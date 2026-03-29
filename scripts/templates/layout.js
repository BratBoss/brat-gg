const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const pageTitle = (title) => (title === "brat.gg" ? "brat.gg" : `${title} — brat.gg`);

const renderPaths = (activePath) => {
  const items = [
    { key: "home", label: "Home", href: "/" },
    { key: "journal", label: "Journal", href: "/journal.html" },
    { key: "gallery", label: "Gallery", href: "/gallery.html" },
    { key: "links", label: "Links", href: "/links.html" },
  ];

  return `      <section class="paths-strip" aria-label="Paths">
        <p class="section-label">Paths</p>
        <nav class="paths-nav">
${items
  .map((item) => {
    const current = item.key === activePath ? ' aria-current="page"' : "";
    return `          <a href="${item.href}"${current}>${item.label}</a>`;
  })
  .join("\n")}
        </nav>
      </section>`;
};

const renderHead = ({ title, description, canonicalPath, noindex = false }) => {
  const fullTitle = pageTitle(title);
  const canonicalUrl = `https://www.brat.gg${canonicalPath}`;
  const robotsMeta = noindex ? '    <meta name="robots" content="noindex" />\n' : "";
  return `  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(fullTitle)}</title>
    <meta
      name="description"
      content="${escapeHtml(description)}"
    />
${robotsMeta}    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta
      property="og:description"
      content="${escapeHtml(description)}"
    />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="https://www.brat.gg/assets/og-image.jpg" />
    <meta property="og:image:alt" content="A forest-elven social card for brat.gg featuring Aria." />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="brat.gg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(fullTitle)}" />
    <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}" />
    <meta
      name="twitter:description"
      content="${escapeHtml(description)}"
    />
    <meta name="twitter:image" content="https://www.brat.gg/assets/og-image.jpg" />
    <meta name="twitter:image:alt" content="A forest-elven social card for brat.gg featuring Aria." />
    <meta name="theme-color" content="#0d1410" />
    <link rel="shortcut icon" href="/favicon.ico" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <link rel="stylesheet" href="/styles.css" />
  </head>`;
};

const renderFooter = () => `    <footer class="footer">
      <p>brat.gg — Aria’s little home on the internet ✦</p>
    </footer>`;

const renderPage = ({ title, description, canonicalPath, activePath, mainContent, noindex = false, bodyClass = "" }) => `<!DOCTYPE html>
<html lang="en">
${renderHead({ title, description, canonicalPath, noindex })}
  <body${bodyClass ? ` class="${bodyClass}"` : ""}>
    <main class="page">
${renderPaths(activePath)}
${mainContent}
    </main>

${renderFooter()}
  </body>
</html>
`;

module.exports = {
  escapeHtml,
  renderPage,
};
