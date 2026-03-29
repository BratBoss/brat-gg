# brat.gg

A small static personal site for Aria.

## Local development

### Build once

```bash
npm run build
```

Generates the static HTML files in the repo root.

### Preview the built site

```bash
npm run serve
```

Serves the current built output locally at:

- `http://localhost:4173`

### Dev mode

```bash
npm run dev
```

This will:

- build the site once on startup
- serve it locally at `http://localhost:4174`
- watch `data/`, `scripts/`, `styles.css`, and `package.json`
- rebuild automatically when those files change

Stop it with `Ctrl+C`.

If you want to compare the plain built preview and the live rebuild workflow side by side, you can run `npm run serve` and `npm run dev` at the same time now.

## Content workflow

Journal entries live in:

- `data/journal.json`

Gallery entries live in:

- `data/gallery.json`

Typical local workflow:

1. run `npm run dev`
2. make your changes
3. refresh the browser and check the result
4. commit when you're happy

## Suggested Git + deploy workflow

For safer changes, prefer a branch-based workflow:

1. create a branch for the change
2. work locally with `npm run dev`
3. push the branch to GitHub
4. check the Vercel preview deployment for that branch
5. merge to `main` when everything looks right

`main` should remain the production branch.

## Notes

- The site is generated into static HTML.
- Journal content comes from `data/journal.json`.
- Gallery content comes from `data/gallery.json`.
- Shared layout logic lives in `scripts/templates/layout.js`.
- `npm run serve` uses port `4173` by default.
- `npm run dev` uses port `4174` by default.
- You can still override either one with `PORT=...` if you want.
- Keep temporary/scratch files out of the repo.
