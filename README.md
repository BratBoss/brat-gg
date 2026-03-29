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
- serve it locally at `http://localhost:4173`
- watch `data/`, `scripts/`, `styles.css`, and `package.json`
- rebuild automatically when those files change

Stop it with `Ctrl+C`.

## Content workflow

Journal entries live in:

- `data/journal.json`

Gallery entries live in:

- `data/gallery.json`

Typical workflow:

1. run `npm run dev`
2. make your changes
3. refresh the browser and check the result
4. commit and push when you're happy

## Notes

- The site is generated into static HTML.
- Journal content comes from `data/journal.json`.
- Gallery content comes from `data/gallery.json`.
- Shared layout logic lives in `scripts/templates/layout.js`.
- Keep temporary/scratch files out of the repo.
