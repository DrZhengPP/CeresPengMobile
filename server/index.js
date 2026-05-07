'use strict';
// Standalone API server — deploy this to Azure App Service (or any Node host).
// All endpoints mirror the Metro middleware in metro.config.js exactly.
const http = require('http');
const path = require('path');
const { URL } = require('url');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { BlobServiceClient } = require('@azure/storage-blob');
const shapefile = require('shapefile');
const sql = require('mssql');

// ── Azure Blob ────────────────────────────────────────────────────────────────
function getBlobServiceClient() {
  return BlobServiceClient.fromConnectionString(process.env.VulcanBlob);
}

function bufferToArrayBuffer(buf) {
  const ab = new ArrayBuffer(buf.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; i++) view[i] = buf[i];
  return ab;
}

// ── SQL ───────────────────────────────────────────────────────────────────────
const sqlConfig = {
  server: process.env.SQLServer,
  database: process.env.SQLDB,
  user: process.env.SQLUsername,
  password: process.env.SQLPassword,
  port: 1433,
  options: { encrypt: true, trustServerCertificate: false },
};

let pool = null;
async function getPool() {
  if (pool && pool.connected) return pool;
  pool = await sql.connect(sqlConfig);
  return pool;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function jsonOk(res, data) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function jsonErr(res, err) {
  console.error(err);
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: err.message }));
}

// ── Request router ────────────────────────────────────────────────────────────
async function handleRequest(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' });
    res.end();
    return;
  }

  const url = req.url;

  // GET /api/clients
  if (url === '/api/clients') {
    try {
      const p = await getPool();
      const result = await p.request().query(
        "SELECT DISTINCT client FROM CeresPengSchema.clients WHERE status = 'active' ORDER BY client"
      );
      jsonOk(res, result.recordset.map((r) => r.client));
    } catch (err) {
      console.error('[/api/clients]', err.message);
      jsonErr(res, err);
    }
    return;
  }

  // GET /api/farms/<client>
  const farmsMatch = url.match(/^\/api\/farms\/(.+)$/);
  if (farmsMatch) {
    const client = decodeURIComponent(farmsMatch[1]);
    try {
      const p = await getPool();
      const result = await p.request()
        .input('client', sql.NVarChar, client)
        .query("SELECT name FROM CeresPengSchema.clients WHERE client = @client AND status = 'active' ORDER BY name");
      jsonOk(res, result.recordset.map((r) => r.name));
    } catch (err) {
      console.error('[/api/farms]', err.message);
      jsonErr(res, err);
    }
    return;
  }

  // GET /api/dates/<client>/<name>
  const datesMatch = url.match(/^\/api\/dates\/([^/]+)\/(.+)$/);
  if (datesMatch) {
    const client = decodeURIComponent(datesMatch[1]);
    const name   = decodeURIComponent(datesMatch[2]);
    try {
      const p = await getPool();
      const result = await p.request()
        .input('client', sql.NVarChar, client)
        .input('name',   sql.NVarChar, name)
        .query('SELECT date FROM CeresPengSchema.downloads WHERE client = @client AND name = @name ORDER BY date DESC');
      const dates = result.recordset.map((r) => {
        const d = new Date(r.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      });
      jsonOk(res, dates);
    } catch (err) {
      console.error('[/api/dates]', err.message);
      jsonErr(res, err);
    }
    return;
  }

  // GET /api/products/<client>/<name>/<date>
  const productsMatch = url.match(/^\/api\/products\/([^/]+)\/([^/]+)\/(.+)$/);
  if (productsMatch) {
    const client = decodeURIComponent(productsMatch[1]);
    const name   = decodeURIComponent(productsMatch[2]);
    const date   = decodeURIComponent(productsMatch[3]);
    const PRODUCT_COLUMNS = ['Raw', 'NDVI', 'NDVI_norm', 'GNDVI', 'GNDVI_norm', 'NDRE', 'NDRE_norm', 'NDMI', 'NDMI_norm', 'Change'];
    try {
      const p = await getPool();
      const result = await p.request()
        .input('client', sql.NVarChar, client)
        .input('name',   sql.NVarChar, name)
        .input('date',   sql.NVarChar, date)
        .query(`SELECT ${PRODUCT_COLUMNS.join(', ')} FROM CeresPengSchema.downloads WHERE client = @client AND name = @name AND CAST(date AS DATE) = @date`);
      const available = result.recordset.length === 0
        ? []
        : PRODUCT_COLUMNS.filter((col) => result.recordset[0][col] === true);
      jsonOk(res, available);
    } catch (err) {
      console.error('[/api/products]', err.message);
      jsonErr(res, err);
    }
    return;
  }

  // GET /api/shapefile/<name>
  const shapefileMatch = url.match(/^\/api\/shapefile\/(.+)$/);
  if (shapefileMatch) {
    const name = decodeURIComponent(shapefileMatch[1]);
    try {
      const p = await getPool();
      const result = await p.request()
        .input('name', sql.NVarChar, name)
        .query("SELECT container_name, blob_name, shape_name, polygon_id FROM CeresPengSchema.clients WHERE name = @name AND status = 'active'");
      if (result.recordset.length === 0) {
        res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return;
      }
      const { container_name, blob_name, shape_name, polygon_id } = result.recordset[0];
      const containerClient = getBlobServiceClient().getContainerClient(container_name);
      const shpPath = `${blob_name}/input/${name}/shape_file/${shape_name}.shp`;
      const dbfPath = `${blob_name}/input/${name}/shape_file/${shape_name}.dbf`;
      const [shpBuf, dbfBuf] = await Promise.all([
        containerClient.getBlobClient(shpPath).downloadToBuffer(),
        containerClient.getBlobClient(dbfPath).downloadToBuffer(),
      ]);
      const source = await shapefile.open(bufferToArrayBuffer(shpBuf), bufferToArrayBuffer(dbfBuf));
      const features = [];
      let item = await source.read();
      while (!item.done) { features.push(item.value); item = await source.read(); }
      jsonOk(res, { type: 'FeatureCollection', features, polygon_id });
    } catch (err) {
      console.error('[/api/shapefile]', err.message);
      jsonErr(res, err);
    }
    return;
  }

  // GET /api/images/<name>/<date>/<product>
  const imagesMatch = url.match(/^\/api\/images\/([^/]+)\/([^/]+)\/([^/?]+)/);
  if (imagesMatch) {
    const name    = decodeURIComponent(imagesMatch[1]);
    const date    = decodeURIComponent(imagesMatch[2]);
    const product = decodeURIComponent(imagesMatch[3]);
    try {
      const p = await getPool();
      const result = await p.request()
        .input('name', sql.NVarChar, name)
        .query("SELECT container_name, blob_name FROM CeresPengSchema.clients WHERE name = @name AND status = 'active'");
      if (result.recordset.length === 0) {
        res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return;
      }
      const { container_name, blob_name } = result.recordset[0];
      const containerClient = getBlobServiceClient().getContainerClient(container_name);
      const dateFolder = date.replace(/-/g, '');
      const outputPrefix = `${blob_name}/output/${name}/${dateFolder}/`;
      let hashFolder = '';
      for await (const blob of containerClient.listBlobsFlat({ prefix: outputPrefix })) {
        const rel = blob.name.slice(outputPrefix.length);
        const seg = rel.split('/')[0];
        if (seg) { hashFolder = seg; break; }
      }
      if (!hashFolder) { jsonOk(res, []); return; }
      const productPrefix = `${outputPrefix}${hashFolder}/${product}/`;
      const images = [];
      for await (const blob of containerClient.listBlobsFlat({ prefix: productPrefix })) {
        if (!blob.name.endsWith('.png')) continue;
        const fileName = blob.name.split('/').pop();
        const stem = fileName.slice(0, -4);
        const label = (product === 'Raw' || product === 'Change')
          ? stem
          : stem.slice(0, -(product.length + 1));
        images.push({
          label,
          url: `/api/blob-proxy?container=${encodeURIComponent(container_name)}&path=${encodeURIComponent(blob.name)}`,
        });
      }
      jsonOk(res, images);
    } catch (err) {
      console.error('[/api/images]', err.message);
      jsonErr(res, err);
    }
    return;
  }

  // GET /api/blob-proxy?container=...&path=...
  if (url.startsWith('/api/blob-proxy')) {
    const urlObj = new URL(url, 'https://www.cerespeng.com');
    const container = urlObj.searchParams.get('container');
    const blobPath  = urlObj.searchParams.get('path');
    if (!container || !blobPath) {
      res.writeHead(400); res.end('Missing params'); return;
    }
    try {
      const containerClient = getBlobServiceClient().getContainerClient(container);
      const buf = await containerClient.getBlobClient(blobPath).downloadToBuffer();
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(buf);
    } catch (err) {
      console.error('[/api/blob-proxy]', err.message);
      res.writeHead(500); res.end('Blob fetch failed');
    }
    return;
  }

  // Health check
  if (url === '/health') {
    res.writeHead(200); res.end('OK'); return;
  }

  res.writeHead(404); res.end('Not found');
}

const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('Unhandled error:', err);
    res.writeHead(500); res.end('Internal server error');
  });
});

server.listen(PORT, () => {
  console.log(`CeresPeng API server listening on port ${PORT}`);
});
