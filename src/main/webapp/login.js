// login.js – strict, minimal, robust
(() => {
  const goHome = () => location.href = 'index.html';

  const safeJson = async (r) => {
    const text = await r.text();
    try { return JSON.parse(text); }
    catch { return { success: false, message: 'Server returned non-JSON', raw: text }; }
  };

  // LOGIN
  document.getElementById('loginBtn').onclick = async () => {
    const username = document.getElementById('luser').value.trim();
    const password = document.getElementById('lpass').value.trim();

    const r = await fetch('login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ username, password })
    });

    const j = await safeJson(r);
    if (j.success) {
      API.setLogin(j.data.userId, username);
      goHome();
    } else {
      alert(j.message || 'Login failed');
    }
  };

  // SIGN UP
  document.getElementById('signupBtn').onclick = async () => {
    const username = document.getElementById('suser').value.trim();
    const email    = document.getElementById('semail').value.trim();
    const password = document.getElementById('spass').value.trim();

    const r = await fetch('register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ username, email, password })
    });

    const j = await safeJson(r);
    if (j.success) {
      API.setLogin(j.data.userId, username);
      goHome();
    } else {
      alert(j.message || 'Signup failed');
    }
  };
})();
