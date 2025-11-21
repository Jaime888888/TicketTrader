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
            String username = body.get("username").getAsString().trim();
            String email    = body.get("email").getAsString().trim();
            String password = body.get("password").getAsString();

            if (username.isEmpty() || email.isEmpty() || password.isEmpty()) {
                write(resp, JsonResp.error("All fields are required"));
                return;
            }

            Connection c = null;
            PreparedStatement check = null, insUser = null;
            ResultSet rs = null;
            try {
                c = JDBCConnector.get();
                c.setAutoCommit(false);

                check = c.prepareStatement("SELECT id FROM users WHERE username=? OR email=?");
                check.setString(1, username);
                check.setString(2, email);
                rs = check.executeQuery();
                if (rs.next()) {
                    write(resp, JsonResp.error("Username or email already exists"));
                    c.rollback();
                    return;
                }

                insUser = c.prepareStatement(
                    "INSERT INTO users(username, email, password_hash) VALUES(?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
                insUser.setString(1, username);
                insUser.setString(2, email);
                insUser.setString(3, password);
                insUser.executeUpdate();

                long uid;
                try (ResultSet gk = insUser.getGeneratedKeys()) {
                    gk.next();
                    uid = gk.getLong(1);
                }

                // Wallet is created by trigger; returning the new user id for the frontend
                c.commit();
                write(resp, new JsonResp(true, "OK", java.util.Map.of("userId", uid)));
            } catch (Exception e) {
                if (c != null) try { c.rollback(); } catch (Exception ignore) {}
                write(resp, JsonResp.error("DB error: " + e.getMessage()));
            } finally {
                JDBCConnector.closeQuiet(rs);
                JDBCConnector.closeQuiet(check);
                JDBCConnector.closeQuiet(insUser);
                if (c != null) try { c.setAutoCommit(true); } catch (Exception ignore) {}
                JDBCConnector.closeQuiet(c);
            }
        } catch (Exception e) {
            write(resp, JsonResp.error("Server error: " + e.getMessage()));
        }
    }

    private void write(HttpServletResponse resp, JsonResp jr) throws IOException {
        try (PrintWriter out = resp.getWriter()) { out.write(gson.toJson(jr)); }
    }
}
