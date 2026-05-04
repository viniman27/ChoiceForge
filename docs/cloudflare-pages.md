# Cloudflare Pages deploy

ChoiceForge is a Vite app. Cloudflare Pages must publish the compiled `dist`
directory, not the repository root.

Use these settings in Cloudflare Pages:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root
- Node version: `24.15.0`

If the deployed page is blank, check whether the deployed HTML contains:

```html
<script type="module" src="/src/main.tsx"></script>
```

That means Cloudflare is serving the source `index.html` directly. The deployed
HTML should instead point to compiled assets under `/assets/`.
