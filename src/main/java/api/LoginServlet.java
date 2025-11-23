package api;

import db.JDBCConnector;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Map;
import java.util.stream.Collectors;

@WebServlet(name = "LoginServlet", urlPatterns = {"/login"})
public class LoginServlet extends HttpServlet {
    private final Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setStatus(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
        resp.setContentType("application/json;charset=UTF-8");
        write(resp, JsonResp.error("Use POST /login with JSON payload"));
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setStatus(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
        resp.setContentType("application/json;charset=UTF-8");
        write(resp, JsonResp.error("Use POST /login with JSON payload"));
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        try {
            String body = readBody(req);
            LoginPayload payload = parsePayload(body);
            if (payload == null) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                write(resp, JsonResp.error("Invalid JSON payload"));
                return;
            }

            if (payload == null || isBlank(payload.username) || isBlank(payload.password)) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                write(resp, JsonResp.error("Username/email and password are required"));
                return;
            }

            DemoUser.ensure(new BigDecimal("2000.00"));
            UserRecord user = findUser(payload.username);
            if (user == null) {
                write(resp, JsonResp.error("User not found"));
                return;
            }
            String hashed = hash(payload.password);
            if (!hashed.equals(user.passwordHash)) {
                write(resp, JsonResp.error("Invalid credentials"));
                return;
            }
            write(resp, JsonResp.ok("Login successful", new UserResponse(user)));
        } catch (Exception e) {
            e.printStackTrace();
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            write(resp, JsonResp.error("Login failed: " + e.getMessage()));
        }
    }

    private UserRecord findUser(String usernameOrEmail) throws SQLException {
        Connection c = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            c = JDBCConnector.get();
            ps = c.prepareStatement(
                    "SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1");
            ps.setString(1, usernameOrEmail);
            ps.setString(2, usernameOrEmail);
            rs = ps.executeQuery();
            if (rs.next()) {
                UserRecord u = new UserRecord();
                u.id = rs.getLong("id");
                u.username = rs.getString("username");
                u.email = rs.getString("email");
                u.passwordHash = rs.getString("password_hash");
                return u;
            }
            return null;
        } finally {
            JDBCConnector.closeQuiet(rs);
            JDBCConnector.closeQuiet(ps);
            JDBCConnector.closeQuiet(c);
        }
    }

    private String readBody(HttpServletRequest req) throws IOException {
        try (BufferedReader reader = req.getReader()) {
            return reader.lines().collect(Collectors.joining());
        }
    }

    private void write(HttpServletResponse resp, JsonResp<?> jr) throws IOException {
        try (PrintWriter out = resp.getWriter()) {
            out.write(jr.toJson());
        }
    }

    private LoginPayload parsePayload(String body) {
        if (body == null) return null;
        Map<String, String> map = SimpleJson.parseObject(body);
        if (map == null) return null;
        LoginPayload p = new LoginPayload();
        p.username = map.get("username");
        p.password = map.get("password");
        return p;
    }

    private boolean isBlank(String s) { return s == null || s.trim().isEmpty(); }

    static String hash(String raw) { return HashUtil.sha256(raw); }

    private static class LoginPayload {
        String username;
        String password;
    }

    private static class UserRecord {
        long id;
        String username;
        String email;
        String passwordHash;
    }

    private static class UserResponse {
        long id;
        String username;
        String email;

        UserResponse(UserRecord r) {
            this.id = r.id;
            this.username = r.username;
            this.email = r.email;
        }
    }
}
