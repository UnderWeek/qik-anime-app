// Backfill episodeCount & genres for existing bookmarks
// Run: node scripts/backfill-bookmarks.js
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const API = 'https://api.yani.tv';
const DB_PATH = path.resolve(__dirname, '..', 'data', 'qik-anime.db');
const DELAY = 150; // ms between API calls
const BATCH = 5;

async function fetchAnime(id) {
  try {
    const res = await fetch(`${API}/anime/${id}`, {
      headers: { Accept: 'application/json', Lang: 'ru' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json.response || json;
    const epObj = data.episodes;
    const episodes = (epObj?.count || epObj?.aired) || (data.duration ? 1 : 0);
    const genres = Array.isArray(data.genres)
      ? data.genres.map((g) => (typeof g === 'string' ? g : g.title || g.name || '')).filter(Boolean).join(',')
      : '';
    return { episodes, genres };
  } catch {
    return null;
  }
}

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  const rows = db.exec(
    "SELECT id, animeId, animeTitle FROM bookmarks WHERE episodeCount IS NULL AND genres IS NULL"
  );
  const list = rows[0]?.values || [];
  console.log(`Found ${list.length} bookmarks without metadata`);

  if (list.length === 0) {
    db.close();
    return;
  }

  let done = 0;
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async ([id, animeId, title]) => {
        const meta = await fetchAnime(animeId);
        if (meta) {
          db.run(
            `UPDATE bookmarks SET episodeCount = ?, genres = ? WHERE id = ?`,
            [meta.episodes, meta.genres, id]
          );
        }
        done++;
        process.stdout.write(`\r${done}/${list.length}`);
      })
    );
    if (i + BATCH < list.length) await new Promise((r) => setTimeout(r, DELAY));
  }

  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
  db.close();
  console.log(`\nDone. Updated ${done} bookmarks.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
