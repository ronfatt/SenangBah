const teacherLoginForm = document.getElementById('teacherLoginForm');
const teacherRegisterForm = document.getElementById('teacherRegisterForm');
const teacherLoginMsg = document.getElementById('teacherLoginMsg');
const teacherRegisterMsg = document.getElementById('teacherRegisterMsg');
const teacherAuthCard = document.getElementById('teacherAuthCard');
const teacherInfoCard = document.getElementById('teacherInfoCard');
const teacherStudentsCard = document.getElementById('teacherStudentsCard');
const teacherCode = document.getElementById('teacherCode');
const teacherLogout = document.getElementById('teacherLogout');

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return { ok: res.ok, data: await res.json() };
}

async function loadTeacher() {
  const res = await fetch('/api/teacher/me');
  if (!res.ok) return false;
  const data = await res.json();
  teacherAuthCard.style.display = 'none';
  teacherInfoCard.style.display = 'block';
  teacherStudentsCard.style.display = 'block';
  teacherCode.textContent = `${data.code} (School: ${data.school_code || 'senang'})`;
  await loadStudents();
  return true;
}

async function loadStudents() {
  const res = await fetch('/api/teacher/students');
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.querySelector('#teacherTable tbody');
  tbody.innerHTML = '';
  (data.students || []).forEach((s) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.name || ''}</td>
      <td>${s.email || ''}</td>
      <td>${s.class_name || ''}</td>
      <td>${s.estimated_band || ''}</td>
      <td>${s.total_sessions || 0}</td>
      <td>${s.completed_sessions || 0}</td>
      <td>${s.completion_rate || 0}%</td>
      <td>${s.last_active || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

teacherLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  teacherLoginMsg.textContent = '';
  const formData = new FormData(teacherLoginForm);
  const payload = Object.fromEntries(formData.entries());
  const res = await postJSON('/api/teacher/login', payload);
  if (!res.ok) {
    teacherLoginMsg.textContent = res.data?.error || 'Login failed';
    return;
  }
  teacherLoginMsg.textContent = '';
  await loadTeacher();
});

teacherRegisterForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  teacherRegisterMsg.textContent = '';
  const formData = new FormData(teacherRegisterForm);
  const payload = Object.fromEntries(formData.entries());
  const res = await postJSON('/api/teacher/register', payload);
  if (!res.ok) {
    teacherRegisterMsg.textContent = res.data?.error || 'Registration failed';
    return;
  }
  teacherRegisterMsg.textContent = `Created. Your code: ${res.data?.code || ''}`;
  await loadTeacher();
});

teacherLogout.addEventListener('click', async () => {
  await postJSON('/api/teacher/logout', {});
  teacherAuthCard.style.display = 'block';
  teacherInfoCard.style.display = 'none';
  teacherStudentsCard.style.display = 'none';
});

loadTeacher();
