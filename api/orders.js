// Vercel Serverless Function: api/orders.js
// Handles GET, POST, and PATCH requests for delivery orders using /tmp/orders_db.json.

import fs from 'fs';
import path from 'path';

const DB_FILE = path.join('/tmp', 'orders_db.json');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let db = readDB();

  try {
    if (req.method === 'GET') {
      const { deviceId, shopIds, phone } = req.query;
      let filtered = [...db];

      if (phone) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        filtered = filtered.filter(o => {
          const cleanOPhone = String(o.phone || '').replace(/[^0-9]/g, '');
          return cleanOPhone.endsWith(cleanPhone) || cleanPhone.endsWith(cleanOPhone);
        });
      } else if (shopIds) {
        const ids = shopIds.split(',');
        filtered = filtered.filter(o => ids.includes(String(o.shopId)));
      } else if (deviceId) {
        filtered = filtered.filter(o => o.deviceId === deviceId);
      }

      return res.status(200).json({ orders: filtered });
    }

    if (req.method === 'POST') {
      const newOrder = req.body;
      if (!newOrder.id) {
        return res.status(400).json({ error: 'Invalid order data' });
      }

      // Prevent duplicates
      db = db.filter(o => String(o.id) !== String(newOrder.id));
      db.unshift(newOrder);
      writeDB(db);

      return res.status(200).json({ order: newOrder });
    }

    if (req.method === 'PATCH') {
      const updates = req.body;
      const idx = db.findIndex(o => String(o.id) === String(updates.id));
      
      if (idx === -1) {
        return res.status(404).json({ error: 'Order not found' });
      }

      db[idx] = { ...db[idx], ...updates };
      writeDB(db);

      return res.status(200).json({ order: db[idx] });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
