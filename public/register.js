const form = document.getElementById("pilotForm");
const applicationCard = document.getElementById("applicationCard");
const steps = [...document.querySelectorAll(".step")];
const roleButtons = [...document.querySelectorAll(".roleBtn")];
const applicationTypeInput = document.getElementById("applicationTypeInput");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const submitBtn = document.getElementById("submitBtn");
const errorText = document.getElementById("errorText");
const successState = document.getElementById("successState");
const successMessage = document.getElementById("successMessage");
const analysisBox = document.getElementById("analysisBox");
const analysisStrengths = document.getElementById("analysisStrengths");
const analysisWeaknesses = document.getElementById("analysisWeaknesses");
const analysisGrammar = document.getElementById("analysisGrammar");
const analysisFixes = document.getElementById("analysisFixes");
const analysisComment = document.getElementById("analysisComment");
const stepText = document.getElementById("stepText");
const segments = [...document.querySelectorAll("#segmentBar i")];
const totalApplications = document.getElementById("totalApplications");
const seatsLeft = document.getElementById("seatsLeft");
const diagnosticBtn = document.getElementById("diagnosticBtn");
const diagnosticHint = document.getElementById("diagnosticHint");
const diagnosticInlineResult = document.getElementById("diagnosticInlineResult");
const diagStrengths = document.getElementById("diagStrengths");
const diagWeaknesses = document.getElementById("diagWeaknesses");
const diagGrammar = document.getElementById("diagGrammar");
const diagFixes = document.getElementById("diagFixes");
const diagComment = document.getElementById("diagComment");
const diagScoreClarity = document.getElementById("diagScoreClarity");
const diagScoreGrammar = document.getElementById("diagScoreGrammar");
const diagScoreIdea = document.getElementById("diagScoreIdea");
const diagScoreVocabulary = document.getElementById("diagScoreVocabulary");
const diagScoreClarityText = document.getElementById("diagScoreClarityText");
const diagScoreGrammarText = document.getElementById("diagScoreGrammarText");
const diagScoreIdeaText = document.getElementById("diagScoreIdeaText");
const diagScoreVocabularyText = document.getElementById("diagScoreVocabularyText");
const startApplicationBtn = document.getElementById("startApplicationBtn");
const selectionInfoBtn = document.getElementById("selectionInfoBtn");
const selectionInfo = document.getElementById("selectionInfo");

const intakeAssistantBtn = document.getElementById("intakeAssistantBtn");
const intakeAssistantPanel = document.getElementById("intakeAssistantPanel");
const assistantCloseBtn = document.getElementById("assistantCloseBtn");
const assistantMessages = document.getElementById("assistantMessages");
const assistantForm = document.getElementById("assistantForm");
const assistantInput = document.getElementById("assistantInput");
const assistantQuickButtons = [...document.querySelectorAll(".assistantQuickBtn")];

let currentStep = 1;
let diagnosticAnalysis = null;

function setStep(step) {
  currentStep = step;
  steps.forEach((node) => {
    node.classList.toggle("active", Number(node.dataset.step) === step);
  });

  if (stepText) stepText.textContent = `Step ${step}/4`;
  segments.forEach((segment, idx) => {
    const n = idx + 1;
    segment.classList.toggle("active", n === step);
    segment.classList.toggle("done", n < step);
  });

  prevBtn.style.display = step === 1 ? "none" : "inline-block";
  nextBtn.style.display = step === 4 ? "none" : "inline-block";
  submitBtn.style.display = step === 4 ? "inline-block" : "none";
  errorText.textContent = "";
}

function validateStep(step) {
  if (step === 1) {
    return Boolean(applicationTypeInput.value);
  }

  if (step === 3) {
    const intro = document.querySelector('textarea[name="self_intro_text"]');
    return Boolean(String(intro?.value || "").trim()) && Boolean(diagnosticAnalysis);
  }

  const activeStep = document.querySelector(`.step[data-step="${step}"]`);
  const inputs = [...activeStep.querySelectorAll("input, select, textarea")].filter((node) => node.required);

  for (const node of inputs) {
    if (node.type === "radio") {
      const checked = activeStep.querySelector(`input[name="${node.name}"]:checked`);
      if (!checked) return false;
      continue;
    }
    if (!String(node.value || "").trim()) return false;
  }

  return true;
}

function showStepError(step) {
  const tips = {
    1: "Please choose Student, Parent/Guardian, or Teacher application type.",
    2: "Please complete all required applicant fields.",
    3: "Please run AI Diagnostic after writing your self-introduction.",
    4: "Please choose one preferred plan."
  };
  errorText.textContent = tips[step] || "Please complete this step.";
}

prevBtn.addEventListener("click", () => {
  if (currentStep > 1) setStep(currentStep - 1);
});

nextBtn.addEventListener("click", () => {
  if (!validateStep(currentStep)) {
    showStepError(currentStep);
    return;
  }
  if (currentStep < 4) setStep(currentStep + 1);
});

roleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    roleButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    applicationTypeInput.value = button.dataset.applicationType;
    errorText.textContent = "";
  });
});

if (startApplicationBtn) {
  startApplicationBtn.addEventListener("click", () => {
    applicationCard?.scrollIntoView({ behavior: "smooth", block: "start" });
    setStep(1);
  });
}

if (selectionInfoBtn && selectionInfo) {
  selectionInfoBtn.addEventListener("click", () => {
    selectionInfo.classList.toggle("hidden");
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateStep(4)) {
    showStepError(4);
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  payload.self_intro_analysis = diagnosticAnalysis;

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";
  errorText.textContent = "";

  try {
    const response = await fetch("/api/pilot-registration/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      const map = {
        email_already_registered: "This email already submitted an application.",
        missing_fields: "Please fill every required field.",
        missing_intro: "Please write your self-introduction first.",
        intro_too_short: "Please write at least 30 words for your self-introduction sample.",
        invalid_email: "Please use a valid email address.",
        invalid_application_type: "Please choose a valid application type.",
        invalid_plan_choice: "Please choose a plan."
      };
      throw new Error(map[data.error] || "Unable to submit now. Try again.");
    }

    form.classList.add("hidden");
    successState.classList.remove("hidden");
    successMessage.textContent = `${data.message} Application ID: ${data.application_id}`;
    renderAnalysis(data.intro_analysis);

    await loadMeta();
  } catch (error) {
    errorText.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Application";
  }
});

function renderList(container, values = []) {
  container.innerHTML = "";
  for (const text of values) {
    const li = document.createElement("li");
    li.textContent = text;
    container.appendChild(li);
  }
}

function renderAnalysis(analysis) {
  if (!analysis) return;
  analysisBox.classList.remove("hidden");
  renderList(analysisStrengths, analysis.strengths || []);
  renderList(analysisWeaknesses, analysis.weaknesses || []);
  renderList(analysisGrammar, analysis.grammar || []);

  analysisFixes.innerHTML = "";
  for (const item of analysis.sentence_fixes || []) {
    const node = document.createElement("div");
    node.className = "fixItem";
    const original = document.createElement("p");
    const improved = document.createElement("p");
    const reason = document.createElement("p");
    original.textContent = `Original: ${item.original || "-"}`;
    improved.textContent = `Improved: ${item.improved || "-"}`;
    reason.textContent = `Why: ${item.reason || "-"}`;
    node.appendChild(original);
    node.appendChild(improved);
    node.appendChild(reason);
    analysisFixes.appendChild(node);
  }

  analysisComment.textContent = analysis.overall_comment || "";
}

function renderInlineDiagnostic(analysis) {
  if (!analysis) return;
  diagnosticInlineResult.classList.remove("hidden");
  renderList(diagStrengths, analysis.strengths || []);
  renderList(diagWeaknesses, analysis.weaknesses || []);
  renderList(diagGrammar, analysis.grammar || []);
  diagFixes.innerHTML = "";

  for (const item of analysis.sentence_fixes || []) {
    const node = document.createElement("div");
    node.className = "fixItem";
    const original = document.createElement("p");
    const improved = document.createElement("p");
    const reason = document.createElement("p");
    original.textContent = `Original: ${item.original || "-"}`;
    improved.textContent = `Improved: ${item.improved || "-"}`;
    reason.textContent = `Why: ${item.reason || "-"}`;
    node.appendChild(original);
    node.appendChild(improved);
    node.appendChild(reason);
    diagFixes.appendChild(node);
  }

  diagComment.textContent = analysis.overall_comment || "";
  renderScores(analysis.scores || {});
}

function renderScores(scores) {
  const safe = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  };

  const clarity = safe(scores.clarity);
  const grammar = safe(scores.grammar);
  const idea = safe(scores.idea);
  const vocabulary = safe(scores.vocabulary);

  diagScoreClarity.style.width = `${clarity}%`;
  diagScoreGrammar.style.width = `${grammar}%`;
  diagScoreIdea.style.width = `${idea}%`;
  diagScoreVocabulary.style.width = `${vocabulary}%`;

  diagScoreClarityText.textContent = clarity;
  diagScoreGrammarText.textContent = grammar;
  diagScoreIdeaText.textContent = idea;
  diagScoreVocabularyText.textContent = vocabulary;
}

diagnosticBtn.addEventListener("click", async () => {
  const intro = document.querySelector('textarea[name="self_intro_text"]');
  const text = String(intro?.value || "").trim();
  const applicationType = applicationTypeInput.value || "individual_student";

  diagnosticAnalysis = null;
  diagnosticInlineResult.classList.add("hidden");
  errorText.textContent = "";

  if (!text) {
    errorText.textContent = "Please write your self-introduction first.";
    return;
  }

  diagnosticBtn.disabled = true;
  diagnosticBtn.textContent = "Running...";
  diagnosticHint.textContent = "Analyzing your writing...";

  try {
    const response = await fetch("/api/pilot-registration/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_type: applicationType, self_intro_text: text })
    });

    const data = await response.json();
    if (!response.ok) {
      const map = {
        missing_intro: "Please write your self-introduction first.",
        intro_too_short: "Please write at least 30 words."
      };
      throw new Error(map[data.error] || "Diagnostic failed. Please try again.");
    }

    diagnosticAnalysis = data.intro_analysis || null;
    renderInlineDiagnostic(diagnosticAnalysis);
    diagnosticHint.textContent = "Diagnostic ready. You can click Next now.";
  } catch (err) {
    diagnosticHint.textContent = "Diagnostic not ready. Please try again.";
    errorText.textContent = err.message;
  } finally {
    diagnosticBtn.disabled = false;
    diagnosticBtn.textContent = "Run AI Diagnostic";
  }
});

const introTextarea = document.querySelector('textarea[name="self_intro_text"]');
if (introTextarea) {
  const blockClipboard = (event) => {
    event.preventDefault();
    errorText.textContent = "Please type your own writing. Copy/paste is disabled for this diagnostic.";
  };
  introTextarea.addEventListener("paste", blockClipboard);
  introTextarea.addEventListener("drop", blockClipboard);
  introTextarea.addEventListener("cut", blockClipboard);

  introTextarea.addEventListener("input", () => {
    diagnosticAnalysis = null;
    diagnosticInlineResult.classList.add("hidden");
    diagnosticHint.textContent = "Complete diagnostic first, then you can click Next.";
  });
}

async function loadMeta() {
  try {
    const response = await fetch("/api/pilot-registration/meta");
    if (!response.ok) return;
    const data = await response.json();
    if (totalApplications) totalApplications.textContent = data.total_applications;
    if (seatsLeft) seatsLeft.textContent = data.seats_left;
  } catch {
    // ignore
  }
}

function appendAssistantMessage(text, kind) {
  if (!assistantMessages) return;
  const p = document.createElement("p");
  p.className = `assistantMsg ${kind === "user" ? "assistantMsgUser" : "assistantMsgBot"}`;
  p.textContent = text;
  assistantMessages.appendChild(p);
  assistantMessages.scrollTop = assistantMessages.scrollHeight;
}

async function askAssistant(question) {
  appendAssistantMessage(question, "user");
  try {
    const response = await fetch("/api/pilot-registration/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    const data = await response.json();
    if (!response.ok) {
      appendAssistantMessage("I can't answer right now. Please continue with the intake form.", "bot");
      return;
    }
    appendAssistantMessage(data.reply || "Please continue with your intake application.", "bot");
  } catch {
    appendAssistantMessage("Connection issue. Please continue with the intake application.", "bot");
  }
}

if (intakeAssistantBtn && intakeAssistantPanel) {
  intakeAssistantBtn.addEventListener("click", () => {
    intakeAssistantPanel.classList.toggle("hidden");
    if (!intakeAssistantPanel.classList.contains("hidden")) {
      assistantInput?.focus();
    }
  });
}

if (assistantCloseBtn && intakeAssistantPanel) {
  assistantCloseBtn.addEventListener("click", () => {
    intakeAssistantPanel.classList.add("hidden");
  });
}

assistantQuickButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const text = String(btn.textContent || "").trim();
    if (text) askAssistant(text);
  });
});

if (assistantForm) {
  assistantForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = String(assistantInput?.value || "").trim();
    if (!question) return;
    assistantInput.value = "";
    askAssistant(question);
  });
}

setStep(1);
loadMeta();
