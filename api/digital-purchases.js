// api/digital-purchases.js — v2 (node-fetch)
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
    // ── GET: Query purchased courses with PIN and Device Lock ──
    if (req.method === 'GET') {
      const { phone, pin, deviceId } = req.query;
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
                date: r.created_at,
                studentPin: r.student_pin,
                registeredDeviceId: r.registered_device_id
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

      // Enforce PIN validation if provided
      if (pin) {
        filtered = filtered.filter(p => String(p.studentPin || '') === String(pin));
      }

      // Enforce Device Lock (Anti-Piracy)
      let databaseChanged = false;
      if (deviceId) {
        filtered = filtered.map(p => {
          if (!p.registeredDeviceId) {
            // First time logging in: register this deviceId!
            p.registeredDeviceId = deviceId;
            databaseChanged = true;
            return p;
          } else if (p.registeredDeviceId !== deviceId) {
            // Piracy attempt: lock this purchase!
            return {
              ...p,
              isLocked: true,
              accessLink: '', // Hide access link
              deliveryMsg: '⚠️ Bloke kont piraj! Aparèy sa a pa otorize.'
            };
          }
          return p;
        });

        // Save registry back to local /tmp db
        if (databaseChanged) {
          let db = readDB();
          let localChanged = false;
          filtered.forEach(fp => {
            if (!fp.isLocked) {
              const idx = db.findIndex(p => String(p.txId) === String(fp.txId) && p.productName === fp.productName);
              if (idx >= 0 && !db[idx].registeredDeviceId) {
                db[idx].registeredDeviceId = fp.registeredDeviceId;
                localChanged = true;
              }
            }
          });
          if (localChanged) writeDB(db);

          // Save registry back to Supabase if available
          if (SB && KEY) {
            for (const fp of filtered) {
              if (!fp.isLocked) {
                try {
                  const updateUrl = `${SB}/rest/v1/digital_purchases?tx_id=eq.${fp.txId}&product_name=eq.${encodeURIComponent(fp.productName)}`;
                  await fetch(updateUrl, {
                    method: 'PATCH',
                    headers: {
                      'apikey': KEY,
                      'Authorization': `Bearer ${KEY}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      registered_device_id: fp.registeredDeviceId
                    })
                  });
                } catch (sbUpErr) {
                  console.error('Supabase update device lock error:', sbUpErr.message);
                }
              }
            }
          }
        }
      }

      return res.status(200).json({ purchases: filtered });
    }

    // ── POST: Record new digital purchase with student PIN ──
    if (req.method === 'POST') {
      const { phone, productName, accessLink, deliveryMsg, shopName, txId, date, studentPin } = req.body || {};
      if (!phone || !productName) {
        return res.status(400).json({ error: 'phone and productName are required' });
      }

      const generatedPin = studentPin || String(Math.floor(1000 + Math.random() * 9000));

      const newPurchase = {
        phone,
        productName,
        accessLink: accessLink || '',
        deliveryMsg: deliveryMsg || '',
        shopName: shopName || 'ClairMarché POS',
        txId: String(txId || Date.now()),
        date: date || new Date().toISOString(),
        studentPin: String(generatedPin),
        registeredDeviceId: ""
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
              created_at: date || new Date().toISOString(),
              student_pin: String(generatedPin),
              registered_device_id: ""
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
