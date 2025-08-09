const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Update with your PostgreSQL credentials
const pool = new Pool({
  user: 'your_pg_username',
  host: 'localhost',
  database: 'nwp_tourism',
  password: 'your_pg_password',
  port: 5432,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Routes

// Serve uploaded images/files
app.use('/uploads', express.static(uploadDir));

// Get all tourism assets
app.get('/api/assets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tourism_assets ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Upload single asset with optional image
app.post('/api/assets', upload.single('dataFile'), async (req, res) => {
  const { name, category, description, lat, lng } = req.body;
  if (!name || !category || !description || !lat || !lng) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  let image_url = null;
  if (req.file) {
    image_url = '/uploads/' + req.file.filename;
  }
  try {
    const query = `
      INSERT INTO tourism_assets(name, category, description, latitude, longitude, image_url)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    const values = [name, category, description, parseFloat(lat), parseFloat(lng), image_url];
    const result = await pool.query(query, values);
    res.json({ success: true, asset: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save asset' });
  }
});

// Upload GeoJSON file (bulk upload)
app.post('/upload-geojson', upload.single('geojsonFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  // Save last upload filename
  fs.writeFileSync(path.join(__dirname, 'last_upload.json'), JSON.stringify({ filename: req.file.filename }));
  res.json({ success: true, filename: req.file.filename });
});

// Get last uploaded GeoJSON filename
app.get('/api/last-uploaded-geojson', (req, res) => {
  const jsonPath = path.join(__dirname, 'last_upload.json');
  if (fs.existsSync(jsonPath)) {
    const data = JSON.parse(fs.readFileSync(jsonPath));
    res.json(data);
  } else {
    res.json({ filename: null });
  }
});

// Gap analysis endpoint (counts by category)
app.get('/api/gap-analysis', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM tourism_assets
      GROUP BY category
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed gap analysis' });
  }
});

// Serve static HTML pages (optional, fallback to index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});
app.get('/assets.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/assets.html'));
});
app.get('/analysis.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/analysis.html'));
});
app.get('/recommendations.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/recommendations.html'));
});
app.get('/about.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/about.html'));
});

// Serve uploaded GeoJSON files
app.get('/geojson/:filename', (req, res) => {
  const filepath = path.join(uploadDir, req.params.filename);
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).send('File not found');
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

