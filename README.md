# TicketTrader Quick Notes

## What changed for the demo flow
- The app now runs without login or signup. A demo user is auto-provisioned in the browser and on the server so you land directly on the search page.
- The demo wallet starts with **$2,000**. Wallet and trade endpoints auto-create this user/wallet if the DB is empty.
- Navigation is simplified to just **Home** and **Wallet**.

## Project layout
- **Backend (Java servlets)** under `src/main/java`, including helpers like `JsonResp`, `DemoUser`, and `JDBCConnector` plus the core servlets (`SearchServlet`, `TradeServlet`, `WalletServlet`, etc.).
- **Frontend assets** under `src/main/webapp` with page scripts such as `index.js` (search/buy), `wallet.js` (balances + trades), and the shared helper `common.js` that seeds the demo user and builds API paths.
- **Database schema** in `setup.sql`, which creates `users`, `wallet`, `favorites`, and `positions` tables and seeds wallet balances with $2,000.

## Key behaviors
- **Search & Buy**: `index.js` fetches `/search`, renders results, and lets you buy tickets directly; buys post to `/trade` using the demo user id.
- **Wallet**: `wallet.js` calls `/wallet` for cash and positions, and BUY/SELL buttons post to `/trade` to update holdings and balances.
- **Demo bootstrapping**: `common.js` seeds localStorage with the demo user id; `DemoUser.ensure` guarantees the database has the corresponding user and wallet before trades or wallet reads.

## Deployment tips
- Ensure your build copies compiled classes into the exploded webapp (Tomcat needs `.class` files under `WEB-INF/classes`).
- Update `db/JDBCConnector.java` if your MySQL host, schema name, or credentials differ from the defaults.
- Run the DDL in `setup.sql` to create the schema (it now defaults wallet balances to $2,000).
