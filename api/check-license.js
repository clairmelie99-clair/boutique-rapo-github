// Vercel Serverless Function: api/check-license.js
// Verifye estati lisans yon aparèy an tan reyèl nan Supabase.

import https from 'https';

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ ok: false, status: res.statusCode, data: null }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const { deviceId } = req.query;
  if (!deviceId || deviceId.length < 5) {
    return res.status(400).json({ error: 'deviceId obligatwa.' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(200).json({ status: 'active', plan: 'enterprise', source: 'fallback' });
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/licences?device_id=eq.${encodeURIComponent(deviceId)}&select=status,plan,expires_at,shop_name`;
    const result = await httpsGet(url, {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    });

    if (!result.ok || !result.data) {
      return res.status(200).json({ status: 'unknown', source: 'db_error' });
    }

    const rows = result.data;
    if (!rows || rows.length === 0) {
      return res.status(200).json({ status: 'not_found', source: 'db' });
    }

    const lic = rows[0];
    const now = Date.now();
    const expiresAt = lic.expires_at ? new Date(lic.expires_at).getTime() : null;

    let effectiveStatus = lic.status;
    if (effectiveStatus === 'active' && expiresAt && now > expiresAt) {
      effectiveStatus = 'expired';
    }

    return res.status(200).json({
      status: effectiveStatus,
      plan: lic.plan,
      expires_at: lic.expires_at,
      shop_name: lic.shop_name,
      source: 'db'
    });

  } catch (err) {
    return res.status(200).json({ status: 'unknown', source: 'exception', error: err.message });
  }
}
