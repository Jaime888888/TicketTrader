package api;

import db.JDBCConnector;
import java.math.BigDecimal;
import java.sql.*;

/** Ensures a default demo user and wallet exist so the app works without signup. */
public final class DemoUser {
    public static final long ID = 1L;
    private static final String USERNAME = "demo";
    private static final String EMAIL = "demo@example.com";
    private static final String PASS_HASH = LoginServlet.hash("demo123");

    private DemoUser() {}

    /**
     * Guarantees there is at least one user record and wallet row for the demo
     * user. Returns the demo user id.
     */
    public static long ensure(BigDecimal startingCash) throws SQLException {
        Connection c = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            c = JDBCConnector.get();

            ps = c.prepareStatement("SELECT id, password_hash FROM users WHERE id=?");
            ps.setLong(1, ID);
            rs = ps.executeQuery();
            if (rs.next()) {
                String stored = rs.getString("password_hash");
                if (!PASS_HASH.equals(stored)) {
                    JDBCConnector.closeQuiet(ps);
                    ps = c.prepareStatement("UPDATE users SET password_hash=? WHERE id=?");
                    ps.setString(1, PASS_HASH);
                    ps.setLong(2, ID);
                    ps.executeUpdate();
                }
                ensureWallet(c, startingCash);
                return ID;
            }
            JDBCConnector.closeQuiet(rs);
            JDBCConnector.closeQuiet(ps);

            c.setAutoCommit(false);
            try {
                ps = c.prepareStatement("INSERT INTO users(id, username, email, password_hash) VALUES(?,?,?,?)");
                ps.setLong(1, ID);
                ps.setString(2, USERNAME);
                ps.setString(3, EMAIL);
                ps.setString(4, PASS_HASH);
                ps.executeUpdate();

                ensureWallet(c, startingCash);
                c.commit();
            } catch (Exception e) {
                c.rollback();
                throw e;
            } finally {
                c.setAutoCommit(true);
            }
            return ID;
        } finally {
            JDBCConnector.closeQuiet(rs);
            JDBCConnector.closeQuiet(ps);
            JDBCConnector.closeQuiet(c);
        }
    }

    private static void ensureWallet(Connection c, BigDecimal startingCash) throws SQLException {
        PreparedStatement ps = null;
        try {
            ps = c.prepareStatement(
                "INSERT INTO wallet(user_id, cash_usd) VALUES(?, ?) " +
                "ON DUPLICATE KEY UPDATE cash_usd = cash_usd"
            );
            ps.setLong(1, ID);
            ps.setBigDecimal(2, startingCash);
            ps.executeUpdate();
        } finally {
            JDBCConnector.closeQuiet(ps);
        }
    }
}
