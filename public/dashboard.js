const logoutBtn = document.getElementById('logoutBtn');
const gradeNow = document.getElementById('gradeNow');
const gradeTarget = document.getElementById('gradeTarget');
const bandNow = document.getElementById('bandNow');
const weekImprovement = document.getElementById('weekImprovement');
const gradeProgressFill = document.getElementById('gradeProgressFill');
const gradeScaleLeft = document.getElementById('gradeScaleLeft');
const gradeScaleRight = document.getElementById('gradeScaleRight');
const todayFocusLine = document.getElementById('todayFocusLine');
const taskChecklist = document.getElementById('taskChecklist');
const weeklySessions = document.getElementById('weeklySessions');
const avgScore = document.getElementById('avgScore');
const avgDelta = document.getElementById('avgDelta');
const totalStars = document.getElementById('totalStars');
const weeklyChart = document.getElementById('weeklyChart');
const trialAccessLabel = document.getElementById('trialAccessLabel');
const trialDaysLeft = document.getElementById('trialDaysLeft');
const vocabStars = document.getElementById('vocabStars');
const grammarStars = document.getElementById('grammarStars');
const writingStars = document.getElementById('writingStars');
const readingStars = document.getElementById('readingStars');
const referralCode = document.getElementById('referralCode');
const bonusStars = document.getElementById('bonusStars');
const referralJoinedWith = document.getElementById('referralJoinedWith');
const schoolNamePill = document.getElementById('schoolNamePill');
const copyReferralBtn = document.getElementById('copyReferralBtn');
const copyReferralMessageBtn = document.getElementById('copyReferralMessageBtn');
const referralShareText = document.getElementById('referralShareText');
const referralTotal = document.getElementById('referralTotal');
const referralPending = document.getElementById('referralPending');
const referralGranted = document.getElementById('referralGranted');
const referralList = document.getElementById('referralList');

function bandToGrade(band) {
  const value = Number(band || 4);
  if (value >= 6) return 'A-';
  if (value >= 5) return 'B+';
  if (value >= 4) return 'C+';
  if (value >= 3) return 'D';
  return 'E';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function renderTasks(todayStarted, todayDone) {
  if (!taskChecklist) return;

  const states = todayDone
    ? [true, true, true]
    : todayStarted
      ? [true, true, false]
      : [false, false, false];

  const labels = [
    'Quick Fix (2 min)',
    'Writing Drill (6 min)',
    'Rewrite Practice (2 min)'
  ];

  taskChecklist.innerHTML = labels
    .map((label, idx) => {
      const checked = states[idx] ? 'checked' : '';
      const marker = states[idx] ? '✔' : '◻';
      return `<div class="task-item ${checked}"><span>${marker}</span><span>${label}</span></div>`;
    })
    .join('');
}

function renderWeeklyChart(rows = []) {
  if (!weeklyChart) return;
  const width = 420;
  const height = 120;
  const padding = 14;

  const safeRows = rows.length ? rows : Array.from({ length: 7 }, () => ({ score: 0 }));

  const points = safeRows.map((row, i) => {
    const x = padding + (i * (width - padding * 2)) / Math.max(1, safeRows.length - 1);
    const y = height - padding - ((clamp(Number(row.score || 0), 0, 100) / 100) * (height - padding * 2));
    return { x, y };
  });

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  weeklyChart.innerHTML = `
    <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(148,163,184,0.45)" stroke-width="1" />
    <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="rgba(148,163,184,0.45)" stroke-width="1" />
    <path d="${path}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    ${points.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" fill="#0f172a" stroke="#ff6b00" stroke-width="2" />`).join('')}
  `;
}

function formatReferralDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function renderReferralList(rows = []) {
  if (!referralList) return;

  if (!rows.length) {
    referralList.innerHTML = '<div class="referral-list-empty">No friends joined with your code yet.</div>';
    return;
  }

  referralList.innerHTML = rows.map((row) => {
    const status = row.reward_status === 'granted' ? 'Rewarded' : 'Pending';
    const statusClass = row.reward_status === 'granted' ? 'granted' : 'pending';
    const joined = formatReferralDate(row.created_at);
    return `
      <div class="referral-list-item">
        <div>
          <div class="referral-list-name">${row.name || 'New student'}</div>
          <div class="referral-list-meta">${row.email || 'New signup'}${joined ? ` • Joined ${joined}` : ''}</div>
        </div>
        <span class="referral-status ${statusClass}">${status}</span>
      </div>
    `;
  }).join('');
}

function buildReferralShareMessage(code) {
  const safeCode = (code || 'SBH00000').trim();
  return `Join me on SenangBah and use my referral code ${safeCode} when you sign up. You get +2 bonus stars after your first lesson, and I get +3 bonus stars too.`;
}

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return { ok: res.ok, data: await res.json() };
}

async function loadDashboard() {
  const res = await fetch('/api/dashboard');
  if (!res.ok) {
    window.location.href = '/login.html';
    return;
  }

  const data = await res.json();

  const currentBand = Number(data.estimated_band || 4);
  const targetBand = clamp(currentBand + 1, 4, 6);
  const currentGrade = bandToGrade(currentBand);
  const targetGrade = bandToGrade(targetBand);

  if (gradeNow) gradeNow.textContent = currentGrade;
  if (gradeTarget) gradeTarget.textContent = targetGrade;
  if (bandNow) bandNow.textContent = `Band: ${currentBand}`;

  if (gradeScaleLeft) gradeScaleLeft.textContent = currentGrade;
  if (gradeScaleRight) gradeScaleRight.textContent = targetGrade;
  if (gradeProgressFill) {
    const pct = clamp(((currentBand - 2) / 4) * 100, 8, 100);
    gradeProgressFill.style.width = `${Math.round(pct)}%`;
  }

  if (weekImprovement) {
    weekImprovement.textContent = `Improvement This Week: +${Number(data.week_improvement || 0)}%`;
  }

  if (todayFocusLine) {
    todayFocusLine.textContent = `Day ${data.day_index || 1} of ${data.total_days || 14} - ${data.focus || 'Writing Focus'}`;
  }
  renderTasks(Boolean(data.today_started), Boolean(data.today_done));

  if (weeklySessions) weeklySessions.textContent = String(data.weekly_sessions || 0);
  if (avgScore) avgScore.textContent = `${Number(data.avg_score || 0)}%`;
  if (avgDelta) avgDelta.textContent = `+${Number(data.week_improvement || 0)}% This Week`;
  if (trialAccessLabel) trialAccessLabel.textContent = data.access_label || '30-Day Full Access';
  if (trialDaysLeft) trialDaysLeft.textContent = String(data.access_days_left ?? 30);
  if (totalStars) totalStars.textContent = String(data.total_stars || 0);
  if (bonusStars) bonusStars.textContent = String(data.bonus_stars || 0);
  if (writingStars) writingStars.textContent = String(data.completed_days || 0);
  if (vocabStars) vocabStars.textContent = String(data.vocab_total_stars || 0);
  if (grammarStars) grammarStars.textContent = String(data.grammar_total_stars || 0);
  if (readingStars) readingStars.textContent = String(data.reading_total_stars || 0);
  if (referralCode) referralCode.textContent = data.referral_code || 'SBH00000';
  if (referralShareText) {
    referralShareText.textContent = buildReferralShareMessage(data.referral_code || 'SBH00000');
  }
  if (schoolNamePill) schoolNamePill.textContent = data.school_name || 'School';
  if (referralJoinedWith) {
    referralJoinedWith.textContent = data.referred_by_code
      ? `Joined with: ${data.referred_by_code}`
      : 'Joined with: none';
  }
  if (referralTotal) referralTotal.textContent = String(data.referral_stats?.total || 0);
  if (referralPending) referralPending.textContent = String(data.referral_stats?.pending || 0);
  if (referralGranted) referralGranted.textContent = String(data.referral_stats?.granted || 0);

  renderWeeklyChart(data.weekly_activity || []);
  renderReferralList(data.recent_referrals || []);
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await postJSON('/api/auth/logout', {});
    window.location.href = '/login.html';
  });
}

if (copyReferralBtn) {
  copyReferralBtn.addEventListener('click', async () => {
    const code = referralCode?.textContent?.trim();
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      copyReferralBtn.textContent = 'Copied';
      setTimeout(() => {
        copyReferralBtn.textContent = 'Copy Code';
      }, 1200);
    } catch {
      copyReferralBtn.textContent = 'Copy Failed';
      setTimeout(() => {
        copyReferralBtn.textContent = 'Copy Code';
      }, 1200);
    }
  });
}

if (copyReferralMessageBtn) {
  copyReferralMessageBtn.addEventListener('click', async () => {
    const message = referralShareText?.textContent?.trim();
    if (!message) return;

    try {
      await navigator.clipboard.writeText(message);
      copyReferralMessageBtn.textContent = 'Invite Copied';
      setTimeout(() => {
        copyReferralMessageBtn.textContent = 'Copy Invite Message';
      }, 1400);
    } catch {
      copyReferralMessageBtn.textContent = 'Copy Failed';
      setTimeout(() => {
        copyReferralMessageBtn.textContent = 'Copy Invite Message';
      }, 1400);
    }
  });
}

loadDashboard();
