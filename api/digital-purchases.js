// api/digital-purchases.js — v1 (node-fetch)
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join('/tmp', 'digital_purchases_db.json');

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

  const SB = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_KEY;

  try {
    // ── GET: Query purchased courses by student phone ──
    if (req.method === 'GET') {
      const { phone } = req.query;
      if (!phone) {
        return res.status(400).json({ error: 'phone parameter is required' });
      }

      // Read from local /tmp mock database first
      let localPurchases = readDB();
      // Normalize and filter by phone number (removing spaces, leading characters, matching suffix)
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      let filtered = localPurchases.filter(p => {
        const cleanP = String(p.phone).replace(/[^0-9]/g, '');
        return cleanP.endsWith(cleanPhone) || cleanPhone.endsWith(cleanP);
      });

      // If Supabase is available, query Supabase as well
      if (SB && KEY) {
        try {
          const url = `${SB}/rest/v1/digital_purchases?select=*`;
          const resp = await fetch(url, {
            method: 'GET',
            headers: {
              'apikey': KEY,
              'Authorization': `Bearer ${KEY}`,
              'Content-Type': 'application/json'
            }
          });

          if (resp.ok) {
            const rows = await resp.json();
            if (rows && rows.length > 0) {
              const dbFiltered = rows.filter(p => {
                const cleanP = String(p.phone).replace(/[^0-9]/g, '');
                return cleanP.endsWith(cleanPhone) || cleanPhone.endsWith(cleanP);
              }).map(r => ({
                phone: r.phone,
                productName: r.product_name,
                accessLink: r.access_link,
                deliveryMsg: r.delivery_msg,
                shopName: r.shop_name,
                txId: r.tx_id,
                date: r.created_at
              }));

              // Merge both (de-duplicate by txId + productName)
              const seen = new Set();
              const merged = [];
              [...filtered, ...dbFiltered].forEach(item => {
                const key = `${item.txId}-${item.productName}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  merged.push(item);
                }
              });
              filtered = merged;
            }
          }
        } catch (sbErr) {
          console.error('Supabase query error, falling back to local:', sbErr.message);
        }
      }

      return res.status(200).json({ purchases: filtered });
    }

    // ── POST: Record new digital purchase ──
    if (req.method === 'POST') {
      const { phone, productName, accessLink, deliveryMsg, shopName, txId, date } = req.body || {};
      if (!phone || !productName) {
        return res.status(400).json({ error: 'phone and productName are required' });
      }

      const newPurchase = {
        phone,
        productName,
        accessLink: accessLink || '',
        deliveryMsg: deliveryMsg || '',
        shopName: shopName || 'ClairMarché POS',
        txId: String(txId || Date.now()),
        date: date || new Date().toISOString()
      };

      // 1. Save to local /tmp database
      let db = readDB();
      // Avoid duplicate posting
      db = db.filter(p => !(String(p.txId) === String(newPurchase.txId) && p.productName === newPurchase.productName));
      db.unshift(newPurchase);
      writeDB(db);

      // 2. Save to Supabase if configured
      let sbSuccess = false;
      if (SB && KEY) {
        try {
          const resp = await fetch(`${SB}/rest/v1/digital_purchases`, {
            method: 'POST',
            headers: {
              'apikey': KEY,
              'Authorization': `Bearer ${KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              phone: phone,
              product_name: productName,
              access_link: accessLink || '',
              delivery_msg: deliveryMsg || '',
              shop_name: shopName || 'ClairMarché POS',
              tx_id: String(txId || Date.now()),
              created_at: date || new Date().toISOString()
            })
          });
          sbSuccess = resp.ok;
        } catch (sbErr) {
          console.error('Supabase insert error, saved locally:', sbErr.message);
        }
      }

      return res.status(200).json({ success: true, localSaved: true, sbSaved: sbSuccess, purchase: newPurchase });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
