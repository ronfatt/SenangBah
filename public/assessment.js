const essayForm = document.getElementById('essayForm');
const essayFile = document.getElementById('essayFile');
const essayMsg = document.getElementById('essayMsg');
const essayResult = document.getElementById('essayResult');
const dropzone = document.getElementById('dropzone');
const fileName = document.getElementById('fileName');
const clearFileBtn = document.getElementById('clearFileBtn');
const runBtn = document.getElementById('runBtn');
const diagLoading = document.getElementById('diagLoading');
const diagLoadingFill = document.getElementById('diagLoadingFill');

function renderEssayResult(data) {
  if (!essayResult) return;
  essayResult.innerHTML = '';
  if (!data?.analysis) return;

  const a = data.analysis;

  const title = document.createElement('h3');
  title.textContent = 'Diagnostic Result';
  essayResult.appendChild(title);

  const band = document.createElement('p');
  band.textContent = `Estimated: ${a.analysis?.band_estimate_range || ''}`;
  essayResult.appendChild(band);

  const strengths = a.analysis?.strengths || [];
  if (strengths.length) {
    const h = document.createElement('h4');
    h.textContent = 'Strengths';
    essayResult.appendChild(h);
    strengths.forEach((t) => {
      const p = document.createElement('p');
      p.textContent = '✔ ' + t;
      essayResult.appendChild(p);
    });
  }

  const weaknesses = a.analysis?.weaknesses || [];
  if (weaknesses.length) {
    const h = document.createElement('h4');
    h.textContent = 'Weaknesses';
    essayResult.appendChild(h);
    weaknesses.forEach((t) => {
      const p = document.createElement('p');
      p.textContent = '⚠ ' + t;
      essayResult.appendChild(p);
    });
  }

  const improvements = a.analysis?.improvements || [];
  if (improvements.length) {
    const h = document.createElement('h4');
    h.textContent = 'Improvement Plan';
    essayResult.appendChild(h);
    improvements.forEach((t) => {
      const p = document.createElement('p');
      p.textContent = '→ ' + t;
      essayResult.appendChild(p);
    });
  }

  if (a.analysis?.band_lift_sentence) {
    const h = document.createElement('h4');
    h.textContent = 'Sample Rewrite';
    essayResult.appendChild(h);
    const p = document.createElement('p');
    p.textContent = a.analysis.band_lift_sentence;
    essayResult.appendChild(p);
  }
}

function setFile(file) {
  if (!essayFile || !file) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  essayFile.files = dt.files;
  fileName.textContent = file.name;
  if (clearFileBtn) clearFileBtn.classList.remove('hidden');
}

function clearSelectedFile() {
  if (!essayFile) return;
  essayFile.value = '';
  fileName.textContent = 'No file selected';
  if (clearFileBtn) clearFileBtn.classList.add('hidden');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runProcessingPreview() {
  if (!diagLoading || !diagLoadingFill) return;
  diagLoading.classList.remove('hidden');
  diagLoadingFill.style.width = '0%';
  await sleep(300);
  diagLoadingFill.style.width = '20%';
  await sleep(700);
  diagLoadingFill.style.width = '45%';
  await sleep(800);
  diagLoadingFill.style.width = '72%';
  await sleep(900);
  diagLoadingFill.style.width = '90%';
}

function stopProcessingPreview() {
  if (!diagLoading || !diagLoadingFill) return;
  diagLoadingFill.style.width = '100%';
  setTimeout(() => {
    diagLoading.classList.add('hidden');
    diagLoadingFill.style.width = '0%';
  }, 250);
}

if (dropzone) {
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    setFile(file);
  });
}

if (essayFile) {
  essayFile.addEventListener('change', () => {
    const file = essayFile.files?.[0];
    fileName.textContent = file ? file.name : 'No file selected';
    if (clearFileBtn) clearFileBtn.classList.toggle('hidden', !file);
  });
}

if (clearFileBtn) {
  clearFileBtn.addEventListener('click', () => {
    clearSelectedFile();
    essayMsg.textContent = '';
  });
}

if (essayForm) {
  essayForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    essayMsg.textContent = '';
    essayResult.innerHTML = '';

    const file = essayFile?.files?.[0];
    if (!file) {
      essayMsg.textContent = 'Please choose an image.';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      essayMsg.textContent = 'File too large. Max 2MB.';
      return;
    }

    runBtn.disabled = true;
    runBtn.textContent = 'Running...';

    const loadingPromise = runProcessingPreview();

    const formData = new FormData();
    formData.append('image', file);

    const resPromise = fetch('/api/essay/upload', {
      method: 'POST',
      body: formData
    });

    const [res] = await Promise.all([resPromise, loadingPromise]);
    const data = await res.json();

    stopProcessingPreview();
    runBtn.disabled = false;
    runBtn.textContent = '📊 Run Diagnostic Analysis';

    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      essayMsg.textContent = data?.error || 'Upload failed';
      return;
    }

    essayMsg.textContent = 'Diagnostic completed.';
    renderEssayResult(data);
  });
}
