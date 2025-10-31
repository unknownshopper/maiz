#!/usr/bin/env node

// Export latest 24h news from Firestore into JSON and save to exports/news-YYYY-MM-DD.json
// Usage: node scripts/export-json.js

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is missing');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }
}

function initFirestore() {
  const sa = getServiceAccount();
  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  return admin.firestore();
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function queryLast24h(db) {
  const to = admin.firestore.Timestamp.now();
  const from = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
  const snap = await db.collection('news')
    .where('date', '>=', from)
    .where('date', '<=', to)
    .orderBy('date', 'desc')
    .limit(1000)
    .get();
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return rows.map(r => ({
    title: String(r.title || ''),
    link: r.link || '',
    description: String(r.description || ''),
    date: r.date && r.date.toDate ? r.date.toDate().toISOString() : null,
    source: r.source || '',
    region: r.region || 'mx',
  }));
}

(async function main() {
  try {
    const db = initFirestore();
    const items = await queryLast24h(db);
    const outDir = path.join(process.cwd(), 'exports');
    ensureDir(outDir);
    const yyyy = new Date().toISOString().slice(0,10);
    const outPath = path.join(outDir, `news-${yyyy}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ date: yyyy, count: items.length, items }, null, 2), 'utf8');
    console.log(JSON.stringify({ ok: true, path: outPath, count: items.length }));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
