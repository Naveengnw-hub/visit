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
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// 4. DATABASE INITIALIZATION - Create table if it doesn't exist
async function initializeDatabase() {
  console.log('🔄 Initializing database...');
  try {
    const client = await pool.connect();

    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tourism_assets (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          description TEXT,
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          image_url VARCHAR(500),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tourism_assets_location ON tourism_assets(latitude, longitude);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tourism_assets_category ON tourism_assets(category);
    `);

    // Insert sample data if table is empty
    const countResult = await client.query('SELECT COUNT(*) FROM tourism_assets');
    const count = parseInt(countResult.rows[0].count);

    if (count === 0) {
      await client.query(`
        INSERT INTO tourism_assets (name, category, description, latitude, longitude) VALUES
        ('Sigiriya Lion Rock', 'heritage', 'Ancient rock fortress and palace ruins', 7.9575, 80.7600),
        ('Dambulla Cave Temple', 'religious', 'Buddhist cave temple complex', 7.8566, 80.6483),
        ('Wilpattu National Park', 'nature', 'Largest national park in Sri Lanka', 8.5247, 80.4619),
        ('Anuradhapura Ancient City', 'heritage', 'Ancient capital with Buddhist monuments', 8.3114, 80.4037),
        ('Kurunegala Lake', 'nature', 'Beautiful lake in the heart of Kurunegala', 7.4863, 80.3647)
      `);
      console.log('✅ Sample data inserted successfully');
    }

    client.release();
    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  }
}

// 5. CONFIGURE FILE UPLOADS (Multer)
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadDir); },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage });

// 6. DEFINE ALL API ROUTES

// --- GET: Health check endpoint ---
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM tourism_assets');
    res.json({
      status: 'healthy',
      database: 'connected',
      totalAssets: parseInt(result.rows[0].count)
    });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message
    });
  }
});

// --- GET: Fetch all tourism assets (Read) ---
app.get('/api/assets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tourism_assets ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('ERROR FETCHING ASSETS:', err);
    res.status(500).json({ error: 'Failed to retrieve assets from database.' });
  }
});

// --- POST: Upload a single new asset (Create) ---
app.post('/api/assets', upload.single('dataFile'), async (req, res) => {
  const { name, category, description, lat, lng } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  if (!name || !category || !lat || !lng) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

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
    res.status(500).json({ error: 'Failed to save asset to database.' });
  }
});

// --- PUT: Update a single asset by its ID (Update) ---
app.put('/api/assets/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, description, latitude, longitude } = req.body;

  if (!name || !category || !latitude || !longitude) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const query = `
      UPDATE tourism_assets
      SET name = $1, category = $2, description = $3, latitude = $4, longitude = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 RETURNING *;
    `;
    const values = [name, category, description, parseFloat(latitude), parseFloat(longitude), id];
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('ERROR UPDATING ASSET:', err);
    res.status(500).json({ error: 'Failed to update asset in database.' });
  }
});

// --- DELETE: Remove a single asset by its ID (Delete) ---
app.delete('/api/assets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM tourism_assets WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Asset not found.' });
    }
    res.status(200).json({ message: 'Asset deleted successfully.' });
  } catch (err) {
    console.error('ERROR DELETING ASSET:', err);
    res.status(500).json({ error: 'Failed to delete asset from database.' });
  }
});

// --- POST: Bulk Upload GeoJSON file ---
app.post('/api/geojson-upload', upload.single('geojsonFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No GeoJSON file uploaded.' });
  }

  try {
    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const geojsonData = JSON.parse(fileContent);
    let itemsAdded = 0;

    const getCategory = (properties) => {
      if (properties.tourism) {
        if (['hotel', 'guest_house', 'apartment', 'hostel', 'motel', 'camp_site'].includes(properties.tourism)) return 'accommodation';
        if (['attraction', 'museum', 'viewpoint', 'artwork', 'information', 'picnic_site'].includes(properties.tourism)) return 'heritage';
      }
      if (properties.amenity === 'place_of_worship') return 'religious';
      if (properties.shop || ['restaurant', 'cafe', 'fast_food', 'bar', 'food_court', 'bank', 'townhall', 'police', 'school', 'hospital', 'marketplace'].includes(properties.amenity)) return 'urban';
      if (properties.amenity === 'shelter' || properties.tourism === 'wilderness_hut') return 'nature';
      return 'urban';
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const feature of geojsonData.features) {
        if (feature.geometry.type !== 'Point') {
          continue;
        }

        const name = feature.properties.name || feature.properties['name:en'];
        const description = feature.properties.description || null;
        const [longitude, latitude] = feature.geometry.coordinates;
        const category = getCategory(feature.properties);

        if (name && latitude && longitude) {
          const query = `
            INSERT INTO tourism_assets (name, category, description, latitude, longitude)
            VALUES ($1, $2, $3, $4, $5);
          `;
          const values = [name, category, description, latitude, longitude];
          await client.query(query, values);
          itemsAdded++;
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.status(200).json({
      message: `Successfully imported ${itemsAdded} assets from the GeoJSON file.`,
      filename: req.file.originalname
    });

  } catch (err) {
    console.error('ERROR PROCESSING GEOJSON:', err);
    res.status(500).json({ error: 'Failed to process GeoJSON file.' });
  }
});

// --- GET: Gap analysis data for charts ---
app.get('/api/gap-analysis', async (req, res) => {
  try {
    const query = 'SELECT category, COUNT(*) as count FROM tourism_assets GROUP BY category ORDER BY count DESC;';
    const result = await pool.query(query);

    const analysis = {};
    result.rows.forEach(row => {
      analysis[row.category] = parseInt(row.count, 10);
    });

    res.json(analysis);
  } catch (err) {
    console.error('ERROR FETCHING GAP ANALYSIS:', err);
    res.status(500).json({ error: 'Failed to retrieve gap analysis.' });
  }
});

// 7. INITIALIZE DATABASE AND START SERVER
async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`🌐 Production URL: https://tourism-gap-gnw.up.railway.app/`);
  });
}

startServer().catch(console.error);
