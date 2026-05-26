// Vercel Serverless Function: api/activate-license.js
// Aktive yon lisans kliyan nan Supabase apre li fin antre kòd aktivasyon an.

import https from 'https';

function httpsRequest(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: data ? JSON.parse(data) : null }); }
        catch (e) { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: null }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { deviceId, plan, shopName, whatsapp } = req.body || {};

  if (!deviceId || !plan) {
    return res.status(400).json({ error: 'deviceId ak plan obligatwa.' });
  }

  const VALID_PLANS = ['solo', 'team', 'boutique', 'business', 'enterprise'];
  if (!VALID_PLANS.includes(plan)) {
    return res.status(400).json({ error: 'Plan pa valid.' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(200).json({ success: true, source: 'fallback' });
  }

  const activatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();

  const licenceData = JSON.stringify({
    device_id: deviceId,
    shop_name: shopName || 'Boutique ClairMarché',
    status: 'active',
    plan: plan,
    activated_at: activatedAt,
    expires_at: expiresAt,
    whatsapp: whatsapp || null,
    notes: `Aktive otomatikman — Plan ${plan}`
  });

  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
    'Content-Length': Buffer.byteLength(licenceData)
  };

  try {
    const result = await httpsRequest(
      `${SUPABASE_URL}/rest/v1/licences`,
      'POST', headers, licenceData
    );

    if (!result.ok) {
      return res.status(500).json({ error: `Supabase error: ${result.status}` });
    }

    return res.status(200).json({
      success: true,
      plan,
      expires_at: expiresAt,
      activated_at: activatedAt,
      source: 'db'
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
