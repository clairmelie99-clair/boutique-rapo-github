// Vercel Serverless Function: api/check-license.js
// Verifye estati lisans yon aparèy an tan reyèl nan Supabase.
// Rele pa app kliyan an chak fwa li ouvri (si li gen entènèt).

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
    // Si baz done poko konfigire, kite app la travay (mòd deградasyon gracieux)
    return res.status(200).json({ status: 'active', plan: 'enterprise', source: 'fallback' });
  }

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/licences?device_id=eq.${encodeURIComponent(deviceId)}&select=status,plan,expires_at,shop_name`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!resp.ok) {
      // Si baz done pa reponn, pèmèt app la kontinye (mòd ibrid)
      return res.status(200).json({ status: 'unknown', source: 'db_error' });
    }

    const rows = await resp.json();

    if (!rows || rows.length === 0) {
      // Aparèy poko nan baz done — kite li nan mòd essai
      return res.status(200).json({ status: 'not_found', source: 'db' });
    }

    const lic = rows[0];
    const now = Date.now();
    const expiresAt = lic.expires_at ? new Date(lic.expires_at).getTime() : null;

    // Si lisans te aktif men li ekspire kounye a
    let effectiveStatus = lic.status;
    if (effectiveStatus === 'active' && expiresAt && now > expiresAt) {
      effectiveStatus = 'expired';
    }

    return res.status(200).json({
      status: effectiveStatus,   // 'active' | 'suspended' | 'expired' | 'trial'
      plan: lic.plan,
      expires_at: lic.expires_at,
      shop_name: lic.shop_name,
      source: 'db'
    });

  } catch (err) {
    // Erè entèn — pèmèt app la kontinye (pa bloke kliyan si sèvè a gen pwoblèm)
    return res.status(200).json({ status: 'unknown', source: 'exception', error: err.message });
  }
}
