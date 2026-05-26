// Vercel Serverless Function: api/manage-license.js
// Kontwòl a distans: Bloke, Deblike, Renouvle, ak Lis tout kliyan yo.
// PWOTEJE ak MASTER_API_KEY — Sèlman MASTER-DEV ou a ka rele endpoint sa a!

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Verifye kle sekrè MASTER a ──────────────────────────────────────────
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

  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // ── GET: Jwenn lis tout kliyan yo ──────────────────────────────────────
    if (req.method === 'GET') {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/licences?select=*&order=created_at.desc`,
        { headers }
      );
      const data = await resp.json();
      return res.status(200).json({ licences: data, count: data.length });
    }

    // ── POST: Aksyon sou yon kliyan ─────────────────────────────────────────
    if (req.method === 'POST') {
      const { action, deviceId, plan, months, notes, shopName, whatsapp } = req.body || {};

      if (!action) return res.status(400).json({ error: 'action obligatwa.' });

      // ── Lis tout kliyan (via POST tou) ──
      if (action === 'list') {
        const resp = await fetch(
          `${SUPABASE_URL}/rest/v1/licences?select=*&order=created_at.desc`,
          { headers }
        );
        const data = await resp.json();
        return res.status(200).json({ licences: data, count: data.length });
      }

      if (!deviceId) return res.status(400).json({ error: 'deviceId obligatwa pou aksyon sa a.' });

      // ── Bloke kliyan (Suspend) ──
      if (action === 'suspend') {
        const resp = await fetch(
          `${SUPABASE_URL}/rest/v1/licences?device_id=eq.${encodeURIComponent(deviceId)}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              status: 'suspended',
              notes: notes || `Sispann pa admin — ${new Date().toLocaleDateString('fr-HT')}`
            })
          }
        );
        const data = await resp.json();
        return res.status(200).json({ success: true, action: 'suspended', updated: data });
      }

      // ── Deblike / Aktive / Renouvle kliyan ──
      if (action === 'activate') {
        const numMonths = parseInt(months) || 1;
        const expiresAt = new Date(Date.now() + numMonths * 31 * 24 * 60 * 60 * 1000).toISOString();
        const activatedAt = new Date().toISOString();

        // Tcheke si kliyan deja egziste
        const checkResp = await fetch(
          `${SUPABASE_URL}/rest/v1/licences?device_id=eq.${encodeURIComponent(deviceId)}&select=device_id`,
          { headers }
        );
        const existing = await checkResp.json();

        let resp;
        if (existing && existing.length > 0) {
          // Mete ajou si deja la
          resp = await fetch(
            `${SUPABASE_URL}/rest/v1/licences?device_id=eq.${encodeURIComponent(deviceId)}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                status: 'active',
                plan: plan || 'team',
                expires_at: expiresAt,
                activated_at: activatedAt,
                notes: notes || `Renouvle pa admin — ${numMonths} mwa`
              })
            }
          );
        } else {
          // Kreye si poko egziste
          resp = await fetch(
            `${SUPABASE_URL}/rest/v1/licences`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify({
                device_id: deviceId,
                shop_name: shopName || 'Boutique ClairMarché',
                status: 'active',
                plan: plan || 'team',
                activated_at: activatedAt,
                expires_at: expiresAt,
                whatsapp: whatsapp || null,
                notes: notes || `Kreye pa admin — ${new Date().toLocaleDateString('fr-HT')}`
              })
            }
          );
        }

        const data = await resp.json();
        return res.status(200).json({
          success: true,
          action: 'activated',
          plan,
          expires_at: expiresAt,
          updated: data
        });
      }

      // ── Efase kliyan nèt ──
      if (action === 'delete') {
        const resp = await fetch(
          `${SUPABASE_URL}/rest/v1/licences?device_id=eq.${encodeURIComponent(deviceId)}`,
          { method: 'DELETE', headers }
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
