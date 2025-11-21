// Common helpers available on all pages
const DEMO_USER_ID = 1;
const DEMO_USERNAME = 'demo-user';

function ensureDemoSession(){
  if (!localStorage.getItem('TT_USER_ID')) {
    localStorage.setItem('TT_USER_ID', DEMO_USER_ID);
    localStorage.setItem('userId', DEMO_USER_ID);
    localStorage.setItem('TT_USERNAME', DEMO_USERNAME);
    localStorage.setItem('username', DEMO_USERNAME);
  }
}

ensureDemoSession();

const API = {
  base: (function computeBase(){
    // Derive the servlet context root from the first path segment, ignoring the filename
    const path = window.location.pathname || '';
    const dir  = path.substring(0, Math.max(0, path.lastIndexOf('/')));
    const segments = dir.split('/').filter(Boolean);
    return segments.length ? '/' + segments[0] : '';
  })(),
  proxyBase: localStorage.getItem('TT_PROXY_BASE') || 'https://example-proxy.invalid',
  get loggedIn(){ return true; },
  get userId(){
    ensureDemoSession();
    const raw = localStorage.getItem('TT_USER_ID') || localStorage.getItem('userId') || DEMO_USER_ID;
    const n = Number(raw);
    return Number.isFinite(n) ? n : DEMO_USER_ID;
  },
  setLogin(uid, uname){
    localStorage.setItem('TT_USER_ID', uid);
    localStorage.setItem('userId', uid);
    localStorage.setItem('TT_USERNAME', uname||'');
    localStorage.setItem('username', uname||'');
    renderNav();
  },
  logout(){
    // No-op now that the app is always logged in as the demo user
    renderNav();
  },
};

function apiPath(path){
  const base = API.base || '';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}
function renderNav(){
  const nav = document.getElementById('nav'); if(!nav) return;
  nav.innerHTML = `<a href="index.html">Home</a><a href="wallet.html">Wallet</a>`;
}
document.addEventListener('DOMContentLoaded', renderNav);
