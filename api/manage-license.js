// Vercel Serverless Function: api/manage-license.js
// Kontwòl a distans: Bloke, Deblike, Renouvle, ak Lis tout kliyan yo.
// PWOTEJE ak MASTER_API_KEY

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const masterKey = req.headers['x-master-key'] || req.query.key;
  const MASTER_API_KEY = process.env.MASTER_API_KEY;

  if (!MASTER_API_KEY || masterKey !== MASTER_API_KEY) {
    return res.status(401).json({ error: 'Aksè refize. Kle Master la pa valid.' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Baz done pa konfigire.' });
  }

  const baseHeaders = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // ── GET: Jwenn lis tout kliyan yo ──────────────────────────────────────
    if (req.method === 'GET') {
      const result = await httpsRequest(
        `${SUPABASE_URL}/rest/v1/licences?select=*&order=created_at.desc`,
        'GET', baseHeaders, null
      );
      const data = result.data || [];
      return res.status(200).json({ licences: data, count: data.length });
    }

    if (req.method === 'POST') {
      const { action, deviceId, plan, months, notes, shopName, whatsapp } = req.body || {};

      if (!action) return res.status(400).json({ error: 'action obligatwa.' });

      // ── Lis kliyan yo ──
      if (action === 'list') {
        const result = await httpsRequest(
          `${SUPABASE_URL}/rest/v1/licences?select=*&order=created_at.desc`,
          'GET', baseHeaders, null
        );
        const data = result.data || [];
        return res.status(200).json({ licences: data, count: data.length });
      }

      if (!deviceId) return res.status(400).json({ error: 'deviceId obligatwa.' });

      // ── Bloke kliyan ──
      if (action === 'suspend') {
        const patchBody = JSON.stringify({
          status: 'suspended',
          notes: notes || `Sispann pa admin — ${new Date().toLocaleDateString('fr-HT')}`
        });
        const result = await httpsRequest(
          `${SUPABASE_URL}/rest/v1/licences?device_id=eq.${encodeURIComponent(deviceId)}`,
          'PATCH', baseHeaders, patchBody
        );
        return res.status(200).json({ success: true, action: 'suspended' });
      }

      // ── Aktive / Renouvle kliyan ──
      if (action === 'activate') {
        const numMonths = parseInt(months) || 1;
        const expiresAt = new Date(Date.now() + numMonths * 31 * 24 * 60 * 60 * 1000).toISOString();
        const activatedAt = new Date().toISOString();

        // Tcheke si deja egziste
        const checkResult = await httpsRequest(
          `${SUPABASE_URL}/rest/v1/licences?device_id=eq.${encodeURIComponent(deviceId)}&select=device_id`,
          'GET', baseHeaders, null
        );
        const existing = checkResult.data || [];

        if (existing.length > 0) {
          // Mete ajou
          const patchBody = JSON.stringify({
            status: 'active',
            plan: plan || 'team',
            expires_at: expiresAt,
            activated_at: activatedAt,
            notes: notes || `Renouvle pa admin — ${numMonths} mwa`
          });
          await httpsRequest(
            `${SUPABASE_URL}/rest/v1/licences?device_id=eq.${encodeURIComponent(deviceId)}`,
            'PATCH', baseHeaders, patchBody
          );
        } else {
          // Kreye nouvo
          const postBody = JSON.stringify({
            device_id: deviceId,
            shop_name: shopName || 'Boutique ClairMarché',
            status: 'active',
            plan: plan || 'team',
            activated_at: activatedAt,
            expires_at: expiresAt,
            whatsapp: whatsapp || null,
            notes: notes || `Kreye pa admin — ${new Date().toLocaleDateString('fr-HT')}`
          });
          await httpsRequest(
            `${SUPABASE_URL}/rest/v1/licences`,
            'POST', { ...baseHeaders, 'Prefer': 'resolution=merge-duplicates' }, postBody
          );
        }

        return res.status(200).json({ success: true, action: 'activated', plan, expires_at: expiresAt });
      }

      // ── Efase kliyan ──
      if (action === 'delete') {
        await httpsRequest(
          `${SUPABASE_URL}/rest/v1/licences?device_id=eq.${encodeURIComponent(deviceId)}`,
          'DELETE', baseHeaders, null
        );
        return res.status(200).json({ success: true, action: 'deleted' });
      }

      return res.status(400).json({ error: `Aksyon "${action}" pa rekonèt.` });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
