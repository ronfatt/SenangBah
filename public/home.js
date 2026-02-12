const startConsultBtn = document.getElementById('startConsultBtn');
const consultWizard = document.getElementById('consultWizard');
const consultSteps = [...document.querySelectorAll('.consult-step')];
const consultResult = document.getElementById('consultResult');

const state = {
  grade: null,
  challenge: null,
  step: 1
};

function shouldReduceMotion() {
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
  const saveData = navigator.connection?.saveData === true;
  return Boolean(prefersReduced || lowCpu || lowMemory || saveData);
}

const reduceMotion = shouldReduceMotion();
if (reduceMotion) {
  document.body.classList.add('reduce-motion');
}

function showStep(step) {
  state.step = step;
  consultSteps.forEach((node) => {
    node.classList.toggle('active', Number(node.dataset.step) === step);
  });
}

function buildRecommendation() {
  const gradeText = {
    A_B: 'already near upper performance bands',
    C_D: 'currently in a mid-band range',
    E_FAIL: 'currently below target SPM pass performance',
    NOT_SURE: 'currently unclear and needs a baseline check'
  }[state.grade] || 'currently unclear and needs a baseline check';

  const challengeText = {
    WRITING_IDEAS: 'idea development and paragraph support',
    GRAMMAR: 'sentence accuracy and grammar consistency',
    ORGANISATION: 'organisation, linking and flow',
    TIME_MANAGEMENT: 'speed, planning and exam time control'
  }[state.challenge] || 'writing fundamentals';

  return `Based on your input, your child is ${gradeText}. The main focus should be ${challengeText}, with structured writing breakdown training aligned to SPM marking criteria.`;
}

if (startConsultBtn && consultWizard) {
  startConsultBtn.addEventListener('click', () => {
    consultWizard.classList.remove('hidden');
    showStep(1);
    consultWizard.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('.consult-option');
  if (!button) return;

  const group = button.parentElement?.dataset.group;
  const value = button.dataset.value;
  if (!group || !value) return;

  const siblings = [...button.parentElement.querySelectorAll('.consult-option')];
  siblings.forEach((item) => item.classList.remove('active'));
  button.classList.add('active');

  if (group === 'grade') {
    state.grade = value;
    showStep(2);
    return;
  }

  if (group === 'challenge') {
    state.challenge = value;
    consultResult.textContent = buildRecommendation();
    showStep(3);
  }
});
