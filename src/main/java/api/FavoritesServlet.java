package api;

import db.JDBCConnector;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.sql.*;
import java.util.*;

@WebServlet(name = "FavoritesServlet", urlPatterns = {"/favorites"})
public class FavoritesServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        long userId = parseUserId(req.getParameter("userId"));
        try {
            DemoUser.seedWallet(userId, DemoUser.DEFAULT_CASH);
        } catch (Exception e) {
            write(resp, JsonResp.error("Unable to prepare demo user: " + e.getMessage()));
            return;
        }

        Connection c = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            c = JDBCConnector.get();
            ps = c.prepareStatement(
                    "SELECT event_id,event_name,event_date,venue,min_price_usd,max_price_usd,url " +
                    "FROM favorites WHERE user_id=? ORDER BY created_at DESC");
            ps.setLong(1, userId);
            rs = ps.executeQuery();
            java.util.List<Map<String, Object>> list = new ArrayList<>();
            while (rs.next()) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("eventId", rs.getString(1));
                m.put("eventName", rs.getString(2));
                m.put("date", rs.getString(3));
                m.put("venue", rs.getString(4));
                m.put("minPriceUsd", rs.getBigDecimal(5));
                m.put("maxPriceUsd", rs.getBigDecimal(6));
                m.put("url", rs.getString(7));
                list.add(m);
            }
            write(resp, JsonResp.ok("OK", list));
        } catch (Exception e) {
            write(resp, JsonResp.error("DB error: " + e.getMessage()));
        } finally {
            JDBCConnector.closeQuiet(rs);
            JDBCConnector.closeQuiet(ps);
            JDBCConnector.closeQuiet(c);
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        try {
            String raw = req.getReader().lines().collect(java.util.stream.Collectors.joining());
            Map<String, String> body = SimpleJson.parseObject(raw);
            if (body == null || body.isEmpty()) {
                write(resp, JsonResp.error("Missing request body"));
                return;
            }

            long userId = parseUserId(body.get("userId"));
            try {
                DemoUser.seedWallet(userId, DemoUser.DEFAULT_CASH);
            } catch (Exception e) {
                write(resp, JsonResp.error("Unable to prepare demo user: " + e.getMessage()));
                return;
            }

            String eventId = body.getOrDefault("eventId", "");
            if (eventId.isEmpty()) {
                write(resp, JsonResp.error("eventId is required"));
                return;
            }

            String action = body.getOrDefault("action", "toggle").toLowerCase(Locale.ROOT);
            Connection c = null;
            PreparedStatement ps = null;
            try {
                c = JDBCConnector.get();
                if ("remove".equals(action)) {
                    ps = c.prepareStatement("DELETE FROM favorites WHERE user_id=? AND event_id=?");
                    ps.setLong(1, userId);
                    ps.setString(2, eventId);
                    ps.executeUpdate();
                    write(resp, JsonResp.ok("Removed"));
                } else {
                    ps = c.prepareStatement(
                            "INSERT INTO favorites(user_id, event_id, event_name, event_date, venue, min_price_usd, max_price_usd, url) " +
                                    "VALUES(?,?,?,?,?,?,?,?) " +
                                    "ON DUPLICATE KEY UPDATE event_name=VALUES(event_name), event_date=VALUES(event_date), venue=VALUES(venue), " +
                                    "min_price_usd=VALUES(min_price_usd), max_price_usd=VALUES(max_price_usd), url=VALUES(url)");
                    ps.setLong(1, userId);
                    ps.setString(2, eventId);
                    ps.setString(3, body.get("eventName"));
                    ps.setString(4, body.get("date"));
                    ps.setString(5, body.get("venue"));
                    ps.setBigDecimal(6, parseDecimal(body.get("minPriceUsd")));
                    ps.setBigDecimal(7, parseDecimal(body.get("maxPriceUsd")));
                    ps.setString(8, body.get("url"));
                    ps.executeUpdate();
                    write(resp, JsonResp.ok("Saved"));
                }
            } catch (Exception e) {
                write(resp, JsonResp.error("DB error: " + e.getMessage()));
            } finally {
                JDBCConnector.closeQuiet(ps);
                JDBCConnector.closeQuiet(c);
            }
        } catch (Exception e) {
            write(resp, JsonResp.error("Server error: " + e.getMessage()));
        }
    }

    private void write(HttpServletResponse resp, JsonResp jr) throws IOException {
        try (PrintWriter out = resp.getWriter()) { out.write(jr.toJson()); }
    }

    private long parseUserId(String raw) {
        try {
            if (raw != null && !raw.isEmpty()) {
                return Long.parseLong(raw);
            }
        } catch (Exception ignore) { /* fall through to demo user */ }
        return DemoUser.ensureSafe(DemoUser.DEFAULT_CASH);
    }

    private BigDecimal parseDecimal(String raw) {
        try { return raw == null ? null : new BigDecimal(raw); } catch (Exception e) { return null; }
    }
}
