import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const dataDir = path.join(process.cwd(), 'server', 'data');
const dbPath = path.join(dataDir, 'news.db');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  description TEXT,
  date INTEGER,
  source TEXT,
  region TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(link)
);
CREATE INDEX IF NOT EXISTS idx_news_date ON news(date DESC);
CREATE INDEX IF NOT EXISTS idx_news_region ON news(region);
CREATE INDEX IF NOT EXISTS idx_news_source ON news(source);
`);

const insertStmt = db.prepare(`
INSERT OR IGNORE INTO news (title, link, description, date, source, region)
VALUES (@title, @link, @description, @date, @source, @region)
`);

export function upsertNews(items) {
  const tx = db.transaction((rows) => {
    for (const row of rows) insertStmt.run(row);
  });
  tx(items);
}

export function queryNews({ q = '', region = '', limit = 50 } = {}) {
  let sql = 'SELECT title, link, description, date, source, region FROM news';
  const where = [];
  const params = {};

  if (q) {
    where.push('(title LIKE @q OR description LIKE @q OR source LIKE @q)');
    params.q = `%${q}%`;
  }
  if (region) {
    const regions = region.split(',').map(r => r.trim()).filter(Boolean);
    if (regions.length) {
      where.push(`region IN (${regions.map((_, i) => `@r${i}`).join(',')})`);
      regions.forEach((r, i) => { params[`r${i}`] = r; });
    }
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY date DESC NULLS LAST, rowid DESC LIMIT @limit';
  params.limit = Math.max(1, Math.min(200, Number(limit) || 50));

  return db.prepare(sql).all(params).map(r => ({
    ...r,
    date: r.date ? new Date(r.date) : null,
  }));
}

export default db;
