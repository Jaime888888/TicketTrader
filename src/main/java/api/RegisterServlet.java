package api;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import db.JDBCConnector;
import jakarta.servlet.http.*;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.ServletException;
import java.io.*;
import java.sql.*;

@WebServlet(name = "RegisterServlet", urlPatterns = {"/register"})
public class RegisterServlet extends HttpServlet {
    private final Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        try (BufferedReader br = req.getReader()) {
            JsonObject body = gson.fromJson(br, JsonObject.class);
            String username = body.get("username").getAsString();
            String password = body.get("password").getAsString();

            Connection c = null;
            PreparedStatement check = null, insUser = null, insWallet = null;
            ResultSet rs = null;
            try {
                c = JDBCConnector.get();
                c.setAutoCommit(false);

                check = c.prepareStatement("SELECT id FROM users WHERE username=?");
                check.setString(1, username);
                rs = check.executeQuery();
                if (rs.next()) {
                    write(resp, new JsonResp(false, "Username already exists"));
                    c.rollback();
                    return;
                }

                insUser = c.prepareStatement(
                    "INSERT INTO users(username, password) VALUES(?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
                insUser.setString(1, username);
                insUser.setString(2, password);
                insUser.executeUpdate();

                long uid;
                try (ResultSet gk = insUser.getGeneratedKeys()) {
                    gk.next();
                    uid = gk.getLong(1);
                }

                // If your trigger already creates wallet, this is harmless (ON DUP KEY ignored)
                insWallet = c.prepareStatement(
                    "INSERT INTO wallet(user_id, cash_usd) VALUES(?, 0.00) " +
                    "ON DUPLICATE KEY UPDATE cash_usd=cash_usd");
                insWallet.setLong(1, uid);
                insWallet.executeUpdate();

                c.commit();
                write(resp, new JsonResp(true, "OK"));
            } catch (Exception e) {
                if (c != null) try { c.rollback(); } catch (Exception ignore) {}
                write(resp, new JsonResp(false, "DB error: " + e.getMessage()));
            } finally {
                JDBCConnector.closeQuiet(rs);
                JDBCConnector.closeQuiet(check);
                JDBCConnector.closeQuiet(insUser);
                JDBCConnector.closeQuiet(insWallet);
                if (c != null) try { c.setAutoCommit(true); } catch (Exception ignore) {}
                JDBCConnector.closeQuiet(c);
            }
        } catch (Exception e) {
            write(resp, new JsonResp(false, "Server error: " + e.getMessage()));
        }
    }

    private void write(HttpServletResponse resp, JsonResp jr) throws IOException {
        try (PrintWriter out = resp.getWriter()) { out.write(gson.toJson(jr)); }
    }
}
