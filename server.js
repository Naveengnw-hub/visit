// server.js

// 1. IMPORT DEPENDENCIES
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 2. INITIALIZE APP & MIDDLEWARE
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // To parse JSON bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files (HTML, CSS, JS) from the 'public' directory

// Serve uploaded images and geojson files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/geojson', express.static(path.join(__dirname, 'uploads')));


// 3. CONFIGURE DATABASE CONNECTION
// IMPORTANT: Replace these with your actual database credentials.
// It is highly recommended to use environment variables for this in a real project.
const pool = new Pool({
  user: 'your_db_user',       // e.g., 'postgres'
  host: 'localhost',
  database: 'your_db_name',    // e.g., 'nwp_tourism'
  password: 'your_db_password',
  port: 5432,
});

// 4. CONFIGURE FILE UPLOADS (Multer)
// Create the 'uploads' directory if it doesn't exist
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Save files to the 'uploads' directory
  },
  filename: (req, file, cb) => {
    // Use a timestamp to ensure unique filenames
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// A simple variable to keep track of the last uploaded GeoJSON
let lastUploadedGeoJSON = null;


// 5. DEFINE API ROUTES WITH ERROR HANDLING

// --- GET: Fetch all tourism assets ---
app.get('/api/assets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tourism_assets ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('ERROR FETCHING ASSETS:', err);
    res.status(500).json({ error: 'Failed to retrieve assets from database.' });
  }
});

// --- POST: Upload a single new asset ---
app.post('/api/assets', upload.single('dataFile'), async (req, res) => {
  const { name, category, description, lat, lng } = req.body;
  // The path to the uploaded image, accessible by the browser
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  if (!name || !category || !description || !lat || !lng) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const query = `
      INSERT INTO tourism_assets (name, category, description, latitude, longitude, image_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [name, category, description, parseFloat(lat), parseFloat(lng), imageUrl];
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('ERROR INSERTING ASSET:', err);
    res.status(500).json({ error: 'Failed to save asset to database.' });
  }
});


// --- GET: Gap analysis (count of assets by category) ---
app.get('/api/gap-analysis', async (req, res) => {
  try {
    const query = 'SELECT category, COUNT(*) as count FROM tourism_assets GROUP BY category;';
    const result = await pool.query(query);

    // Format the data as a simple object {category: count}
    const analysis = result.rows.reduce((acc, row) => {
      acc[row.category] = parseInt(row.count, 10);
      return acc;
    }, {});

    res.json(analysis);
  } catch (err) {
    // This is the fix for your 500 error. It logs the real error and sends a clean response.
    console.error('ERROR FETCHING GAP ANALYSIS:', err);
    res.status(500).json({ error: 'Failed to retrieve gap analysis.' });
  }
});

// --- POST: Upload a GeoJSON file ---
app.post('/api/geojson-upload', upload.single('geojsonFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No GeoJSON file uploaded.' });
  }
  // Store the filename to be retrieved by the assets page
  lastUploadedGeoJSON = req.file.filename;
  res.status(200).json({
    message: 'GeoJSON file uploaded successfully.',
    filename: lastUploadedGeoJSON
  });
});

// --- GET: Get the filename of the last uploaded GeoJSON ---
app.get('/api/last-uploaded-geojson', (req, res) => {
  if (lastUploadedGeoJSON) {
    res.json({ filename: lastUploadedGeoJSON });
  } else {
    // If no file has been uploaded yet, send back nothing or a default
    res.status(404).json({ error: 'No GeoJSON file has been uploaded yet.' });
  }
});


// 6. START THE SERVER
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
