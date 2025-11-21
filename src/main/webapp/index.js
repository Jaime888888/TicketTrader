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
        const raw = localStorage.getItem("TT_USER_ID") || localStorage.getItem("userId");
        return !!raw;
      },
      get userId() {
        const raw = localStorage.getItem("TT_USER_ID") || localStorage.getItem("userId") || "0";
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
    if (!priceUsd) {
      alert("Missing price; cannot trade this event");
      return;
    }
    try {
      const tradeUrl = apiPath("trade");
      const r = await fetch(tradeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: API.userId, side: "BUY", eventId, eventName, qty, priceUsd })
      });
      const j = await safeJson(r, tradeUrl);
      if (j.success) {
        alert("Purchase complete");
      } else {
        alert(j.message || "Price fetch failed");
      }
    } catch (e) {
      console.error(e);
      alert("Price fetch failed");
    }
  }

  // ---------- search / list ----------
  async function search() {
    const kwInput = $("#keyword") || $("#kw") || $("#searchKeyword");
    const cityInput = $("#city") || $("#searchCity");
    const keyword = kwInput ? kwInput.value.trim() : "";
    const city = cityInput ? cityInput.value.trim() : "";

    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (city) params.set("city", city);

    const url = params.toString() ? `search?${params.toString()}` : "search";

    try {
      const searchUrl = apiPath(url);
      const r = await fetch(searchUrl, { method: "GET" });
      const j = await safeJson(r, searchUrl);
      if (!r.ok) throw new Error(j.message || `Search failed (${r.status})`);
      if (!j.success) throw new Error(j.message || "Search failed");
      renderEvents(j.data || []);
    } catch (e) {
      console.error(e);
      try {
        const mockResp = await fetch(apiPath("/mock/getEvents/search"));
        const mockJson = await mockResp.json();
        renderEvents(mockJson);
        alert(e.message || "Search failed, showing mock data instead");
      } catch (err) {
        console.error(err);
        renderEvents([]);
        alert(e.message || "Search failed");
      }
    }
  }

  function renderEvents(events) {
    const tbody = $("#results-body") || $("#results tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (!Array.isArray(events) || events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4">No results</td></tr>`;
      return;
    }

    for (const e of events) {
      // expected minimal fields; use fallbacks so nothing crashes
      const id = e.id ?? e.eventId ?? e.eid ?? "";
      const name = e.name ?? e.title ?? "Event";
      const date = fmtDate(e.date ?? e.localDate ?? e.startDate ?? "");
      const venue = e.venue ?? e.venueName ?? "";
      const img = e.image ?? e.pic ?? (Array.isArray(e.images) ? e.images[0] : "");
      const minP = e.minPrice ?? e.priceMin ?? e.low ?? "";
      const maxP = e.maxPrice ?? e.priceMax ?? e.high ?? "";
      const ticketUrl = e.url ?? e.ticketUrl ?? "#";
      const priceUsd = Number(minP || maxP) || 0;

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
      buyBtn.addEventListener("click", () => buyTickets(id, name, qty, priceUsd || 1));
      details.appendChild(qty);
      details.appendChild(buyBtn);
      tdEvent.appendChild(document.createElement("br"));
      tdEvent.appendChild(details);

      const tdVenue = document.createElement("td");
      tdVenue.textContent = venue;

      tr.appendChild(tdDate);
      tr.appendChild(tdPic);
      tr.appendChild(tdEvent);
      tr.appendChild(tdVenue);
      tbody.appendChild(tr);
    }
  }

  // ---------- wire up ----------
  document.addEventListener("DOMContentLoaded", () => {
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

    const btn = $("#searchBtn") || $("#btnSearch") || $("#search") || $("#doSearch");
    if (btn) btn.addEventListener("click", search);

    // initial load
    search();
  });
})();
