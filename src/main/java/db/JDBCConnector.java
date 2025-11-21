package db;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public final class JDBCConnector {
    // TODO: adjust to your database values if different
    private static final String URL =
            "jdbc:mysql://localhost:3306/ticket_trader?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
    private static final String USER = "root";
    private static final String PASS = "8Jaime8%";

    private JDBCConnector() {}

    public static Connection get() throws SQLException { return DriverManager.getConnection(URL, USER, PASS); }

    /** Convenience alias for legacy callers. */
    public static Connection getConnection() throws SQLException { return get(); }

    public static void closeQuiet(AutoCloseable c) {
        if (c == null) return;
        try { c.close(); } catch (Exception ignore) {}
    }
}
