# Cloudflare Pages deploy

ChoiceForge is a Vite app. Cloudflare Pages must publish the compiled `dist`
directory, not the repository root.

Use these settings in Cloudflare Pages:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root
- Node version: `24.15.0`

Do not add a `wrangler.toml` for this static Git deployment unless the Pages
project configuration is intentionally managed through Wrangler. When Cloudflare
detects `wrangler.toml`, that file becomes the source of truth for Pages config;
if no build command is configured in the project, Cloudflare will skip the Vite
build and then fail because `dist` does not exist in the repository.

If the deployed page is blank, check whether the deployed HTML contains:

```html
<script type="module" src="/src/main.tsx"></script>
```

That means Cloudflare is serving the source `index.html` directly. The deployed
HTML should instead point to compiled assets under `/assets/`.
