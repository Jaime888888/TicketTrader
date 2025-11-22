package db;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

public final class JDBCConnector {
    // TODO: adjust to your database values if different
    private static final String DB_NAME = "ticket_trader";
    private static final String BASE_URL =
            "jdbc:mysql://localhost:3306/?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
    private static final String URL =
            "jdbc:mysql://localhost:3306/" + DB_NAME + "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
    private static final String USER = "root";
    private static final String PASS = "8Jaime8%";

    private static volatile boolean schemaEnsured = false;

    private JDBCConnector() {}

    static {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            throw new RuntimeException("MySQL JDBC driver not found on classpath", e);
        }
    }

    public static Connection get() throws SQLException {
        ensureSchema();
        return DriverManager.getConnection(URL, USER, PASS);
    }

    /** Convenience alias for legacy callers. */
    public static Connection getConnection() throws SQLException { return get(); }

    public static void closeQuiet(AutoCloseable c) {
        if (c == null) return;
        try { c.close(); } catch (Exception ignore) {}
    }

    /**
     * Creates the database and core tables if they do not already exist so
     * first-time deployments do not fail with "Unknown database" errors.
     */
    private static synchronized void ensureSchema() throws SQLException {
        if (schemaEnsured) return;

        // Create the database if missing
        try (Connection root = DriverManager.getConnection(BASE_URL, USER, PASS);
             Statement s = root.createStatement()) {
            s.executeUpdate("CREATE DATABASE IF NOT EXISTS " + DB_NAME +
                    " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        }

        // Create the tables/trigger under the target schema
        try (Connection c = DriverManager.getConnection(URL, USER, PASS);
             Statement s = c.createStatement()) {
            s.executeUpdate("CREATE TABLE IF NOT EXISTS users (" +
                    "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT," +
                    "username VARCHAR(50) NOT NULL," +
                    "email VARCHAR(100) NOT NULL," +
                    "password_hash VARCHAR(255) NOT NULL," +
                    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                    "PRIMARY KEY (id)," +
                    "UNIQUE KEY uq_users_username (username)," +
                    "UNIQUE KEY uq_users_email (email)) ENGINE=InnoDB");

            s.executeUpdate("CREATE TABLE IF NOT EXISTS favorites (" +
                    "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT," +
                    "user_id BIGINT UNSIGNED NOT NULL," +
                    "event_id VARCHAR(64) NOT NULL," +
                    "event_name VARCHAR(255) NULL," +
                    "event_date VARCHAR(64) NULL," +
                    "venue VARCHAR(255) NULL," +
                    "min_price_usd DECIMAL(10,2) NULL," +
                    "max_price_usd DECIMAL(10,2) NULL," +
                    "url VARCHAR(500) NULL," +
                    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                    "PRIMARY KEY (id)," +
                    "UNIQUE KEY uq_fav_user_event (user_id, event_id)," +
                    "CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE" +
                    ") ENGINE=InnoDB");

            s.executeUpdate("CREATE TABLE IF NOT EXISTS wallet (" +
                    "user_id BIGINT UNSIGNED NOT NULL," +
                    "cash_usd DECIMAL(10,2) NOT NULL DEFAULT 2000.00," +
                    "PRIMARY KEY (user_id)," +
                    "CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE" +
                    ") ENGINE=InnoDB");

            s.executeUpdate("CREATE TABLE IF NOT EXISTS positions (" +
                    "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT," +
                    "user_id BIGINT UNSIGNED NOT NULL," +
                    "event_id VARCHAR(64) NOT NULL," +
                    "event_name VARCHAR(255) NULL," +
                    "qty INT NOT NULL," +
                    "total_cost_usd DECIMAL(12,2) NOT NULL," +
                    "min_price_usd DECIMAL(10,2) NOT NULL," +
                    "max_price_usd DECIMAL(10,2) NOT NULL," +
                    "last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                    "PRIMARY KEY (id)," +
                    "UNIQUE KEY uq_pos_user_event (user_id, event_id)," +
                    "KEY ix_pos_user (user_id)," +
                    "CONSTRAINT fk_pos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE" +
                    ") ENGINE=InnoDB");

            s.executeUpdate("CREATE OR REPLACE VIEW v_positions AS " +
                    "SELECT p.id, p.user_id, p.event_id, p.event_name, p.qty, p.total_cost_usd, " +
                    "CASE WHEN p.qty > 0 THEN ROUND(p.total_cost_usd / p.qty, 2) ELSE NULL END AS avg_cost_usd, " +
                    "p.min_price_usd, p.max_price_usd, ROUND(p.max_price_usd * p.qty, 2) AS market_value_usd, p.last_updated " +
                    "FROM positions p");

            s.executeUpdate("DROP TRIGGER IF EXISTS trg_users_after_insert");
            s.executeUpdate("CREATE TRIGGER trg_users_after_insert AFTER INSERT ON users " +
                    "FOR EACH ROW BEGIN INSERT INTO wallet(user_id, cash_usd) VALUES (NEW.id, 2000.00); END");
        }

        schemaEnsured = true;
    }
}
