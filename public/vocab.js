let sessionId = null;
let currentStep = null;
let currentData = null;
let lastWordFocus = 'Vocabulary Engine';

const startBtn = document.getElementById('startBtn');
const submitBtn = document.getElementById('submitBtn');
const logoutBtn = document.getElementById('logoutBtn');
const taskCard = document.getElementById('taskCard');
const doneCard = document.getElementById('doneCard');
const shareDownloadBtn = document.getElementById('shareDownloadBtn');
const shareCaptionBtn = document.getElementById('shareCaptionBtn');
const shareStatus = document.getElementById('shareStatus');

const taskTitle = document.getElementById('taskTitle');
const taskInstructions = document.getElementById('taskInstructions');
const taskItems = document.getElementById('taskItems');
const inputArea = document.getElementById('inputArea');
const progressInfo = document.getElementById('progressInfo');
const stepInfo = document.getElementById('stepInfo');
const wordHelper = document.getElementById('wordHelper');
const textAnswer = document.getElementById('textAnswer');
const wordCount = document.getElementById('wordCount');
const vocabError = document.getElementById('vocabError');

async function postJSON(url, data) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = { error: res.ok ? 'invalid_response' : 'server_error' };
    }
    return { ok: res.ok, data: payload };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { ok: false, data: { error: 'timeout', message: 'Request timed out. Please try again.' } };
    }
    return { ok: false, data: { error: 'network_error', message: 'Network error. Please try again.' } };
  } finally {
    clearTimeout(timeout);
  }
}

function setBtnLoading(btn, isLoading, loadingText, idleText) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.classList.toggle('is-loading', isLoading);
  btn.textContent = isLoading ? loadingText : idleText;
}

function clearNode(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function buildShareCanvas({ moduleName, resultLine, suggestion }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 1080, 1350);
  grad.addColorStop(0, '#0B1220');
  grad.addColorStop(1, '#111827');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 56px Arial';
  ctx.fillText('SenangBah Progress Card', 80, 140);
  ctx.fillStyle = '#93C5FD';
  ctx.font = '600 34px Arial';
  ctx.fillText(moduleName, 80, 220);
  ctx.fillStyle = '#FF6B00';
  ctx.font = '700 52px Arial';
  ctx.fillText(resultLine, 80, 340);
  ctx.fillStyle = '#E5E7EB';
  ctx.font = '400 36px Arial';
  ctx.fillText('AI Suggestion:', 80, 450);
  ctx.fillText(suggestion.slice(0, 64), 80, 510);
  ctx.fillText(suggestion.slice(64, 128), 80, 560);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '400 30px Arial';
  ctx.fillText('#SPM #SPMEnglish #SenangBah', 80, 1260);
  return canvas;
}

function setShareStatus(text) {
  if (!shareStatus) return;
  shareStatus.textContent = text;
}

function toTitleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeQuotes(text) {
  return String(text || "")
    .replace(/’([^’]+)’/g, "‘$1’")
    .replace(/'([^']+)'/g, "‘$1’");
}

function normalizeWordFocusTitle(title) {
  const raw = String(title || "");
  const match = raw.match(/^word\s*focus\s*:\s*(.+)$/i);
  if (!match) return normalizeQuotes(raw);
  return `Word Focus: ${toTitleCase(match[1])}`;
}

function renderTask(data) {
  currentData = data;
  if (data?.title) {
    lastWordFocus = normalizeWordFocusTitle(data.title || 'Vocabulary Engine');
  }
  taskCard.style.display = 'block';
  doneCard.style.display = 'none';

  taskTitle.textContent = normalizeWordFocusTitle(data.title || 'Word Focus');
  taskInstructions.textContent = normalizeQuotes(data.instructions || '');
  clearNode(taskItems);
  if (vocabError) vocabError.textContent = '';

  const item = data.items?.[0];
  if (item) {
    const prompt = document.createElement('p');
    prompt.className = 'prompt';
    prompt.textContent = normalizeQuotes(item.prompt);
    taskItems.appendChild(prompt);

    if (item.hints?.length) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'Hint: ' + normalizeQuotes(item.hints[0]);
      taskItems.appendChild(hint);
    }
  }

  if (data.task_type === 'mcq') {
    wordHelper.style.display = 'block';
    const choices = item?.choices || [];
    choices.forEach((choice, i) => {
      const label = document.createElement('label');
      label.className = 'choice';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'mcq';
      radio.value = choice;
      if (i === 0) radio.checked = true;
      label.appendChild(radio);
      label.appendChild(document.createTextNode(normalizeQuotes(choice)));
      taskItems.appendChild(label);
    });
  } else {
    wordHelper.style.display = currentStep === 'vocab_reinforce' ? 'none' : 'block';
  }

  const writeCard = document.querySelector('.vocab-write-card');
  if (writeCard) {
    writeCard.style.display = currentStep === 'vocab_reinforce' ? 'none' : 'block';
  }

  if (data.next_question) {
    progressInfo.textContent = normalizeQuotes(data.next_question);
  } else {
    progressInfo.textContent = `Step: ${currentStep}`;
  }
}

function getStudentAnswer() {
  if (currentData?.task_type === 'mcq') {
    const selected = document.querySelector('input[name="mcq"]:checked');
    return selected ? selected.value : '';
  }
  return textAnswer ? textAnswer.value : '';
}

function updateStepInfo(step) {
  const order = ['vocab_warmup', 'vocab_apply', 'vocab_reinforce'];
  const idx = order.indexOf(step);
  const stepNum = idx === -1 ? 1 : idx + 1;
  stepInfo.textContent = `Step ${stepNum} of 3`;
}

startBtn.addEventListener('click', async () => {
  setBtnLoading(startBtn, true, 'Starting...', 'Start');
  const res = await postJSON('/api/vocab/start', {});
  setBtnLoading(startBtn, false, 'Starting...', 'Start');
  if (!res.ok) return alert(res.data?.message || res.data?.error || 'Failed to start');
  if (res.data.done && !res.data.step) {
    taskCard.style.display = 'none';
    doneCard.style.display = 'block';
    return;
  }
  sessionId = res.data.session_id;
  currentStep = res.data.step;
  updateStepInfo(currentStep);
  renderTask(res.data.data);
});

submitBtn.addEventListener('click', async () => {
  if (!sessionId || !currentStep) return;
  if (vocabError) vocabError.textContent = '';
  if (currentStep !== 'vocab_reinforce') {
    const sentence = (textAnswer?.value || '').trim();
    if (!sentence) {
      if (vocabError) vocabError.textContent = 'Please write your sentence first.';
      return;
    }
  }
  const answer = getStudentAnswer();
  setBtnLoading(submitBtn, true, 'Checking...', '👉 Check my sentence');
  const res = await postJSON('/api/vocab/next', {
    session_id: sessionId,
    step: currentStep,
    student_answer: answer
  });
  setBtnLoading(submitBtn, false, 'Checking...', '👉 Check my sentence');
  if (!res.ok) return alert(res.data?.message || res.data?.error || 'Submit failed');

  if (res.data.done && !res.data.step) {
    taskCard.style.display = 'none';
    doneCard.style.display = 'block';
    return;
  }

  currentStep = res.data.step;
  updateStepInfo(currentStep);
  renderTask(res.data.data);
});

logoutBtn.addEventListener('click', async () => {
  await postJSON('/api/auth/logout', {});
  window.location.href = '/login.html';
});

async function ensureAuth() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }
  } catch {
    window.location.href = '/login.html';
  }
}

ensureAuth();

if (textAnswer) {
  textAnswer.addEventListener('input', () => {
    if (vocabError) vocabError.textContent = '';
    const words = textAnswer.value.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount) wordCount.textContent = `${words} words`;
  });
}

if (shareDownloadBtn) {
  shareDownloadBtn.addEventListener('click', () => {
    const canvas = buildShareCanvas({
      moduleName: 'Vocabulary Engine',
      resultLine: 'Today: +1 Star',
      suggestion: `Use "${lastWordFocus.replace('Word Focus: ', '')}" in one clear sentence.`
    });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'senangbah-vocab-result.png';
    link.click();
    setShareStatus('Card downloaded.');
  });
}

if (shareCaptionBtn) {
  shareCaptionBtn.addEventListener('click', async () => {
    const word = lastWordFocus.replace('Word Focus: ', '');
    const caption = `I finished Vocabulary Engine on SenangBah.\nResult: +1 star\nWord focus: ${word}\n#SPM #SPMEnglish #SenangBah`;
    try {
      await navigator.clipboard.writeText(caption);
      setShareStatus('Caption copied.');
    } catch {
      setShareStatus('Copy failed. Please try again.');
    }
  });
}
