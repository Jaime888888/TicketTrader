package api;

import com.google.gson.Gson;
import db.JDBCConnector;
import jakarta.servlet.http.*;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.ServletException;
import java.io.*;
import java.sql.*;
import java.util.*;
import java.math.BigDecimal;

@WebServlet(name = "WalletServlet", urlPatterns = {"/wallet"})
public class WalletServlet extends HttpServlet {
    private final Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        String type   = req.getParameter("type");    // "cash" or "positions"
        String userId = req.getParameter("userId");

        try {
            if (userId == null || userId.isEmpty()) {
                userId = String.valueOf(DemoUser.ensure(BigDecimal.valueOf(2000)));
            } else {
                // Make sure the wallet exists for the requested user
                DemoUser.ensure(BigDecimal.valueOf(2000));
            }
        } catch (Exception e) {
            write(resp, new JsonResp(false, "Unable to prepare demo wallet: " + e.getMessage()));
            return;
        }

        if (type == null) {
            write(resp, new JsonResp(false, "Missing parameters"));
            return;
        }

        Connection c = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            c = JDBCConnector.get();
            if ("cash".equalsIgnoreCase(type)) {
                ps = c.prepareStatement("SELECT cash_usd FROM wallet WHERE user_id=?");
                ps.setLong(1, Long.parseLong(userId));
                rs = ps.executeQuery();
                if (rs.next()) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("cashUsd", rs.getBigDecimal(1));
                    write(resp, new JsonResp(true, "OK", m));
                } else {
                    write(resp, new JsonResp(false, "Wallet not found"));
                }
            } else if ("positions".equalsIgnoreCase(type)) {
                ps = c.prepareStatement("SELECT id,event_id,event_name,qty,total_cost_usd,min_price_usd,max_price_usd FROM positions WHERE user_id=? ORDER BY id DESC");
                ps.setLong(1, Long.parseLong(userId));
                rs = ps.executeQuery();
                java.util.List<Map<String,Object>> list = new ArrayList<>();
                while (rs.next()) {
                    Map<String,Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getLong(1));
                    m.put("eventId", rs.getLong(2));
                    m.put("eventName", rs.getString(3));
                    m.put("qty", rs.getInt(4));
                    BigDecimal total = rs.getBigDecimal(5);
                    BigDecimal avg = rs.getInt(4) == 0 ? BigDecimal.ZERO
                        : total.divide(BigDecimal.valueOf(rs.getInt(4)), 2, java.math.RoundingMode.HALF_UP);
                    m.put("avgCostUsd", avg);
                    m.put("minPriceUsd", rs.getBigDecimal(6));
                    m.put("maxPriceUsd", rs.getBigDecimal(7));
                    list.add(m);
                }
                write(resp, new JsonResp(true, "OK", list));
            } else {
                write(resp, new JsonResp(false, "Unknown type"));
            }
        } catch (Exception e) {
            write(resp, new JsonResp(false, "DB error: " + e.getMessage()));
        } finally {
            JDBCConnector.closeQuiet(rs);
            JDBCConnector.closeQuiet(ps);
            JDBCConnector.closeQuiet(c);
        }
    }

    private void write(HttpServletResponse resp, JsonResp jr) throws IOException {
        try (PrintWriter out = resp.getWriter()) { out.write(gson.toJson(jr)); }
    }
}
