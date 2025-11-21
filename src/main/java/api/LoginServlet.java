package api;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import db.JDBCConnector;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.ServletException;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;

@WebServlet(name = "LoginServlet", urlPatterns = {"/login"})
public class LoginServlet extends HttpServlet {
    private final Gson gson = new Gson();
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        resp.setContentType("application/json;charset=UTF-8");

        String username, password;
        try (BufferedReader br = req.getReader()) {
            JsonObject body = gson.fromJson(br, JsonObject.class);
            username = body.get("username").getAsString().trim();
            password = body.get("password").getAsString().trim();
        } catch (Exception e) {
            resp.setStatus(400);
            try (PrintWriter out = resp.getWriter()) {
                JsonObject j = new JsonObject();
                j.addProperty("success", false);
                j.addProperty("message", "Invalid JSON");
                out.print(j.toString());
            }
            return;
        }

        try (Connection conn = JDBCConnector.get()) {
            String sql = "SELECT id, password_hash FROM users WHERE username = ?";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, username);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        write(resp, JsonResp.error("User not found"));
                        return;
                    }

                    long userId = rs.getLong("id");
                    String stored = rs.getString("password_hash");

                    // Simple demo: plain match (setup.sql stores plain text). Replace with hashing in real code.
                    if (stored != null && stored.equals(password)) {
                        write(resp, new JsonResp<>(true, null, java.util.Map.of("userId", userId)));
                    } else {
                        write(resp, JsonResp.error("Wrong password"));
                    }
                }
            }
        } catch (Exception e) {
            resp.setStatus(500);
            write(resp, JsonResp.error("Server error: " + e.getMessage()));
        }
    }

    private void write(HttpServletResponse resp, JsonResp jr) throws IOException {
        try (PrintWriter out = resp.getWriter()) { out.print(gson.toJson(jr)); }
    }
}
