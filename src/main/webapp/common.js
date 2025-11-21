// Common helpers available on all pages
const API = {
  base: (function computeBase(){
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts.length ? '/' + parts[0] : '';
  })(),
  proxyBase: localStorage.getItem('TT_PROXY_BASE') || 'https://example-proxy.invalid',
  get loggedIn(){ return !!(localStorage.getItem('TT_USER_ID') || localStorage.getItem('userId')); },
  get userId(){
    const raw = localStorage.getItem('TT_USER_ID') || localStorage.getItem('userId') || '0';
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  },
  setLogin(uid, uname){
    localStorage.setItem('TT_USER_ID', uid);
    localStorage.setItem('userId', uid);
    localStorage.setItem('TT_USERNAME', uname||'');
    localStorage.setItem('username', uname||'');
    renderNav();
  },
  logout(){
    localStorage.removeItem('TT_USER_ID');
    localStorage.removeItem('TT_USERNAME');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
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
  if(API.loggedIn){
    nav.innerHTML = `<a href="index.html">Home</a><a href="favorites.html">Favorites</a><a href="wallet.html">Wallet</a><a href="#" id="logout">Logout</a>`;
    const lo = document.getElementById('logout'); if (lo) lo.onclick = (e)=>{ e.preventDefault(); API.logout(); location.href='index.html'; };
  }else{
    nav.innerHTML = `<a href="index.html">Home</a><a href="login.html">Login / Sign Up</a>`;
  }
}
document.addEventListener('DOMContentLoaded', renderNav);
