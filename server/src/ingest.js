import { fetchManyRss } from './scrapers/rss.js';
import { upsertNews } from './db.js';

const KEYWORDS = [
  'maíz', 'maiz', 'precio', 'cotización', 'futuros', 'chicago', 'cbot', 'usda', 'bushel', 'grano', 'granos',
  'tabasco', 'villahermosa', 'sagarpa', 'sader', 'sniim',
  'agrícola', 'agricola', 'agropecuaria', 'agroveterinaria', 'productores', 'cosecha', 'mercado', 'insumos', 'tortilla'
];

function normalizeText(t) {
  return (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function isRelevant(title, description) {
  const text = normalizeText(`${String(title || '').replace(/<[^>]+>/g, ' ')} ${String(description || '').replace(/<[^>]+>/g, ' ')}`);
  return KEYWORDS.some(kw => text.includes(normalizeText(kw)));
}

export async function ingestOnce() {
  const sources = [
    // Google News MX general
    {
      url: 'https://news.google.com/rss/search?q=(ma%C3%ADz+OR+maiz)+(precio+OR+cotizaci%C3%B3n+OR+cbot+OR+chicago+OR+usda+OR+productores+OR+cosecha+OR+mercado+OR+insumos+OR+tortilla)&hl=es-419&gl=MX&ceid=MX:es-419',
      region: 'mx'
    },
    // Google News Tabasco específico
    {
      url: 'https://news.google.com/rss/search?q=(ma%C3%ADz+OR+maiz)+(precio+OR+tabasco+OR+villahermosa+OR+cosecha+OR+productores+OR+agr%C3%ADcola+OR+agropecuaria+OR+agroveterinaria+OR+mercado+OR+insumos)&hl=es-419&gl=MX&ceid=MX:es-419',
      region: 'tabasco'
    },
    // Reuters Commodities (global)
    { url: 'https://feeds.reuters.com/reuters/commoditiesNews', region: 'mx' },
    // USDA
    { url: 'https://www.usda.gov/media/press-releases/rss', region: 'mx' },
    // FAO
    { url: 'https://www.fao.org/rss-feed/en/', region: 'mx' },
    // Google News por dominio (fuentes adicionales)
    { url: 'https://news.google.com/rss/search?q=site:eleconomista.com.mx+(ma%C3%ADz+OR+maiz)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'mx' },
    { url: 'https://news.google.com/rss/search?q=site:jornada.com.mx+(ma%C3%ADz+OR+maiz)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'mx' },
    { url: 'https://news.google.com/rss/search?q=site:informador.mx+(ma%C3%ADz+OR+maiz)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'mx' },
    { url: 'https://news.google.com/rss/search?q=site:ejecentral.com.mx+(ma%C3%ADz+OR+maiz)&hl=es-419&gl=MX&ceid=MX:es-419', region: 'mx' },
    // RSS proporcionados (algunos pueden ser índices, el parser filtrará)
    { url: 'https://heraldodemexico.com.mx/rss', region: 'mx' },
    { url: 'https://www.reforma.com/libre/estatico/rss/', region: 'mx' },
    { url: 'https://www.eleconomista.com.mx/rss.html', region: 'mx' },
    { url: 'https://www.proceso.com.mx/rss/', region: 'mx' }
    ,{ url: 'https://www.google.com/alerts/feeds/15185212992475756623/6961065785433240832', region: 'mx' }
  ];

  const items = await fetchManyRss(sources);
  const filtered = items.filter(it => isRelevant(it.title, it.description));

  const normalized = filtered.map(it => ({
    title: it.title,
    link: it.link,
    description: it.description,
    date: it.date || null,
    source: it.source || '',
    region: it.region || 'mx'
  }));

  upsertNews(normalized);
  return normalized.length;
}
