/* global renderNav, AuthState, API */

document.addEventListener('DOMContentLoaded', () => {
  renderNav();

  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    if (!user || !pass) return alert('Please enter username/email and password');
    const res = AuthState.loginUser(user, pass);
    if (!res.success) return alert(res.message || 'Login failed');
    alert('Login successful');
    window.location.href = 'index.html';
  });

  signupForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value.trim();
    const username = document.getElementById('signupUser').value.trim();
    const pass = document.getElementById('signupPass').value;
    const confirm = document.getElementById('signupConfirm').value;
    if (!email || !username || !pass || !confirm) return alert('All fields are required');
    if (pass !== confirm) return alert('Passwords do not match');
    const res = AuthState.registerUser({ email, username, password: pass });
    if (!res.success) return alert(res.message || 'Signup failed');
    alert('Account created');
    window.location.href = 'index.html';
  });
});
