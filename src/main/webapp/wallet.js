/* global API, renderNav */
document.addEventListener('DOMContentLoaded', async () => {
  renderNav();

  const cashEl = document.getElementById('cash');
  const totalEl = document.getElementById('total');
  const tbody = document.querySelector('tbody');
  const p = (path) => (typeof apiPath === 'function' ? apiPath(path) : path);

  const LOCAL_KEY = 'TT_WALLET_STATE_V1';
  let state = {
    cashUsd: 0,
    positions: []
  };

  function loadFromLocal(){
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) state = JSON.parse(raw);
    } catch (e) {
      console.warn('Unable to read cached wallet state', e);
    }
  }

  function saveToLocal(){
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Unable to persist wallet state', e);
    }
  }

  async function load() {
    try {
      // Prefer cached values so the page renders even if fetch fails
      loadFromLocal();

      const cashResp = await fetch(p('/mock/wallet/cash.json'));
      const cashJson = await cashResp.json();
      const balance = Number(cashJson?.data?.cashUsd ?? state.cashUsd ?? 0);
      state.cashUsd = balance;
      cashEl.textContent = 'Cash: $' + balance.toFixed(2);

      const posResp = await fetch(p('/mock/wallet/positions.json'));
      const posJson = await posResp.json();
      state.positions = Array.isArray(posJson) ? posJson : (posJson?.data || state.positions || []);

      render();
      saveToLocal();
    } catch (e) {
      console.error(e);
      // Keep the page usable; show a friendly message instead of crashing on HTML 500 pages.
      tbody.innerHTML = '';
      totalEl.textContent = '';
      alert(e.message || 'Wallet error');
    }
  }

  function render(){
    tbody.innerHTML = '';
    let sum = 0;

    for (const pos of (state.positions || [])) {
      const avg = pos.totalCostUsd && pos.qty ? (Number(pos.totalCostUsd) / Number(pos.qty)).toFixed(2) : '0.00';
      const mv  = (Number(pos.maxPriceUsd || 0) * Number(pos.qty || 0)).toFixed(2);
      sum += Number(mv);

      const tr = document.createElement('tr');
      const qid = (Math.random().toString(36).slice(2));
      const minPrice = Number(pos.minPriceUsd || pos.maxPriceUsd || 0);
      const maxPrice = Number(pos.maxPriceUsd || pos.minPriceUsd || 0);
      tr.innerHTML = `
        <td>${pos.eventName || pos.eventId}</td>
        <td>${pos.qty}</td>
        <td>$${avg}</td>
        <td>$${(pos.maxPriceUsd ?? 0)}</td>
        <td>$${mv}</td>
        <td>
          <input id="${qid}" type="number" min="1" value="1" style="width:80px"/>
          <button class="buy">BUY</button>
          <button class="sell">SELL</button>
        </td>
      `;

      tr.querySelector('.buy').onclick = () => {
        const q = Number(document.getElementById(qid).value || 0);
        if (q < 1) return alert('Enter a quantity of at least 1');
        const cost = q * minPrice;
        if (cost > state.cashUsd) return alert('Not enough cash for this purchase');

        state.cashUsd -= cost;
        const existing = state.positions.find(x => x.eventId === pos.eventId) || pos;
        existing.qty = Number(existing.qty || 0) + q;
        existing.totalCostUsd = Number(existing.totalCostUsd || 0) + cost;
        existing.minPriceUsd = minPrice;
        existing.maxPriceUsd = maxPrice;
        if (!state.positions.includes(existing)) state.positions.push(existing);

        saveToLocal();
        render();
      };

      tr.querySelector('.sell').onclick = () => {
        const q = Number(document.getElementById(qid).value || 0);
        if (q < 1) return alert('Enter a quantity of at least 1');
        if (q > Number(pos.qty || 0)) return alert('Cannot sell more than you own');

        const proceeds = q * maxPrice;
        const avgCost = pos.qty ? (Number(pos.totalCostUsd || 0) / Number(pos.qty)) : 0;

        state.cashUsd += proceeds;
        pos.qty = Number(pos.qty || 0) - q;
        pos.totalCostUsd = Math.max(0, Number(pos.totalCostUsd || 0) - avgCost * q);
        if (pos.qty <= 0) {
          state.positions = state.positions.filter(x => x !== pos);
        }

        saveToLocal();
        render();
      };

      tbody.appendChild(tr);
    }

    totalEl.textContent = 'Total Account Value: $' + (sum + state.cashUsd).toFixed(2);
    cashEl.textContent = 'Cash: $' + Number(state.cashUsd || 0).toFixed(2);
  }

  load();
});
