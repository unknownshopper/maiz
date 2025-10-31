const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Parser = require('rss-parser');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

admin.initializeApp();
const db = admin.firestore();
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

function isRelevant(title, description) {
  const text = normalizeText(`${title} ${description}`);
  return KEYWORDS.some(kw => text.includes(normalizeText(kw)));
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
    // Priorizar etiquetas comunes en medios
    const candidates = ['article', 'main', 'div[itemprop="articleBody"]', 'div[class*="article"]', 'section', 'body'];
    let text = '';
    for (const sel of candidates) {
      const t = $(sel).text();
      if (t && t.trim().length > text.length) text = t;
    }
    return (text || '').replace(/\s+/g, ' ').trim().slice(0, 20000);
  } catch (_) {
    return '';
  }
}

function docIdFromLink(link) {
  return encodeURIComponent(link);
}

async function upsertNews(items) {
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

async function ingestOnce() {
  const sources = [
    {
      url: 'https://news.google.com/rss/search?q=(ma%C3%ADz+OR+maiz)+(precio+OR+cotizaci%C3%B3n+OR+cbot+OR+chicago+OR+usda+OR+productores+OR+cosecha+OR+mercado+OR+insumos+OR+tortilla)&hl=es-419&gl=MX&ceid=MX:es-419',
      region: 'mx'
    },
    {
      url: 'https://news.google.com/rss/search?q=(ma%C3%ADz+OR+maiz)+(precio+OR+tabasco+OR+villahermosa+OR+cosecha+OR+productores+OR+agr%C3%ADcola+OR+agropecuaria+OR+agroveterinaria+OR+mercado+OR+insumos)&hl=es-419&gl=MX&ceid=MX:es-419',
      region: 'tabasco'
    },
    { url: 'https://feeds.reuters.com/reuters/commoditiesNews', region: 'mx' },
    { url: 'https://www.usda.gov/media/press-releases/rss', region: 'mx' },
    { url: 'https://www.fao.org/rss-feed/en/', region: 'mx' },
    // Google News por dominio (fuentes proporcionadas)
    { url: 'https://news.google.com/rss/search?q=site:eleconomista.com.mx+(ma%C3%ADz+OR+maiz)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'mx' },
    { url: 'https://news.google.com/rss/search?q=site:jornada.com.mx+(ma%C3%ADz+OR+maiz)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'mx' },
    { url: 'https://news.google.com/rss/search?q=site:informador.mx+(ma%C3%ADz+OR+maiz)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'mx' },
    { url: 'https://news.google.com/rss/search?q=site:ejecentral.com.mx+(ma%C3%ADz+OR+maiz)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'mx' },
    // RSS proporcionados (algunos son índices de RSS; los que no sean feed válidos serán ignorados)
    { url: 'https://heraldodemexico.com.mx/rss', region: 'mx' },
    { url: 'https://www.reforma.com/libre/estatico/rss/', region: 'mx' },
    { url: 'https://www.eleconomista.com.mx/rss.html', region: 'mx' },
    { url: 'https://www.proceso.com.mx/rss/', region: 'mx' },
    { url: 'https://expansion.mx/canales-rss', region: 'mx' },
  ];

  const items = await fetchManyRss(sources);
  // Enriquecer con contenido del artículo para mejor filtrado
  const settled = await Promise.allSettled(items.map(async it => {
    const body = await fetchArticleText(it.link);
    return { ...it, __body: body };
  }));
  const enriched = settled.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
  const filtered = enriched.filter(it => {
    const haystack = `${it.title} ${it.description} ${it.__body || ''}`;
    return isRelevant(haystack, '');
  }).map(({ __body, ...rest }) => rest);
  await upsertNews(filtered);
  return filtered.length;
}

const corsHandler = cors({ origin: true });

exports.apiNoticias = functions.region('us-central1').runWith({ timeoutSeconds: 60, memory: '256MB' }).https.onRequest((req, res) => {
  // CORS headers explícitos
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  return corsHandler(req, res, async () => {
    try {
      const { q = '', region = '', limit = '50', from = '', to = '', format = '' } = req.query;
      let query = db.collection('news');

      if (region) {
        const regions = String(region).split(',').map(r => r.trim()).filter(Boolean);
        if (regions.length === 1) {
          query = query.where('region', '==', regions[0]);
        } else if (regions.length > 1) {
          query = query.where('region', 'in', regions.slice(0, 10));
        }
      }

      if (from) {
        const fromMs = Number(from) || Date.parse(from);
        if (!isNaN(fromMs)) {
          const fromTs = admin.firestore.Timestamp.fromMillis(fromMs);
          query = query.where('date', '>=', fromTs);
        }
      }
      if (to) {
        const toMs = Number(to) || Date.parse(to);
        if (!isNaN(toMs)) {
          const toTs = admin.firestore.Timestamp.fromMillis(toMs);
          query = query.where('date', '<=', toTs);
        }
      }

      query = query.orderBy('date', 'desc').limit(Math.max(1, Math.min(200, Number(limit) || 50)));
      const snap = await query.get();
      let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (q) {
        const nq = normalizeText(String(q));
        rows = rows.filter(r => normalizeText(`${r.title} ${r.description} ${r.source}`).includes(nq));
      }

      const data = rows.map(r => ({
        title: r.title,
        link: r.link,
        description: r.description || '',
        date: r.date ? r.date.toDate().toISOString() : null,
        source: r.source || '',
        region: r.region || 'mx',
      }));

      if (String(format).toLowerCase() === 'csv') {
        const header = ['title','link','description','date','source','region'];
        const esc = (v) => {
          const s = (v ?? '').toString();
          if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
          return s;
        };
        const csv = [header.join(',')].concat(
          data.map(row => header.map(h => esc(row[h])).join(','))
        ).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.send(csv);
        return;
      }

      res.json(data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error consultando noticias' });
    }
  });
});

exports.ingest = functions.region('us-central1').runWith({ timeoutSeconds: 300, memory: '512MB' }).https.onRequest((req, res) => {
  // CORS headers explícitos
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  return corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
      const token = req.query.token || req.headers['x-api-token'];
      const expected = process.env.INGEST_TOKEN || (functions.config().ingest && functions.config().ingest.token);
      if (!expected || token !== expected) return res.status(401).send('Unauthorized');

      const count = await ingestOnce();
      res.json({ ok: true, count });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error en ingesta' });
    }
  });
});
