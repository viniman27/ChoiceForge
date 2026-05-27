# Deploying ChoiceForge as a static site

ChoiceForge is a Vite-built SPA. Any static host (or your own server) that can serve compiled files works. The build always lives under `dist/` — never serve the repository root.

## Build

```bash
npm install
npm run build        # → ./dist
```

This emits hashed assets under `dist/assets/` and an `index.html` that references them. Upload the contents of `dist/` to your host.

## Host-agnostic settings

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | repository root |
| Node version | `24.15.0` (from `.nvmrc`) |
| SPA fallback | serve `index.html` for unknown routes |
| Cache headers | hashed `/assets/*` files can be cached for a year (`immutable`); `index.html` should not be cached |

The `public/_redirects` file in the repo provides an SPA fallback for hosts that read it (Netlify, Cloudflare Pages, etc.). For nginx / Apache / S3+CloudFront, write the equivalent rule yourself.

## Things that commonly go wrong

### Blank page

Check the deployed HTML's source. If you see:

```html
<script type="module" src="/src/main.tsx"></script>
```

…then the host is serving the **source** `index.html` rather than the compiled one. The deployed HTML should reference `/assets/<hash>.js`. Likely cause: the build never ran (root directory wrong, build command not configured, or a host-managed config file overrode the project settings).

### Build fails with "Cannot find module 'vite'" on the host

The host built without running `npm install`. Make sure the install + build commands run in sequence: `npm install && npm run build`, or rely on the host's automatic build pipeline.

### Provider-specific config files

If your host honours a config file in the repo (e.g. `wrangler.toml`, `netlify.toml`, `vercel.json`), that file becomes the source of truth and the dashboard settings are ignored. Either keep the config file complete (with `build` + `publish` directories set) or remove it entirely and configure through the dashboard.

## Desktop releases

The desktop release pipeline is separate from web hosting. See [`.github/workflows/desktop-release.yml`](../.github/workflows/desktop-release.yml) — pushing a `v*` tag builds installers for macOS and Windows and attaches them to a draft GitHub Release.
