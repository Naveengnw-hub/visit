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
        const res = await fetch('/api/assets', { method: 'POST', body: formData });
        if (res.ok) {
          uploadStatus.textContent = 'Asset uploaded successfully!';
          uploadStatus.style.color = 'var(--primary-color)';
          assetUploadForm.reset();
          // After a successful upload, refresh the gap analysis
          loadGapAnalysis();
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
        const res = await fetch('/api/geojson-upload', { method: 'POST', body: formData });
        if (res.ok) {
          const result = await res.json();
          geojsonUploadStatus.textContent = `File '${result.filename}' uploaded successfully.`;
          geojsonUploadStatus.style.color = 'var(--primary-color)';
          geojsonUploadForm.reset();
          // After a successful upload, refresh the gap analysis
          loadGapAnalysis();
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

  // --- Fetch Gap Analysis Data for the Homepage ---
  // CHANGED: This function now builds a styled list
  const gapAnalysisList = document.getElementById('gap-analysis-list');
  async function loadGapAnalysis() {
    if (!gapAnalysisList) return; // Only run if the element exists
    try {
      const res = await fetch('/api/gap-analysis');
      const analysis = await res.json();

      gapAnalysisList.innerHTML = ''; // Clear the list

      if (analysis.labels.length === 0) {
        gapAnalysisList.innerHTML = '<li>No asset data available for analysis.</li>';
        return;
      }

      analysis.labels.forEach((label, index) => {
        const count = analysis.data[index];
        const listItem = document.createElement('li');
        listItem.innerHTML = `<span class="analysis-label">${label}</span><span class="analysis-value">${count}</span>`;
        gapAnalysisList.appendChild(listItem);
      });

    } catch (err) {
      gapAnalysisList.innerHTML = '<li>Failed to load analysis.</li>';
    }
  }
  // Load the analysis when the page first loads
  loadGapAnalysis();
});