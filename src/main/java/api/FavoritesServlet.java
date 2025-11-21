package api;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import db.JDBCConnector;
import jakarta.servlet.http.*;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.ServletException;
import java.io.*;
import java.sql.*;
import java.util.*;

@WebServlet(name = "FavoritesServlet", urlPatterns = {"/favorites"})
public class FavoritesServlet extends HttpServlet {
    private final Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        String userId = req.getParameter("userId");
        if (userId == null) { write(resp, new JsonResp(false, "Missing userId")); return; }

        Connection c = null; PreparedStatement ps = null; ResultSet rs = null;
        try {
            c = JDBCConnector.get();
            ps = c.prepareStatement("SELECT event_id, event_name FROM favorites WHERE user_id=? ORDER BY id DESC");
            ps.setLong(1, Long.parseLong(userId));
            rs = ps.executeQuery();
            List<Map<String,Object>> list = new ArrayList<>();
            while (rs.next()) {
                Map<String,Object> m = new LinkedHashMap<>();
                m.put("eventId", rs.getString(1));
                m.put("eventName", rs.getString(2));
                list.add(m);
            }
            write(resp, new JsonResp(true, "OK", list));
        } catch (Exception e) {
            write(resp, new JsonResp(false, "DB error: " + e.getMessage()));
        } finally {
            JDBCConnector.closeQuiet(rs); JDBCConnector.closeQuiet(ps); JDBCConnector.closeQuiet(c);
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        try (BufferedReader br = req.getReader()) {
            JsonObject b = gson.fromJson(br, JsonObject.class);
            long userId = b.get("userId").getAsLong();
            String eventId = b.get("eventId").getAsString();
            String eventName = b.get("eventName").getAsString();

            Connection c = null; PreparedStatement ps = null;
            try {
                c = JDBCConnector.get();
                ps = c.prepareStatement(
                    "INSERT INTO favorites(user_id, event_id, event_name) VALUES(?,?,?) " +
                    "ON DUPLICATE KEY UPDATE event_name=VALUES(event_name)");
                ps.setLong(1, userId);
                ps.setString(2, eventId);
                ps.setString(3, eventName);
                ps.executeUpdate();
                write(resp, new JsonResp(true, "Favorited"));
            } catch (Exception e) {
                write(resp, new JsonResp(false, "DB error: " + e.getMessage()));
            } finally {
                JDBCConnector.closeQuiet(ps); JDBCConnector.closeQuiet(c);
            }
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String userId  = req.getParameter("userId");
        String eventId = req.getParameter("eventId");
        if (userId == null || eventId == null) { write(resp, new JsonResp(false, "Missing params")); return; }

        Connection c = null; PreparedStatement ps = null;
        try {
            c = JDBCConnector.get();
            ps = c.prepareStatement("DELETE FROM favorites WHERE user_id=? AND event_id=?");
            ps.setLong(1, Long.parseLong(userId));
            ps.setString(2, eventId);
            ps.executeUpdate();
            write(resp, new JsonResp(true, "Removed"));
        } catch (Exception e) {
            write(resp, new JsonResp(false, "DB error: " + e.getMessage()));
        } finally {
            JDBCConnector.closeQuiet(ps); JDBCConnector.closeQuiet(c);
        }
    }

    private void write(HttpServletResponse resp, JsonResp jr) throws IOException {
        try (PrintWriter out = resp.getWriter()) { out.write(gson.toJson(jr)); }
    }
}
