let sessionId = null;
let currentPayload = null;
let currentSelectedOption = "";

const startBtn = document.getElementById("startBtn");
const submitBtn = document.getElementById("submitBtn");
const nextBtn = document.getElementById("nextBtn");
const logoutBtn = document.getElementById("logoutBtn");
const taskCard = document.getElementById("taskCard");
const doneCard = document.getElementById("doneCard");
const stepInfo = document.getElementById("stepInfo");
const questionIndex = document.getElementById("questionIndex");
const passageText = document.getElementById("passageText");
const taskTitle = document.getElementById("taskTitle");
const taskItems = document.getElementById("taskItems");
const feedbackBox = document.getElementById("feedbackBox");
const readingError = document.getElementById("readingError");
const summaryAccuracy = document.getElementById("summaryAccuracy");
const summaryStars = document.getElementById("summaryStars");
const summaryMessage = document.getElementById("summaryMessage");

async function postJSON(url, data) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = { error: res.ok ? "invalid_response" : "server_error" };
    }
    return { ok: res.ok, data: payload };
  } catch (error) {
    if (error?.name === "AbortError") {
      return { ok: false, data: { error: "timeout", message: "Request timed out. Please try again." } };
    }
    return { ok: false, data: { error: "network_error", message: "Network error. Please try again." } };
  } finally {
    clearTimeout(timeout);
  }
}

function setBtnLoading(btn, isLoading, loadingText, idleText) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.classList.toggle("is-loading", isLoading);
  btn.textContent = isLoading ? loadingText : idleText;
}

function updateStepVisual(index) {
  const segs = document.querySelectorAll(".grammar-sim-step-bar .seg");
  segs.forEach((seg, i) => seg.classList.toggle("active", i <= index));
}

function renderOptions(options = []) {
  taskItems.innerHTML = "";
  options.forEach((option) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "grammar-option-card";
    btn.textContent = option;
    btn.addEventListener("click", () => {
      currentSelectedOption = option;
      taskItems.querySelectorAll(".grammar-option-card").forEach((el) => el.classList.remove("selected"));
      btn.classList.add("selected");
      readingError.textContent = "";
    });
    taskItems.appendChild(btn);
  });
}

function markOptionStates(correctOption) {
  taskItems.querySelectorAll(".grammar-option-card").forEach((el) => {
    const text = (el.textContent || "").trim();
    if (text === String(correctOption || "").trim()) {
      el.classList.add("is-correct");
    } else if (text === String(currentSelectedOption || "").trim()) {
      el.classList.add("is-wrong");
    }
  });
}

function renderQuestion(payload) {
  currentPayload = payload;
  currentSelectedOption = "";
  taskCard.style.display = "block";
  doneCard.style.display = "none";
  nextBtn.style.display = "none";
  feedbackBox.innerHTML = `<h3>Feedback</h3><p class="muted">No feedback yet. Choose an answer and submit.</p>`;
  readingError.textContent = "";

  questionIndex.textContent = `Q ${payload.question_index} / ${payload.total_questions}`;
  stepInfo.textContent = `Step 2 Answer · Q ${payload.question_index} / ${payload.total_questions}`;
  taskTitle.textContent = payload.question?.prompt || "Question";
  passageText.textContent = payload.passage || "";
  renderOptions(payload.question?.options || []);
  updateStepVisual(1);
}

function renderFeedback(payload) {
  const f = payload.feedback || {};
  markOptionStates(f.correct_answer);
  feedbackBox.innerHTML = `
    <h3>${f.correct ? "Correct" : "Not quite"}</h3>
    <p><strong>Reason:</strong> ${f.reason || "-"}</p>
    <p><strong>Correct answer:</strong> ${f.correct_answer || "-"}</p>
  `;
  nextBtn.style.display = payload.continue_available ? "inline-block" : "none";
  updateStepVisual(2);
}

function renderSummary(summary = {}) {
  taskCard.style.display = "none";
  doneCard.style.display = "block";
  summaryAccuracy.textContent = `Accuracy: ${Number(summary.accuracy_percent || 0)}%`;
  summaryStars.textContent = `Stars: ${Number(summary.stars || 0)}`;
  summaryMessage.textContent = summary.message || "Completed.";
  stepInfo.textContent = "Step 3 Review · Session complete";
}

startBtn.addEventListener("click", async () => {
  setBtnLoading(startBtn, true, "Starting...", "Start Reading Set");
  const res = await postJSON("/api/reading/start", {});
  setBtnLoading(startBtn, false, "Starting...", "Start Reading Set");
  if (!res.ok) {
    alert(res.data?.message || res.data?.error || "Failed to start");
    return;
  }
  sessionId = res.data.session_id;
  if (res.data.done) {
    renderSummary(res.data.summary || {});
    return;
  }
  renderQuestion(res.data);
});

submitBtn.addEventListener("click", async () => {
  if (!sessionId || !currentPayload) return;
  if (!currentSelectedOption) {
    readingError.textContent = "Please choose one option first.";
    return;
  }
  setBtnLoading(submitBtn, true, "Checking...", "Check Answer");
  const res = await postJSON("/api/reading/next", {
    session_id: sessionId,
    action: "answer",
    selected_option: currentSelectedOption
  });
  setBtnLoading(submitBtn, false, "Checking...", "Check Answer");
  if (!res.ok) {
    readingError.textContent = res.data?.message || res.data?.error || "Failed to check answer.";
    return;
  }
  renderFeedback(res.data);
});

nextBtn.addEventListener("click", async () => {
  if (!sessionId) return;
  setBtnLoading(nextBtn, true, "Loading...", "Next Question");
  const res = await postJSON("/api/reading/next", {
    session_id: sessionId,
    action: "next_question"
  });
  setBtnLoading(nextBtn, false, "Loading...", "Next Question");
  if (!res.ok) {
    readingError.textContent = res.data?.message || res.data?.error || "Failed to continue.";
    return;
  }
  if (res.data.done) {
    renderSummary(res.data.summary || {});
    return;
  }
  renderQuestion(res.data);
});

logoutBtn.addEventListener("click", async () => {
  await postJSON("/api/auth/logout", {});
  window.location.href = "/login.html";
});

async function ensureAuth() {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) window.location.href = "/login.html";
  } catch {
    window.location.href = "/login.html";
  }
}

ensureAuth();
