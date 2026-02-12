const essayForm = document.getElementById('essayForm');
const essayFile = document.getElementById('essayFile');
const essayMsg = document.getElementById('essayMsg');
const essayResult = document.getElementById('essayResult');

function renderEssayResult(data) {
  if (!essayResult) return;
  essayResult.innerHTML = '';
  if (!data?.analysis) return;
  const a = data.analysis;

  const title = document.createElement('h3');
  title.textContent = 'Analysis';
  essayResult.appendChild(title);

  const band = document.createElement('p');
  band.textContent = `Estimated: ${a.analysis?.band_estimate_range || ''}`;
  essayResult.appendChild(band);

  const strengths = a.analysis?.strengths || [];
  if (strengths.length) {
    const h = document.createElement('h4');
    h.textContent = 'What you did well';
    essayResult.appendChild(h);
    strengths.forEach((t) => {
      const p = document.createElement('p');
      p.textContent = '👍 ' + t;
      essayResult.appendChild(p);
    });
  }

  const weaknesses = a.analysis?.weaknesses || [];
  if (weaknesses.length) {
    const h = document.createElement('h4');
    h.textContent = 'Weak points';
    essayResult.appendChild(h);
    weaknesses.forEach((t) => {
      const p = document.createElement('p');
      p.textContent = '⚠️ ' + t;
      essayResult.appendChild(p);
    });
  }

  const improvements = a.analysis?.improvements || [];
  if (improvements.length) {
    const h = document.createElement('h4');
    h.textContent = 'How to improve';
    essayResult.appendChild(h);
    improvements.forEach((t) => {
      const p = document.createElement('p');
      p.textContent = '✅ ' + t;
      essayResult.appendChild(p);
    });
  }

  if (a.analysis?.band_lift_sentence) {
    const h = document.createElement('h4');
    h.textContent = 'Band lift sentence';
    essayResult.appendChild(h);
    const p = document.createElement('p');
    p.textContent = a.analysis.band_lift_sentence;
    essayResult.appendChild(p);
  }

  if (a.explanation?.zh || a.explanation?.ms) {
    const h = document.createElement('h4');
    h.textContent = 'Chinese / Bahasa';
    essayResult.appendChild(h);
    if (a.explanation?.zh) {
      const p = document.createElement('p');
      p.textContent = `中文: ${a.explanation.zh}`;
      essayResult.appendChild(p);
    }
    if (a.explanation?.ms) {
      const p = document.createElement('p');
      p.textContent = `BM: ${a.explanation.ms}`;
      essayResult.appendChild(p);
    }
  }
}

if (essayForm) {
  essayForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    essayMsg.textContent = '';

    const file = essayFile?.files?.[0];
    if (!file) {
      essayMsg.textContent = 'Please choose an image.';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      essayMsg.textContent = 'File too large. Max 2MB.';
      return;
    }

    essayMsg.textContent = 'Uploading...';

    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch('/api/essay/upload', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      essayMsg.textContent = data?.error || 'Upload failed';
      return;
    }

    essayMsg.textContent = 'Done.';
    renderEssayResult(data);
  });
}
