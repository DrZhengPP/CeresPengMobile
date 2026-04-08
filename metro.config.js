// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

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

      metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
