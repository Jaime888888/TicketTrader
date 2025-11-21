/* global API, renderNav */
document.addEventListener('DOMContentLoaded', async () => {
  renderNav();

  const cash = document.getElementById('cash');
  const total = document.getElementById('total');
  const tbody = document.querySelector('tbody');
  const p = (path) => (typeof apiPath === 'function' ? apiPath(path) : path);

  async function load() {
    try {
      // --- Cash ---
      const r1 = await fetch(p(`wallet?type=cash&userId=${API.userId}`));
      const j1 = await r1.json();
      if (!j1.success) throw new Error(j1.message || 'Cash fetch failed');
      const balance = Number(j1.data?.cashUsd ?? 0);
      cash.textContent = 'Cash: $' + balance.toFixed(2);

      // --- Positions ---
      const r2 = await fetch(p(`wallet?type=positions&userId=${API.userId}`));
      const j2 = await r2.json();
      if (!j2.success) throw new Error(j2.message || 'Positions fetch failed');

      tbody.innerHTML = '';
      let sum = 0;

      for (const p of (j2.data || [])) {
        const avg = p.totalCostUsd && p.qty ? (Number(p.totalCostUsd) / Number(p.qty)).toFixed(2) : '0.00';
        const mv  = (Number(p.maxPriceUsd || 0) * Number(p.qty || 0)).toFixed(2);
        sum += Number(mv);

        const tr = document.createElement('tr');
        const qid = (Math.random().toString(36).slice(2));
        const minPrice = Number(p.minPriceUsd || p.maxPriceUsd || 0);
        const maxPrice = Number(p.maxPriceUsd || p.minPriceUsd || 0);
        tr.innerHTML = `
          <td>${p.eventName || p.eventId}</td>
          <td>${p.qty}</td>
          <td>$${avg}</td>
          <td>$${(p.maxPriceUsd ?? 0)}</td>
          <td>$${mv}</td>
          <td>
            <input id="${qid}" type="number" min="1" value="1" style="width:80px"/>
            <button class="buy">BUY</button>
            <button class="sell">SELL</button>
          </td>
        `;

        tr.querySelector('.buy').onclick = async () => {
          const q = Number(document.getElementById(qid).value || 0);
          const r = await fetch(p('trade'), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              userId: API.userId,
              side: 'BUY',
              eventId: p.eventId,
              eventName: p.eventName,
              qty: q,
              priceUsd: minPrice
            })
          });
          const j = await r.json();
          alert(j.message || 'Done');
          load();
        };

        tr.querySelector('.sell').onclick = async () => {
          const q = Number(document.getElementById(qid).value || 0);
          const r = await fetch(p('trade'), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              userId: API.userId,
              side: 'SELL',
              eventId: p.eventId,
              eventName: p.eventName,
              qty: q,
              priceUsd: maxPrice
            })
          });
          const j = await r.json();
          alert(j.message || 'Done');
          load();
        };

        tbody.appendChild(tr);
      }

      total.textContent = 'Total Account Value: $' + (sum + balance).toFixed(2);
    } catch (e) {
      console.error(e);
      // Keep the page usable; show a friendly message instead of crashing on HTML 500 pages.
      tbody.innerHTML = '';
      total.textContent = '';
      alert(e.message || 'Wallet error');
    }
  }

  load();
});
