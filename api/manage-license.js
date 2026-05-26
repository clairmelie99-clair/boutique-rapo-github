// api/manage-license.js — v4 (node-fetch)
import fetch from 'node-fetch';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const masterKey = req.headers['x-master-key'] || req.query.key;
  const MASTER_API_KEY = process.env.MASTER_API_KEY;
  if (!MASTER_API_KEY || masterKey !== MASTER_API_KEY) {
    return res.status(401).json({ error: 'Aksè refize.', version: 'v4' });
  }

  const SB = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB || !KEY) return res.status(500).json({ error: 'Baz done pa konfigire.', version: 'v4' });

  const H = {
    'apikey': KEY,
    'Authorization': `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const sbFetch = (path, method = 'GET', body = null) => {
    const opts = { method, headers: H };
    if (body) opts.body = JSON.stringify(body);
    return fetch(`${SB}/rest/v1/${path}`, opts).then(r => r.json().catch(() => []));
  };

  try {
    const action = req.method === 'GET' ? 'list' : (req.body?.action || 'list');

    if (action === 'list') {
      const data = await sbFetch('licences?select=*&order=created_at.desc');
      const licences = Array.isArray(data) ? data : [];
      return res.status(200).json({ licences, count: licences.length, version: 'v4' });
    }

    const { deviceId, plan, months, notes, shopName, whatsapp } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: 'deviceId obligatwa.' });

    if (action === 'suspend') {
      await sbFetch(`licences?device_id=eq.${encodeURIComponent(deviceId)}`, 'PATCH',
        { status: 'suspended', notes: notes || `Sispann pa admin — ${new Date().toLocaleDateString('fr-HT')}` });
      return res.status(200).json({ success: true, action: 'suspended', version: 'v4' });
    }

    if (action === 'activate') {
      const numMonths = parseInt(months) || 1;
      const expiresAt = new Date(Date.now() + numMonths * 31 * 24 * 60 * 60 * 1000).toISOString();
      const activatedAt = new Date().toISOString();
      const existing = await sbFetch(`licences?device_id=eq.${encodeURIComponent(deviceId)}&select=device_id`);
      const exists = Array.isArray(existing) && existing.length > 0;

      if (exists) {
        await sbFetch(`licences?device_id=eq.${encodeURIComponent(deviceId)}`, 'PATCH',
          { status: 'active', plan: plan || 'team', expires_at: expiresAt, activated_at: activatedAt,
            notes: notes || `Renouvle pa admin — ${numMonths} mwa` });
      } else {
        await sbFetch('licences', 'POST',
          { device_id: deviceId, shop_name: shopName || 'Boutique ClairMarché',
            status: 'active', plan: plan || 'team', activated_at: activatedAt,
            expires_at: expiresAt, whatsapp: whatsapp || null, notes: notes || `Kreye pa admin` });
      }
      return res.status(200).json({ success: true, action: 'activated', plan, expires_at: expiresAt, version: 'v4' });
    }

    if (action === 'delete') {
      await sbFetch(`licences?device_id=eq.${encodeURIComponent(deviceId)}`, 'DELETE');
      return res.status(200).json({ success: true, action: 'deleted', version: 'v4' });
    }

    return res.status(400).json({ error: `Aksyon "${action}" pa rekonèt.` });

  } catch (err) {
    return res.status(500).json({ error: err.message, code: err.code, version: 'v4' });
  }
}
