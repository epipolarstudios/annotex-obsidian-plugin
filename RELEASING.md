# Releasing Annotex Publish to the Obsidian community store

The community store installs a plugin from a **dedicated public GitHub repo** and
its **GitHub Releases** — not from this monorepo. So the plugin has two homes:

- **`obsidian-plugin/` (here, in the private app repo)** — the dev source of truth.
- **`annotex-publish` (a standalone *public* repo)** — the submission mirror.
  Generated from here with `./sync-release.sh`; don't hand-edit it.

> GitHub visibility is per-*repo*, not per-branch: making a repo public exposes
> every branch and all history. Keeping the plugin in its own repo is what lets it
> be public without exposing the app/server/deploy configs.

## What the store needs (in the public repo)

| File | Why |
|---|---|
| `manifest.json` | id, name, version, minAppVersion, description, author, isDesktopOnly — all present |
| `main.js` | the built plugin — **not committed**; the release CI builds it and attaches it to the Release |
| `versions.json` | maps each plugin version → minAppVersion |
| `README.md`, `LICENSE` | required |
| source to build (`main.ts`, `esbuild.config.mjs`, `tsconfig.json`, `package.json`, `package-lock.json`) | so CI can build `main.js` |
| `.github/workflows/release.yml` | on a version tag, builds `main.js` and creates the Release with `main.js` + `manifest.json` as assets |

A **GitHub Release whose tag exactly equals `manifest.json` "version"** (e.g.
`0.2.0`, no leading `v`), with `main.js` and `manifest.json` attached as individual
assets. The release.yml here does that automatically.

## What is NOT needed (keep out of the public repo)

- `node_modules/` (gitignored) and `main.js` (built by CI, gitignored).
- The whole server app — `server.js`, `store.js`, `public/`, `data/`, `test/`,
  `scripts/`, `dev_logs/`, `OPERATING.md`, `SELF_HOSTING.md`. None of it ships with
  the plugin.
- `install-local.sh` / `sync-release.sh` — dev helpers; excluded by the sync.
- Any secrets — there are none in the plugin (the `ADMIN_TOKEN` is entered by the
  user in plugin settings and stored locally in their vault, never in the repo).

## Steps to publish this version (v0.2.0)

1. **Build + verify locally:** `npm install && npm run build` (produces `main.js`);
   `npx tsc --noEmit -p tsconfig.json` should be clean.
2. **Sync to the public repo:** `./sync-release.sh` (default `~/projects/annotex-publish`).
3. **Create the public GitHub repo** (once) e.g. `epipolarstudios/annotex-obsidian-plugin`,
   add it as the remote, and push `main`.
4. **Tag the release:** `git tag 0.2.0 && git push origin 0.2.0` — the workflow
   builds and publishes the Release with the assets. Confirm the Release shows
   `main.js` + `manifest.json`.
5. **Submit to the store (first time only):** open a PR on
   [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases)
   adding an entry to `community-plugins.json`:
   ```json
   {
     "id": "annotex-publish",
     "name": "Annotex Publish",
     "author": "Epipolar Studios",
     "description": "Publish the current note to your self-hosted Annotex server so invited colleagues can leave inline, anchored comments.",
     "repo": "epipolarstudios/annotex-obsidian-plugin"
   }
   ```
   A review bot + a maintainer check the repo against the
   [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
   For **updates** after acceptance, you only repeat steps 2 + 4 (bump the version
   in `manifest.json`/`versions.json` first) — no new PR.

## Likely reviewer notes for this plugin

- It makes network requests to a **user-configured** server with a token the user
  supplies — legitimate for a self-hosted tool; the README explains it. Uses
  Obsidian's `requestUrl` (not `fetch`), which reviewers prefer.
- Desktop + mobile both fine (`isDesktopOnly: false`); no Node/Electron-only APIs.
