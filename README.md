# TicketTrader Quick Notes

## What changed for the demo flow
- A lightweight login/sign-up flow now lives at `login.html`, backed by localStorage. A demo account (`demo-user` / `demo123`) is pre-created for quick access.
- Each logged-in user gets their own mock wallet and favorites stored locally. The starting balance remains **$2,000**.
- Navigation adapts between **Home**, **Favorites**, **Wallet**, and **Login/Logout** depending on whether you're signed in.

## Project layout
- **Backend (Java servlets)** under `src/main/java`, including helpers like `JsonResp`, `DemoUser`, and `JDBCConnector` plus the core servlets (`SearchServlet`, `TradeServlet`, `WalletServlet`).
- **Frontend assets** under `src/main/webapp` with page scripts such as `index.js` (search/buy), `wallet.js` (balances + trades), and the shared helper `common.js` that seeds the demo user and builds API paths.
- **Database schema** in `setup.sql`, which creates `users`, `wallet`, and `positions` tables and seeds wallet balances with $2,000.

- **Search, Favorite, & Buy**: `index.js` reads the bundled mock search JSON at `/mock/getEvents/search.json` (no backend call needed), renders results on load, filters them by keyword/city inputs, lets signed-in users star events into Favorites, and books trades locally using a shared wallet state helper.
- **Favorites**: `favorites.js` renders the locally saved favorites list for the logged-in user, lets you remove items, and provides a quick BUY action that flows into the same wallet state as Home/Wallet.
- **Wallet**: `wallet.js` renders straight from the browser-stored wallet state for the active user (starting with $2,000 cash and no positions on a fresh session) and updates instantly when you BUY/SELL either here or from the Home page.
- **Demo bootstrapping**: `common.js` seeds a demo account in localStorage, exposes `WalletState`, `AuthState`, and handles per-user favorites/wallet storage.

## Deployment tips
- Ensure your build copies compiled classes into the exploded webapp (Tomcat needs `.class` files under `WEB-INF/classes`).
- Update `db/JDBCConnector.java` if your MySQL host, schema name, or credentials differ from the defaults.
- Run the DDL in `setup.sql` to create the schema (it now defaults wallet balances to $2,000).
