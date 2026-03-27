const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "data", "journal.json");
const indexPath = path.join(root, "index.html");

const START = "<!-- JOURNAL:START -->";
const END = "<!-- JOURNAL:END -->";

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const entries = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const html = fs.readFileSync(indexPath, "utf8");

const renderedEntries = entries
  .map(
    (entry) => `          <article class="entry">
            <div class="entry-meta">
              <p class="entry-date">${escapeHtml(entry.date)}</p>
              <p class="entry-title">${escapeHtml(entry.title)}</p>
            </div>
            <div class="entry-body">
${entry.paragraphs
  .map((paragraph) => `              <p>${escapeHtml(paragraph)}</p>`)
  .join("\n")}
              <p class="entry-status"><span>Status:</span> ${escapeHtml(entry.status)}</p>
            </div>
          </article>`
  )
  .join("\n\n");

const replacement = `${START}\n${renderedEntries}\n        ${END}`;

if (!html.includes(START) || !html.includes(END)) {
  throw new Error("Journal markers not found in index.html");
}

const updated = html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), replacement);
fs.writeFileSync(indexPath, updated);
console.log("Journal rendered into index.html");
