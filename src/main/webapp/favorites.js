/* global API, renderNav, FavoritesState, WalletState */
document.addEventListener('DOMContentLoaded', async () => {
  renderNav();
  const container = document.getElementById('favorites');

  if (!API.loggedIn) {
    container.innerHTML = '<div class="muted">Please log in to view favorites.</div>';
    return;
  }

  if (FavoritesState && FavoritesState.syncFavorites) {
    await FavoritesState.syncFavorites();
  }

  function render(){
    const favs = (FavoritesState && FavoritesState.loadFavorites && FavoritesState.loadFavorites()) || [];
    container.innerHTML = '';

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
      meta.textContent = `${fav.date || ''} ${fav.venue ? ' • ' + fav.venue : ''}`;
      card.appendChild(meta);

      const price = document.createElement('div');
      price.className = 'fav-meta';
      price.textContent = `Price range: ${fav.minPriceUsd ?? '?'} - ${fav.maxPriceUsd ?? '?'}`;
      card.appendChild(price);

      const actions = document.createElement('div');
      actions.className = 'fav-actions';

      const qty = document.createElement('input');
      qty.type = 'number';
      qty.min = '1';
      qty.value = '1';
      qty.style.width = '70px';

      const buyBtn = document.createElement('button');
      buyBtn.textContent = 'BUY';
      buyBtn.addEventListener('click', async () => {
        const q = Number(qty.value || 0);
        let result = { success: false };
        if (WalletState && WalletState.tradeRemote) {
          result = await WalletState.tradeRemote({ side: 'BUY', eventId: fav.eventId, eventName: fav.eventName, qty: q, priceUsd: fav.minPriceUsd || fav.maxPriceUsd || 0 });
        }
        if (!result.success && WalletState && WalletState.applyTradeToState) {
          result = WalletState.applyTradeToState({ side: 'BUY', eventId: fav.eventId, eventName: fav.eventName, qty: q, priceUsd: fav.minPriceUsd || fav.maxPriceUsd || 0 });
        }
        if (!result.success) return alert(result.message || 'Trade failed');
        alert('Purchase complete');
      });

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        FavoritesState && FavoritesState.removeFavorite && FavoritesState.removeFavorite(fav.eventId);
        render();
      });

      actions.appendChild(qty);
      actions.appendChild(buyBtn);
      actions.appendChild(removeBtn);
      card.appendChild(actions);

      if (fav.url) {
        const link = document.createElement('a');
        link.href = fav.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'More info';
        card.appendChild(link);
      }

      container.appendChild(card);
    }
  }

  render();
});
