#!/usr/bin/env node

// Export latest 24h news from Firestore into a styled PDF.
// Usage: node scripts/export-pdf.js

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const PDFDocument = require('pdfkit');

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

function normalizeText(t) {
  return (t || '')
    .toString()
    .replace(/\s+/g, ' ')
    .trim();
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
    title: normalizeText(r.title || ''),
    link: r.link || '',
    description: normalizeText(r.description || ''),
    date: r.date && r.date.toDate ? r.date.toDate() : null,
    source: r.source || '',
    region: r.region || 'mx',
  }));
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function formatDate(d) {
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    return d.toISOString();
  }
}

async function makePdf(items) {
  ensureDir(path.join(process.cwd(), 'exports'));
  const yyyy = new Date().toISOString().slice(0,10);
  const outPath = path.join(process.cwd(), 'exports', `news-${yyyy}.pdf`);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  // Header with logo
  const logoPath = path.join(process.cwd(), 'logotus.png');
  const headerY = doc.y;
  let headerHeight = 0;
  try {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.margins.left, headerY, { width: 120 });
      headerHeight = 50;
    }
  } catch {}
  const titleX = doc.page.margins.left + (headerHeight ? 130 : 0);
  const titleY = headerY;
  doc.fillColor('#111827').fontSize(18).text('Reporte Diario de Noticias de Maíz', titleX, titleY, { continued: false });
  doc.moveDown(0.2);
  doc.fillColor('#374151').fontSize(11).text('The Unknown Shopper', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#6b7280').text(`Generado: ${formatDate(new Date())} • Total: ${items.length}`, { align: 'left' });
  doc.moveDown(0.6);
  // Divider
  doc.strokeColor('#d1d5db').moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.6);

  // Table-like rows
  let i = 0;
  for (const it of items) {
    i += 1;
    // Index + title
    doc.fillColor('#6b7280').fontSize(10).text(`${i}.`, { continued: true });
    doc.fillColor('#111827').fontSize(12).text(it.title, { underline: false });
    const meta = [it.source || '', it.date ? formatDate(it.date) : ''].filter(Boolean).join(' • ');
    if (meta) doc.fillColor('#6b7280').fontSize(10).text(meta);
    if (it.link) {
      doc.fillColor('#2563eb').fontSize(10).text(it.link, { link: it.link, underline: false });
    }
    doc.moveDown(0.6);
    // Divider
    doc.strokeColor('#e5e7eb').moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.6);
  }

  doc.end();
  await new Promise((res, rej) => {
    stream.on('finish', res);
    stream.on('error', rej);
  });
  return outPath;
}

(async function main() {
  try {
    const db = initFirestore();
    const items = await queryLast24h(db);
    const out = await makePdf(items);
    console.log(JSON.stringify({ ok: true, path: out, count: items.length }));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
