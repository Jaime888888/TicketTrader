# TicketTrader Quick Notes

## What changed for the demo flow
- The app always runs as a demo user. There is no login or signup—just land on the search page and trade.
- The demo wallet starts with **$2,000**. Wallet and trade endpoints auto-create this user/wallet if the DB is empty.
- Navigation is **Home**, **Favorites**, and **Wallet**.

## Project layout
- **Backend (Java servlets)** under `src/main/java`, including helpers like `JsonResp`, `DemoUser`, and `JDBCConnector` plus the core servlets (`SearchServlet`, `TradeServlet`, `WalletServlet`).
- **Frontend assets** under `src/main/webapp` with page scripts such as `index.js` (search/buy), `wallet.js` (balances + trades), and the shared helper `common.js` that seeds the demo user and builds API paths.
- **Database schema** in `setup.sql`, which creates `users`, `wallet`, and `positions` tables and seeds wallet balances with $2,000.

## Key behaviors
- **Search, Favorite, & Buy**: `index.js` reads the bundled mock search JSON at `/mock/getEvents/search.json` (no backend call needed), renders results, lets you star events into Favorites, and books trades locally using a shared wallet state helper.
- **Favorites**: `favorites.js` renders the locally saved favorites list, lets you remove items, and provides a quick BUY action that flows into the same wallet state as Home/Wallet.
- **Wallet**: `wallet.js` renders straight from the browser-stored wallet state (starting with $2,000 cash and no positions on a fresh session) and updates instantly when you BUY/SELL either here or from the Home page.
- **Demo bootstrapping**: `common.js` seeds localStorage with the demo user id and now exposes a `WalletState` helper used by both pages.

## Deployment tips
- Ensure your build copies compiled classes into the exploded webapp (Tomcat needs `.class` files under `WEB-INF/classes`).
- Update `db/JDBCConnector.java` if your MySQL host, schema name, or credentials differ from the defaults.
- Run the DDL in `setup.sql` to create the schema (it now defaults wallet balances to $2,000).
