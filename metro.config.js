// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { execSync } = require('child_process');

// Ensure adb reverse is active whenever Metro starts
try {
  execSync('adb reverse tcp:8081 tcp:8081', { stdio: 'pipe' });
  console.log('[metro] adb reverse tcp:8081 tcp:8081 OK');
} catch {
  // Emulator not connected yet — harmless, app will reconnect after adb reverse is run
}

// Load .env manually for the Metro (Node.js) process.
// EXPO_PUBLIC_* vars are loaded by Expo automatically for the bundle;
// the SQL vars below are only needed here on the server side.
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Block optional lightningcss platform packages that aren't installed on this machine.
const missingOptionalPkgs = [
  'lightningcss-darwin-x64',
  'lightningcss-darwin-arm64',
  'lightningcss-linux-x64-gnu',
  'lightningcss-linux-x64-musl',
  'lightningcss-linux-arm64-gnu',
  'lightningcss-linux-arm64-musl',
  'lightningcss-linux-arm-gnueabihf',
  'lightningcss-win32-arm64-msvc',
  'lightningcss-freebsd-x64',
  'lightningcss-android-arm64',
];
const blockListRegex = new RegExp(
  missingOptionalPkgs.map((pkg) => `node_modules[\\\\/]${pkg}[\\\\/]`).join('|')
);
config.resolver = { ...config.resolver, blockList: blockListRegex };

// ── Azure Blob helpers (server-side only) ─────────────────────────────────────
const { BlobServiceClient } = require('@azure/storage-blob');
const shapefile = require('shapefile');

function getBlobServiceClient() {
  return BlobServiceClient.fromConnectionString(process.env.VulcanBlob);
}

// Convert a Node Buffer to a plain ArrayBuffer (avoids pool-slice issues)
function bufferToArrayBuffer(buf) {
  const ab = new ArrayBuffer(buf.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; i++) view[i] = buf[i];
  return ab;
}

// ── SQL helpers (server-side only) ────────────────────────────────────────────
const sql = require('mssql');

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

// ── Custom API middleware ──────────────────────────────────────────────────────
function jsonOk(res, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(data));
}

function jsonErr(res, err) {
  res.writeHead(500);
  res.end(JSON.stringify({ error: err.message }));
}

config.server = {
  enhanceMiddleware: (metroMiddleware) => {
    return async (req, res, next) => {
      // GET /api/clients
      if (req.url === '/api/clients') {
        try {
          const p = await getPool();
          const result = await p
            .request()
            .query(
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
      const farmsMatch = req.url.match(/^\/api\/farms\/(.+)$/);
      if (farmsMatch) {
        const client = decodeURIComponent(farmsMatch[1]);
        try {
          const p = await getPool();
          const result = await p
            .request()
            .input('client', sql.NVarChar, client)
            .query(
              "SELECT name FROM CeresPengSchema.clients WHERE client = @client AND status = 'active' ORDER BY name"
            );
          jsonOk(res, result.recordset.map((r) => r.name));
        } catch (err) {
          console.error('[/api/farms]', err.message);
          jsonErr(res, err);
        }
        return;
      }

      // GET /api/dates/<client>/<name>
      const datesMatch = req.url.match(/^\/api\/dates\/([^/]+)\/(.+)$/);
      if (datesMatch) {
        const client = decodeURIComponent(datesMatch[1]);
        const name = decodeURIComponent(datesMatch[2]);
        try {
          const p = await getPool();
          const result = await p
            .request()
            .input('client', sql.NVarChar, client)
            .input('name', sql.NVarChar, name)
            .query(
              'SELECT date FROM CeresPengSchema.downloads WHERE client = @client AND name = @name ORDER BY date DESC'
            );
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
      const productsMatch = req.url.match(/^\/api\/products\/([^/]+)\/([^/]+)\/(.+)$/);
      if (productsMatch) {
        const client = decodeURIComponent(productsMatch[1]);
        const name   = decodeURIComponent(productsMatch[2]);
        const date   = decodeURIComponent(productsMatch[3]);
        const PRODUCT_COLUMNS = ['Raw', 'NDVI', 'NDVI_norm', 'GNDVI', 'GNDVI_norm', 'NDRE', 'NDRE_norm', 'NDMI', 'NDMI_norm', 'Change'];
        try {
          const p = await getPool();
          const result = await p
            .request()
            .input('client', sql.NVarChar, client)
            .input('name',   sql.NVarChar, name)
            .input('date',   sql.NVarChar, date)
            .query(
              `SELECT ${PRODUCT_COLUMNS.join(', ')} FROM CeresPengSchema.downloads WHERE client = @client AND name = @name AND CAST(date AS DATE) = @date`
            );
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
      const shapefileMatch = req.url.match(/^\/api\/shapefile\/(.+)$/);
      if (shapefileMatch) {
        const name = decodeURIComponent(shapefileMatch[1]);
        try {
          const p = await getPool();
          const result = await p
            .request()
            .input('name', sql.NVarChar, name)
            .query(
              "SELECT container_name, blob_name, shape_name, polygon_id FROM CeresPengSchema.clients WHERE name = @name AND status = 'active'"
            );
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
      const imagesMatch = req.url.match(/^\/api\/images\/([^/]+)\/([^/]+)\/([^/?]+)/);
      if (imagesMatch) {
        const name    = decodeURIComponent(imagesMatch[1]);
        const date    = decodeURIComponent(imagesMatch[2]);
        const product = decodeURIComponent(imagesMatch[3]);
        try {
          const p = await getPool();
          const result = await p
            .request()
            .input('name', sql.NVarChar, name)
            .query(
              "SELECT container_name, blob_name FROM CeresPengSchema.clients WHERE name = @name AND status = 'active'"
            );
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
      if (req.url.startsWith('/api/blob-proxy')) {
        const urlObj = new URL(req.url, 'http://localhost');
        const container = urlObj.searchParams.get('container');
        const blobPath  = urlObj.searchParams.get('path');
        if (!container || !blobPath) {
          res.writeHead(400); res.end('Missing params'); return;
        }
        try {
          const containerClient = getBlobServiceClient().getContainerClient(container);
          const buf = await containerClient.getBlobClient(blobPath).downloadToBuffer();
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(buf);
        } catch (err) {
          console.error('[/api/blob-proxy]', err.message);
          res.writeHead(500); res.end('Blob fetch failed');
        }
        return;
      }

      metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
