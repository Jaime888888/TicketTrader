package api;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.ServletException;
import java.io.BufferedReader;
import java.io.IOException;
import java.sql.*;

import db.JDBCConnector;   // <-- this is the only place you import it


public class LoginServlet extends HttpServlet {
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        resp.setContentType("application/json;charset=UTF-8");

        // Read JSON body
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = req.getReader()) {
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
        }

        String username = null, password = null;
        try {
            com.google.gson.JsonObject body = com.google.gson.JsonParser.parseString(sb.toString()).getAsJsonObject();
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

        JsonObject outJson = new JsonObject();

        try (Connection conn = JDBCConnector.getConnection()) {
            String sql = "SELECT id, password_hash FROM users WHERE username = ?";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, username);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        outJson.addProperty("success", false);
                        outJson.addProperty("message", "User not found");
                    } else {
                        long userId = rs.getLong("id");
                        String stored = rs.getString("password_hash");
                        // Simple demo: plain match (your setup.sql stores plain text). Replace with hashing in real code.
                        if (stored.equals(password)) {
                            outJson.addProperty("success", true);
                            JsonObject data = new JsonObject();
                            data.addProperty("userId", userId);
                            outJson.add("data", data);
                        } else {
                            outJson.addProperty("success", false);
                            outJson.addProperty("message", "Wrong password");
                        }
                    }
                }
            }
        } catch (Exception e) {
            resp.setStatus(500);
            outJson.addProperty("success", false);
            outJson.addProperty("message", "Server error: " + e.getMessage());
        }

        try (PrintWriter out = resp.getWriter()) {
            out.print(outJson.toString());
        }
    }
}
