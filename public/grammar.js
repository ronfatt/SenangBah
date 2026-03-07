let sessionId = null;
let currentPayload = null;
let hintUsedForCurrent = false;
let currentSelectedOption = "";

const startBtn = document.getElementById("startBtn");
const submitBtn = document.getElementById("submitBtn");
const nextBtn = document.getElementById("nextBtn");
const logoutBtn = document.getElementById("logoutBtn");
const taskCard = document.getElementById("taskCard");
const doneCard = document.getElementById("doneCard");
const stepInfo = document.getElementById("stepInfo");
const questionIndex = document.getElementById("questionIndex");
const focusRuleTag = document.getElementById("focusRuleTag");
const passageText = document.getElementById("passageText");
const taskTitle = document.getElementById("taskTitle");
const taskInstructions = document.getElementById("taskInstructions");
const fixedTip = document.getElementById("fixedTip");
const showHintToggle = document.getElementById("showHintToggle");
const hintText = document.getElementById("hintText");
const taskItems = document.getElementById("taskItems");
const rewriteInput = document.getElementById("rewriteInput");
const constraintText = document.getElementById("constraintText");
const feedbackBox = document.getElementById("feedbackBox");
const grammarError = document.getElementById("grammarError");
const summaryAccuracy = document.getElementById("summaryAccuracy");
const summaryMissed = document.getElementById("summaryMissed");
const summaryDrill = document.getElementById("summaryDrill");
const summaryStars = document.getElementById("summaryStars");
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
    return { ok: res.ok, status: res.status, data: payload };
  } catch (error) {
    if (error?.name === "AbortError") {
      return { ok: false, status: 504, data: { error: "timeout", message: "Request timed out. Please try again." } };
    }
    return { ok: false, status: 0, data: { error: "network_error", message: "Network error. Please try again." } };
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

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resetQuestionLocalState() {
  hintUsedForCurrent = false;
  currentSelectedOption = "";
  showHintToggle.checked = false;
  hintText.style.display = "none";
  rewriteInput.classList.remove("has-error");
  grammarError.textContent = "";
  feedbackBox.innerHTML = `<h3>Feedback</h3><p class="muted">No feedback yet. Answer and submit to see corrections.</p>`;
  nextBtn.style.display = "none";
}

function renderPassage(rawText = "", blankIndex = 0) {
  const html = escapeHtml(rawText).replace(
    /\[____\]/g,
    `<span class="cloze-blank" title="Blank #${blankIndex}">[____]</span>`
  );
  passageText.innerHTML = html;
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
      grammarError.textContent = "";
    });
    taskItems.appendChild(btn);
  });
}

function updateStepVisual(index) {
  const segs = document.querySelectorAll(".grammar-sim-step-bar .seg");
  segs.forEach((seg, i) => seg.classList.toggle("active", i <= index));
}

function renderQuestion(payload) {
  currentPayload = payload;
  taskCard.style.display = "block";
  doneCard.style.display = "none";
  resetQuestionLocalState();

  const q = payload.question;
  questionIndex.textContent = `Q ${payload.question_index} / ${payload.total_questions}`;
  stepInfo.textContent = `Step 1 Detect · Q ${payload.question_index} / ${payload.total_questions}`;
  focusRuleTag.textContent = `Focus Rule: ${q.focus_rule_tag}`;
  taskTitle.textContent = payload.instruction_primary;
  taskInstructions.textContent = payload.instruction_secondary;
  fixedTip.textContent = payload.instruction_tip;
  constraintText.textContent = `Constraint: ${q.min_fix_constraint === "change_1_word" ? "Change 1 word only." : "Max 2 words."}`;
  hintText.textContent = `Hint: ${payload.instruction_tip.replace(/^Tip:\s*/i, "")}`;
  renderPassage(payload.passage_text, q.blank_index);
  renderOptions(q.options || []);
  updateStepVisual(0);

  rewriteInput.value = q.sentence_with_blank;
}

function markOptionStates(correctOption) {
  taskItems.querySelectorAll(".grammar-option-card").forEach((el) => {
    const text = (el.textContent || "").trim().toLowerCase();
    if (text === String(correctOption || "").trim().toLowerCase()) {
      el.classList.add("is-correct");
    } else if (text === String(currentSelectedOption || "").trim().toLowerCase()) {
      el.classList.add("is-wrong");
    }
  });
}

function renderOptionFeedback(data) {
  const f = data.option_feedback;
  const isCorrect = f?.correctness === "correct";
  markOptionStates(currentPayload.question.correct_option);
  feedbackBox.innerHTML = `
    <h3>${isCorrect ? "Correct Answer" : "Incorrect"}</h3>
    <p><strong>Why:</strong> ${escapeHtml(f?.reason || "-")}</p>
    <p><strong>SPM Tip:</strong> ${escapeHtml(f?.micro_tip || "-")}</p>
    <p><strong>Example:</strong> ${escapeHtml(f?.example_sentence || "-")}</p>
    ${f?.hint_used ? "<p class='muted'>Hint used: star adjusted.</p>" : ""}
  `;
  updateStepVisual(1);
}

function renderRewriteFeedback(data) {
  const r = data.rewrite_feedback || {};
  const hasError = !r.rewrite_correct;
  if (hasError) {
    rewriteInput.classList.add("has-error");
    const firstActual = (r.wrong_tokens || [])[0]?.actual;
    if (firstActual) {
      const lower = rewriteInput.value.toLowerCase();
      const token = String(firstActual).toLowerCase();
      const start = lower.indexOf(token);
      if (start >= 0) {
        const end = start + token.length;
        rewriteInput.focus();
        rewriteInput.setSelectionRange(start, end);
      }
    }
  } else {
    rewriteInput.classList.remove("has-error");
  }

  const tokenPreview = (r.wrong_tokens || [])
    .map((t) => `<span class="grammar-wrong-token">${escapeHtml(t.actual || "∅")} → ${escapeHtml(t.expected || "∅")}</span>`)
    .join(", ");

  feedbackBox.innerHTML = `
    <h3>${r.rewrite_correct ? "Rewrite Accepted" : "Rewrite Needs Fix"}</h3>
    <p><strong>What to fix:</strong> ${escapeHtml(r.what_to_fix || "-")}</p>
    <p><strong>Why:</strong> ${escapeHtml(r.why || "-")}</p>
    <p><strong>Correct answer:</strong> ${escapeHtml(r.correct_answer || "-")}</p>
    ${tokenPreview ? `<p class="muted">Wrong token(s): ${tokenPreview}</p>` : ""}
  `;
  nextBtn.style.display = data.continue_available ? "inline-block" : "none";
  updateStepVisual(2);
}

function renderSummary(summary = {}) {
  taskCard.style.display = "none";
  doneCard.style.display = "block";
  const tags = Array.isArray(summary.top_missed_focus_rule_tags)
    ? summary.top_missed_focus_rule_tags.join(", ")
    : "-";
  summaryAccuracy.textContent = `Accuracy: ${summary.accuracy_percent || 0}%`;
  summaryMissed.textContent = `Most missed focus tags: ${tags || "-"}`;
  summaryDrill.textContent = `Suggested next drill: ${summary.suggested_next_drill || "-"}`;
  summaryStars.textContent = `Stars: ${summary.stars || 0}`;
  stepInfo.textContent = "Step 3 Upgrade · Session complete";
}

startBtn.addEventListener("click", async () => {
  setBtnLoading(startBtn, true, "Starting...", "Start Cloze Set");
  const res = await postJSON("/api/grammar/start", {});
  setBtnLoading(startBtn, false, "Starting...", "Start Cloze Set");
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
  grammarError.textContent = "";

  if (!currentSelectedOption) {
    grammarError.textContent = "Please choose one option first.";
    return;
  }
  if (!rewriteInput.value.trim()) {
    grammarError.textContent = "Please rewrite the full sentence first.";
    return;
  }

  // Step A: answer option
  setBtnLoading(submitBtn, true, "Checking...", "Check my fix");
  const optionRes = await postJSON("/api/grammar/next", {
    session_id: sessionId,
    action: "answer_option",
    selected_option: currentSelectedOption,
    hint_used: hintUsedForCurrent
  });
  if (!optionRes.ok) {
    setBtnLoading(submitBtn, false, "Checking...", "Check my fix");
    grammarError.textContent = optionRes.data?.message || optionRes.data?.error || "Failed to check option.";
    return;
  }
  renderOptionFeedback(optionRes.data);

  // Step B: micro rewrite
  const rewriteRes = await postJSON("/api/grammar/next", {
    session_id: sessionId,
    action: "submit_rewrite",
    selected_option: currentSelectedOption,
    rewrite_text: rewriteInput.value
  });
  setBtnLoading(submitBtn, false, "Checking...", "Check my fix");
  if (!rewriteRes.ok) {
    grammarError.textContent = rewriteRes.data?.message || rewriteRes.data?.error || "Failed to check rewrite.";
    return;
  }
  renderRewriteFeedback(rewriteRes.data);
});

nextBtn.addEventListener("click", async () => {
  if (!sessionId) return;
  setBtnLoading(nextBtn, true, "Loading...", "Next Question");
  const res = await postJSON("/api/grammar/next", {
    session_id: sessionId,
    action: "next_question"
  });
  setBtnLoading(nextBtn, false, "Loading...", "Next Question");
  if (!res.ok) {
    grammarError.textContent = res.data?.message || res.data?.error || "Failed to continue.";
    return;
  }
  if (res.data.done) {
    renderSummary(res.data.summary || {});
    return;
  }
  renderQuestion(res.data);
});

showHintToggle.addEventListener("change", () => {
  const visible = showHintToggle.checked;
  hintText.style.display = visible ? "block" : "none";
  if (visible) hintUsedForCurrent = true;
});

logoutBtn.addEventListener("click", async () => {
  await postJSON("/api/auth/logout", {});
  window.location.href = "/login.html";
});

async function ensureAuth() {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) {
      window.location.href = "/login.html";
    }
  } catch {
    window.location.href = "/login.html";
  }
}

ensureAuth();

if (shareDownloadBtn) {
  shareDownloadBtn.addEventListener("click", () => {
    const canvas = buildShareCanvas({
      moduleName: "Grammar Lab",
      resultLine: summaryAccuracy?.textContent || "Accuracy: 0%",
      suggestion: (summaryDrill?.textContent || "").replace("Suggested next drill: ", "")
    });
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "senangbah-grammar-result.png";
    link.click();
    setShareStatus("Card downloaded.");
  });
}

if (shareCaptionBtn) {
  shareCaptionBtn.addEventListener("click", async () => {
    const caption = `I finished Grammar Lab on SenangBah.\n${summaryAccuracy?.textContent || "Accuracy: 0%"} | ${summaryStars?.textContent || "Stars: 0"}\nAI tip: ${(summaryDrill?.textContent || "").replace("Suggested next drill: ", "")}\n#SPM #SPMEnglish #SenangBah`;
    try {
      await navigator.clipboard.writeText(caption);
      setShareStatus("Caption copied.");
    } catch {
      setShareStatus("Copy failed. Please try again.");
    }
  });
}
