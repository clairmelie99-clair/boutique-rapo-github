// api/manage-license.js — v3 (https module, explicit port 443)

import https from 'https';

function supabaseRequest(supabaseUrl, serviceKey, path, method, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(supabaseUrl);
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: `/rest/v1/${path}`,
      method: method,
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: data ? JSON.parse(data) : [] }); }
        catch (e) { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: [], raw: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('timeout')));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const masterKey = req.headers['x-master-key'] || req.query.key;
  const MASTER_API_KEY = process.env.MASTER_API_KEY;
  if (!MASTER_API_KEY || masterKey !== MASTER_API_KEY) {
    return res.status(401).json({ error: 'Aksè refize.', version: 'v3' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Baz done pa konfigire.', version: 'v3' });
  }

  try {
    const method = req.method;
    const body = req.body || {};
    const action = method === 'GET' ? 'list' : (body.action || 'list');

    // ── LIST ──
    if (action === 'list') {
      const r = await supabaseRequest(SUPABASE_URL, SUPABASE_SERVICE_KEY,
        'licences?select=*&order=created_at.desc', 'GET', null);
      const licences = Array.isArray(r.data) ? r.data : [];
      return res.status(200).json({ licences, count: licences.length, version: 'v3' });
    }

    const { deviceId, plan, months, notes, shopName, whatsapp } = body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId obligatwa.' });

    // ── SUSPEND ──
    if (action === 'suspend') {
      await supabaseRequest(SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `licences?device_id=eq.${encodeURIComponent(deviceId)}`,
        'PATCH',
        { status: 'suspended', notes: notes || `Sispann pa admin — ${new Date().toLocaleDateString('fr-HT')}` }
      );
      return res.status(200).json({ success: true, action: 'suspended', version: 'v3' });
    }

    // ── ACTIVATE ──
    if (action === 'activate') {
      const numMonths = parseInt(months) || 1;
      const expiresAt = new Date(Date.now() + numMonths * 31 * 24 * 60 * 60 * 1000).toISOString();
      const activatedAt = new Date().toISOString();

      const check = await supabaseRequest(SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `licences?device_id=eq.${encodeURIComponent(deviceId)}&select=device_id`, 'GET', null);
      const exists = Array.isArray(check.data) && check.data.length > 0;

      if (exists) {
        await supabaseRequest(SUPABASE_URL, SUPABASE_SERVICE_KEY,
          `licences?device_id=eq.${encodeURIComponent(deviceId)}`, 'PATCH',
          { status: 'active', plan: plan || 'team', expires_at: expiresAt, activated_at: activatedAt,
            notes: notes || `Renouvle pa admin — ${numMonths} mwa` });
      } else {
        await supabaseRequest(SUPABASE_URL, SUPABASE_SERVICE_KEY, 'licences', 'POST',
          { device_id: deviceId, shop_name: shopName || 'Boutique ClairMarché',
            status: 'active', plan: plan || 'team', activated_at: activatedAt,
            expires_at: expiresAt, whatsapp: whatsapp || null,
            notes: notes || `Kreye pa admin` });
      }
      return res.status(200).json({ success: true, action: 'activated', plan, expires_at: expiresAt, version: 'v3' });
    }

    // ── DELETE ──
    if (action === 'delete') {
      await supabaseRequest(SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `licences?device_id=eq.${encodeURIComponent(deviceId)}`, 'DELETE', null);
      return res.status(200).json({ success: true, action: 'deleted', version: 'v3' });
    }

    return res.status(400).json({ error: `Aksyon "${action}" pa rekonèt.` });

  } catch (err) {
    return res.status(500).json({ error: err.message, code: err.code, version: 'v3' });
  }
}
