const profileForm = document.getElementById('profileForm');
const profileMsg = document.getElementById('profileMsg');
const logoutBtn = document.getElementById('logoutBtn');
const dayStatus = document.getElementById('dayStatus');
const focusStatus = document.getElementById('focusStatus');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const starCount = document.getElementById('starCount');
const writingMeta = document.getElementById('writingMeta');
const writingStars = document.getElementById('writingStars');
const vocabMeta = document.getElementById('vocabMeta');
const vocabStars = document.getElementById('vocabStars');
const grammarStars = document.getElementById('grammarStars');
const essayForm = document.getElementById('essayForm');
const essayFile = document.getElementById('essayFile');
const essayMsg = document.getElementById('essayMsg');
const essayResult = document.getElementById('essayResult');

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return { ok: res.ok, data: await res.json() };
}

async function loadProfile() {
  const res = await fetch('/api/me');
  if (!res.ok) {
    window.location.href = '/login.html';
    return;
  }
  const data = await res.json();
  profileForm.name.value = data.name || '';
  profileForm.class_name.value = data.class_name || '';
  profileForm.teacher_name.value = data.teacher_name || '';
  profileForm.estimated_band.value = data.estimated_band || 4;
}

async function loadDashboardStatus() {
  const res = await fetch('/api/dashboard');
  if (!res.ok) return;
  const data = await res.json();
  dayStatus.textContent = `Day ${data.day_index} of ${data.total_days}`;
  focusStatus.textContent = data.focus || 'Writing Focus';
  if (progressFill && progressLabel) {
    const completed = data.completed_days || 0;
    const total = data.total_days || 14;
    const percent = Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
    progressFill.style.width = `${percent}%`;
    progressLabel.textContent = `Progress: ${completed}/${total}`;
  }
  if (starCount) {
    starCount.textContent = data.total_stars ?? (data.completed_days || 0);
  }
  if (writingMeta) {
    writingMeta.textContent = `Day ${data.day_index} of ${data.total_days}`;
  }
  if (writingStars) {
    writingStars.textContent = data.completed_days ?? 0;
  }
  if (vocabMeta) {
    vocabMeta.textContent = data.vocab_today_done ? 'Today: Done' : 'Today: Not done';
  }
  if (vocabStars) {
    vocabStars.textContent = data.vocab_total_stars ?? 0;
  }
  if (grammarStars) {
    grammarStars.textContent = data.grammar_total_stars ?? 0;
  }
}

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  profileMsg.textContent = '';
  const formData = new FormData(profileForm);
  const payload = Object.fromEntries(formData.entries());
  payload.estimated_band = Number(payload.estimated_band || 4);
  const res = await postJSON('/api/profile', payload);
  if (!res.ok) {
    profileMsg.textContent = res.data?.error || 'Save failed';
    return;
  }
  profileMsg.textContent = 'Saved.';
});

logoutBtn.addEventListener('click', async () => {
  await postJSON('/api/auth/logout', {});
  window.location.href = '/login.html';
});

loadProfile();
loadDashboardStatus();

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
    h.textContent = '中文 / Bahasa';
    essayResult.appendChild(h);
    if (a.explanation?.zh) {
      const p = document.createElement('p');
      p.textContent = `中文：${a.explanation.zh}`;
      essayResult.appendChild(p);
    }
    if (a.explanation?.ms) {
      const p = document.createElement('p');
      p.textContent = `BM：${a.explanation.ms}`;
      essayResult.appendChild(p);
    }
  }
}

if (essayForm) {
  essayForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    essayMsg.textContent = '';
    const file = essayFile?.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      essayMsg.textContent = 'File too large. Max 2MB.';
      return;
    }
    essayMsg.textContent = 'Uploading...';
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch('/api/essay/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      essayMsg.textContent = data?.error || 'Upload failed';
      return;
    }
    essayMsg.textContent = 'Done.';
    renderEssayResult(data);
  });
}
