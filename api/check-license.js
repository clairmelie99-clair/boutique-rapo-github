// Vercel Serverless Function: api/check-license.js — v3 (https module)

import https from 'https';

function supabaseGet(supabaseUrl, serviceKey, path) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(supabaseUrl);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: `/rest/v1/${path}`,
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, data: null, raw: body }); }
      });
    });
    req.on('error', (e) => reject(e));
    req.setTimeout(8000, () => { req.destroy(new Error('timeout')); });
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error: 'deviceId obligatwa.', version: 'v3' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(200).json({ status: 'active', plan: 'enterprise', source: 'fallback', version: 'v3' });
  }

  try {
    const result = await supabaseGet(
      SUPABASE_URL,
      SUPABASE_SERVICE_KEY,
      `licences?device_id=eq.${encodeURIComponent(deviceId)}&select=status,plan,expires_at,shop_name`
    );

    if (!result.data || !Array.isArray(result.data)) {
      return res.status(200).json({ status: 'unknown', source: 'db_error', http: result.status, version: 'v3' });
    }

    if (result.data.length === 0) {
      return res.status(200).json({ status: 'not_found', source: 'db', version: 'v3' });
    }

    const lic = result.data[0];
    const expiresAt = lic.expires_at ? new Date(lic.expires_at).getTime() : null;
    let effectiveStatus = lic.status;
    if (effectiveStatus === 'active' && expiresAt && Date.now() > expiresAt) {
      effectiveStatus = 'expired';
    }

    return res.status(200).json({
      status: effectiveStatus,
      plan: lic.plan,
      expires_at: lic.expires_at,
      shop_name: lic.shop_name,
      source: 'db',
      version: 'v3'
    });

  } catch (err) {
    return res.status(200).json({
      status: 'unknown',
      source: 'exception',
      error: err.message,
      errorCode: err.code,
      version: 'v3'
    });
  }
}
