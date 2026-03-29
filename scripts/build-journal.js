const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "data", "journal.json");
const indexPath = path.join(root, "index.html");
const journalPath = path.join(root, "journal.html");

const INDEX_START = "<!-- JOURNAL_LATEST:START -->";
const INDEX_END = "<!-- JOURNAL_LATEST:END -->";
const JOURNAL_START = "<!-- JOURNAL_ARCHIVE:START -->";
const JOURNAL_END = "<!-- JOURNAL_ARCHIVE:END -->";

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const entries = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const indexHtml = fs.readFileSync(indexPath, "utf8");
const journalHtml = fs.readFileSync(journalPath, "utf8");

const renderEntry = (entry) => `          <article class="entry">
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
          </article>`;

const latestEntry = entries[0] ? renderEntry(entries[0]) : '          <p class="journal-fallback">Nothing here just yet.</p>';
const archiveEntries = entries.length
  ? entries.map(renderEntry).join("\n\n")
  : '          <p class="journal-fallback">Nothing here just yet.</p>';

const indexReplacement = `${INDEX_START}\n${latestEntry}\n        ${INDEX_END}`;
const journalReplacement = `${JOURNAL_START}\n${archiveEntries}\n        ${JOURNAL_END}`;

if (!indexHtml.includes(INDEX_START) || !indexHtml.includes(INDEX_END)) {
  throw new Error("Journal markers not found in index.html");
}

if (!journalHtml.includes(JOURNAL_START) || !journalHtml.includes(JOURNAL_END)) {
  throw new Error("Journal markers not found in journal.html");
}

const updatedIndex = indexHtml.replace(new RegExp(`${INDEX_START}[\\s\\S]*?${INDEX_END}`), indexReplacement);
const updatedJournal = journalHtml.replace(new RegExp(`${JOURNAL_START}[\\s\\S]*?${JOURNAL_END}`), journalReplacement);
fs.writeFileSync(indexPath, updatedIndex);
fs.writeFileSync(journalPath, updatedJournal);
console.log("Journal rendered into index.html and journal.html");
