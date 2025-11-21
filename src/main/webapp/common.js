// Common helpers available on all pages
const API = {
  base: '', // same origin
  proxyBase: localStorage.getItem('TT_PROXY_BASE') || 'https://example-proxy.invalid',
  get loggedIn(){ return !!localStorage.getItem('userId'); },
  get userId(){ return Number(localStorage.getItem('userId')||0); },
  setLogin(uid, uname){ localStorage.setItem('userId', uid); localStorage.setItem('username', uname||''); renderNav(); },
  logout(){ localStorage.removeItem('userId'); localStorage.removeItem('username'); renderNav(); },
};
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
