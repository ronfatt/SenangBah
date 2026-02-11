const adminLoginForm = document.getElementById('adminLoginForm');
const adminLoginMsg = document.getElementById('adminLoginMsg');
const adminLoginCard = document.getElementById('adminLoginCard');
const adminTableCard = document.getElementById('adminTableCard');
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

function renderPilotTable(items) {
  const tbody = document.querySelector('#pilotTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  items.forEach((item) => {
    const tr = document.createElement('tr');
    const summary = item?.self_intro_analysis?.overall_comment || '-';
    tr.innerHTML = `
      <td>${item.created_at || ''}</td>
      <td>${item.full_name || ''}</td>
      <td>${item.role || ''}</td>
      <td>${item.email || ''}</td>
      <td>${item.school_name || ''}</td>
      <td>${item.plan_choice || ''}</td>
      <td>${item.status || ''}</td>
      <td>${summary}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function load() {
  const data = await fetchUsers();
  const chat = await fetch('/api/admin/chat-summary').then(r => r.ok ? r.json() : null);
  const pilot = await fetch('/api/admin/pilot-registrations').then(r => r.ok ? r.json() : null);
  if (!data) return;
  adminLoginCard.style.display = 'none';
  adminTableCard.style.display = 'block';
  chatSummaryCard.style.display = 'block';
  adminDeleteCard.style.display = 'block';
  schoolCodeCard.style.display = 'block';
  pilotCard.style.display = 'block';
  renderTable(data.users || []);
  if (chat?.items) renderChatTable(chat.items);
  if (pilot?.items) renderPilotTable(pilot.items);
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
  chatSummaryCard.style.display = 'none';
  adminDeleteCard.style.display = 'none';
  schoolCodeCard.style.display = 'none';
  pilotCard.style.display = 'none';
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
});

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

load();
