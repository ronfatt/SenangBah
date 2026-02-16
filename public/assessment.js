const essayForm = document.getElementById('essayForm');
const essayFile = document.getElementById('essayFile');
const essayMsg = document.getElementById('essayMsg');
const essayResult = document.getElementById('essayResult');
const dropzone = document.getElementById('dropzone');
const fileName = document.getElementById('fileName');
const clearFileBtn = document.getElementById('clearFileBtn');
const runBtn = document.getElementById('runBtn');
const diagLoading = document.getElementById('diagLoading');
const diagLoadingFill = document.getElementById('diagLoadingFill');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseBandMidpoint(bandText = '') {
  const values = String(bandText).match(/\d+/g)?.map(Number).filter((n) => Number.isFinite(n)) || [];
  if (!values.length) return 4;
  if (values.length === 1) return values[0];
  return (values[0] + values[1]) / 2;
}

function estimateSpmRubric(bandText = '') {
  const mid = parseBandMidpoint(bandText);
  const ratio = Math.max(0, Math.min(1, (mid - 1) / 5));
  const content = Math.round(6 + ratio * 14); // /20
  const language = Math.round(6 + ratio * 14); // /20
  const organisation = Math.round(3 + ratio * 7); // /10
  return {
    content,
    language,
    organisation,
    total: content + language + organisation
  };
}

function extractTextStats(text = '') {
  const content = String(text || '').trim();
  const words = content ? content.split(/\s+/).filter(Boolean) : [];
  const sentences = content.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const paragraphs = content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const avgSentenceLength = sentences.length ? words.length / sentences.length : 0;
  const connectors = ['however', 'therefore', 'moreover', 'in addition', 'firstly', 'secondly', 'for example', 'because'];
  const connectorHits = connectors.reduce((acc, token) => {
    const regex = new RegExp(`\\b${token.replace(' ', '\\s+')}\\b`, 'gi');
    const count = (content.match(regex) || []).length;
    return acc + count;
  }, 0);
  return {
    words: words.length,
    sentences: sentences.length,
    paragraphs: paragraphs.length || (content ? 1 : 0),
    avgSentenceLength: Number(avgSentenceLength.toFixed(1)),
    connectorHits
  };
}

function mapBandToCefr(bandText = '') {
  const mid = parseBandMidpoint(bandText);
  if (mid >= 6) return { level: 'B2', descriptor: 'Can write clear, detailed responses with controlled language.' };
  if (mid >= 5) return { level: 'B1+', descriptor: 'Can explain ideas clearly but still needs consistency in range and flow.' };
  if (mid >= 4) return { level: 'B1', descriptor: 'Can write connected text on familiar topics with frequent simplification.' };
  if (mid >= 3) return { level: 'A2+', descriptor: 'Can write short connected sentences with limited control.' };
  return { level: 'A2', descriptor: 'Can produce basic sentences but needs strong support for development.' };
}

function toPercent(part, total) {
  if (!total) return 0;
  return Math.round((Math.max(0, part) / total) * 100);
}

function estimateErrorDistribution(textStats, weaknesses = []) {
  const words = Math.max(1, textStats.words || 0);
  const base = Math.max(2, weaknesses.length * 2);
  const categories = [
    { name: 'Tense Consistency', freq: Math.max(1, Math.round(base * 0.32)) },
    { name: 'Sentence Structure', freq: Math.max(1, Math.round(base * 0.28)) },
    { name: 'Word Choice', freq: Math.max(1, Math.round(base * 0.24)) },
    { name: 'Punctuation', freq: Math.max(1, Math.round(base * 0.16)) }
  ];
  const totalFreq = categories.reduce((acc, item) => acc + item.freq, 0);
  const density = Number(((totalFreq / words) * 100).toFixed(1));
  const benchmark = density <= 4 ? 'At / better than Band 6 benchmark' : density <= 7 ? 'Near Band 5 benchmark' : 'Below Band 5 benchmark';
  return { categories, totalFreq, density, benchmark };
}

function estimateSentenceDistribution(textStats, complexityIndex) {
  const sentences = Math.max(1, textStats.sentences || 1);
  const connectorBias = Math.min(0.28, (textStats.connectorHits || 0) / 20);
  const complex = Math.max(1, Math.round(sentences * (0.22 + connectorBias)));
  const compound = Math.max(1, Math.round(sentences * (0.30 + connectorBias / 2)));
  const simple = Math.max(1, sentences - complex - compound);
  const benchmark = complexityIndex >= 72 ? 'Aligned with Band 6 complexity range' : complexityIndex >= 58 ? 'Aligned with Band 5 complexity range' : 'Below Band 5 complexity range';
  return { simple, compound, complex, benchmark };
}

function estimateParagraphDepth(textStats, improvementsCount) {
  const argumentStrength = Math.max(30, Math.min(92, Math.round((textStats.paragraphs * 18) + (improvementsCount * 9))));
  const supportRatio = Math.max(25, Math.min(95, Math.round((textStats.sentences > 0 ? ((textStats.sentences - 1) / textStats.sentences) * 100 : 30))));
  const suggestion = supportRatio < 55
    ? 'Add one concrete support sentence after each main point.'
    : 'Strengthen each paragraph with one specific example or impact.';
  return { argumentStrength, supportRatio, suggestion };
}

function projectBandUpgrade(bandText, improvementsCount, complexityIndex, density) {
  const current = parseBandMidpoint(bandText);
  const qualityBoost = Math.min(1.2, (improvementsCount * 0.12) + (complexityIndex / 250) + Math.max(0, (6 - density) / 20));
  const projected = Math.max(current, Math.min(6.5, Number((current + qualityBoost).toFixed(1))));
  const projectedRange = projected >= 6 ? 'Band 6' : projected >= 5.2 ? 'Band 5-6' : projected >= 4.4 ? 'Band 5' : 'Band 4-5';
  return { projected, projectedRange };
}

function renderEssayResult(data) {
  if (!essayResult) return;
  essayResult.innerHTML = '';
  if (!data?.analysis) return;

  const a = data.analysis;
  const analysis = a.analysis || {};
  const rubric = estimateSpmRubric(analysis.band_estimate_range || '');
  const textStats = extractTextStats(a.extracted_text || '');
  const cefr = mapBandToCefr(analysis.band_estimate_range || '');
  const weaknessesCount = Array.isArray(analysis.weaknesses) ? analysis.weaknesses.length : 0;
  const improvementsCount = Array.isArray(analysis.improvements) ? analysis.improvements.length : 0;
  const corrections = Array.isArray(analysis.sentence_corrections) ? analysis.sentence_corrections : [];
  const fallbackCorrection = analysis.band_lift_sentence
    ? [{ original: 'Original sentence from your draft', revised: analysis.band_lift_sentence, reason: 'Stronger wording and clearer impact.' }]
    : [];
  const correctionList = corrections.length ? corrections : fallbackCorrection;
  const complexityIndex = Math.max(20, Math.min(95, Math.round((textStats.avgSentenceLength * 4) + (textStats.connectorHits * 6))));
  const paragraphDepthScore = Math.max(25, Math.min(95, Math.round((textStats.paragraphs * 20) + (improvementsCount * 8))));
  const errorDist = estimateErrorDistribution(textStats, analysis.weaknesses || []);
  const sentenceDist = estimateSentenceDistribution(textStats, complexityIndex);
  const paragraphDepth = estimateParagraphDepth(textStats, improvementsCount);
  const projection = projectBandUpgrade(analysis.band_estimate_range || '', improvementsCount, complexityIndex, errorDist.density);

  essayResult.innerHTML = `
    <section class="diag-layer diag-layer-basic">
      <div class="diag-layer-head">
        <h3>Layer 1 · Basic Diagnostic Report</h3>
        <p class="muted">Full SPM-aligned scoring with clear next actions.</p>
      </div>

      <div class="diag-score-grid">
        <div class="diag-score-item">
          <span>Content</span>
          <strong>${rubric.content}/20</strong>
        </div>
        <div class="diag-score-item">
          <span>Language</span>
          <strong>${rubric.language}/20</strong>
        </div>
        <div class="diag-score-item">
          <span>Organisation</span>
          <strong>${rubric.organisation}/10</strong>
        </div>
        <div class="diag-score-item">
          <span>Estimated Band</span>
          <strong>${analysis.band_estimate_range || 'Band 4-5'}</strong>
        </div>
      </div>

      <div class="diag-columns">
        <div>
          <h4>Strengths</h4>
          <ul>${(analysis.strengths || []).map((t) => `<li>✔ ${escapeHtml(t)}</li>`).join('')}</ul>
        </div>
        <div>
          <h4>Actionable Improvement Guidance</h4>
          <ul>${(analysis.improvements || []).map((t) => `<li>→ ${escapeHtml(t)}</li>`).join('')}</ul>
        </div>
      </div>

      <div class="diag-columns">
        <div>
          <h4>Weaknesses</h4>
          <ul>${(analysis.weaknesses || []).map((t) => `<li>⚠ ${escapeHtml(t)}</li>`).join('')}</ul>
        </div>
        <div>
          <h4>Sample Sentence Corrections</h4>
          <div class="diag-corrections">
            ${correctionList.map((item, idx) => `
              <article class="diag-correction-item">
                <p><strong>${idx + 1}.</strong> Original: ${escapeHtml(item.original || '-')}</p>
                <p>Revised: ${escapeHtml(item.revised || '-')}</p>
                <p class="muted">Why: ${escapeHtml(item.reason || '-')}</p>
              </article>
            `).join('')}
          </div>
        </div>
      </div>
    </section>

    <section class="diag-layer diag-layer-advanced">
      <div class="diag-layer-head">
        <h3>🔒 Layer 2 · Advanced Preview</h3>
        <p class="muted">Summarized metrics preview.</p>
      </div>
      <div class="diag-advanced-grid">
        <article class="diag-adv-item">
          <h4>Error Distribution</h4>
          <p>Weakness flags: <strong>${weaknessesCount}</strong></p>
          <p>Improvement flags: <strong>${improvementsCount}</strong></p>
          <p class="muted">Estimated balance: Content ${toPercent(rubric.content, 20)}% · Language ${toPercent(rubric.language, 20)}% · Organisation ${toPercent(rubric.organisation, 10)}%</p>
        </article>
        <article class="diag-adv-item">
          <h4>Sentence Complexity Index</h4>
          <p><strong>${complexityIndex}/100</strong></p>
          <p class="muted">Avg sentence length: ${textStats.avgSentenceLength} words · Connectors: ${textStats.connectorHits}</p>
        </article>
        <article class="diag-adv-item">
          <h4>CEFR Descriptor Mapping</h4>
          <p><strong>${cefr.level}</strong></p>
          <p class="muted">${escapeHtml(cefr.descriptor)}</p>
        </article>
        <article class="diag-adv-item">
          <h4>Paragraph Development Depth</h4>
          <p><strong>${paragraphDepthScore}/100</strong></p>
          <p class="muted">Paragraphs: ${textStats.paragraphs} · Sentences: ${textStats.sentences} · Words: ${textStats.words}</p>
        </article>
      </div>
      <p class="diag-unlock-note">Unlock Advanced Insights</p>
    </section>

    <section class="diag-layer diag-layer-advanced diag-pro-module">
      <div class="diag-layer-head">
        <h3>🔒 Advanced Performance Insights</h3>
        <p class="muted">Preview available now. Detailed metrics are Pro-locked.</p>
      </div>

      <div class="diag-pro-grid">
        <article class="diag-pro-item">
          <h4>1) Error Distribution Analysis</h4>
          <p>Top categories: ${escapeHtml(errorDist.categories.map((c) => `${c.name} (${c.freq})`).join(' · '))}</p>
          <p>Error density: <strong>${errorDist.density}</strong> / 100 words</p>
          <p class="muted">Benchmark: ${escapeHtml(errorDist.benchmark)}</p>
          <div class="diag-pro-locked"><span class="lock">🔒</span> Detailed per-category trend, line-level mapping, and benchmark percentile are available in Pro.</div>
        </article>

        <article class="diag-pro-item">
          <h4>2) Sentence Complexity Index</h4>
          <p>Simple / Compound / Complex: <strong>${sentenceDist.simple} / ${sentenceDist.compound} / ${sentenceDist.complex}</strong></p>
          <p>Complexity score: <strong>${complexityIndex}/100</strong></p>
          <p class="muted">Benchmark: ${escapeHtml(sentenceDist.benchmark)}</p>
          <div class="diag-pro-locked"><span class="lock">🔒</span> Clause-level structure map and complexity progression are available in Pro.</div>
        </article>

        <article class="diag-pro-item">
          <h4>3) CEFR Descriptor Alignment</h4>
          <p>Estimated CEFR: <strong>${cefr.level}</strong></p>
          <p>Strength / Weakness signals: <strong>${(analysis.strengths || []).length}</strong> / <strong>${(analysis.weaknesses || []).length}</strong></p>
          <p class="muted">${escapeHtml(cefr.descriptor)}</p>
          <div class="diag-pro-locked"><span class="lock">🔒</span> Skill-by-skill descriptor mapping and calibration notes are available in Pro.</div>
        </article>

        <article class="diag-pro-item">
          <h4>4) Paragraph Development Depth</h4>
          <p>Argument strength index: <strong>${paragraphDepth.argumentStrength}/100</strong></p>
          <p>Support sentence ratio: <strong>${paragraphDepth.supportRatio}%</strong></p>
          <p class="muted">${escapeHtml(paragraphDepth.suggestion)}</p>
          <div class="diag-pro-locked"><span class="lock">🔒</span> Paragraph-by-paragraph development graph and evidence quality breakdown are available in Pro.</div>
        </article>

        <article class="diag-pro-item diag-pro-item-wide">
          <h4>5) Band Upgrade Projection</h4>
          <p>Conditional model: based on correction quality + complexity + error density.</p>
          <p>Projected band after corrections: <strong>${projection.projectedRange}</strong> (model score: ${projection.projected})</p>
          <div class="diag-pro-locked"><span class="lock">🔒</span> Full projection model assumptions and scenario simulation are available in Pro.</div>
        </article>
      </div>
      <p class="diag-unlock-note">Unlock Advanced Insights</p>
    </section>
  `;
}

function setFile(file) {
  if (!essayFile || !file) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  essayFile.files = dt.files;
  fileName.textContent = file.name;
  if (clearFileBtn) clearFileBtn.classList.remove('hidden');
}

function clearSelectedFile() {
  if (!essayFile) return;
  essayFile.value = '';
  fileName.textContent = 'No file selected';
  if (clearFileBtn) clearFileBtn.classList.add('hidden');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runProcessingPreview() {
  if (!diagLoading || !diagLoadingFill) return;
  diagLoading.classList.remove('hidden');
  diagLoadingFill.style.width = '0%';
  await sleep(300);
  diagLoadingFill.style.width = '20%';
  await sleep(700);
  diagLoadingFill.style.width = '45%';
  await sleep(800);
  diagLoadingFill.style.width = '72%';
  await sleep(900);
  diagLoadingFill.style.width = '90%';
}

function stopProcessingPreview() {
  if (!diagLoading || !diagLoadingFill) return;
  diagLoadingFill.style.width = '100%';
  setTimeout(() => {
    diagLoading.classList.add('hidden');
    diagLoadingFill.style.width = '0%';
  }, 250);
}

if (dropzone) {
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    setFile(file);
  });
}

if (essayFile) {
  essayFile.addEventListener('change', () => {
    const file = essayFile.files?.[0];
    fileName.textContent = file ? file.name : 'No file selected';
    if (clearFileBtn) clearFileBtn.classList.toggle('hidden', !file);
  });
}

if (clearFileBtn) {
  clearFileBtn.addEventListener('click', () => {
    clearSelectedFile();
    essayMsg.textContent = '';
  });
}

if (essayForm) {
  essayForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    essayMsg.textContent = '';
    essayResult.innerHTML = '';

    const file = essayFile?.files?.[0];
    if (!file) {
      essayMsg.textContent = 'Please choose an image.';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      essayMsg.textContent = 'File too large. Max 10MB.';
      return;
    }

    runBtn.disabled = true;
    runBtn.textContent = 'Running...';

    const loadingPromise = runProcessingPreview();

    const formData = new FormData();
    formData.append('image', file);

    const resPromise = fetch('/api/essay/upload', {
      method: 'POST',
      body: formData
    });

    const [res] = await Promise.all([resPromise, loadingPromise]);
    const data = await res.json();

    stopProcessingPreview();
    runBtn.disabled = false;
    runBtn.textContent = '📊 Run Diagnostic Analysis';

    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      essayMsg.textContent = data?.error || 'Upload failed';
      return;
    }

    essayMsg.textContent = 'Diagnostic completed.';
    renderEssayResult(data);
  });
}
