let sessionId = null;
let currentPayload = null;
let currentSelectedOption = "";
let questionStartedAt = 0;

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
const taskInstructions = document.getElementById("taskInstructions");
const taskMeta = document.getElementById("taskMeta");
const taskItems = document.getElementById("taskItems");
const feedbackBox = document.getElementById("feedbackBox");
const readingError = document.getElementById("readingError");
const summaryAccuracy = document.getElementById("summaryAccuracy");
const summaryStars = document.getElementById("summaryStars");
const summaryMessage = document.getElementById("summaryMessage");
const summarySpeed = document.getElementById("summarySpeed");
const summaryWeak = document.getElementById("summaryWeakSkills");
const summaryPlan = document.getElementById("summaryPlan");
const shareDownloadBtn = document.getElementById("shareDownloadBtn");
const shareCaptionBtn = document.getElementById("shareCaptionBtn");
const shareStatus = document.getElementById("shareStatus");

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

function buildShareCanvas({ moduleName, resultLine, suggestion }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 1080, 1350);
  grad.addColorStop(0, "#0B1220");
  grad.addColorStop(1, "#111827");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "700 56px Arial";
  ctx.fillText("SenangBah Progress Card", 80, 140);
  ctx.fillStyle = "#93C5FD";
  ctx.font = "600 34px Arial";
  ctx.fillText(moduleName, 80, 220);
  ctx.fillStyle = "#FF6B00";
  ctx.font = "700 52px Arial";
  ctx.fillText(resultLine, 80, 340);
  ctx.fillStyle = "#E5E7EB";
  ctx.font = "400 36px Arial";
  ctx.fillText("AI Suggestion:", 80, 450);
  ctx.fillText(String(suggestion || "").slice(0, 64), 80, 510);
  ctx.fillText(String(suggestion || "").slice(64, 128), 80, 560);
  ctx.fillStyle = "#94A3B8";
  ctx.font = "400 30px Arial";
  ctx.fillText("#SPM #SPMEnglish #SenangBah", 80, 1260);
  return canvas;
}

function setShareStatus(text) {
  if (!shareStatus) return;
  shareStatus.textContent = text;
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

function setOptionButtonsDisabled(disabled) {
  taskItems.querySelectorAll(".grammar-option-card").forEach((el) => {
    el.disabled = disabled;
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
  questionStartedAt = Date.now();
  taskCard.style.display = "block";
  doneCard.style.display = "none";
  submitBtn.style.display = "inline-block";
  submitBtn.disabled = false;
  nextBtn.style.display = "none";
  nextBtn.disabled = false;
  nextBtn.textContent = "Next Question";
  feedbackBox.innerHTML = `<h3>Feedback</h3><p class="muted">No feedback yet. Choose an answer and submit.</p>`;
  readingError.textContent = "";

  questionIndex.textContent = `Q ${payload.question_index} / ${payload.total_questions}`;
  stepInfo.textContent = `Step 2 Answer · Q ${payload.question_index} / ${payload.total_questions}`;
  taskTitle.textContent = payload.question?.prompt || "Question";
  taskInstructions.textContent = "Choose the best answer based on passage evidence.";
  taskMeta.textContent = `Type: ${payload.question?.question_type || "Comprehension"} · Skill: ${payload.question?.skill_tag || "General"} · Tip: ${payload.question?.tactic_tip || "Find proof sentence first."}`;
  passageText.textContent = payload.passage || "";
  renderOptions(payload.question?.options || []);
  setOptionButtonsDisabled(false);
  updateStepVisual(1);
}

function renderFeedback(payload) {
  const f = payload.feedback || {};
  currentPayload = payload;
  currentSelectedOption = payload.selected_option || currentSelectedOption || "";
  markOptionStates(f.correct_answer);
  setOptionButtonsDisabled(true);
  feedbackBox.innerHTML = `
    <h3>${f.correct ? "Correct" : "Not quite"}</h3>
    <p><strong>Reason:</strong> ${f.reason || "-"}</p>
    <p><strong>Correct answer:</strong> ${f.correct_answer || "-"}</p>
    <p><strong>SPM Skill:</strong> ${f.skill_tag || "General comprehension"}</p>
    <p><strong>Exam move:</strong> ${f.exam_move || "Find key evidence before selecting."}</p>
    <p class="muted">Tactic tip: ${f.tactic_tip || "Match option with exact supporting sentence."}</p>
  `;
  submitBtn.style.display = "none";
  nextBtn.style.display = payload.continue_available ? "inline-block" : "none";
  nextBtn.textContent = "Continue";
  if (payload.continue_available) {
    nextBtn.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  updateStepVisual(2);
}

function renderSummary(summary = {}) {
  taskCard.style.display = "none";
  doneCard.style.display = "block";
  summaryAccuracy.textContent = `Accuracy: ${Number(summary.accuracy_percent || 0)}%`;
  summaryStars.textContent = `Stars: ${Number(summary.stars || 0)}`;
  summarySpeed.textContent = `Avg time/question: ${Number(summary.avg_time_sec || 0)}s`;
  summaryWeak.textContent = `Focus skills: ${(summary.top_weak_skills || []).join(" · ") || "General comprehension"}`;
  summaryMessage.textContent = summary.message || "Completed.";
  summaryPlan.innerHTML = "";
  (summary.next_drill_plan || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    summaryPlan.appendChild(li);
  });
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
  if (res.data.state === "feedback_shown") {
    renderQuestion(res.data);
    renderFeedback(res.data);
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
  const elapsedMs = questionStartedAt ? Date.now() - questionStartedAt : 0;
  const res = await postJSON("/api/reading/next", {
    session_id: sessionId,
    action: "answer",
    selected_option: currentSelectedOption,
    elapsed_ms: elapsedMs
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

if (shareDownloadBtn) {
  shareDownloadBtn.addEventListener("click", () => {
    const canvas = buildShareCanvas({
      moduleName: "Reading Decoder",
      resultLine: summaryAccuracy?.textContent || "Accuracy: 0%",
      suggestion: summaryMessage?.textContent || "Keep practicing short passages daily."
    });
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "senangbah-reading-result.png";
    link.click();
    setShareStatus("Card downloaded.");
  });
}

if (shareCaptionBtn) {
  shareCaptionBtn.addEventListener("click", async () => {
    const caption = `I finished Reading Decoder on SenangBah.\n${summaryAccuracy?.textContent || "Accuracy: 0%"} | ${summaryStars?.textContent || "Stars: 0"}\nAI tip: ${summaryMessage?.textContent || "Read daily to improve comprehension speed."}\n#SPM #SPMEnglish #SenangBah`;
    try {
      await navigator.clipboard.writeText(caption);
      setShareStatus("Caption copied.");
    } catch {
      setShareStatus("Copy failed. Please try again.");
    }
  });
}
