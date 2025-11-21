// webapp/index.js

// ---------- helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return iso || "";
  }
}

// ---------- favorites (NEW) ----------
async function addFavorite(eventId, label) {
  try {
    const r = await fetch("favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, label })
    });
    const j = await r.json();
    if (j.success) {
      alert("Favorited");
    } else {
      alert(j.message || "Favorite failed");
    }
  } catch (err) {
    console.error(err);
    alert("Favorite failed");
  }
}

// ---------- buy ----------
async function buyTickets(eventId, qtyInput) {
  const qty = parseInt(qtyInput.value || "1", 10);
  if (!Number.isFinite(qty) || qty <= 0) {
    alert("Quantity must be a positive number");
    return;
  }
  try {
    const r = await fetch("trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, qty })
    });
    const j = await r.json();
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
  const keyword = $("#keyword").value.trim();
  const city = $("#city").value.trim();

  const params = new URLSearchParams();
  if (keyword) params.set("keyword", keyword);
  if (city) params.set("city", city);

  const url = params.toString() ? `search?${params.toString()}` : "search";

  try {
    const r = await fetch(url, { method: "GET" });
    const j = await r.json();
    if (!j.success) throw new Error(j.message || "Search failed");
    renderEvents(j.data || []);
  } catch (e) {
    console.error(e);
    renderEvents([]);
    alert(e.message || "Search failed");
  }
}

function renderEvents(events) {
  const tbody = $("#results-body");
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
    const img = e.image ?? e.pic ?? "";
    const minP = e.minPrice ?? e.priceMin ?? e.low ?? "";
    const maxP = e.maxPrice ?? e.priceMax ?? e.high ?? "";
    const ticketUrl = e.url ?? e.ticketUrl ?? "#";

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

    // star (favorite)
    const star = document.createElement("span");
    star.title = "Add to favorites";
    star.textContent = " ★";
    star.style.cursor = "pointer";
    // IMPORTANT: new call goes to addFavorite(eventId, name)
    star.addEventListener("click", () => addFavorite(id, name));
    tdEvent.appendChild(document.createTextNode(" "));
    tdEvent.appendChild(star);

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
    buyBtn.addEventListener("click", () => buyTickets(id, qty));
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
  if (!$("#keyword")) {
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
  if (!$("#searchBtn")) {
    const sb = document.createElement("button");
    sb.id = "searchBtn";
    sb.style.display = "none";
    document.body.appendChild(sb);
  }
  if (!$("#results-body")) {
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

  const btn = $("#searchBtn") || $("#search") || $("#doSearch");
  if (btn) btn.addEventListener("click", search);

  // initial load
  search();
});
