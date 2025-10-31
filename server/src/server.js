import express from 'express';
import cors from 'cors';
import { queryNews } from './db.js';
import path from 'node:path';
import { ingestOnce } from './ingest.js';

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// Servir únicamente una carpeta pública explícita
const staticRoot = path.resolve(process.cwd(), 'public');
app.use(express.static(staticRoot));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/noticias', (req, res) => {
  const { q = '', region = 'mx,tabasco', limit = 50 } = req.query;
  try {
    const rows = queryNews({ q, region, limit });
    res.json(rows.map(r => ({
      ...r,
      date: r.date ? new Date(r.date).toISOString() : null,
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error consultando noticias' });
  }
});

// Endpoint administrativo para ejecutar una ingesta manual al SQLite
// Uso: POST /api/admin/ingest?token=XYZ
app.post('/api/admin/ingest', async (req, res) => {
  try {
    const token = String(req.query.token || req.headers['x-api-token'] || '');
    const expected = String(process.env.ADMIN_TOKEN || '');
    if (!expected || token !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const count = await ingestOnce();
    res.json({ ok: true, count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error ejecutando ingesta' });
  }
});

async function boot() {
  app.listen(PORT, () => {
    console.log(`News server listening on http://localhost:${PORT}`);
  });
}

boot();
