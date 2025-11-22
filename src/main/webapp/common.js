// Common helpers available on all pages
const DEMO_USER_ID = 1;
const DEMO_USERNAME = 'demo-user';
const WALLET_KEY = 'TT_WALLET_STATE_V1';
const FAVORITES_KEY = 'TT_FAVORITES_V1';
const STARTING_CASH = 2000;

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

function walletStore(){
  try {
    return window.sessionStorage || window.localStorage;
  } catch {
    return null;
  }
}

function defaultWalletState(){
  return { cashUsd: STARTING_CASH, positions: [] };
}

function loadWalletState(reset = false){
  const store = walletStore();
  if (!store) return defaultWalletState();

  if (reset || !store.getItem(WALLET_KEY)) {
    const fresh = defaultWalletState();
    store.setItem(WALLET_KEY, JSON.stringify(fresh));
    return fresh;
  }

  try {
    const parsed = JSON.parse(store.getItem(WALLET_KEY));
    if (typeof parsed !== 'object' || !parsed) throw new Error('invalid');
    parsed.cashUsd = Number(parsed.cashUsd ?? STARTING_CASH) || STARTING_CASH;
    parsed.positions = Array.isArray(parsed.positions) ? parsed.positions : [];
    return parsed;
  } catch {
    const fresh = defaultWalletState();
    store.setItem(WALLET_KEY, JSON.stringify(fresh));
    return fresh;
  }
}

function saveWalletState(state){
  const store = walletStore();
  if (!store) return;
  try {
    store.setItem(WALLET_KEY, JSON.stringify(state));
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

function loadFavorites(){
  const store = favoritesStore();
  if (!store) return [];
  try {
    const parsed = JSON.parse(store.getItem(FAVORITES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavorites(favs){
  const store = favoritesStore();
  if (!store) return;
  try {
    store.setItem(FAVORITES_KEY, JSON.stringify(favs || []));
  } catch (e) {
    console.warn('Unable to persist favorites', e);
  }
}

function isFavorite(eventId){
  if (!eventId) return false;
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
  nav.innerHTML = `<a href="index.html">Home</a><a href="favorites.html">Favorites</a><a href="wallet.html">Wallet</a>`;
}
document.addEventListener('DOMContentLoaded', renderNav);
