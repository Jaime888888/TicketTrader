/* global API, renderNav */
document.addEventListener('DOMContentLoaded', async () => {
  renderNav();

  if (!API.loggedIn) {
    const main = document.querySelector('main') || document.body;
    main.innerHTML = '<div class="muted">Please log in to view your wallet.</div>';
    return;
  }

  const cashEl = document.getElementById('cash');
  const totalEl = document.getElementById('total');
  const tbody = document.querySelector('tbody');
  let state = (window.WalletState && window.WalletState.loadWalletState()) || { cashUsd: 2000, positions: [] };

  async function load() {
    try {
      state = (window.WalletState && window.WalletState.loadWalletState()) || state;
      render();
    } catch (e) {
      console.error(e);
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
        const trade = (window.WalletState && window.WalletState.applyTradeToState) || (() => ({ success: false, message: 'No wallet handler' }));
        const result = trade({ side: 'BUY', eventId: pos.eventId, eventName: pos.eventName, qty: q, priceUsd: minPrice });
        if (!result.success) return alert(result.message || 'Trade failed');
        state = result.state;
        render();
      };

      tr.querySelector('.sell').onclick = () => {
        const q = Number(document.getElementById(qid).value || 0);
        const trade = (window.WalletState && window.WalletState.applyTradeToState) || (() => ({ success: false, message: 'No wallet handler' }));
        const result = trade({ side: 'SELL', eventId: pos.eventId, eventName: pos.eventName, qty: q, priceUsd: maxPrice });
        if (!result.success) return alert(result.message || 'Trade failed');
        state = result.state;
        render();
      };

      tbody.appendChild(tr);
    }

    totalEl.textContent = 'Total Account Value: $' + (sum + state.cashUsd).toFixed(2);
    cashEl.textContent = 'Cash: $' + Number(state.cashUsd || 0).toFixed(2);
  }

  load();
});
