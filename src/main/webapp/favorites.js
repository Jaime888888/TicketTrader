/* global API, renderNav */
document.addEventListener('DOMContentLoaded', async () => {
  renderNav();

  const main = document.querySelector('main') || document.body;
  if (!API.userId) { main.innerHTML = '<p>Please log in to see favorites.</p>'; return; }

  try {
    const r = await fetch(`favorites?userId=${encodeURIComponent(API.userId)}`);
    const j = await r.json();
    if (!j.success) throw new Error(j.message || 'Load failed');

    const list = j.data || [];
    if (!list.length) {
      main.innerHTML = '<p>No favorites yet.</p>';
      return;
    }

    const ul = document.createElement('ul');

    for (const f of list) {
      const li = document.createElement('li');

      const a = document.createElement('a');
      a.textContent = f.label ?? f.eventName ?? 'Event';
      // keep your mock/details structure if you have it
      a.href = `mock/eventDetail/${encodeURIComponent(f.eventId)}`;
      li.appendChild(a);

      // optional small "remove" action
      const del = document.createElement('button');
      del.textContent = 'Remove';
      del.style.marginLeft = '8px';
      del.addEventListener('click', async () => {
        const r2 = await fetch(
          `favorites?userId=${encodeURIComponent(API.userId)}&eventId=${encodeURIComponent(f.eventId)}`,
          { method: 'DELETE' }
        );
        const j2 = await r2.json();
        if (j2.success) {
          li.remove();
          if (!ul.children.length) main.innerHTML = '<p>No favorites yet.</p>';
        } else {
          alert(j2.message || 'Remove failed');
        }
      });

      li.appendChild(del);
      ul.appendChild(li);
    }

    main.appendChild(ul);
  } catch (e) {
    console.error(e);
    main.innerHTML = '<p>Failed to load favorites</p>';
  }
});
