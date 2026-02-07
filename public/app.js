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

function renderTask(data) {
  currentData = data;
  taskCard.style.display = 'block';
  doneCard.style.display = 'none';

  taskTitle.textContent = data.title || 'Today';
  taskInstructions.textContent = data.instructions || '';
  clearNode(taskItems);
  clearNode(inputArea);

  const item = data.items?.[0];
  if (item) {
    const prompt = document.createElement('p');
    prompt.textContent = item.prompt;
    taskItems.appendChild(prompt);

    if (item.hints?.length) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'Hint: ' + item.hints[0];
      taskItems.appendChild(hint);
    }
  }

  if (data.task_type === 'mcq') {
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
    const textarea = document.createElement('textarea');
    textarea.id = 'textAnswer';
    textarea.rows = 4;
    textarea.placeholder = 'Type here...';
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

  // Feedback rendering when available
  if (data.feedback) {
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
        h.textContent = 'One thing holding you back';
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
    }
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
    submitBtn.textContent = 'Submit';
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
