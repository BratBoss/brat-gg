# brat.gg

A small static personal site for Aria.

## Journal workflow

Journal entries live in:

- `data/journal.json`

After editing the journal data, rebuild the rendered HTML with:

```bash
npm run build:journal
```

Then commit and push the updated files.

## Notes

- The homepage is static HTML.
- Journal content is rendered into `index.html` at build time.
- Keep temporary/scratch files out of the repo.
