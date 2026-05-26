// api/check-license.js — v4 (node-fetch)
import fetch from 'node-fetch';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const { deviceId } = req.query;
  if (!deviceId || deviceId.length < 3) {
    return res.status(400).json({ error: 'deviceId obligatwa.', version: 'v4' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(200).json({ status: 'active', plan: 'enterprise', source: 'fallback', version: 'v4' });
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/licences?device_id=eq.${encodeURIComponent(deviceId)}&select=status,plan,expires_at,shop_name`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!resp.ok) {
      return res.status(200).json({ status: 'unknown', source: 'db_error', http: resp.status, version: 'v4' });
    }

    const rows = await resp.json();

    if (!rows || rows.length === 0) {
      // Auto-register this device as a trial!
      const insertUrl = `${SUPABASE_URL}/rest/v1/licences`;
      await fetch(insertUrl, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          device_id: deviceId,
          shop_name: 'Boutique ClairMarché',
          status: 'trial',
          plan: 'solo',
          notes: 'Enskri otomatikman nan premye ouvèti'
        })
      }).catch(() => {});

      return res.status(200).json({
        status: 'trial',
        plan: 'solo',
        source: 'db_auto',
        version: 'v4'
      });
    }

    const lic = rows[0];
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
      version: 'v4'
    });

  } catch (err) {
    return res.status(200).json({
      status: 'unknown', source: 'exception',
      error: err.message, code: err.code, version: 'v4'
    });
  }
}
