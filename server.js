// server.js

// 1. IMPORT DEPENDENCIES
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 2. INITIALIZE APP & MIDDLEWARE
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// 3. CONFIGURE DATABASE CONNECTION
// THIS IS THE FINAL, CORRECTED VERSION FOR PRODUCTION
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // This is the key setting for services like Railway
  }
});

// 4. CONFIGURE FILE UPLOADS (Multer)
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadDir); },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage });

// 5. DEFINE API ROUTES

// --- GET: Fetch all tourism assets (Read) ---
app.get('/api/assets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tourism_assets ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('ERROR FETCHING ASSETS:', err);
    res.status(500).json({ error: 'Failed to retrieve assets.' });
  }
});

// --- POST: Upload a single new asset (Create) ---
app.post('/api/assets', upload.single('dataFile'), async (req, res) => {
  const { name, category, description, lat, lng } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  if (!name || !category || !lat || !lng) return res.status(400).json({ error: 'Missing fields.' });
  try {
    const query = `
      INSERT INTO tourism_assets (name, category, description, latitude, longitude, image_url)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
    `;
    const values = [name, category, description, parseFloat(lat), parseFloat(lng), imageUrl];
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('ERROR INSERTING ASSET:', err);
    res.status(500).json({ error: 'Failed to save asset.' });
  }
});

// --- PUT: Update a single asset by its ID (Update) ---
app.put('/api/assets/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, description, latitude, longitude } = req.body;
  if (!name || !category || !latitude || !longitude) return res.status(400).json({ error: 'Missing fields.' });
  try {
    const query = `
      UPDATE tourism_assets
      SET name = $1, category = $2, description = $3, latitude = $4, longitude = $5
      WHERE id = $6 RETURNING *;
    `;
    const values = [name, category, description, parseFloat(latitude), parseFloat(longitude), id];
    const result = await pool.query(query, values);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Asset not found.' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('ERROR UPDATING ASSET:', err);
    res.status(500).json({ error: 'Failed to update asset.' });
  }
});

// --- DELETE: Remove a single asset by its ID (Delete) ---
app.delete('/api/assets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM tourism_assets WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Asset not found.' });
    res.status(200).json({ message: 'Asset deleted successfully.' });
  } catch (err) {
    console.error('ERROR DELETING ASSET:', err);
    res.status(500).json({ error: 'Failed to delete asset.' });
  }
});

// --- POST: Bulk Upload GeoJSON file ---
app.post('/api/geojson-upload', upload.single('geojsonFile'), async (req, res) => {
  // ... (This route remains the same as the previous version)
});

// --- GET: Gap analysis data for charts ---
app.get('/api/gap-analysis', async (req, res) => {
  // ... (This route remains the same as the previous version)
});

// 6. START THE SERVER
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
