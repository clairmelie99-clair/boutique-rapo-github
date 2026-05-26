const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'orders_db.json');

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

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  let db = readDB();

  try {
    if (event.httpMethod === 'GET') {
      const { deviceId, shopIds } = event.queryStringParameters || {};
      let filtered = [...db];

      if (shopIds) {
        const ids = shopIds.split(',');
        filtered = filtered.filter(o => ids.includes(String(o.shopId)));
      } else if (deviceId) {
        filtered = filtered.filter(o => o.deviceId === deviceId);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ orders: filtered })
      };
    }

    if (event.httpMethod === 'POST') {
      const newOrder = JSON.parse(event.body);
      if (!newOrder.id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid order data' }) };
      }

      // Anpeche double kòmand
      db = db.filter(o => String(o.id) !== String(newOrder.id));
      db.unshift(newOrder);
      writeDB(db);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ order: newOrder })
      };
    }

    if (event.httpMethod === 'PATCH') {
      const updates = JSON.parse(event.body);
      const idx = db.findIndex(o => String(o.id) === String(updates.id));
      
      if (idx === -1) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Order not found' }) };
      }

      db[idx] = { ...db[idx], ...updates };
      writeDB(db);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ order: db[idx] })
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
