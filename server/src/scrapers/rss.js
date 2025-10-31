import Parser from 'rss-parser';

const parser = new Parser({ timeout: 20000 });

function unwrapGoogleRedirect(rawLink) {
  try {
    const href = (rawLink || '').trim();
    if (!href) return '';
    const u = new URL(href);
    if (u.hostname === 'www.google.com' && u.pathname === '/url') {
      const real = u.searchParams.get('url');
      return real ? decodeURIComponent(real) : href;
    }
    return href;
  } catch {
    return (rawLink || '').trim();
  }
}

export async function fetchRss(url, extra = {}) {
  const feed = await parser.parseURL(url);
  const source = feed.title || new URL(url).hostname;
  return (feed.items || []).map(it => ({
    title: it.title?.trim() || '',
    link: unwrapGoogleRedirect(it.link),
    description: (it.contentSnippet || it.content || it.summary || '').toString().trim(),
    date: it.isoDate ? new Date(it.isoDate).getTime() : (it.pubDate ? new Date(it.pubDate).getTime() : null),
    source,
    region: extra.region || 'mx',
  })).filter(x => x.link);
}

export async function fetchManyRss(sources) {
  const settled = await Promise.allSettled(sources.map(async s => {
    const items = await fetchRss(s.url, { region: s.region });
    return items;
  }));
  return settled.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}
