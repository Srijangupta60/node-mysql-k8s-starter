'use strict';

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'cruduser',
  password: process.env.DB_PASSWORD || 'crudpassword',
  database: process.env.DB_NAME || 'cruddb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validateUser(body) {
  const fields = ['name', 'fathername', 'address', 'pincode'];
  const user = {};
  for (const field of fields) {
    if (typeof body[field] !== 'string' || body[field].trim() === '') {
      return { error: `${field} is required and must be a non-empty string.` };
    }
    user[field] = body[field].trim();
  }

  if (user.name.length > 100) return { error: 'name must be 100 characters or fewer.' };
  if (user.fathername.length > 100) return { error: 'fathername must be 100 characters or fewer.' };
  if (user.address.length > 255) return { error: 'address must be 255 characters or fewer.' };
  if (user.pincode.length > 20) return { error: 'pincode must be 20 characters or fewer.' };
  return { user };
}

async function listUsers(_req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, fathername, address, pincode, created_at, updated_at FROM users ORDER BY id DESC'
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('List users failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not fetch users.' });
  }
}

// Health endpoint for Docker/Kubernetes readiness checks.
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

// Home and GetUser both return the records used by the frontend table.
app.get('/app/home', listUsers);
app.get('/app/getUser', listUsers);

app.post('/app/addUser', async (req, res) => {
  const validation = validateUser(req.body || {});
  if (validation.error) {
    return res.status(400).json({ success: false, message: validation.error });
  }

  try {
    const { name, fathername, address, pincode } = validation.user;
    const [result] = await pool.execute(
      'INSERT INTO users (name, fathername, address, pincode) VALUES (?, ?, ?, ?)',
      [name, fathername, address, pincode]
    );
    return res.status(201).json({
      success: true,
      message: 'User added successfully.',
      id: result.insertId
    });
  } catch (error) {
    console.error('Add user failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not add user.' });
  }
});

// PUT /app/updateUser/:id — body must include all four user fields.
app.put('/app/updateUser/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'A valid user ID is required.' });

  const validation = validateUser(req.body || {});
  if (validation.error) {
    return res.status(400).json({ success: false, message: validation.error });
  }

  try {
    const { name, fathername, address, pincode } = validation.user;
    const [result] = await pool.execute(
      'UPDATE users SET name = ?, fathername = ?, address = ?, pincode = ? WHERE id = ?',
      [name, fathername, address, pincode, id]
    );

    // affectedRows can be 0 when a record exists but values did not change, so check existence.
    if (result.affectedRows === 0) {
      const [rows] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
    }

    return res.status(200).json({ success: true, message: 'User updated successfully.' });
  } catch (error) {
    console.error('Update user failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not update user.' });
  }
});

app.delete('/app/deleteUser/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'A valid user ID is required.' });

  try {
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not delete user.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

const server = app.listen(PORT, () => {
  console.log(`CRUD API listening on port ${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down API...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
