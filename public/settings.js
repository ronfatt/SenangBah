const profileForm = document.getElementById('profileForm');
const profileMsg = document.getElementById('profileMsg');
const logoutBtn = document.getElementById('logoutBtn');
const accessStatusLabel = document.getElementById('accessStatusLabel');
const accessDaysLeft = document.getElementById('accessDaysLeft');

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
  profileForm.school_name.value = data.school_name || '';
  profileForm.referral_code.value = data.referral_code || '';
  profileForm.referred_by_code.value = data.referred_by_code || '';
  profileForm.bonus_stars.value = String(data.bonus_stars || 0);
  profileForm.access_label.value = data.access_label || '30-Day Full Access';
  profileForm.access_days_left.value = String(data.access_days_left ?? 30);
  profileForm.estimated_band.value = data.estimated_band || 4;
  if (accessStatusLabel) accessStatusLabel.textContent = data.access_label || '30-Day Full Access';
  if (accessDaysLeft) accessDaysLeft.textContent = String(data.access_days_left ?? 30);
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
