#!/usr/bin/env node

// Ingest news from sources and store in Firestore using a service account
// Usage: node scripts/ingest.js

const admin = require('firebase-admin');
const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');

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

const parser = new Parser({ timeout: 20000 });

const KEYWORDS = [
  'maíz', 'maiz', 'maíz blanco', 'maiz blanco', 'precio', 'cotización', 'futuros', 'chicago', 'cbot', 'usda', 'bushel', 'grano', 'granos',
  'méxico', 'mexico', 'tabasco', 'villahermosa', 'sagarpa', 'sader', 'sniim',
  'agrícola', 'agricola', 'agropecuaria', 'agroveterinaria', 'productores', 'cosecha', 'mercado', 'insumos', 'tortilla',
  'ganado', 'engorda'
];

function normalizeText(t) {
  return (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function isRelevant(text) {
  const normalized = normalizeText(text);
  return KEYWORDS.some(kw => normalized.includes(normalizeText(kw)));
}

async function fetchRss(url, extra = {}) {
  const feed = await parser.parseURL(url);
  const source = feed.title || new URL(url).hostname;
  return (feed.items || []).map(it => ({
    title: (it.title || '').trim(),
    link: (it.link || '').trim(),
    description: (it.contentSnippet || it.content || it.summary || '').toString().trim(),
    date: it.isoDate ? new Date(it.isoDate).getTime() : (it.pubDate ? new Date(it.pubDate).getTime() : null),
    source,
    region: extra.region || 'mx',
  })).filter(x => x.link);
}

async function fetchManyRss(sources) {
  const settled = await Promise.allSettled(sources.map(async s => {
    const items = await fetchRss(s.url, { region: s.region });
    return items;
  }));
  return settled.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

async function fetchArticleText(url) {
  try {
    const resp = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'
      }
    });
    const $ = cheerio.load(resp.data);
    const candidates = ['article', 'main', 'div[itemprop="articleBody"]', 'div[class*="article"]', 'section', 'body'];
    let text = '';
    for (const sel of candidates) {
      const t = $(sel).text();
      if (t && t.trim().length > text.length) text = t;
    }
    return (text || '').replace(/\s+/g, ' ').trim().slice(0, 20000);
  } catch (e) {
    return '';
  }
}

function docIdFromLink(link) {
  return encodeURIComponent(link);
}

async function upsertNews(db, items) {
  const batch = db.batch();
  const col = db.collection('news');
  for (const it of items) {
    const id = docIdFromLink(it.link);
    const ref = col.doc(id);
    batch.set(ref, {
      title: it.title,
      link: it.link,
      description: it.description || '',
      date: it.date ? admin.firestore.Timestamp.fromMillis(it.date) : null,
      source: it.source || '',
      region: it.region || 'mx',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

async function main() {
  const db = initFirestore();
  const sources = [
    { url: 'https://news.google.com/rss/search?q=(ma%C3%ADz+OR+maiz)+(precio+OR+cotizaci%C3%B3n+OR+cbot+OR+chicago+OR+usda+OR+productores+OR+cosecha+OR+mercado+OR+insumos+OR+tortilla)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'mx' },
    { url: 'https://news.google.com/rss/search?q=(ma%C3%ADz+OR+maiz)+(precio+OR+tabasco+OR+villahermosa+OR+cosecha+OR+productores+OR+agr%C3%ADcola+OR+agropecuaria+OR+agroveterinaria+OR+mercado+OR+insumos)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'tabasco' },
    { url: 'https://feeds.reuters.com/reuters/commoditiesNews', region: 'mx' },
    { url: 'https://www.usda.gov/media/press-releases/rss', region: 'mx' },
    { url: 'https://www.fao.org/rss-feed/en/', region: 'mx' },
    { url: 'https://news.google.com/rss/search?q=site:eleconomista.com.mx+(ma%C3%ADz+OR+maiz)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'mx' },
    { url: 'https://news.google.com/rss/search?q=site:jornada.com.mx+(ma%C3%ADz+OR+maiz)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'mx' },
    { url: 'https://news.google.com/rss/search?q=site:informador.mx+(ma%C3%ADz+OR+maiz)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'mx' },
    { url: 'https://news.google.com/rss/search?q=site:ejecentral.com.mx+(ma%C3%ADz+OR+maiz)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'mx' },
    // Provided RSS links (may include index pages; non-feed responses will be skipped by parser)
    { url: 'https://heraldodemexico.com.mx/rss', region: 'mx' },
    { url: 'https://www.reforma.com/libre/estatico/rss/', region: 'mx' },
    { url: 'https://www.eleconomista.com.mx/rss.html', region: 'mx' },
    { url: 'https://www.proceso.com.mx/rss/', region: 'mx' },
    { url: 'https://expansion.mx/canales-rss', region: 'mx' },
  ];

  const items = await fetchManyRss(sources);
  const settled = await Promise.allSettled(items.map(async it => {
    const body = await fetchArticleText(it.link);
    return { ...it, __body: body };
  }));
  const enriched = settled.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
  const filtered = enriched.filter(it => isRelevant(`${it.title} ${it.description} ${it.__body || ''}`))
    .map(({ __body, ...rest }) => rest);

  await upsertNews(db, filtered);
  console.log(JSON.stringify({ ok: true, inserted: filtered.length }));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
