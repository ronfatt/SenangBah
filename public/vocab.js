let sessionId = null;
let currentStep = null;
let currentData = null;

const startBtn = document.getElementById('startBtn');
const submitBtn = document.getElementById('submitBtn');
const logoutBtn = document.getElementById('logoutBtn');
const taskCard = document.getElementById('taskCard');
const doneCard = document.getElementById('doneCard');

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
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return { ok: res.ok, data: await res.json() };
}

function clearNode(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
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
  const res = await postJSON('/api/vocab/start', {});
  if (!res.ok) return alert(res.data?.error || 'Failed to start');
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
  const res = await postJSON('/api/vocab/next', {
    session_id: sessionId,
    step: currentStep,
    student_answer: answer
  });
  if (!res.ok) return alert(res.data?.error || 'Submit failed');

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
