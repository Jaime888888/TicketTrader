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
  const cards = document.getElementById('positions');
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
      if (cards) cards.innerHTML = '<div class="muted">Wallet failed to load: ' + (e.message || 'unknown error') + '</div>';
      if (totalEl) totalEl.textContent = '';
      alert(e.message || 'Wallet error');
    }
  }

  function fmt(val){
    const num = Number(val || 0);
    return `$${num.toFixed(2)}`;
  }

  function render(){
    if (cards) cards.innerHTML = '';
    let sum = 0;

    const table = document.createElement('table');
    table.className = 'wallet-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Event</th>
          <th>Quantity</th>
          <th>Change</th>
          <th>Avg Cost</th>
          <th>Total Cost</th>
          <th>Current Price</th>
          <th>Market Value</th>
          <th>Trade</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    for (const pos of (state.positions || [])) {
      const qtyNum = Number(pos.qty || 0);
      const totalCost = Number(pos.totalCostUsd ?? pos.totalCost ?? 0);
      const avgNum = qtyNum ? (totalCost / qtyNum) : 0;
      const minP = Number(pos.minPriceUsd ?? pos.minPrice ?? pos.maxPriceUsd ?? 0);
      const maxP = Number(pos.maxPriceUsd ?? pos.maxPrice ?? pos.minPriceUsd ?? 0);
      const change = maxP - minP;
      const current = maxP;
      const mvNum  = current * qtyNum;
      sum += Number(mvNum);

      const qid = (Math.random().toString(36).slice(2));
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${pos.eventName || pos.eventId}</td>
        <td class="right">${qtyNum}</td>
        <td class="right">${fmt(change)}</td>
        <td class="right">${fmt(avgNum)}</td>
        <td class="right">${fmt(totalCost)}</td>
        <td class="right">${fmt(current)}</td>
        <td class="right">${fmt(mvNum)}</td>
        <td class="trade-cell">
          <div class="trade-row">
            <input id="${qid}" type="number" min="1" value="1" />
            <label><input type="radio" name="side-${qid}" value="BUY" checked/> BUY</label>
            <label><input type="radio" name="side-${qid}" value="SELL"/> SELL</label>
            <button class="trade">Submit</button>
          </div>
        </td>
      `;

      row.querySelector('.trade').onclick = async () => {
        const q = Number(document.getElementById(qid).value || 0);
        const side = (row.querySelector(`input[name="side-${qid}"]:checked`) || {}).value || 'BUY';
        const minPrice = minP || current;
        const maxPrice = maxP || minPrice || current;
        const result = window.WalletState && window.WalletState.tradeRemote
          ? await window.WalletState.tradeRemote({ side, eventId: pos.eventId, eventName: pos.eventName, qty: q, priceUsd: side === 'BUY' ? minPrice : maxPrice, minPriceUsd: minPrice, maxPriceUsd: maxPrice })
          : { success: false, message: 'Trading unavailable' };
        if (!result.success) return alert(result.message || 'Trade failed');
        state = result.state || state;
        render();
      };

      tbody.appendChild(row);
    }

    if (tbody.children.length === 0) {
      const empty = document.createElement('tr');
      empty.innerHTML = '<td colspan="8" class="muted">No holdings yet.</td>';
      tbody.appendChild(empty);
    }

    if (cards) cards.appendChild(table);

    if (totalEl) totalEl.textContent = 'Total Account Value: ' + fmt(sum + state.cashUsd);
    if (cashEl) cashEl.textContent = 'Cash Balance: ' + fmt(state.cashUsd);
  }

  await load(true);
});
