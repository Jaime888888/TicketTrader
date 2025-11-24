/* global API, renderNav, FavoritesState, WalletState, sanitizeProxyBase */
document.addEventListener('DOMContentLoaded', async () => {
  renderNav();
  const container = document.getElementById('favorites');

  const container = document.getElementById('favorites');
  const detailPanel = document.getElementById('fav-detail');

  if (!API.loggedIn) {
    container.innerHTML = '<div class="muted">Please log in to view favorites.</div>';
    if (detailPanel) detailPanel.style.display = 'none';
    return;
  }

  const TM_PROXY_ROOT = ((API && API.proxyBase) || (typeof sanitizeProxyBase === 'function' ? sanitizeProxyBase() : 'https://us-central1-quixotic-dynamo-165616.cloudfunctions.net')).replace(/\/+$/, '');
  const TM_PROXY = `${TM_PROXY_ROOT}/getEvents`;

  let latestFavorites = [];

  const safeJson = async (res, urlHint = '') => {
    const text = await res.text();
    try {
      return JSON.parse(text || '{}');
    } catch (e) {
      throw new Error(`Non-JSON response from ${urlHint || res.url || 'request'}: ${text?.slice(0, 200)}`);
    }
  };

  async function fetchDetail(eventId) {
    const urls = [
      `${TM_PROXY}/eventDetail/${encodeURIComponent(eventId)}`,
      `${TM_PROXY}/eventDetail?eventId=${encodeURIComponent(eventId)}`,
    ];

    let lastErr = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, { method: 'GET' });
        const json = await safeJson(res, url);
        if (!res.ok) throw new Error(json.message || `Detail failed (${res.status})`);
        return json;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Detail failed');
  }

  const renderDetail = (fav, detail) => {
    if (!detailPanel) return;
    const dateObj = detail.date || {};
    const eventObj = detail.event || {};
    const priceObj = detail.price || {};
    const localDate = dateObj.localDate || fav.date || '';
    const localTime = dateObj.localTime || fav.localTime || '';
    const min = Number(priceObj.min ?? fav.minPriceUsd ?? -1);
    const max = Number(priceObj.max ?? fav.maxPriceUsd ?? -1);
    const disableTrade = min === -1 && max === -1;

    const priceLabel = disableTrade ? 'N/A' : `${min} - ${max}`;
    const url = eventObj.url || fav.url || '#';

    detailPanel.style.display = 'block';
    detailPanel.innerHTML = `
      <div class="detail-row"><strong>Date:</strong> ${localDate} ${localTime}</div>
      <div class="detail-row"><strong>Event:</strong> ${eventObj.name || fav.eventName || fav.eventId}</div>
      <div class="detail-row"><strong>Venue:</strong> ${eventObj.venue || fav.venue || ''}</div>
      <div class="detail-row"><strong>Price range:</strong> ${priceLabel}</div>
      <div class="detail-row"><strong>Buy ticket at:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></div>
    `;

    const trade = document.createElement('div');
    trade.className = 'trade';
    const qty = document.createElement('input');
    qty.type = 'number';
    qty.min = '1';
    qty.placeholder = 'Qty';
    qty.style.width = '80px';

    const buyBtn = document.createElement('button');
    buyBtn.textContent = 'PURCHASE';
    buyBtn.disabled = disableTrade;
    buyBtn.addEventListener('click', async () => {
      const q = Number(qty.value || 0);
      if (!Number.isFinite(q) || q <= 0) {
        alert('Enter a ticket quantity first');
        return;
      }
      if (!API.loggedIn) {
        alert('Please log in to trade');
        window.location.href = 'login.html';
        return;
      }
      if (disableTrade) {
        alert('Price unavailable; cannot trade this event');
        return;
      }
      const priceUsd = min > 0 ? min : max;
      const result = WalletState && WalletState.tradeRemote
        ? await WalletState.tradeRemote({ side: 'BUY', eventId: fav.eventId, eventName: fav.eventName || eventObj.name, qty: q, priceUsd, maxPriceUsd: max })
        : { success: false, message: 'Trading unavailable' };
      alert(result.success ? 'Purchase complete' : (result.message || 'Trade failed'));
    });

    trade.appendChild(document.createTextNode('Quantity: '));
    trade.appendChild(qty);
    trade.appendChild(buyBtn);
    detailPanel.appendChild(trade);
  };

  if (FavoritesState && FavoritesState.syncFavorites) {
    try {
      latestFavorites = await FavoritesState.syncFavorites();
    } catch (e) {
      alert(e.message || 'Favorites failed to load');
      latestFavorites = [];
    }
  }

  function render() {
    const favs = latestFavorites && latestFavorites.length
      ? latestFavorites
      : (FavoritesState && FavoritesState.loadFavorites && FavoritesState.loadFavorites()) || [];
    container.innerHTML = '';
    if (detailPanel) { detailPanel.style.display = 'none'; detailPanel.innerHTML = ''; }

    if (!favs.length) {
      container.innerHTML = '<div class="muted">No favorites yet. Add some from the Home page using the star icon.</div>';
      return;
    }

    for (const fav of favs) {
      const card = document.createElement('div');
      card.className = 'fav-card';

      const title = document.createElement('div');
      title.className = 'fav-title';
      title.textContent = fav.eventName || fav.eventId;
      card.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'fav-meta';
      const dateTime = `${fav.date || ''}${fav.localTime ? ' ' + fav.localTime : ''}`.trim();
      meta.textContent = dateTime || 'Date/time unavailable';
      card.appendChild(meta);

      const price = document.createElement('div');
      price.className = 'fav-meta';
      const min = fav.minPriceUsd ?? '?';
      const max = fav.maxPriceUsd ?? '?';
      price.textContent = `Price range: ${min} - ${max}`;
      card.appendChild(price);

      const actions = document.createElement('div');
      actions.className = 'fav-actions';

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          if (FavoritesState && FavoritesState.toggleFavorite) {
            await FavoritesState.toggleFavorite({ ...fav });
          }
          latestFavorites = FavoritesState && FavoritesState.loadFavorites ? FavoritesState.loadFavorites() : [];
          alert('Removed from favorites');
          render();
        } catch (err) {
          alert(err.message || 'Failed to remove favorite');
        }
      });

      actions.appendChild(removeBtn);
      card.appendChild(actions);

      card.addEventListener('click', async () => {
        if (!API.loggedIn) {
          alert('Please log in to view details');
          window.location.href = 'login.html';
          return;
        }
        if (detailPanel) {
          detailPanel.style.display = 'block';
          detailPanel.textContent = 'Loading details...';
        }
        try {
          const detail = await fetchDetail(fav.eventId);
          renderDetail(fav, detail);
        } catch (err) {
          if (detailPanel) detailPanel.textContent = err.message || 'Failed to load details';
        }
      });

      container.appendChild(card);
    }
  }

  render();
});
