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

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
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
  const res = await postJSON("/api/grammar/start", {});
  if (!res.ok) {
    alert(res.data?.error || "Failed to start");
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
  const optionRes = await postJSON("/api/grammar/next", {
    session_id: sessionId,
    action: "answer_option",
    selected_option: currentSelectedOption,
    hint_used: hintUsedForCurrent
  });
  if (!optionRes.ok) {
    grammarError.textContent = optionRes.data?.error || "Failed to check option.";
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
  if (!rewriteRes.ok) {
    grammarError.textContent = rewriteRes.data?.error || "Failed to check rewrite.";
    return;
  }
  renderRewriteFeedback(rewriteRes.data);
});

nextBtn.addEventListener("click", async () => {
  if (!sessionId) return;
  const res = await postJSON("/api/grammar/next", {
    session_id: sessionId,
    action: "next_question"
  });
  if (!res.ok) {
    grammarError.textContent = res.data?.error || "Failed to continue.";
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
