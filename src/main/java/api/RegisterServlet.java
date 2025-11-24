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

@WebServlet(name = "RegisterServlet", urlPatterns = {"/register"})
public class RegisterServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setStatus(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
        resp.setContentType("application/json;charset=UTF-8");
        write(resp, JsonResp.error("Use POST /register with JSON payload"));
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        try {
            String body = readBody(req);
            RegisterPayload payload = parsePayload(body);
            if (payload == null) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                write(resp, JsonResp.error("Invalid JSON payload"));
                return;
            }

            if (payload == null || isBlank(payload.email) || isBlank(payload.username) || isBlank(payload.password)) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                write(resp, JsonResp.error("Email, username, and password are required"));
                return;
            }

            DemoUser.ensure(new BigDecimal("2000.00"));
            if (exists("SELECT 1 FROM users WHERE username = ?", payload.username)) {
                write(resp, JsonResp.error("Username already taken"));
                return;
            }
            if (exists("SELECT 1 FROM users WHERE email = ?", payload.email)) {
                write(resp, JsonResp.error("Email already registered"));
                return;
            }

            long id = insertUser(payload.username, payload.email, HashUtil.sha256(payload.password));
            UserResponse user = new UserResponse();
            user.id = id;
            user.username = payload.username;
            user.email = payload.email;
            write(resp, JsonResp.ok("Account created", user));
        } catch (Exception e) {
            e.printStackTrace();
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            write(resp, JsonResp.error("Registration failed: " + e.getMessage()));
        }
    }

    private long insertUser(String username, String email, String passwordHash) throws SQLException {
        Connection c = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            c = JDBCConnector.get();
            ps = c.prepareStatement("INSERT INTO users(username, email, password_hash) VALUES(?,?,?)", PreparedStatement.RETURN_GENERATED_KEYS);
            ps.setString(1, username);
            ps.setString(2, email);
            ps.setString(3, passwordHash);
            ps.executeUpdate();
            rs = ps.getGeneratedKeys();
            if (rs.next()) return rs.getLong(1);
            throw new SQLException("No generated key returned");
        } finally {
            JDBCConnector.closeQuiet(rs);
            JDBCConnector.closeQuiet(ps);
            JDBCConnector.closeQuiet(c);
        }
    }

    private boolean exists(String sql, String value) throws SQLException {
        Connection c = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            c = JDBCConnector.get();
            ps = c.prepareStatement(sql);
            ps.setString(1, value);
            rs = ps.executeQuery();
            return rs.next();
        } finally {
            JDBCConnector.closeQuiet(rs);
            JDBCConnector.closeQuiet(ps);
            JDBCConnector.closeQuiet(c);
        }
    }

    private RegisterPayload parsePayload(String body) {
        if (body == null) return null;
        Map<String, String> map = SimpleJson.parseObject(body);
        if (map == null) return null;
        RegisterPayload p = new RegisterPayload();
        p.email = map.get("email");
        p.username = map.get("username");
        p.password = map.get("password");
        return p;
    }

    private String readBody(HttpServletRequest req) throws IOException {
        try (BufferedReader reader = req.getReader()) {
            return reader.lines().collect(Collectors.joining());
        }
    }

    private void write(HttpServletResponse resp, JsonResp<?> jr) throws IOException {
        try (PrintWriter out = resp.getWriter()) { out.write(jr.toJson()); }
    }

    private boolean isBlank(String s) { return s == null || s.trim().isEmpty(); }

    private static class RegisterPayload {
        String email;
        String username;
        String password;
    }

    private static class UserResponse {
        long id;
        String username;
        String email;
    }
}
