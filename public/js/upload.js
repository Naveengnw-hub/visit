// This file is included on index.html and assets.html for map and upload handling

const map = L.map('map').setView([7.5, 80.3], 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let boundaryLayer = null;
let pointsLayer = null;

async function loadLastGeoJSON() {
  try {
    const res = await fetch('/api/last-uploaded-geojson');
    const data = await res.json();
    if (data.filename) {
      await loadGeoJSON(data.filename);
    }
  } catch (err) {
    console.error('Failed to load last uploaded GeoJSON:', err);
  }
}

async function loadGeoJSON(filename) {
  try {
    const res = await fetch(`/geojson/${filename}`);
    if (!res.ok) throw new Error('Failed to fetch GeoJSON');
    const geojson = await res.json();

    if (boundaryLayer) map.removeLayer(boundaryLayer);
    if (pointsLayer) map.removeLayer(pointsLayer);

    const polygons = {
      type: 'FeatureCollection',
      features: geojson.features.filter(f => ['Polygon', 'MultiPolygon'].includes(f.geometry.type))
    };
    const points = {
      type: 'FeatureCollection',
      features: geojson.features.filter(f => f.geometry.type === 'Point')
    };

    if (polygons.features.length > 0) {
      boundaryLayer = L.geoJSON(polygons, {
        style: { color: '#2c5c3b', weight: 3, fillOpacity: 0.1 }
      }).addTo(map);
      map.fitBounds(boundaryLayer.getBounds());
    }

    if (points.features.length > 0) {
      pointsLayer = L.geoJSON(points, {
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
          radius: 6,
          fillColor: '#2c5c3b',
          color: '#155724',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        }),
        onEachFeature: (feature, layer) => {
          if (feature.properties) {
            const popupContent = Object.entries(feature.properties)
              .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
              .join('<br>');
            layer.bindPopup(popupContent);
          }
        }
      }).addTo(map);
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadAssets() {
  try {
    const res = await fetch('/api/assets');
    const assets = await res.json();

    if (pointsLayer) {
      map.removeLayer(pointsLayer);
      pointsLayer = null;
    }
    if (!assets.length) return;

    pointsLayer = L.layerGroup();

    assets.forEach(asset => {
      const marker = L.circleMarker([asset.latitude, asset.longitude], {
        radius: 6,
        fillColor: '#ff7800',
        color: '#b35200',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9
      });
      let popupHtml = `<strong>${asset.name}</strong><br>
        Category: ${asset.category}<br>
        ${asset.description}<br>`;
      if (asset.image_url) {
        popupHtml += `<img src="${asset.image_url}" alt="${asset.name}" style="width:100px; margin-top:5px;">`;
      }
      marker.bindPopup(popupHtml);
      pointsLayer.addLayer(marker);
    });

    pointsLayer.addTo(map);
  } catch (err) {
    console.error(err);
  }
}

// Upload handlers for forms on index.html

const assetForm = document.getElementById('asset-upload-form');
const uploadStatus = document.getElementById('upload-status');
const geojsonForm = document.getElementById('geojson-upload-form');
const geojsonUploadStatus = document.getElementById('geojson-upload-status');

if (assetForm) {
  assetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    uploadStatus.textContent = 'Uploading...';

    const formData = new FormData(assetForm);

    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');
      uploadStatus.textContent = 'Upload successful!';
      assetForm.reset();
      loadAssets();
    } catch (err) {
      uploadStatus.textContent = 'Error: ' + err.message;
    }
  });
}

if (geojsonForm) {
  geojsonForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    geojsonUploadStatus.textContent = 'Uploading GeoJSON...';

    const formData = new FormData(geojsonForm);

    try {
      const res = await fetch('/upload-geojson', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Upload failed');

      geojsonUploadStatus.textContent = 'Upload successful! Loading map...';

      await loadGeoJSON(data.filename);
    } catch (err) {
      geojsonUploadStatus.textContent = 'Error: ' + err.message;
    }
  });
}

window.onload = async () => {
  await loadLastGeoJSON();
  await loadAssets();
};

