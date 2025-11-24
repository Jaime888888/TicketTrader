// webapp/index.js

// Wrap everything in an IIFE so we don't clash with globals (notably the API
// object from common.js). This avoids "Identifier has already been declared"
// errors when both scripts are present.
(() => {
  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const hasWindow = typeof window !== "undefined";
  const baseParts = hasWindow ? window.location.pathname.split("/").filter(Boolean) : [];
  const fallbackBase = baseParts.length ? `/${baseParts[0]}` : "";

  // Some servers may fail to load common.js; provide local fallbacks so the page
  // still works instead of throwing ReferenceError in that scenario.
  const API = (() => {
    if (hasWindow && window.API) return window.API;
    const shim = {
      base: fallbackBase,
      proxyBase: "",
      get loggedIn() {
        const raw = localStorage.getItem("TT_CURRENT_USER") || localStorage.getItem("TT_USER_ID") || localStorage.getItem("userId");
        return !!raw;
      },
      get userId() {
        const raw = localStorage.getItem("TT_CURRENT_USER") || localStorage.getItem("TT_USER_ID") || localStorage.getItem("userId") || "0";
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
      },
      setLogin() {},
      logout() {},
    };
    if (hasWindow) window.API = shim;
    return shim;
  })();

  // Keep the apiPath helper in scope even if common.js fails to load or loads later.
  const deriveApiPath = (path) => {
    const cleanBase = fallbackBase.endsWith("/") ? fallbackBase.slice(0, -1) : fallbackBase;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
  };

  const apiPath = hasWindow && typeof window.apiPath === "function" ? window.apiPath : deriveApiPath;
  if (hasWindow && !window.apiPath) {
    window.apiPath = apiPath;
  }

  // Favorites state (in-browser)
  const Favorites = (() => {
    if (hasWindow && window.FavoritesState) return window.FavoritesState;
    const storeKey = 'TT_FAVORITES_V1';
    const load = () => {
      try { return JSON.parse(localStorage.getItem(storeKey) || '[]') || []; } catch { return []; }
    };
    const save = (list) => { try { localStorage.setItem(storeKey, JSON.stringify(list || [])); } catch {} };
    return {
      loadFavorites: load,
      saveFavorites: save,
      isFavorite: (id) => load().some(f => f.eventId === id),
      toggleFavorite: (fav) => {
        const list = load();
        const idx = list.findIndex(f => f.eventId === (fav && fav.eventId));
        if (idx >= 0) {
          list.splice(idx, 1);
        } else if (fav && fav.eventId) {
          list.push(fav);
        }
        save(list);
        return list;
      },
    };
  })();

  function fmtDate(iso) {
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      return iso || "";
    }
  }

  async function safeJson(res, urlHint = "") {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      parsed._status = res.status;
      parsed._ok = res.ok;
      return parsed;
    } catch {
      const loc = urlHint || res.url || "request";
      const snippet = text ? ` Response: ${text.slice(0, 160)}` : "";
      return {
        success: false,
        message: `Expected JSON from ${loc} (status ${res.status}).${snippet}`,
        raw: text,
        _status: res.status,
        _ok: res.ok,
      };
    }
  }

  // ---------- buy ----------
  async function buyTickets(eventId, eventName, qtyInput, priceUsd) {
    const qty = parseInt(qtyInput.value || "1", 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      alert("Quantity must be a positive number");
      return;
    }
    const result = window.WalletState && window.WalletState.tradeRemote
      ? await window.WalletState.tradeRemote({ side: "BUY", eventId, eventName, qty, priceUsd })
      : { success: false, message: "Trading unavailable" };
    if (result.success) {
      alert("Purchase complete");
    } else {
      alert(result.message || "Purchase failed");
    }
  }

  // ---------- search / details ----------
  const TM_PROXY_ROOT = (API.proxyBase || "https://us-central1-quixotic-dynamo-165616.cloudfunctions.net").replace(/\/+$/, "");
  const TM_PROXY = `${TM_PROXY_ROOT}/getEvents`;

  async function fetchEvents(keyword, city) {
    const url = `${TM_PROXY}/search?keyword=${encodeURIComponent(keyword || "")}` +
      `&city=${encodeURIComponent(city || "")}`;
    const res = await fetch(url, { method: "GET" });
    const json = await safeJson(res, url);
    if (!res.ok) throw new Error(json.message || `Search failed (${res.status})`);
    return Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : [];
  }

  async function fetchDetail(eventId) {
    const url = `${TM_PROXY}/eventDetail?eventId=${encodeURIComponent(eventId)}`;
    const res = await fetch(url, { method: "GET" });
    const json = await safeJson(res, url);
    if (!res.ok) throw new Error(json.message || `Detail failed (${res.status})`);
    return json;
  }

  async function search() {
    const kwInput = $("#keyword") || $("#kw") || $("#searchKeyword");
    const cityInput = $("#city") || $("#searchCity");
    let keyword = kwInput ? kwInput.value.trim() : "";
    let city = cityInput ? cityInput.value.trim() : "";
    const hint = document.getElementById("hint");

    if (!keyword && !city) {
      renderEvents([], "Enter a keyword and city to search.");
      if (hint) hint.textContent = "";
      return;
    }

    if (!city) {
      renderEvents([], "City is required by the Ticketmaster proxy.");
      if (hint) hint.textContent = "";
      return;
    }

    try {
      const events = await fetchEvents(keyword, city);
      renderEvents(events, `Showing ${events.length} events for keyword "${keyword || "(any)"}" and city "${city || "(any)"}".`);
      if (hint) {
        hint.textContent = `Showing ${events.length} events for keyword "${keyword || "(any)"}" and city "${city || "(any)"}".`;
      }
    } catch (e) {
      console.error(e);
      renderEvents([], e.message || "Search failed");
      if (hint) hint.textContent = "";
      alert(e.message || "Search failed");
    }
  }

  function renderEvents(events, emptyMessage = "No results") {
    const table = $("#results");
    if (table) {
      const thead = table.querySelector("thead");
      if (thead) {
        thead.innerHTML = `<tr><th>Date</th><th>Pic</th><th>Event</th><th>Venue</th></tr>`;
      }
    }

    const tbody = $("#results-body") || (table && table.querySelector("tbody"));
    if (!tbody) return;

    tbody.innerHTML = "";
    if (!Array.isArray(events) || events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4">${emptyMessage}</td></tr>`;
      return;
    }

    for (const e of events) {
      // expected minimal fields; use fallbacks so nothing crashes
      const id = e.eventId ?? e.id ?? e.eid ?? "";
      const name = e.name ?? e.title ?? "Event";
      const date = fmtDate(e.date ?? e.localDate ?? e.startDate ?? "");
      const venue = e.venue ?? e.venueName ?? "";
      const img = e.image ?? e.pic ?? (Array.isArray(e.images) ? e.images[0] : e.images || "");
      const minP = e.minPrice ?? e.priceMin ?? e.low ?? 100;
      const maxP = e.maxPrice ?? e.priceMax ?? e.high ?? minP;
      const ticketUrl = e.url ?? e.ticketUrl ?? "#";
      const priceUsd = Number(minP || maxP) || 100;
      const favPayload = { eventId: id, eventName: name, date, venue, minPriceUsd: minP, maxPriceUsd: maxP, image: img, url: ticketUrl };
      const favbed = Favorites.isFavorite && Favorites.isFavorite(id);

      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      tdDate.textContent = date;

      const tdPic = document.createElement("td");
      if (img) {
        const im = document.createElement("img");
        im.src = img;
        im.alt = "";
        im.width = 24;
        im.height = 24;
        tdPic.appendChild(im);
      }

      const tdEvent = document.createElement("td");
      const star = document.createElement("button");
      star.textContent = favbed ? "★" : "☆";
      star.title = favbed ? "Remove from favorites" : "Add to favorites";
      star.style.marginRight = "6px";
      star.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!API.loggedIn) {
          alert("Please log in to save favorites");
          window.location.href = "login.html";
          return;
        }
        try {
          if (Favorites.toggleFavorite) {
            await Favorites.toggleFavorite(favPayload);
          }
          const nowFav = Favorites.isFavorite && Favorites.isFavorite(id);
          star.textContent = nowFav ? "★" : "☆";
          star.title = nowFav ? "Remove from favorites" : "Add to favorites";
        } catch (e) {
          alert(e.message || "Favorite update failed");
        }
      });
      tdEvent.appendChild(star);

      const a = document.createElement("a");
      a.href = ticketUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = name;
      tdEvent.appendChild(a);

      // details / buy
      const details = document.createElement("div");
      details.style.fontSize = "12px";
      details.textContent = `${venue ? venue + " — " : ""}Price range: ${minP || "?"} - ${maxP || "?"}  `;
      const qty = document.createElement("input");
      qty.type = "number";
      qty.min = "1";
      qty.value = "1";
      qty.style.width = "60px";
      qty.style.marginLeft = "8px";
      const buyBtn = document.createElement("button");
      buyBtn.textContent = "BUY";
      buyBtn.style.marginLeft = "8px";
      buyBtn.addEventListener("click", () => {
        if (!API.loggedIn) {
          alert("Please log in to trade");
          window.location.href = "login.html";
          return;
        }
        buyTickets(id, name, qty, priceUsd || 1);
      });
      details.appendChild(qty);
      details.appendChild(buyBtn);
      tdEvent.appendChild(document.createElement("br"));
      tdEvent.appendChild(details);

      const tdVenue = document.createElement("td");
      tdVenue.textContent = venue;

      tr.dataset.eventId = id;
      tr.appendChild(tdDate);
      tr.appendChild(tdPic);
      tr.appendChild(tdEvent);
      tr.appendChild(tdVenue);
      tbody.appendChild(tr);

      tr.addEventListener("click", () => {
        if (!API.loggedIn) return; // only logged-in users can open details
        showDetails(id, name);
      });
    }
  }

  async function showDetails(eventId, fallbackName) {
    const panel = document.getElementById("details");
    const body = document.getElementById("details-body");
    if (!panel || !body) return;

    body.innerHTML = "Loading...";
    panel.style.display = "block";

    try {
      const detail = await fetchDetail(eventId);
      const dateObj = detail.date || {};
      const eventObj = detail.event || {};
      const priceObj = detail.price || {};
      const localDate = dateObj.localDate || "";
      const localTime = dateObj.localTime || "";
      const url = eventObj.url || "#";
      const min = Number(priceObj.min ?? -1);
      const max = Number(priceObj.max ?? -1);
      const disableTrade = min === -1 && max === -1;

      body.innerHTML = `
        <div><strong>Date:</strong> ${localDate} ${localTime}</div>
        <div><strong>Event (Artist/Tour):</strong> ${eventObj.name || fallbackName || eventId}</div>
        <div><strong>Venue:</strong> ${eventObj.venue || ''}</div>
        <div><strong>Buy Ticket At:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></div>
        <div><strong>Price ranges:</strong> ${min === -1 && max === -1 ? 'N/A' : `${min} - ${max}`}</div>
      `;

      const qty = document.createElement("input");
      qty.type = "number";
      qty.min = "1";
      qty.value = "1";
      qty.style.width = "80px";
      const buyBtn = document.createElement("button");
      buyBtn.textContent = "PURCHASE";
      buyBtn.disabled = disableTrade;
      buyBtn.addEventListener("click", () => {
        if (!API.loggedIn) {
          alert("Please log in to trade");
          window.location.href = "login.html";
          return;
        }
        if (disableTrade) {
          alert("Price unavailable; cannot trade this event");
          return;
        }
        buyTickets(eventId, eventObj.name || fallbackName || eventId, qty, min > 0 ? min : max);
      });

      const favBtn = document.createElement("button");
      const favbed = Favorites.isFavorite && Favorites.isFavorite(eventId);
      favBtn.textContent = favbed ? "★" : "☆";
      favBtn.title = favbed ? "Remove from favorites" : "Add to favorites";
      favBtn.addEventListener("click", async () => {
        if (!API.loggedIn) {
          alert("Please log in to save favorites");
          window.location.href = "login.html";
          return;
        }
        const payload = {
          eventId,
          eventName: eventObj.name || fallbackName || eventId,
          date: localDate,
          venue: eventObj.venue,
          minPriceUsd: priceObj.min,
          maxPriceUsd: priceObj.max,
          url,
        };
        const updated = Favorites.toggleFavorite ? Favorites.toggleFavorite(payload) : [];
        const nowFav = Favorites.isFavorite && Favorites.isFavorite(eventId);
        favBtn.textContent = nowFav ? "★" : "☆";
        favBtn.title = nowFav ? "Remove from favorites" : "Add to favorites";
        return updated;
      });

      const controls = document.createElement("div");
      controls.style.marginTop = "8px";
      controls.appendChild(document.createTextNode("Quantity: "));
      controls.appendChild(qty);
      controls.appendChild(buyBtn);
      controls.appendChild(favBtn);
      body.appendChild(controls);
    } catch (e) {
      console.error(e);
      body.textContent = e.message || "Failed to load details";
    }
  }

  // ---------- wire up ----------
  document.addEventListener("DOMContentLoaded", () => {
    if (API.loggedIn && Favorites.syncFavorites) {
      Favorites.syncFavorites();
    }
    // basic form elements (falls back if missing)
    if (!$("#keyword") && !$("#kw")) {
      const kw = document.createElement("input");
      kw.id = "keyword";
      kw.style.display = "none";
      document.body.appendChild(kw);
    }
    if (!$("#city")) {
      const ct = document.createElement("input");
      ct.id = "city";
      ct.style.display = "none";
      document.body.appendChild(ct);
    }
    if (!$("#searchBtn") && !$("#btnSearch")) {
      const sb = document.createElement("button");
      sb.id = "searchBtn";
      sb.style.display = "none";
      document.body.appendChild(sb);
    }
    if (!$("#results-body") && !$("#results tbody")) {
      // create a table if the html didn't have one
      const tbl = document.createElement("table");
      tbl.style.width = "100%";
      tbl.innerHTML = `
        <thead>
          <tr><th>Date</th><th>Pic</th><th>Event</th><th>Venue</th></tr>
        </thead>
        <tbody id="results-body"></tbody>
      `;
      document.body.appendChild(tbl);
    }

    const authCallout = document.getElementById("authCallout");
    if (authCallout) {
      if (API.loggedIn) {
        const user = window.AuthState && typeof window.AuthState.currentUser === "function" ? window.AuthState.currentUser() : null;
        const label = user && (user.username || user.email) ? `${user.username || user.email}` : "logged in";
        authCallout.textContent = `You are ${label}.`; 
      } else {
        authCallout.innerHTML = 'Want to save favorites or trade? <a href="login.html">Login / Sign Up</a>';
      }
    }

    const btn = $("#searchBtn") || $("#btnSearch") || $("#search") || $("#doSearch");
    if (btn) btn.addEventListener("click", search);
  });
})();
