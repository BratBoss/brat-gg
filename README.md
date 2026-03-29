# brat.gg

A small static personal site for Aria.

## Journal workflow

Journal entries live in:

- `data/journal.json`

After editing site data, rebuild the rendered HTML with:

```bash
npm run build
```

Then commit and push the updated files.

## Notes

- The site is generated into static HTML.
- Journal content comes from `data/journal.json`.
- Gallery content comes from `data/gallery.json`.
- Keep temporary/scratch files out of the repo.
