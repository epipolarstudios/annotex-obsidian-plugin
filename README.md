# Annotex Publish — Obsidian plugin

Publish the note you're editing to your self-hosted [Annotex](../README.md) server
with one command. Invited colleagues open the link, read the rendered note, and
leave inline, anchored comments (with LaTeX). The note's Markdown — including
`$math$` — is rendered on the server and gets the Annotex comment layer + KaTeX.

## What it does

- Adds a command **"Publish current note to Annotex"** (and a ribbon icon).
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

## Install (manual, until it's in the community store)

A plugin is just two files in your vault: `manifest.json` and `main.js`, placed
in `<vault>/.obsidian/plugins/annotex-publish/`. Pick whichever path fits the
machine.

### A. On a machine with the repo + Node (build & install in one step)

```
cd obsidian-plugin
./install-local.sh "/path/to/your/vault"
```

That runs `npm install`, builds `main.js`, and copies `manifest.json` + `main.js`
into the vault's plugin folder. (The vault is the folder that contains a
`.obsidian` directory.)

### B. On a machine with no build tools (e.g. your Mac)

You don't need Node or the repo there — just copy the two prebuilt files:

1. Grab `manifest.json` and `main.js` — either from a built `obsidian-plugin/`
   (run `npm run build` once on any machine) or from the release zip.
2. Make the folder `<vault>/.obsidian/plugins/annotex-publish/` and drop both
   files in. (`.obsidian` is hidden — in Finder press **Cmd-Shift-.** to show it,
   or use **Go → Go to Folder**.)

> Copying between machines over SSH, e.g. onto a Mac from this server:
> ```
> scp <server>:~/projects/obsidian_inline_commentor/obsidian-plugin/{manifest.json,main.js} \
>   "~/Documents/<Your Vault>/.obsidian/plugins/annotex-publish/"
> ```

### Then, in Obsidian (either path)

**Settings → Community plugins → Reload** (toggle it off/on if it was already
enabled), then enable **Annotex Publish**. After an update, reloading is what
picks up the new `main.js`.

## Configure

**Settings → Annotex Publish:**

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

Open a note → run **"Publish current note to Annotex"** (Command palette, or the
ribbon icon) → the share link is copied to your clipboard. Send it to an invited
colleague (add them first in the Annotex admin panel). Edit and re-publish any
time; the link and its comments stay.

## Support

If Annotex Publish is useful to you, you can support development:

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
