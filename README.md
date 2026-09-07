# Annotex — Obsidian plugin

Publish the note you're editing to your self-hosted [Annotex](../README.md) server
with one command. Invited colleagues open the link, read the rendered note, and
leave inline, anchored comments (with LaTeX). The note's Markdown — including
`$math$` — is rendered on the server and gets the Annotex comment layer + KaTeX.

## What it does

- Adds a command **"Publish current note"** (and a ribbon icon).
- Renders the current note on your server at `https://<your-server>/n/<docId>` and
  copies the share link to your clipboard.
- Gives each note a stable `docId` (stored in frontmatter as `annotex-doc`), so
  renaming the file — or re-publishing after edits — keeps the same comment thread.
- Publishing again updates the published page; comments survive edits (Annotex
  re-anchors them by quoted text).
- **Mirrors annotations back into your vault.** Each published note gets a
  `<note>.annotex.json` file right beside it holding all its highlights and
  comments. It's refreshed automatically whenever you **open** or **publish** the
  note (and on demand via **"Sync annotations to vault"**), so the discussion
  travels, versions, and backs up together with the note. The Annotex server
  stays the live hub colleagues comment against in real time; the sidecar is your
  owned, offline copy of it.

## Install

Once it's in the **Community Plugins** store, install it the normal way: Obsidian →
**Settings → Community plugins → Browse** → search **Annotex** → Install →
Enable. Until then, use one of the manual options below.

### Option A — from the latest release (no build tools needed)

1. Download **`manifest.json`** and **`main.js`** from the
   [latest release](https://github.com/epipolarstudios/annotex-obsidian-plugin/releases/latest).
2. In your vault, create the folder `<vault>/.obsidian/plugins/annotex-publish/`
   and put both files in it. (`.obsidian` is hidden — on macOS press
   **Cmd-Shift-.** in Finder to show hidden folders.)
3. In Obsidian: **Settings → Community plugins → Reload**, then enable
   **Annotex**.

### Option B — via BRAT (auto-updates from this repo)

Install the **BRAT** community plugin, then **Add beta plugin** →
`epipolarstudios/annotex-obsidian-plugin`. BRAT tracks new releases for you.

### Option C — build from source

```
git clone https://github.com/epipolarstudios/annotex-obsidian-plugin
cd annotex-obsidian-plugin
npm install && npm run build      # produces main.js
```

Then copy `manifest.json` + `main.js` into
`<vault>/.obsidian/plugins/annotex-publish/` and reload + enable as in Option A.

> After any manual update, **Settings → Community plugins → Reload** (or toggle the
> plugin off/on) is what picks up the new `main.js`.

## Configure

**Settings → Annotex:**

- **Annotex server URL** — e.g. `https://annotex.example.com`
- **Admin token** — your server's `ADMIN_TOKEN` (from its `.env.production`).
  Publishing uses the admin API, so this token authors on your behalf. It's
  stored locally in the vault's plugin data on this machine; treat it like a
  password and don't sync it to a shared vault.

## Network use & privacy

This plugin makes network requests **only to the Annotex server URL you configure**
— no other remote services, no third parties, and **no analytics or telemetry** of
any kind.

- **On publish** it sends the current note's Markdown to your server
  (`PUT /api/documents/…`), authenticated with your admin token.
- **On open / sync** it fetches that note's annotations from your server
  (`GET /api/annotations/…`) to mirror them into the vault.

Nothing is sent anywhere else. The plugin is a companion to a **self-hosted Annotex
server that you run and control**, and does nothing until you point it at one.

**Required configuration (disclosure):** the plugin needs an Annotex **server URL**
and an **admin token** to function. It only reads/writes files **inside your vault**
(the note it publishes, and a `<note>.annotex.json` mirror beside it) — never outside.

## Use

Open a note → run **"Publish current note"** (Command palette, or the
ribbon icon) → the share link is copied to your clipboard. Send it to an invited
colleague (add them first in the Annotex admin panel). Edit and re-publish any
time; the link and its comments stay.

## Support

If Annotex is useful to you, you can support development:

<a href="https://www.buymeacoffee.com/epipolar_studios" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50" width="210"></a>

## Notes & limits (v0.2)

- The `<note>.annotex.json` sidecar is currently a **one-way mirror** (server →
  vault): it's a durable, versioned copy of the comments, but it isn't yet
  re-imported to rebuild the server from the vault. Keep it in your vault backup;
  automatic restore-on-publish is a planned follow-up.
- Obsidian wikilinks are flattened to their display text (`[[Note|Alias]]` →
  `Alias`); embeds `![[...]]` are dropped. Standard Markdown + `$…$`/`$$…$$` math
  render fully.
- Publishing is admin-authenticated, so anyone who can run this plugin with your
  token can publish. Keep the token private.
- The published note is only viewable by invited Annotex members — it is not public.
