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
const taskNudge = document.getElementById('taskNudge');
const exampleStart = document.getElementById('exampleStart');
const wordHelper = document.getElementById('wordHelper');
const tomorrowHint = document.getElementById('tomorrowHint');
const missionTitle = document.getElementById('missionTitle');
const missionSubtitle = document.getElementById('missionSubtitle');
const dayInfo = document.getElementById('dayInfo');
const taskItems = document.getElementById('taskItems');
const inputArea = document.getElementById('inputArea');
const progressInfo = document.getElementById('progressInfo');
const topicSnapshot = document.getElementById('topicSnapshot');
const angleChoices = document.getElementById('angleChoices');
const bandMove = document.getElementById('bandMove');
const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');
const chatHint = document.getElementById('chatHint');
const chatSuggestions = document.getElementById('chatSuggestions');

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

function extractTargetPhrase(text) {
  if (!text) return '';
  const fancy = text.match(/“([^”]+)”/);
  if (fancy && fancy[1]) return fancy[1];
  const straight = text.match(/\"([^\"]+)\"/);
  if (straight && straight[1]) return straight[1];
  const single = text.match(/'([^']+)'/);
  if (single && single[1]) return single[1];
  return '';
}

function inferTopic(text) {
  if (!text) return '';
  const lower = text.toLowerCase();
  const about = text.match(/about\s+([a-zA-Z\s]{3,40})[\.,!]/);
  if (about && about[1]) return about[1].trim();
  const on = text.match(/on\s+([a-zA-Z\s]{3,40})[\.,!]/);
  if (on && on[1]) return on[1].trim();
  const related = text.match(/related to\s+([a-zA-Z\s]{3,40})[\.,!]/);
  if (related && related[1]) return related[1].trim();

  if (lower.includes('technology')) return 'technology';
  if (lower.includes('education')) return 'education';
  if (lower.includes('health')) return 'health';
  if (lower.includes('environment')) return 'the environment';
  if (lower.includes('school')) return 'school life';
  if (lower.includes('social media')) return 'social media';
  return '';
}

function renderTask(data) {
  currentData = data;
  taskCard.style.display = 'block';
  doneCard.style.display = 'none';

  taskTitle.textContent = 'Your task (1 step only):';
  taskNudge.textContent = 'You don’t need to be perfect.';
  clearNode(taskItems);
  clearNode(inputArea);
  clearNode(topicSnapshot);
  clearNode(angleChoices);
  clearNode(bandMove);
  inputArea.style.display = 'block';

  const item = data.items?.[0];
  if (item) {
    if (data.task_type !== 'mcq') {
      const prompt = document.createElement('p');
      prompt.className = 'prompt';
      prompt.textContent = item.prompt;
      taskItems.appendChild(prompt);
    }

    if (item.hints?.length) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'Hint: ' + item.hints[0];
      taskItems.appendChild(hint);
    }
  }

  const targetPhrase = extractTargetPhrase(item?.prompt || data.instructions || '');
  const topic = inferTopic(item?.prompt || data.instructions || '');
  if (data.task_type === 'mcq') {
    taskInstructions.textContent = 'Choose the best sentence.';
  } else if (data.task_type === 'fill_blank') {
    taskInstructions.textContent = targetPhrase
      ? `Use “${targetPhrase}” to complete ONE sentence.`
      : 'Complete ONE sentence. Keep it short.';
  } else {
    taskInstructions.textContent = targetPhrase
      ? `Rewrite ONE sentence using “${targetPhrase}”.`
      : 'Rewrite ONE sentence. Keep it short.';
  }
  const phraseForStart = targetPhrase || 'In addition';
  const exampleText = topic
    ? `Example start: ${phraseForStart}, ${topic} helps people in daily life…`
    : `Example start: ${phraseForStart}, it helps people in daily life…`;

  if (data.task_type === 'mcq') {
    exampleStart.textContent = '';
    exampleStart.style.display = 'none';
    wordHelper.style.display = 'none';
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
      label.appendChild(document.createTextNode(choice));
      inputArea.appendChild(label);
    });
  } else {
    if (targetPhrase) {
      exampleStart.style.display = 'block';
      exampleStart.textContent = exampleText;
    } else {
      exampleStart.style.display = 'none';
      exampleStart.textContent = '';
    }
    wordHelper.style.display = 'block';
    const textarea = document.createElement('textarea');
    textarea.id = 'textAnswer';
    textarea.rows = 4;
    textarea.placeholder = targetPhrase
      ? `Start with “${phraseForStart},” and write 1 sentence only.`
      : 'Write 1 sentence only.';
    inputArea.appendChild(textarea);

    const wc = document.createElement('div');
    wc.className = 'muted';
    wc.id = 'wordCount';
    wc.textContent = '0 words';
    inputArea.appendChild(wc);

    textarea.addEventListener('input', () => {
      const words = textarea.value.trim().split(/\s+/).filter(Boolean).length;
      wc.textContent = `${words} words`;
    });
  }

  if (currentStep === 'feedback') {
    exampleStart.style.display = 'none';
    wordHelper.style.display = 'none';
    inputArea.style.display = 'none';
  }

  // Topic snapshot
  const snapshot = data?.content?.topic_snapshot || data?.content?.topicSnapshot;
  if (Array.isArray(snapshot) && snapshot.length) {
    const title = document.createElement('div');
    title.className = 'snapshot-title';
    title.textContent = 'Topic Snapshot (10 sec)';
    topicSnapshot.appendChild(title);
    snapshot.slice(0, 3).forEach((s) => {
      const line = document.createElement('div');
      line.className = 'snapshot-line';
      line.textContent = '• ' + s;
      topicSnapshot.appendChild(line);
    });
  }

  // Angle choices
  const angles = data?.content?.angle_choices || data?.content?.angleChoices;
  if (Array.isArray(angles) && angles.length) {
    const title = document.createElement('div');
    title.className = 'angles-title';
    title.textContent = 'Pick ONE angle:';
    angleChoices.appendChild(title);
    const row = document.createElement('div');
    row.className = 'angles-row';
    angles.slice(0, 3).forEach((a) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'angle-btn';
      btn.textContent = a;
      btn.addEventListener('click', () => {
        angleChoices.querySelectorAll('.angle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      row.appendChild(btn);
    });
    angleChoices.appendChild(row);
  }

  // Band 6 move
  const move = data?.content?.band6_move || data?.content?.band6Move;
  if (move) {
    bandMove.textContent = `Band 6 move: ${move}`;
  }

  // Feedback rendering only on feedback step
  if (currentStep === 'feedback' && data.feedback) {
    const hasFeedback = (data.feedback.what_you_did_well || []).length ||
      (data.feedback.fix_this_next || []).length ||
      data.feedback.band_lift_sentence;

    if (hasFeedback) {
      const fb = document.createElement('div');
      fb.className = 'feedback';

      if ((data.feedback.what_you_did_well || []).length) {
        const h = document.createElement('h3');
        h.textContent = 'What improved';
        fb.appendChild(h);
        data.feedback.what_you_did_well.forEach(t => {
          const p = document.createElement('p');
          p.textContent = '👍 ' + t;
          fb.appendChild(p);
        });
      }

      if ((data.feedback.fix_this_next || []).length) {
        const h = document.createElement('h3');
        h.textContent = '🔧 One small upgrade to level up';
        fb.appendChild(h);
        data.feedback.fix_this_next.forEach(t => {
          const p = document.createElement('p');
          p.textContent = '⚠️ ' + t;
          fb.appendChild(p);
        });
      }

      if (data.feedback.band_lift_sentence) {
        const h = document.createElement('h3');
        h.textContent = 'Band lift sentence';
        fb.appendChild(h);
        const lead = document.createElement('p');
        lead.textContent = '✨ This sentence can help push your writing towards Band 6';
        fb.appendChild(lead);
        const p = document.createElement('p');
        p.textContent = data.feedback.band_lift_sentence;
        fb.appendChild(p);
      }

      if ((data.feedback.why_it_works_simple || []).length) {
        const h = document.createElement('h3');
        h.textContent = 'Why it works';
        fb.appendChild(h);
        data.feedback.why_it_works_simple.forEach(t => {
          const p = document.createElement('p');
          p.textContent = '• ' + t;
          fb.appendChild(p);
        });
      }

      taskItems.appendChild(fb);
      fb.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (currentStep === 'feedback') {
    tomorrowHint.textContent = 'Tomorrow: 👉 Make your sentence more specific (2 minutes)';
  } else {
    tomorrowHint.textContent = '';
  }

  if (data.next_question) {
    progressInfo.textContent = data.next_question;
  } else {
    progressInfo.textContent = `Step: ${currentStep}`;
  }
}

function getStudentAnswer() {
  if (currentData?.task_type === 'mcq') {
    const selected = document.querySelector('input[name="mcq"]:checked');
    return selected ? selected.value : '';
  }
  const textarea = document.getElementById('textAnswer');
  return textarea ? textarea.value : '';
}

startBtn.addEventListener('click', async () => {
  const res = await postJSON('/api/training/start', {});
  if (!res.ok) return alert(res.data?.error || 'Failed to start');
  if (res.data.done && !res.data.step) {
    taskCard.style.display = 'none';
    doneCard.style.display = 'block';
    return;
  }
  sessionId = res.data.session_id;
  currentStep = res.data.step;
  renderTask(res.data.data);
});

submitBtn.addEventListener('click', async () => {
  if (!sessionId || !currentStep) return;
  const answer = getStudentAnswer();
  const res = await postJSON('/api/training/next', {
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
  renderTask(res.data.data);

  if (res.data.done) {
    // feedback shown, next submit ends session
    submitBtn.textContent = 'Finish';
  } else {
    submitBtn.textContent = '👉 Check my sentence';
  }
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

async function loadMissionStatus() {
  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) return;
    const data = await res.json();
    missionTitle.textContent = `🎯 Today’s Mission (Day ${data.day_index} of ${data.total_days})`;
    dayInfo.textContent = data.focus || 'Writing Focus';
    missionSubtitle.textContent = 'Just ONE sentence. Takes less than 2 minutes.';
  } catch {
    // ignore
  }
}

loadMissionStatus();

function appendChatLine(text, who) {
  if (!chatBox) return;
  const line = document.createElement('div');
  line.className = `chat-line ${who}`;
  line.textContent = text;
  chatBox.appendChild(line);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function renderSuggestions(items) {
  if (!chatSuggestions) return;
  chatSuggestions.innerHTML = '';
  items.forEach((q) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.textContent = q;
    chip.addEventListener('click', () => {
      chatInput.value = q;
      chatInput.focus();
    });
    chatSuggestions.appendChild(chip);
  });
}

async function loadChatHistory() {
  const res = await fetch('/api/chat/history');
  if (!res.ok) return;
  const data = await res.json();
  (data.items || []).forEach((item) => {
    appendChatLine(item.question, 'user');
    appendChatLine(item.answer || '...', 'ai');
    if (item.english_question) {
      appendChatLine(`English version: ${item.english_question}`, 'ai');
    }
    if (item.quick_tip) {
      appendChatLine(`Tip: ${item.quick_tip}`, 'ai');
    }
  });
}

async function loadChatSuggestions() {
  const res = await fetch('/api/chat/suggestions');
  if (!res.ok) return;
  const data = await res.json();
  renderSuggestions(data.suggestions || []);
}

async function sendChat() {
  const q = (chatInput?.value || '').trim();
  if (!q) return;
  appendChatLine(q, 'user');
  chatInput.value = '';
  chatHint.textContent = 'Thinking...';
  const res = await postJSON('/api/chat', { question: q });
  if (!res.ok) {
    if (res.data?.error === 'limit_reached') {
      chatHint.textContent = 'Daily chat limit reached. Try tomorrow.';
    } else if (res.data?.error === 'slow_down') {
      chatHint.textContent = 'Wait a few seconds and try again.';
    } else {
      chatHint.textContent = 'Try again.';
    }
    return;
  }
  const data = res.data;
  appendChatLine(data.answer || '...', 'ai');
  if (data.english_question) {
    appendChatLine(`English version: ${data.english_question}`, 'ai');
  }
  if (data.quick_tip) {
    appendChatLine(`Tip: ${data.quick_tip}`, 'ai');
  }
  chatHint.textContent = '';
}

if (chatSend) {
  chatSend.addEventListener('click', sendChat);
}
if (chatInput) {
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChat();
    }
  });
}

loadChatHistory();
loadChatSuggestions();
