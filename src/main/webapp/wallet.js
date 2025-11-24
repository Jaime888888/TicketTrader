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

      const card = document.createElement('div');
      card.className = 'pos-card';
      const qid = (Math.random().toString(36).slice(2));
      card.innerHTML = `
        <h3>${pos.eventName || pos.eventId}</h3>
        <div class="metrics">
          <div class="metric"><label>Quantity</label><div class="value">${qtyNum}</div></div>
          <div class="metric"><label>Change</label><div class="value">${fmt(change)}</div></div>
          <div class="metric"><label>Avg Cost</label><div class="value">${fmt(avgNum)}</div></div>
          <div class="metric"><label>Total Cost</label><div class="value">${fmt(totalCost)}</div></div>
          <div class="metric"><label>Current Price</label><div class="value">${fmt(current)}</div></div>
          <div class="metric"><label>Market Value</label><div class="value">${fmt(mvNum)}</div></div>
        </div>
        <div class="trade-row">
          <label for="${qid}">Qty</label>
          <input id="${qid}" type="number" min="1" value="1" />
          <label><input type="radio" name="side-${qid}" value="BUY" checked/> BUY</label>
          <label><input type="radio" name="side-${qid}" value="SELL"/> SELL</label>
          <button class="trade">Submit</button>
        </div>
      `;

      card.querySelector('.trade').onclick = async () => {
        const q = Number(document.getElementById(qid).value || 0);
        const side = (card.querySelector(`input[name="side-${qid}"]:checked`) || {}).value || 'BUY';
        const minPrice = minP || current;
        const maxPrice = maxP || minP || current;
        const result = window.WalletState && window.WalletState.tradeRemote
          ? await window.WalletState.tradeRemote({ side, eventId: pos.eventId, eventName: pos.eventName, qty: q, priceUsd: side === 'BUY' ? minPrice : maxPrice, minPriceUsd: minPrice, maxPriceUsd: maxPrice })
          : { success: false, message: 'Trading unavailable' };
        if (!result.success) return alert(result.message || 'Trade failed');
        state = result.state || state;
        render();
      };

      if (cards) cards.appendChild(card);
    }

    if (cards && (!state.positions || state.positions.length === 0)) {
      cards.innerHTML = '<div class="muted">No holdings yet.</div>';
    }

    if (totalEl) totalEl.textContent = 'Total Account Value: ' + fmt(sum + state.cashUsd);
    if (cashEl) cashEl.textContent = 'Cash Balance: ' + fmt(state.cashUsd);
  }

  await load(true);
});
