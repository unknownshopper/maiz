(function () {
  const NEWS_UL_ID = 'news-list';
  const REFRESH_BTN_ID = 'refresh-news';
  const PAGE_SIZE = 25;

  const $ul = document.getElementById(NEWS_UL_ID);
  const $btn = document.getElementById(REFRESH_BTN_ID);
  let state = { items: [], filtered: [], page: 1, filterText: '', regions: new Set(['mx','tabasco']) };

  const PAGES_START = new Date('2025-10-30');
  const PAGES_END = new Date('2026-02-08');
  function isGithubPages() {
    return /\.github\.io$/i.test(location.hostname) || location.hostname === 'unknownshopper.github.io';
  }
  function fmtDate(d) {
    return d.toISOString().slice(0,10);
  }
  function buildDateOptions($sel) {
    $sel.innerHTML = '';
    for (let d = new Date(PAGES_START); d <= PAGES_END; d.setDate(d.getDate()+1)) {
      const iso = fmtDate(d);
      const opt = document.createElement('option');
      opt.value = iso;
      opt.textContent = iso;
      $sel.appendChild(opt);
    }
    $sel.value = fmtDate(PAGES_END);
  }

  function ensurePaginationContainer() {
    let $nav = document.getElementById('news-pagination');
    if (!$nav) {
      $nav = document.createElement('div');
      $nav.id = 'news-pagination';
      $nav.style.margin = '8px 0';
      if ($ul && $ul.parentElement) {
        $ul.parentElement.insertBefore($nav, $ul);
      }
    }
    return $nav;
  }

  function downloadPdf() {
    const total = state.filtered.length;
    if (!total) {
      alert('No hay noticias para exportar');
      return;
    }
    const formatter = new Intl.DateTimeFormat('es-MX', {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    const win = window.open('', '_blank');
    if (!win) return; // popup blocked
    const title = 'Reporte Diario de Noticias de Maíz';
    const now = formatter.format(new Date());
    const base = `${location.origin}${location.pathname.replace(/\/[^/]*$/, '/')}`;
    const logoUrl = `${base}logotus.png`;
    const rowsHtml = state.filtered.map((it, i) => {
      const dateVal = it.date ? new Date(it.date) : null;
      const dateStr = dateVal && !isNaN(dateVal.getTime()) ? formatter.format(dateVal) : '';
      const safeTitle = (it.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeSrc = (it.source || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeLink = (it.link || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <tr>
          <td class="idx">${i + 1}.</td>
          <td class="cell">
            <div class="title">${safeTitle}</div>
            <div class="meta">${safeSrc}${dateStr ? ' • ' + dateStr : ''}</div>
            <div class="link">${safeLink}</div>
          </td>
        </tr>`;
    }).join('');

    const html = `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>${title}</title>
      <style>
        @page { size: A4; margin: 16mm; }
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; color:#111827; }
        .header { display:flex; align-items:center; gap:16px; margin-bottom:8px; }
        .header img { width:120px; height:auto; }
        h1 { font-size: 20px; margin:0; }
        .subtitle { font-size: 12px; color:#374151; margin-top:2px; }
        .generated { font-size: 12px; color:#6b7280; margin-top:2px; }
        .divider { height:1px; background:#d1d5db; margin:12px 0; }
        table { width:100%; border-collapse: collapse; }
        tr:nth-child(even) { background: #f9fafb; }
        td.idx { padding:8px; vertical-align:top; color:#6b7280; width:32px; }
        td.cell { padding:8px; vertical-align:top; }
        .title { font-weight:600; font-size:13px; }
        .meta { font-size:11px; color:#374151; margin-top:2px; }
        .link { font-size:11px; color:#2563eb; word-break:break-all; margin-top:2px; }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="${logoUrl}" alt="The Unknown Shopper"/>
        <div>
          <h1>${title}</h1>
          <div class="subtitle">The Unknown Shopper</div>
          <div class="generated">Generado: ${now} • Total: ${total}</div>
        </div>
      </div>
      <div class="divider"></div>
      <table>${rowsHtml}</table>
      <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };<\/script>
    </body>
    </html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function ensureFiltersContainer() {
    let $filters = document.getElementById('news-filters');
    if (!$filters) {
      $filters = document.createElement('div');
      $filters.id = 'news-filters';
      $filters.style.margin = '8px 0';
      if ($ul && $ul.parentElement) {
        $ul.parentElement.insertBefore($filters, $ul);
      }
      // Build controls
      $filters.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
          <label style="font-size:14px;color:#374151;${isGithubPages() ? '' : 'display:none;'}">Fecha: 
            <select id="news-date-select" style="padding:4px;border:1px solid #d1d5db;border-radius:4px;"></select>
          </label>
          <label style="font-size:14px;color:#374151;">Buscar: <input id="news-filter-text" type="text" placeholder="término..." style="padding:4px;border:1px solid #d1d5db;border-radius:4px;"/></label>
          <label style="font-size:14px;color:#374151;"><input id="news-region-mx" type="checkbox" checked style="margin-right:4px;"/>mx</label>
          <label style="font-size:14px;color:#374151;"><input id="news-region-tabasco" type="checkbox" checked style="margin-right:4px;"/>tabasco</label>
          <button id="news-apply-filters" style="padding:4px 8px;border:1px solid #d1d5db;border-radius:4px;background:#f9fafb;">Aplicar</button>
          <button id="news-download-pdf" style="padding:4px 8px;border:1px solid #d1d5db;border-radius:4px;background:#f9fafb;">Descargar PDF</button>
        </div>`;
      // Listeners
      const $date = $filters.querySelector('#news-date-select');
      const $text = $filters.querySelector('#news-filter-text');
      const $mx = $filters.querySelector('#news-region-mx');
      const $tb = $filters.querySelector('#news-region-tabasco');
      const $apply = $filters.querySelector('#news-apply-filters');
      const $pdf = $filters.querySelector('#news-download-pdf');
      if ($date) {
        buildDateOptions($date);
        $date.addEventListener('change', async () => {
          if (isGithubPages()) {
            await loadFromDailyJson($date.value);
            state.page = 1;
            applyFilters();
            renderPage();
          }
        });
      }
      $apply.addEventListener('click', () => {
        state.filterText = ($text.value || '').trim();
        const sel = new Set();
        if ($mx.checked) sel.add('mx');
        if ($tb.checked) sel.add('tabasco');
        state.regions = sel;
        applyFilters();
        state.page = 1;
        renderPage();
      });
      $pdf.addEventListener('click', () => {
        downloadPdf();
      });
    }
    return $filters;
  }

  function setLoading(isLoading) {
    if (!$ul) return;
    if (isLoading) {
      $ul.innerHTML = '<li>Cargando noticias...</li>';
    }
  }

  function showError(message) {
    if (!$ul) return;
    $ul.innerHTML = `<li style="color:#b91c1c;">${message}</li>`;
  }

  function normalizeText(t) {
    try {
      return (t || '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    } catch (_) {
      return (t || '').toString().toLowerCase();
    }
  }

  function applyFilters() {
    const text = normalizeText(state.filterText);
    state.filtered = state.items.filter(it => {
      const regionOk = state.regions.size ? state.regions.has(String(it.region || '').toLowerCase()) : true;
      if (!regionOk) return false;
      if (!text) return true;
      const hay = normalizeText(`${it.title} ${it.description || ''} ${it.source || ''}`);
      return hay.includes(text);
    });
  }

  function renderPage() {
    if (!$ul) return;
    const total = state.filtered.length;
    if (!total) {
      $ul.innerHTML = '<li>No se encontraron noticias relevantes por ahora.</li>';
      return;
    }

    const formatter = new Intl.DateTimeFormat('es-MX', {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), pages);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = state.filtered.slice(start, start + PAGE_SIZE);

    const header = `<li style="color:#6b7280;list-style:none;margin-bottom:4px;">Total: ${total} • Página ${state.page} de ${pages}</li>`;

    $ul.innerHTML = header + pageItems.map((it, idx) => {
      const dateVal = it.date ? new Date(it.date) : null;
      const dateStr = dateVal && !isNaN(dateVal.getTime()) ? formatter.format(dateVal) : '';
      const safeTitle = it.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeSrc = (it.source || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const globalIndex = start + idx + 1;
      return `
        <li>
          <span style="color:#6b7280;margin-right:6px;">${globalIndex}.</span>
          <a href="${it.link}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>
          <div style="font-size:12px;color:#6b7280;">${safeSrc}${dateStr ? ' • ' + dateStr : ''}</div>
        </li>
      `;
    }).join('');

    // Render pagination controls
    const $nav = ensurePaginationContainer();
    $nav.innerHTML = '';
    const mkBtn = (label, disabled, onClick) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.marginRight = '8px';
      b.disabled = disabled;
      b.addEventListener('click', onClick);
      return b;
    };
    $nav.appendChild(mkBtn('Anterior', state.page <= 1, () => { state.page -= 1; renderPage(); }));
    $nav.appendChild(mkBtn('Siguiente', state.page >= pages, () => { state.page += 1; renderPage(); }));
  }

  async function loadNews() {
    setLoading(true);
    try {
      ensureFiltersContainer();
      // If running on GitHub Pages, load from daily JSON
      if (isGithubPages()) {
        const $date = document.getElementById('news-date-select');
        const chosen = $date ? $date.value : fmtDate(PAGES_END);
        await loadFromDailyJson(chosen);
        state.page = 1;
        applyFilters();
        renderPage();
        return;
      }
      const regionsWanted = ['mx', 'tabasco'];
      // 1) Intentar Firestore directo (compat SDK)
      if (window.firebaseApp && typeof window.firebaseApp.getDb === 'function') {
        const db = window.firebaseApp.getDb();
        if (db) {
          const snap = await db.collection('news')
            .orderBy('date', 'desc')
            .limit(200)
            .get();
          const rows = snap.docs.map(d => d.data());
          const filtered = rows.filter(r => r && r.region && regionsWanted.includes(String(r.region)));
          state.items = filtered.map(r => ({
            title: r.title,
            link: r.link,
            description: r.description || '',
            date: r.date && r.date.toDate ? r.date.toDate() : (r.date ? new Date(r.date) : null),
            source: r.source || '',
            region: r.region || 'mx'
          }));
          state.page = 1;
          applyFilters();
          renderPage();
          return;
        }
      }
      // 2) Backend local (desarrollo)
      const params = new URLSearchParams({ region: 'mx,tabasco', limit: '200' });
      const absUrl = `http://localhost:5050/api/noticias?${params.toString()}`;
      const res = await fetch(absUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      state.items = Array.isArray(data) ? data : [];
      state.page = 1;
      applyFilters();
      renderPage();
    } catch (err) {
      console.error(err);
      showError('Ocurrió un error al cargar noticias. Intenta nuevamente.');
    }
  }

  async function loadFromDailyJson(isoDate) {
    const base = `${location.origin}${location.pathname.replace(/\/[^/]*$/, '/')}`;
    // docs/data/ is served at /maiz/data/ when using GitHub Pages with docs/ as root
    const url = `${base}data/news-${isoDate}.json`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`No se encontró el archivo para ${isoDate}`);
    const json = await res.json();
    state.items = Array.isArray(json.items) ? json.items : [];
  }

  if ($btn) {
    $btn.addEventListener('click', () => {
      loadNews();
    });
  }

  // Carga inicial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNews);
  } else {
    loadNews();
  }
})();
