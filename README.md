# TicketTrader Codebase Overview

## Project layout
- **Backend (Java servlets)** lives under `src/main/java`. The `db.JDBCConnector` helper contains the MySQL connection string (currently pointing at `tickettrader` on localhost with `root/root` credentials).【F:src/main/java/db/JDBCConnector.java†L1-L18】
- **Database schema** is defined in `setup.sql`, creating `users`, `wallet`, `favorites`, and `positions` tables plus a trigger to seed wallet balances.【F:setup.sql†L2-L89】
- **Frontend (static web assets)** live in `src/main/webapp`, with page-specific scripts such as `index.js`, `login.js`, `favorites.js`, and `wallet.js` driving interactions with the servlet endpoints.【F:src/main/webapp/index.js†L1-L200】【F:src/main/webapp/login.js†L1-L53】【F:src/main/webapp/favorites.js†L1-L56】【F:src/main/webapp/wallet.js†L1-L85】

## Backend endpoints
- **`/register`** (`RegisterServlet`) accepts JSON containing `username` and `password`, checks for duplicates, inserts a user, and upserts a wallet row, returning a JSON status payload.【F:src/main/java/api/RegisterServlet.java†L12-L83】
- **`/login`** (`LoginServlet`) parses JSON credentials, queries the `users` table for `id` and `password_hash`, and compares the stored value to the provided password before returning a success flag and user id.【F:src/main/java/api/LoginServlet.java†L17-L82】
- **`/favorites`** (`FavoritesServlet`) supports `GET` (list favorites for a `userId`), `POST` (add/update a favorite), and `DELETE` (remove a favorite) using the `favorites` table.【F:src/main/java/api/FavoritesServlet.java†L13-L102】
- **`/wallet`** (`WalletServlet`) reads `type` (`cash` or `positions`) plus `userId` to return cash balances or position summaries from the `wallet` and `positions` tables.【F:src/main/java/api/WalletServlet.java†L13-L80】
- **`/trade`** (`TradeServlet`) processes buy/sell requests with `userId`, `side`, `eventId`, `eventName`, `qty`, and `priceUsd`, updating wallet cash and position holdings in a transaction.【F:src/main/java/api/TradeServlet.java†L13-L166】

## Frontend highlights
- `index.js` builds the search/results experience, wiring favorites and BUY actions to the corresponding servlet endpoints while rendering a table of results if necessary.【F:src/main/webapp/index.js†L16-L200】
- `login.js` drives login and signup flows, persisting user info to `localStorage` and redirecting to `index.html` on success.【F:src/main/webapp/login.js†L11-L53】
- `favorites.js` fetches favorites for the logged-in user, renders a list, and enables deletion via `DELETE /favorites` calls.【F:src/main/webapp/favorites.js†L1-L56】
- `wallet.js` loads cash and positions for the current user and provides BUY/SELL buttons that post to the trade endpoint before refreshing balances.【F:src/main/webapp/wallet.js†L10-L85】

## Notable integration gaps
- The database name in `JDBCConnector` (`tickettrader`) differs from the schema file (`ticket_trader`), and the connector currently lacks the `closeQuiet` helpers referenced throughout the servlets.【F:src/main/java/db/JDBCConnector.java†L7-L18】【F:src/main/java/api/RegisterServlet.java†L67-L74】【F:setup.sql†L2-L89】
- `RegisterServlet` only accepts `username` and `password`, while the schema requires an `email` column and stores passwords in `password_hash`, creating a mismatch with both the schema and the front-end signup payload that includes `email`.【F:src/main/java/api/RegisterServlet.java†L21-L64】【F:src/main/webapp/login.js†L32-L42】【F:setup.sql†L8-L17】
- `LoginServlet` queries `password_hash` and performs a plain-text comparison, so password handling and field naming should be aligned with the schema before deploying.【F:src/main/java/api/LoginServlet.java†L49-L69】【F:setup.sql†L8-L17】

## Deployment tips
- The repository no longer ships compiled servlet `.class` files. Make sure your IDE or build step copies the compiled classes into the exploded webapp (e.g., `target` or `build`) before deploying to Tomcat so endpoints load correctly.【F:.gitignore†L1-L14】
