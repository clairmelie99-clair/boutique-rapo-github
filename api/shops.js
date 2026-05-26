// Vercel Serverless Function: api/shops.js
// Handles GET and POST requests for online shops using /tmp/shops_db.json.

import fs from 'fs';
import path from 'path';

const DB_FILE = path.join('/tmp', 'shops_db.json');

function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let db = readDB();

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ shops: db });
    }

    if (req.method === 'POST') {
      const newShop = req.body;
      if (!newShop.id) {
        return res.status(400).json({ error: 'Invalid shop data' });
      }

      // Sync / Upsert
      const idx = db.findIndex(s => String(s.id) === String(newShop.id) || (newShop.deviceId && s.deviceId === newShop.deviceId));
      if (idx >= 0) {
        db[idx] = { ...db[idx], ...newShop };
      } else {
        db.push(newShop);
      }

      writeDB(db);

      return res.status(200).json({ shops: db });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
