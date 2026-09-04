package api;

import db.JDBCConnector;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

/** Ensures every authenticated account has a wallet row. */
public final class WalletService {
    public static final BigDecimal DEFAULT_CASH = new BigDecimal("3000.00");

    private WalletService() {}

    public static void ensureWallet(long userId, BigDecimal startingCash) throws SQLException {
        BigDecimal initialCash = startingCash == null ? DEFAULT_CASH : startingCash;
        Connection connection = null;
        PreparedStatement statement = null;
        try {
            connection = JDBCConnector.get();
            statement = connection.prepareStatement(
                    "INSERT IGNORE INTO wallet(user_id, cash_usd) VALUES(?, ?)");
            statement.setLong(1, userId);
            statement.setBigDecimal(2, initialCash);
            statement.executeUpdate();
        } finally {
            JDBCConnector.closeQuiet(statement);
            JDBCConnector.closeQuiet(connection);
        }
    }
}
