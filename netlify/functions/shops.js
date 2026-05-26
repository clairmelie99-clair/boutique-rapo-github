const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'shops_db.json');

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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  let db = readDB();

  try {
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ shops: db })
      };
    }

    if (event.httpMethod === 'POST') {
      const newShop = JSON.parse(event.body);
      if (!newShop.id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid shop data' }) };
      }

      // Senkronize / Upsert
      const idx = db.findIndex(s => String(s.id) === String(newShop.id) || (newShop.deviceId && s.deviceId === newShop.deviceId));
      if (idx >= 0) {
        db[idx] = { ...db[idx], ...newShop };
      } else {
        db.push(newShop);
      }

      writeDB(db);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ shops: db })
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
