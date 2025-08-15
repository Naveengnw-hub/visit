// public/js/upload.js

document.addEventListener('DOMContentLoaded', () => {
  const assetUploadForm = document.getElementById('asset-upload-form');
  const uploadStatus = document.getElementById('upload-status');
  const geojsonUploadForm = document.getElementById('geojson-upload-form');
  const geojsonUploadStatus = document.getElementById('geojson-upload-status');

  // --- Handle Single Asset Form Submission ---
  if (assetUploadForm) {
    assetUploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      uploadStatus.textContent = 'Uploading...';
      uploadStatus.style.color = 'var(--text-color)';

      const formData = new FormData(assetUploadForm);

      try {
        const res = await fetch('/api/assets', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          uploadStatus.textContent = 'Asset uploaded successfully!';
          uploadStatus.style.color = 'var(--primary-color)';
          assetUploadForm.reset();
        } else {
          const result = await res.json();
          uploadStatus.textContent = `Error: ${result.error || 'Failed to upload asset.'}`;
          uploadStatus.style.color = 'red';
        }
      } catch (err) {
        uploadStatus.textContent = 'An error occurred. Please check the console.';
        uploadStatus.style.color = 'red';
        console.error('Upload failed:', err);
      }
    });
  }

  // --- Handle GeoJSON Form Submission ---
  if (geojsonUploadForm) {
    geojsonUploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      geojsonUploadStatus.textContent = 'Uploading...';
      geojsonUploadStatus.style.color = 'var(--text-color)';

      const formData = new FormData(geojsonUploadForm);

      try {
        const res = await fetch('/api/geojson-upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const result = await res.json();
          geojsonUploadStatus.textContent = `File '${result.filename}' uploaded successfully.`;
          geojsonUploadStatus.style.color = 'var(--primary-color)';
          geojsonUploadForm.reset();
        } else {
          const result = await res.json();
          geojsonUploadStatus.textContent = `Error: ${result.error || 'Failed to upload GeoJSON.'}`;
          geojsonUploadStatus.style.color = 'red';
        }
      } catch (err) {
        geojsonUploadStatus.textContent = 'An error occurred. Please check the console.';
        geojsonUploadStatus.style.color = 'red';
        console.error('GeoJSON upload failed:', err);
      }
    });
  }

  // --- Fetch Gap Analysis Data (Moved from old upload.js logic) ---
  const gapAnalysisResult = document.getElementById('gap-analysis-result');
  if (gapAnalysisResult) {
    async function loadGapAnalysis() {
      try {
        const res = await fetch('/api/gap-analysis');
        const analysis = await res.json();

        if (Object.keys(analysis).length === 0) {
          gapAnalysisResult.textContent = 'No asset data available for analysis.';
          return;
        }

        let text = 'Asset Counts by Category:\n\n';
        Object.entries(analysis).forEach(([category, count]) => {
          const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);
          text += `${formattedCategory}: ${count}\n`;
        });
        gapAnalysisResult.textContent = text;
      } catch (err) {
        gapAnalysisResult.textContent = 'Failed to load gap analysis.';
      }
    }
    loadGapAnalysis();
  }
});
