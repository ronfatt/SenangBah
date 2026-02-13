const adminLoginForm = document.getElementById('adminLoginForm');
const adminLoginMsg = document.getElementById('adminLoginMsg');
const adminLoginCard = document.getElementById('adminLoginCard');
const adminTableCard = document.getElementById('adminTableCard');
const teacherMgmtCard = document.getElementById('teacherMgmtCard');
const chatSummaryCard = document.getElementById('chatSummaryCard');
const adminDeleteCard = document.getElementById('adminDeleteCard');
const adminLogout = document.getElementById('adminLogout');
const deleteForm = document.getElementById('deleteForm');
const deleteMsg = document.getElementById('deleteMsg');
const resetByEmailBtn = document.getElementById('resetByEmail');
const schoolCodeCard = document.getElementById('schoolCodeCard');
const schoolCodeForm = document.getElementById('schoolCodeForm');
const schoolCodeMsg = document.getElementById('schoolCodeMsg');
const pilotCard = document.getElementById('pilotCard');
const registerExamplesCard = document.getElementById('registerExamplesCard');
const registerExamplesForm = document.getElementById('registerExamplesForm');
const registerExamplesMsg = document.getElementById('registerExamplesMsg');
const teacherSummary = document.getElementById('teacherSummary');
const pilotStatusFilter = document.getElementById('pilotStatusFilter');
const pilotSearchInput = document.getElementById('pilotSearchInput');
const pilotPageSize = document.getElementById('pilotPageSize');
const pilotPrevBtn = document.getElementById('pilotPrevBtn');
const pilotNextBtn = document.getElementById('pilotNextBtn');
const pilotPageInfo = document.getElementById('pilotPageInfo');
const pilotMeta = document.getElementById('pilotMeta');

const pilotState = {
  allItems: [],
  filteredItems: [],
  page: 1,
  pageSize: 25
};

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return { ok: res.ok, data: await res.json() };
}

async function fetchUsers() {
  const res = await fetch('/api/admin/users');
  if (!res.ok) return null;
  return res.json();
}

function renderTable(users) {
  const tbody = document.querySelector('#adminTable tbody');
  tbody.innerHTML = '';
  users.forEach((u) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.name || ''}</td>
      <td>${u.email || ''}</td>
      <td>${u.class_name || ''}</td>
      <td>${u.teacher_name || ''}</td>
      <td>${u.estimated_band || ''}</td>
      <td>${u.total_sessions || 0}</td>
      <td>${u.completed_sessions || 0}</td>
      <td>${u.completion_rate || 0}%</td>
      <td>${u.last_active || '-'}</td>
      <td>
        <button class="btn ghost" data-action="reset" data-id="${u.id}">Reset</button>
        <button class="btn primary" data-action="delete" data-id="${u.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderChatTable(items) {
  const tbody = document.querySelector('#chatTable tbody');
  tbody.innerHTML = '';
  items.forEach((u) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.name || ''}</td>
      <td>${u.email || ''}</td>
      <td>${u.chat_count || 0}</td>
      <td>${u.last_chat || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTeacherTable(payload) {
  const tbody = document.querySelector('#teacherMgmtTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const teachers = payload?.teachers || [];

  teachers.forEach((t) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.name || ''}</td>
      <td>${t.email || ''}</td>
      <td>${t.code || ''}</td>
      <td>${t.school_code || ''}</td>
      <td>${t.student_count || 0}</td>
      <td>${t.total_completed_sessions || 0}</td>
      <td>${t.last_active || '-'}</td>
      <td>
        <button class="btn ghost" data-action="resetTeacherCode" data-id="${t.id}">Reset Code</button>
        <button class="btn primary" data-action="deleteTeacher" data-id="${t.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (teacherSummary) {
    const totalTeachers = payload?.summary?.total_teachers || 0;
    const totalAssignedStudents = payload?.summary?.total_assigned_students || 0;
    teacherSummary.textContent = `Teachers: ${totalTeachers} · Assigned Students: ${totalAssignedStudents}`;
  }
}

function applyPilotFilters() {
  const status = pilotStatusFilter?.value || 'ALL';
  const query = (pilotSearchInput?.value || '').trim().toLowerCase();
  let items = [...pilotState.allItems];
  if (status !== 'ALL') {
    items = items.filter((item) => item.status === status);
  }
  if (query) {
    items = items.filter((item) => {
      const hay = [item.full_name, item.email, item.school_name, item.role].join(' ').toLowerCase();
      return hay.includes(query);
    });
  }
  pilotState.filteredItems = items;
}

function renderPilotTable(items) {
  const tbody = document.querySelector('#pilotTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="9" class="muted">No applications found.</td>`;
    tbody.appendChild(tr);
    return;
  }
  items.forEach((item) => {
    const tr = document.createElement('tr');
    const summary = item?.self_intro_analysis?.overall_comment || '-';
    const canApprove = item.status !== 'APPROVED';
    const summaryId = `pilotSummary_${item.id}`;
    const summaryText = String(summary || '-');
    const canExpand = summaryText.length > 180;
    tr.innerHTML = `
      <td>${item.created_at || ''}</td>
      <td>${item.full_name || ''}</td>
      <td>${item.role || ''}</td>
      <td>${item.email || ''}</td>
      <td>${item.school_name || ''}</td>
      <td>${item.plan_choice || ''}</td>
      <td>${item.status || ''}</td>
      <td class="pilot-summary-cell">
        <div id="${summaryId}" class="pilot-summary-text ${canExpand ? 'is-clamped' : ''}">${summaryText}</div>
        ${canExpand ? `<button class="btn ghost pilot-summary-toggle" type="button" data-action="toggleSummary" data-target="${summaryId}" aria-expanded="false">Show more</button>` : ''}
      </td>
      <td>${canApprove ? `<button class="btn primary" data-action="approvePilot" data-id="${item.id}">Approve</button>` : '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderPilotSection() {
  applyPilotFilters();
  const pageSize = Number(pilotPageSize?.value || pilotState.pageSize || 25);
  pilotState.pageSize = pageSize;
  const total = pilotState.filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (pilotState.page > totalPages) pilotState.page = totalPages;
  if (pilotState.page < 1) pilotState.page = 1;

  const start = (pilotState.page - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = pilotState.filteredItems.slice(start, end);
  renderPilotTable(pageItems);

  if (pilotMeta) {
    const status = pilotStatusFilter?.value || 'ALL';
    const statusText = status === 'ALL' ? 'All' : status.replace('_', ' ');
    pilotMeta.textContent = `${total} record(s) · ${statusText}`;
  }
  if (pilotPageInfo) {
    pilotPageInfo.textContent = `Page ${pilotState.page} / ${totalPages}`;
  }
  if (pilotPrevBtn) pilotPrevBtn.disabled = pilotState.page <= 1;
  if (pilotNextBtn) pilotNextBtn.disabled = pilotState.page >= totalPages;
}

function renderRegisterExamples(items) {
  const tbody = document.querySelector('#registerExamplesTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const rows = items.length ? items : [
    { sort_order: 1, before_text: '', after_text: '' },
    { sort_order: 2, before_text: '', after_text: '' },
    { sort_order: 3, before_text: '', after_text: '' }
  ];
  rows.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><textarea rows="2" data-field="before_text">${item.before_text || ''}</textarea></td>
      <td><textarea rows="2" data-field="after_text">${item.after_text || ''}</textarea></td>
    `;
    tbody.appendChild(tr);
  });
}

async function load() {
  const data = await fetchUsers();
  const teachers = await fetch('/api/admin/teachers').then(r => r.ok ? r.json() : null);
  const chat = await fetch('/api/admin/chat-summary').then(r => r.ok ? r.json() : null);
  const pilot = await fetch('/api/admin/pilot-registrations').then(r => r.ok ? r.json() : null);
  const examples = await fetch('/api/admin/register-examples').then(r => r.ok ? r.json() : null);
  if (!data) return;
  adminLoginCard.style.display = 'none';
  adminTableCard.style.display = 'block';
  teacherMgmtCard.style.display = 'block';
  chatSummaryCard.style.display = 'block';
  adminDeleteCard.style.display = 'block';
  schoolCodeCard.style.display = 'block';
  pilotCard.style.display = 'block';
  registerExamplesCard.style.display = 'block';
  renderTable(data.users || []);
  if (teachers) renderTeacherTable(teachers);
  if (chat?.items) renderChatTable(chat.items);
  if (pilot?.items) {
    pilotState.allItems = pilot.items;
    pilotState.page = 1;
    renderPilotSection();
  }
  if (examples?.items) renderRegisterExamples(examples.items);
}

adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  adminLoginMsg.textContent = '';
  const formData = new FormData(adminLoginForm);
  const payload = Object.fromEntries(formData.entries());
  const res = await postJSON('/api/admin/login', payload);
  if (!res.ok) {
    adminLoginMsg.textContent = res.data?.error || 'Login failed';
    return;
  }
  await load();
});

adminLogout.addEventListener('click', async () => {
  await postJSON('/api/admin/logout', {});
  adminTableCard.style.display = 'none';
  teacherMgmtCard.style.display = 'none';
  chatSummaryCard.style.display = 'none';
  adminDeleteCard.style.display = 'none';
  schoolCodeCard.style.display = 'none';
  pilotCard.style.display = 'none';
  registerExamplesCard.style.display = 'none';
  adminLoginCard.style.display = 'block';
});

deleteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  deleteMsg.textContent = '';
  const formData = new FormData(deleteForm);
  const payload = Object.fromEntries(formData.entries());
  if (!payload.email) return;
  const res = await postJSON('/api/admin/delete-user', payload);
  if (!res.ok) {
    deleteMsg.textContent = res.data?.error || 'Delete failed';
    return;
  }
  deleteMsg.textContent = 'Deleted.';
  await load();
});

if (resetByEmailBtn) {
  resetByEmailBtn.addEventListener('click', async () => {
    deleteMsg.textContent = '';
    const formData = new FormData(deleteForm);
    const payload = Object.fromEntries(formData.entries());
    if (!payload.email) return;
    if (!confirm('Reset all progress for this student?')) return;
    const res = await postJSON('/api/admin/reset-user', payload);
    if (!res.ok) {
      deleteMsg.textContent = res.data?.error || 'Reset failed';
      return;
    }
    deleteMsg.textContent = 'Reset done.';
    await load();
  });
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  const action = btn.getAttribute('data-action');
  if (!id) return;
  if (action === 'reset') {
    if (!confirm('Reset all progress for this student?')) return;
    await postJSON('/api/admin/reset-user', { user_id: id });
    await load();
  }
  if (action === 'delete') {
    if (!confirm('Delete this student permanently?')) return;
    await postJSON('/api/admin/delete-user', { user_id: id });
    await load();
  }
  if (action === 'approvePilot') {
    if (!confirm('Approve this application?')) return;
    const res = await postJSON('/api/admin/pilot-approve', { id });
    if (!res.ok) {
      alert(res.data?.error || 'Approve failed');
      return;
    }
    await load();
  }
  if (action === 'resetTeacherCode') {
    if (!confirm('Reset this teacher code?')) return;
    const res = await postJSON('/api/admin/teacher-reset-code', { teacher_id: id });
    if (!res.ok) {
      alert(res.data?.error || 'Reset code failed');
      return;
    }
    await load();
  }
  if (action === 'deleteTeacher') {
    if (!confirm('Delete this teacher? Students will be unassigned.')) return;
    const res = await postJSON('/api/admin/delete-teacher', { teacher_id: id });
    if (!res.ok) {
      alert(res.data?.error || 'Delete teacher failed');
      return;
    }
    await load();
  }
  if (action === 'toggleSummary') {
    const targetId = btn.getAttribute('data-target');
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;
    const nextExpanded = target.classList.contains('is-clamped');
    target.classList.toggle('is-clamped');
    btn.textContent = nextExpanded ? 'Show less' : 'Show more';
    btn.setAttribute('aria-expanded', String(nextExpanded));
  }
});

if (pilotStatusFilter) {
  pilotStatusFilter.addEventListener('change', () => {
    pilotState.page = 1;
    renderPilotSection();
  });
}

if (pilotSearchInput) {
  pilotSearchInput.addEventListener('input', () => {
    pilotState.page = 1;
    renderPilotSection();
  });
}

if (pilotPageSize) {
  pilotPageSize.addEventListener('change', () => {
    pilotState.page = 1;
    renderPilotSection();
  });
}

if (pilotPrevBtn) {
  pilotPrevBtn.addEventListener('click', () => {
    pilotState.page -= 1;
    renderPilotSection();
  });
}

if (pilotNextBtn) {
  pilotNextBtn.addEventListener('click', () => {
    pilotState.page += 1;
    renderPilotSection();
  });
}

if (schoolCodeForm) {
  schoolCodeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    schoolCodeMsg.textContent = '';
    const formData = new FormData(schoolCodeForm);
    const payload = Object.fromEntries(formData.entries());
    const res = await postJSON('/api/admin/school-code', payload);
    if (!res.ok) {
      schoolCodeMsg.textContent = res.data?.error || 'Create failed';
      return;
    }
    schoolCodeMsg.textContent = 'Created.';
    schoolCodeForm.reset();
  });
}

if (registerExamplesForm) {
  registerExamplesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerExamplesMsg.textContent = '';
    const rows = [...document.querySelectorAll('#registerExamplesTable tbody tr')];
    const items = rows.map((row) => {
      const before = row.querySelector('textarea[data-field="before_text"]')?.value || '';
      const after = row.querySelector('textarea[data-field="after_text"]')?.value || '';
      return { before_text: before.trim(), after_text: after.trim() };
    }).filter((item) => item.before_text && item.after_text);

    const res = await postJSON('/api/admin/register-examples', { items });
    if (!res.ok) {
      registerExamplesMsg.textContent = res.data?.error || 'Save failed';
      return;
    }
    registerExamplesMsg.textContent = 'Saved.';
    await load();
  });
}

load();
