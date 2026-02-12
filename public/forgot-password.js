const resetForm = document.getElementById('resetForm');
const resetMsg = document.getElementById('resetMsg');
const resetBtn = document.getElementById('resetBtn');
const teacherCodeInput = document.getElementById('teacherCode');

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return { ok: res.ok, data: await res.json() };
}

if (teacherCodeInput) {
  teacherCodeInput.addEventListener('input', () => {
    teacherCodeInput.value = teacherCodeInput.value.toUpperCase().replace(/\s+/g, '');
  });
  teacherCodeInput.addEventListener('paste', (event) => {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') || '').toUpperCase().replace(/\s+/g, '');
    teacherCodeInput.value = pasted;
  });
}

if (resetForm) {
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    resetMsg.textContent = '';

    const payload = Object.fromEntries(new FormData(resetForm).entries());
    const newPassword = String(payload.new_password || '');
    if (newPassword.length < 8) {
      resetMsg.textContent = 'Password must be at least 8 characters.';
      return;
    }

    resetBtn.disabled = true;
    resetBtn.textContent = 'Resetting...';

    const res = await postJSON('/api/auth/reset-password', payload);

    resetBtn.disabled = false;
    resetBtn.textContent = 'Reset Password';

    if (!res.ok) {
      const map = {
        missing_fields: 'Please complete all fields.',
        invalid_account_or_code: 'Email or teacher code is not valid.',
        weak_password: 'Password must be at least 8 characters.'
      };
      resetMsg.textContent = map[res.data?.error] || 'Reset failed. Please try again.';
      return;
    }

    resetMsg.textContent = 'Password updated. Redirecting to login...';
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 1000);
  });
}
