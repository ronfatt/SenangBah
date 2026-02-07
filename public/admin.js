const adminLoginForm = document.getElementById('adminLoginForm');
const adminLoginMsg = document.getElementById('adminLoginMsg');
const adminLoginCard = document.getElementById('adminLoginCard');
const adminTableCard = document.getElementById('adminTableCard');
const chatSummaryCard = document.getElementById('chatSummaryCard');
const adminLogout = document.getElementById('adminLogout');

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

async function load() {
  const data = await fetchUsers();
  const chat = await fetch('/api/admin/chat-summary').then(r => r.ok ? r.json() : null);
  if (!data) return;
  adminLoginCard.style.display = 'none';
  adminTableCard.style.display = 'block';
  chatSummaryCard.style.display = 'block';
  renderTable(data.users || []);
  if (chat?.items) renderChatTable(chat.items);
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
  adminLoginCard.style.display = 'block';
});

load();
