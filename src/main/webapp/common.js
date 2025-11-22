// Common helpers available on all pages
const DEMO_USER_ID = 1;
const DEMO_USERNAME = 'demo-user';
const WALLET_KEY_PREFIX = 'TT_WALLET_STATE_V1';
const FAVORITES_KEY_PREFIX = 'TT_FAVORITES_V1';
const USERS_KEY = 'TT_USERS_V1';
const CURRENT_USER_KEY = 'TT_CURRENT_USER';
const STARTING_CASH = 2000;

function ensureDemoUser(){
  const users = loadUsers();
  const exists = users.some(u => u.id === DEMO_USER_ID || u.username === DEMO_USERNAME);
  if (!exists) {
    users.push({ id: DEMO_USER_ID, username: DEMO_USERNAME, email: 'demo@example.com', password: 'demo123' });
    saveUsers(users);
  }
}

function loadUsers(){
  try {
    const parsed = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsers(list){
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(list || []));
  } catch {}
}

function nextUserId(){
  const users = loadUsers();
  return users.reduce((max, u) => Math.max(max, Number(u.id)||0), DEMO_USER_ID) + 1;
}

function currentUserId(){
  ensureDemoUser();
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

const API = {
  base: (function computeBase(){
    // Derive the servlet context root from the first path segment, ignoring the filename
    const path = window.location.pathname || '';
    const dir  = path.substring(0, Math.max(0, path.lastIndexOf('/')));
    const segments = dir.split('/').filter(Boolean);
    return segments.length ? '/' + segments[0] : '';
  })(),
  proxyBase: localStorage.getItem('TT_PROXY_BASE') || 'https://example-proxy.invalid',
  get loggedIn(){ return !!currentUserId(); },
  get userId(){
    return currentUserId();
  },
  setLogin(uid, uname){
    localStorage.setItem(CURRENT_USER_KEY, uid);
    localStorage.setItem('TT_USER_ID', uid);
    localStorage.setItem('userId', uid);
    localStorage.setItem('TT_USERNAME', uname||'');
    localStorage.setItem('username', uname||'');
    renderNav();
  },
  logout(){
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem('TT_USER_ID');
    localStorage.removeItem('userId');
    renderNav();
  },
};

function loginUser(username, password){
  ensureDemoUser();
  const users = loadUsers();
  const match = users.find(u => (u.username === username || u.email === username) && u.password === password);
  if (!match) return { success: false, message: 'Invalid credentials' };
  API.setLogin(match.id, match.username);
  loadWalletState();
  return { success: true, user: match };
}

function registerUser({ email, username, password }){
  ensureDemoUser();
  const users = loadUsers();
  if (users.some(u => u.username === username)) return { success: false, message: 'Username already taken' };
  if (users.some(u => u.email === email)) return { success: false, message: 'Email already registered' };
  const id = nextUserId();
  const user = { id, email, username, password };
  users.push(user);
  saveUsers(users);
  API.setLogin(id, username);
  loadWalletState(true);
  return { success: true, user };
}

function currentUser(){
  const id = currentUserId();
  if (!id) return null;
  return loadUsers().find(u => Number(u.id) === Number(id)) || null;
}

window.AuthState = { loginUser, registerUser, currentUser };

function walletStore(){
  try {
    return window.sessionStorage || window.localStorage;
  } catch {
    return null;
  }
}

function walletKey(uid = API.userId){
  return `${WALLET_KEY_PREFIX}_${uid || 'guest'}`;
}

function defaultWalletState(){
  return { cashUsd: STARTING_CASH, positions: [] };
}

function loadWalletState(reset = false){
  const store = walletStore();
  const key = walletKey();
  if (!store || !key) return defaultWalletState();

  if (reset || !store.getItem(key)) {
    const fresh = defaultWalletState();
    store.setItem(key, JSON.stringify(fresh));
    return fresh;
  }

  try {
    const parsed = JSON.parse(store.getItem(key));
    if (typeof parsed !== 'object' || !parsed) throw new Error('invalid');
    parsed.cashUsd = Number(parsed.cashUsd ?? STARTING_CASH) || STARTING_CASH;
    parsed.positions = Array.isArray(parsed.positions) ? parsed.positions : [];
    return parsed;
  } catch {
    const fresh = defaultWalletState();
    store.setItem(key, JSON.stringify(fresh));
    return fresh;
  }
}

function saveWalletState(state){
  const store = walletStore();
  const key = walletKey();
  if (!store || !key) return;
  try {
    store.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.warn('Unable to persist wallet state', e);
  }
}

// Legacy helper name used by older wallet.js builds; keep it wired to the
// current persistence routine so SELL/BUY buttons never throw when invoked.
function saveToLocal(state){
  return saveWalletState(state);
}
if (typeof window !== 'undefined') {
  window.saveToLocal = saveToLocal;
}

function applyTradeToState({ side, eventId, eventName, qty, priceUsd }){
  if (!API.loggedIn) {
    return { success: false, message: 'Please log in to trade', state: defaultWalletState() };
  }

  const state = loadWalletState();
  const cleanQty = Number(qty || 0);
  const cleanPrice = Number(priceUsd || 0);
  if (!eventId || cleanQty <= 0 || cleanPrice <= 0) {
    return { success: false, message: 'Invalid trade data', state };
  }

  const idx = state.positions.findIndex(p => p.eventId === eventId);
  const existing = idx >= 0 ? state.positions[idx] : { eventId, eventName, qty: 0, totalCostUsd: 0, minPriceUsd: cleanPrice, maxPriceUsd: cleanPrice };
  const minPrice = Number(existing.minPriceUsd || cleanPrice);
  const maxPrice = Number(existing.maxPriceUsd || cleanPrice);

  if (side === 'BUY') {
    const cost = cleanQty * cleanPrice;
    if (cost > state.cashUsd) return { success: false, message: 'Not enough cash', state };
    state.cashUsd -= cost;
    existing.qty = Number(existing.qty || 0) + cleanQty;
    existing.totalCostUsd = Number(existing.totalCostUsd || 0) + cost;
    existing.minPriceUsd = Math.min(minPrice, cleanPrice);
    existing.maxPriceUsd = Math.max(maxPrice, cleanPrice);
  } else if (side === 'SELL') {
    if (cleanQty > Number(existing.qty || 0)) return { success: false, message: 'Cannot sell more than owned', state };
    const proceeds = cleanQty * maxPrice;
    const avgCost = existing.qty ? (Number(existing.totalCostUsd || 0) / Number(existing.qty)) : 0;
    state.cashUsd += proceeds;
    existing.qty = Number(existing.qty || 0) - cleanQty;
    existing.totalCostUsd = Math.max(0, Number(existing.totalCostUsd || 0) - avgCost * cleanQty);
    if (existing.qty <= 0) {
      state.positions = state.positions.filter(p => p.eventId !== eventId);
    }
  } else {
    return { success: false, message: 'Unknown side', state };
  }

  if (!state.positions.find(p => p.eventId === eventId) && existing.qty > 0) {
    state.positions.push(existing);
  }

  saveWalletState(state);
  return { success: true, state };
}

window.WalletState = { loadWalletState, saveWalletState, applyTradeToState, resetWallet: () => saveWalletState(defaultWalletState()) };

// -------- favorites helpers --------
function favoritesStore(){
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function favoritesKey(uid = API.userId){
  return `${FAVORITES_KEY_PREFIX}_${uid || 'guest'}`;
}

function loadFavorites(){
  if (!API.loggedIn) return [];
  const store = favoritesStore();
  if (!store) return [];
  try {
    const parsed = JSON.parse(store.getItem(favoritesKey()) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavorites(favs){
  if (!API.loggedIn) return;
  const store = favoritesStore();
  if (!store) return;
  try {
    store.setItem(favoritesKey(), JSON.stringify(favs || []));
  } catch (e) {
    console.warn('Unable to persist favorites', e);
  }
}

function isFavorite(eventId){
  if (!API.loggedIn || !eventId) return false;
  return loadFavorites().some(f => f.eventId === eventId);
}

function upsertFavorite(fav){
  if (!fav || !fav.eventId) return loadFavorites();
  const list = loadFavorites();
  const idx = list.findIndex(f => f.eventId === fav.eventId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...fav };
  } else {
    list.push(fav);
  }
  saveFavorites(list);
  return list;
}

function removeFavorite(eventId){
  const list = loadFavorites().filter(f => f.eventId !== eventId);
  saveFavorites(list);
  return list;
}

function toggleFavorite(fav){
  if (!API.loggedIn) return loadFavorites();
  if (!fav || !fav.eventId) return loadFavorites();
  return isFavorite(fav.eventId) ? removeFavorite(fav.eventId) : upsertFavorite(fav);
}

window.FavoritesState = { loadFavorites, saveFavorites, upsertFavorite, removeFavorite, toggleFavorite, isFavorite };

function apiPath(path){
  const base = API.base || '';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}
function renderNav(){
  const nav = document.getElementById('nav'); if(!nav) return;
  const links = ["<a href=\"index.html\">Home</a>"];
  if (API.loggedIn) {
    links.push('<a href="favorites.html">Favorites</a>');
    links.push('<a href="wallet.html">Wallet</a>');
    links.push('<button id="logoutBtn" type="button">Logout</button>');
  } else {
    links.push('<a href="login.html">Login / Sign Up</a>');
  }
  nav.innerHTML = links.join('');
  const btn = document.getElementById('logoutBtn');
  if (btn) btn.onclick = () => { API.logout(); window.location.href = 'index.html'; };
}
document.addEventListener('DOMContentLoaded', renderNav);
ensureDemoUser();
