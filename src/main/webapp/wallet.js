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
  const startingCash = typeof STARTING_CASH !== 'undefined' ? STARTING_CASH : 3000;
  let state = { cashUsd: startingCash, positions: [] };

  async function load(forceRemote = false) {
    try {
      if (forceRemote && window.WalletState && window.WalletState.fetchRemote) {
        state = await window.WalletState.fetchRemote();
      }
      render();
    } catch (e) {
      console.error(e);
        tbody.innerHTML = '<tr><td colspan="8" class="muted">Wallet failed to load: ' + (e.message || 'unknown error') + '</td></tr>';
      totalEl.textContent = '';
      alert(e.message || 'Wallet error');
    }
  }

  function fmt(val){
    const num = Number(val || 0);
    return `$${num.toFixed(2)}`;
  }

  function render(){
    tbody.innerHTML = '';
    let sum = 0;

    for (const pos of (state.positions || [])) {
      const qtyNum = Number(pos.qty || 0);
      const avgNum = pos.totalCostUsd && qtyNum ? (Number(pos.totalCostUsd) / qtyNum) : 0;
      const minP = Number(pos.minPriceUsd || pos.maxPriceUsd || 0);
      const maxP = Number(pos.maxPriceUsd || pos.minPriceUsd || 0);
      const change = maxP - minP;
      const totalCost = Number(pos.totalCostUsd || 0);
      const mvNum  = maxP * qtyNum;
      sum += Number(mvNum);

      const tr = document.createElement('tr');
      const qid = (Math.random().toString(36).slice(2));
      const minPrice = minP;
      const maxPrice = maxP;
      tr.innerHTML = `
        <td>${pos.eventName || pos.eventId}</td>
        <td>${qtyNum}</td>
        <td>${fmt(change)}</td>
        <td>${fmt(avgNum)}</td>
        <td>${fmt(maxPrice)}</td>
        <td>${fmt(totalCost)}</td>
        <td>${fmt(mvNum)}</td>
        <td>
          <input id="${qid}" type="number" min="1" value="1" style="width:80px"/>
          <button class="buy">BUY</button>
          <button class="sell">SELL</button>
        </td>
      `;

      tr.querySelector('.buy').onclick = async () => {
        const q = Number(document.getElementById(qid).value || 0);
        const result = window.WalletState && window.WalletState.tradeRemote
          ? await window.WalletState.tradeRemote({ side: 'BUY', eventId: pos.eventId, eventName: pos.eventName, qty: q, priceUsd: minPrice, minPriceUsd: minPrice, maxPriceUsd: maxPrice })
          : { success: false, message: 'Trading unavailable' };
        if (!result.success) return alert(result.message || 'Trade failed');
        state = result.state || state;
        render();
      };

      tr.querySelector('.sell').onclick = async () => {
        const q = Number(document.getElementById(qid).value || 0);
        const result = window.WalletState && window.WalletState.tradeRemote
          ? await window.WalletState.tradeRemote({ side: 'SELL', eventId: pos.eventId, eventName: pos.eventName, qty: q, priceUsd: maxPrice, minPriceUsd: minPrice, maxPriceUsd: maxPrice })
          : { success: false, message: 'Trading unavailable' };
        if (!result.success) return alert(result.message || 'Trade failed');
        state = result.state || state;
        render();
      };

      tbody.appendChild(tr);
    }

    totalEl.textContent = 'Total Account Value: ' + fmt(sum + state.cashUsd);
    cashEl.textContent = 'Cash: ' + fmt(state.cashUsd);
  }

  await load(true);
});
