const profileForm = document.getElementById('profileForm');
const profileMsg = document.getElementById('profileMsg');
const logoutBtn = document.getElementById('logoutBtn');
const dayStatus = document.getElementById('dayStatus');
const focusStatus = document.getElementById('focusStatus');

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return { ok: res.ok, data: await res.json() };
}

async function loadProfile() {
  const res = await fetch('/api/me');
  if (!res.ok) {
    window.location.href = '/login.html';
    return;
  }
  const data = await res.json();
  profileForm.name.value = data.name || '';
  profileForm.class_name.value = data.class_name || '';
  profileForm.teacher_name.value = data.teacher_name || '';
  profileForm.estimated_band.value = data.estimated_band || 4;
}

async function loadDashboardStatus() {
  const res = await fetch('/api/dashboard');
  if (!res.ok) return;
  const data = await res.json();
  dayStatus.textContent = `Day ${data.day_index} of ${data.total_days}`;
  focusStatus.textContent = data.focus || 'Writing Focus';
}

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  profileMsg.textContent = '';
  const formData = new FormData(profileForm);
  const payload = Object.fromEntries(formData.entries());
  payload.estimated_band = Number(payload.estimated_band || 4);
  const res = await postJSON('/api/profile', payload);
  if (!res.ok) {
    profileMsg.textContent = res.data?.error || 'Save failed';
    return;
  }
  profileMsg.textContent = 'Saved.';
});

logoutBtn.addEventListener('click', async () => {
  await postJSON('/api/auth/logout', {});
  window.location.href = '/login.html';
});

loadProfile();
loadDashboardStatus();
