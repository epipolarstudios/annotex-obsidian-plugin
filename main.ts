import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, requestUrl } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';

interface AnnotexSettings {
  serverUrl: string;   // e.g. https://annotex.example.com
  adminToken: string;  // a publish token (preferred) or the master ADMIN_TOKEN; sent as x-admin-token
}
const DEFAULT_SETTINGS: AnnotexSettings = { serverUrl: '', adminToken: '' };

// docId must match the server's ID charset ([A-Za-z0-9_-], 1..100).
function slugify(s: string): string {
  const out = s.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
  return out || 'note-' + Math.random().toString(36).slice(2, 8);
}

// Strip a leading YAML frontmatter block so it isn't published as body text.
function stripFrontmatter(md: string): string {
  const m = md.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return m ? md.slice(m[0].length) : md;
}

// Best-effort: render Obsidian wikilinks as their display text (the published
// page is plain Markdown, so [[Note|Alias]] -> Alias, [[Note]] -> Note).
function cleanWikilinks(md: string): string {
  return md
    .replace(/!\[\[[^\]]+\]\]/g, '')                       // drop embeds
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')          // [[X|Y]] -> Y
    .replace(/\[\[([^\]]+)\]\]/g, '$1');                    // [[X]] -> X
}

// Readable message from an unknown thrown value (avoids `any` in catch blocks).
function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export default class AnnotexPublishPlugin extends Plugin {
  settings: AnnotexSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: 'publish-to-annotex',
      name: 'Publish current note',
      callback: () => this.publishActive(),
    });
    this.addCommand({
      id: 'sync-annotations-to-vault',
      name: 'Sync annotations to vault',
      callback: () => this.syncActive(true),
    });
    this.addRibbonIcon('messages-square', 'Publish to Annotex', () => this.publishActive());

    // Mirror a published note's annotations into the vault whenever it's opened,
    // so the comments travel/version/back up with the note (best-effort, silent).
    this.registerEvent(this.app.workspace.on('file-open', (file) => {
      if (file && file.extension === 'md') this.syncFile(file, false).catch(() => {});
    }));

    this.addSettingTab(new AnnotexSettingTab(this.app, this));
  }

  async publishActive() {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') { new Notice('Open a Markdown note first.'); return; }

    const base = this.settings.serverUrl.replace(/\/+$/, '');
    if (!base || !this.settings.adminToken) {
      new Notice('Set your Annotex server URL and publish token in Settings → Annotex.');
      return;
    }

    // Resolve a stable docId: reuse the note's `annotex-doc` frontmatter, or mint
    // one from the filename and persist it so renames don't detach comments.
    let docId = this.frontmatterValue(file, 'annotex-doc');
    if (!docId) {
      docId = slugify(file.basename);
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => { fm['annotex-doc'] = docId; });
    }
    const title = this.frontmatterValue(file, 'title') || file.basename;
    const raw = await this.app.vault.read(file);
    const markdown = cleanWikilinks(stripFrontmatter(raw));

    new Notice(`Publishing “${title}”…`);
    try {
      const resp = await requestUrl({
        url: `${base}/api/documents/${encodeURIComponent(docId)}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': this.settings.adminToken },
        body: JSON.stringify({ title, markdown }),
        throw: false,
      });
      const body = resp.json as { error?: string; url?: string } | undefined;
      if (resp.status < 200 || resp.status >= 300) {
        new Notice(`Publish failed: ${body?.error || `HTTP ${resp.status}`}`, 8000);
        return;
      }
      const url = body?.url || `${base}/n/${encodeURIComponent(docId)}`;
      try { await navigator.clipboard.writeText(url); } catch { /* clipboard may be unavailable */ }
      new Notice(`Published ✓  Link copied to clipboard:\n${url}`, 10000);
      // Pull any existing comments down beside the note right away.
      await this.syncToVault(file, docId, false).catch(() => {});
    } catch (e) {
      new Notice(`Publish failed: ${errMessage(e)}`, 8000);
    }
  }

  // Where a note's annotations mirror lives: right beside the note, e.g.
  // "Folder/My Note.md" -> "Folder/My Note.annotex.json".
  sidecarPath(file: TFile): string {
    return file.path.replace(/\.md$/i, '') + '.annotex.json';
  }

  // Sync the active note (used by the manual command).
  async syncActive(notice: boolean) {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') { if (notice) new Notice('Open a Markdown note first.'); return; }
    await this.syncFile(file, notice);
  }

  // Sync a note if it's published (has an annotex-doc id) and the plugin is
  // configured. Silent no-op otherwise, so it's safe to call on every file-open.
  async syncFile(file: TFile, notice: boolean) {
    const docId = this.frontmatterValue(file, 'annotex-doc');
    const base = this.settings.serverUrl.replace(/\/+$/, '');
    if (!docId || !base || !this.settings.adminToken) {
      if (notice) new Notice('This note isn’t published to Annotex yet.');
      return;
    }
    await this.syncToVault(file, docId, notice);
  }

  // Fetch the note's annotations from the server and write them into the vault
  // beside the note — but only when they actually changed, so opening a note
  // doesn't churn the file (and your vault sync) on every view.
  async syncToVault(file: TFile, docId: string, notice: boolean) {
    const base = this.settings.serverUrl.replace(/\/+$/, '');
    const path = this.sidecarPath(file);
    try {
      const resp = await requestUrl({
        url: `${base}/api/annotations/${encodeURIComponent(docId)}`,
        method: 'GET',
        headers: { 'x-admin-token': this.settings.adminToken },
        throw: false,
      });
      if (resp.status < 200 || resp.status >= 300) {
        if (notice) new Notice(`Sync failed: HTTP ${resp.status}`, 6000);
        return;
      }
      const annotations: unknown[] = Array.isArray(resp.json) ? (resp.json as unknown[]) : [];
      const adapter = this.app.vault.adapter;

      // Skip the write when the annotation payload is unchanged (ignore our own
      // volatile metadata like syncedAt when comparing).
      let prev: { annotations?: unknown } | null = null;
      if (await adapter.exists(path)) {
        try { prev = JSON.parse(await adapter.read(path)) as { annotations?: unknown }; } catch { /* rewrite a corrupt sidecar */ }
      }
      const same = prev && JSON.stringify(prev.annotations ?? null) === JSON.stringify(annotations);
      if (same) { if (notice) new Notice(`Annotations already up to date (${annotations.length}).`); return; }

      const sidecar = {
        annotex: 1,
        docId,
        note: file.path,
        server: base,
        url: `${base}/n/${encodeURIComponent(docId)}`,
        syncedAt: new Date().toISOString(),
        annotations,
      };
      await adapter.write(path, JSON.stringify(sidecar, null, 2));
      if (notice) new Notice(`Synced ${annotations.length} annotation(s) to ${path}`, 6000);
    } catch (e) {
      if (notice) new Notice(`Sync failed: ${errMessage(e)}`, 6000);
    }
  }

  frontmatterValue(file: TFile, key: string): string | undefined {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const v: unknown = fm?.[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  }

  async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AnnotexSettings>); }
  async saveSettings() { await this.saveData(this.settings); }
}

class AnnotexSettingTab extends PluginSettingTab {
  plugin: AnnotexPublishPlugin;
  constructor(app: App, plugin: AnnotexPublishPlugin) { super(app, plugin); this.plugin = plugin; }

  // Declarative settings (Obsidian 1.13+) so entries show up in settings search.
  // `serverUrl` binds automatically to this.plugin.settings via the default
  // getControlValue/setControlValue; the token uses a render callback so its
  // input can be masked (the declarative text control can't mask input).
  getSettingDefinitions(): SettingDefinitionItem[] {
    const tokenDesc = "Generate one in your Annotex server's admin panel (/admin → Publish tokens → Generate) and paste it here. It authorises publishing only — safer than your admin token. The plugin keeps it in this vault's data on this device (only ever sent to your server). Treat it like a password.";
    return [
      {
        name: 'Annotex server URL',
        desc: 'The base URL of your Annotex instance, e.g. https://annotex.example.com',
        control: { type: 'text', key: 'serverUrl', placeholder: 'https://annotex.example.com' },
      },
      {
        name: 'Publish token',
        desc: tokenDesc,
        aliases: ['admin token'],
        render: (setting: Setting) => {
          setting.setName('Publish token').setDesc(tokenDesc).addText((t) => {
            t.setPlaceholder('paste a publish token')
              .setValue(this.plugin.settings.adminToken)
              .onChange(async (v) => { this.plugin.settings.adminToken = v; await this.plugin.saveSettings(); });
            t.inputEl.type = 'password';
          });
        },
      },
    ];
  }
}
