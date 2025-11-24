# TicketTrader Quick Notes

## What changed for the demo flow
- The login/sign-up page (`login.html`) now talks to MySQL-backed servlets (`/login` and `/register`). A demo account (`demo` / `demo123`) is seeded in the database for quick access; if MySQL is offline the calls will surface errors instead of silently falling back.
- If the servlet endpoints are unreachable (404/500), the browser shows an error instead of persisting accounts locally so you can quickly spot misconfigured servlet paths.
- Authenticated users now read/write favorites and wallet balances through the database-backed `/favorites`, `/wallet`, and `/trade` servlets; if those endpoints fail, the UI surfaces the error instead of silently falling back to local storage. The starting balance remains **$2,000**.
- Navigation adapts between **Home**, **Favorites**, **Wallet**, and **Login/Logout** depending on whether you're signed in.

## Project layout
- **Backend (Java servlets)** under `src/main/java`, including helpers like `JsonResp`, `DemoUser`, and `JDBCConnector` plus the core servlets (`SearchServlet`, `TradeServlet`, `WalletServlet`, `LoginServlet`, `RegisterServlet`, `FavoritesServlet`).
- **Frontend assets** under `src/main/webapp` with page scripts such as `index.js` (search/buy), `wallet.js` (balances + trades), and the shared helper `common.js` that seeds the demo user and builds API paths.
- **Database schema** in `setup.sql`, which creates `users`, `favorites`, `wallet`, and `positions` tables and seeds wallet balances with $2,000.

- **Search, Favorite, & Buy**: `index.js` now calls the provided Ticketmaster Proxy endpoints directly (`/search?keyword=...&city=...` and `/eventDetail/{id}`) to populate the table and detail panel. Signed-in users can star events into Favorites and book trades through `/trade` (falling back to a local wallet state only if the backend is offline). Price ranges of `-1/-1` disable trading per the assignment rules.
- **Favorites**: `favorites.js` syncs the favorites list from `/favorites` for the logged-in user, lets you remove items, and provides a quick BUY action that sends trades to `/trade`.
- **Wallet**: `wallet.js` now loads balances/positions from `/wallet` for the active user and executes BUY/SELL via `/trade`, falling back to the browser-stored wallet only if the server is unreachable.
- **Demo bootstrapping**: `common.js` stores auth state from the backend, exposes `WalletState`, `AuthState`, and handles per-user favorites/wallet storage.

## Deployment tips
- Ensure your build copies compiled classes into the exploded webapp (Tomcat needs `.class` files under `WEB-INF/classes`).
- Compiled servlet classes are checked in under `src/main/webapp/WEB-INF/classes` so Tomcat can load them even if Eclipse skips copying compiled outputs. If you need to rebuild locally without the servlet API jar, use the stub sources in `build-support/stubs` to satisfy `javac` during compilation.
- Update `db/JDBCConnector.java` if your MySQL host, schema name, or credentials differ from the defaults. It now auto-loads the
  MySQL driver, creates the `ticket_trader` database if missing, and will lay down the core tables/triggers on first use so
  fresh environments can start without running SQL manually.
- You can still run the DDL in `setup.sql` yourself; if the schema already exists, the runtime bootstrap will no-op.
- A tiny `Gson` stub class ships in `src/main/java/Gson.java` to avoid startup failures on servers that still scan for a
  `Gson` type even though the app now uses the built-in `SimpleJson` helper instead of the external library.
