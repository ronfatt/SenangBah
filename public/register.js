const form = document.getElementById("pilotForm");
const steps = [...document.querySelectorAll(".step")];
const roleButtons = [...document.querySelectorAll(".roleBtn")];
const roleInput = document.getElementById("roleInput");
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
const progressFill = document.getElementById("progressFill");
const stepLabel = document.getElementById("stepLabel");
const reviewPool = document.getElementById("reviewPool");
const seatsLeft = document.getElementById("seatsLeft");

let currentStep = 1;

const labels = {
  1: "Step 1 of 4 · Choose role",
  2: "Step 2 of 4 · Student information",
  3: "Step 3 of 4 · Previous exam result",
  4: "Step 4 of 4 · Choose preferred plan"
};

function setStep(step) {
  currentStep = step;
  steps.forEach((node) => {
    node.classList.toggle("active", Number(node.dataset.step) === step);
  });

  progressFill.style.width = `${(step / 4) * 100}%`;
  stepLabel.textContent = labels[step];

  prevBtn.style.display = step === 1 ? "none" : "inline-block";
  nextBtn.style.display = step === 4 ? "none" : "inline-block";
  submitBtn.style.display = step === 4 ? "inline-block" : "none";
  errorText.textContent = "";
}

function validateStep(step) {
  if (step === 1) {
    return Boolean(roleInput.value);
  }

  const activeStep = document.querySelector(`.step[data-step=\"${step}\"]`);
  const inputs = [...activeStep.querySelectorAll("input, select, textarea")]
    .filter((node) => node.required);

  for (const node of inputs) {
    if (node.type === "radio") {
      const checked = activeStep.querySelector(`input[name=\"${node.name}\"]:checked`);
      if (!checked) return false;
      continue;
    }

    if (!String(node.value || "").trim()) return false;
  }

  return true;
}

function showStepError(step) {
  const tips = {
    1: "Please choose Student, Parent, or Teacher.",
    2: "Please complete all student information fields.",
    3: "Please provide your previous exam result details.",
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
    roleInput.value = button.dataset.role;
    errorText.textContent = "";
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateStep(4)) {
    showStepError(4);
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());

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
        intro_too_short: "Please write at least 30 words for your self-introduction sample.",
        invalid_email: "Please use a valid email address.",
        invalid_role: "Please choose a valid role.",
        invalid_previous_result_type: "Please choose Form 4 or Diagnostic test.",
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

async function loadMeta() {
  try {
    const response = await fetch("/api/pilot-registration/meta");
    if (!response.ok) return;
    const data = await response.json();
    reviewPool.textContent = data.review_pool_count;
    seatsLeft.textContent = data.seats_left;
  } catch {
    // ignore
  }
}

setStep(1);
loadMeta();
