package api;

import db.JDBCConnector;
import jakarta.servlet.http.*;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.ServletException;
import java.io.*;
import java.math.BigDecimal;
import java.sql.*;
import java.util.stream.Collectors;

@WebServlet(name = "TradeServlet", urlPatterns = {"/trade"})
public class TradeServlet extends HttpServlet {
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        try (BufferedReader br = req.getReader()) {
            String raw = br.lines().collect(java.util.stream.Collectors.joining());
            java.util.Map<String,String> body = SimpleJson.parseObject(raw);
            if (body == null || body.isEmpty()) { write(resp, JsonResp.error("Missing request body")); return; }

            long userId;
            try {
                userId = body.containsKey("userId") && body.get("userId") != null && !body.get("userId").isEmpty()
                        ? Long.parseLong(body.get("userId"))
                        : DemoUser.ensure(BigDecimal.valueOf(2000));
                DemoUser.ensure(BigDecimal.valueOf(2000));
            } catch (Exception e) {
                write(resp, JsonResp.error("Unable to prepare demo wallet: " + e.getMessage()));
                return;
            }

            String side   = body.getOrDefault("side", ""); // "BUY" or "SELL"
            String eventId  = body.getOrDefault("eventId", "");
            String eventName = body.getOrDefault("eventName", "");
            int qty       = parseInt(body.get("qty"));
            BigDecimal priceUsd = parseDecimal(body.get("priceUsd"));

            if (qty <= 0) { write(resp, JsonResp.error("Quantity must be positive")); return; }
            if (priceUsd == null) { write(resp, JsonResp.error("priceUsd is required")); return; }

            Connection c = null;
            PreparedStatement qCash = null, uCash = null, qPos = null, iPos = null, uPos = null;
            ResultSet rs = null;
            try {
                c = JDBCConnector.get();
                c.setAutoCommit(false);

                // Cash
                qCash = c.prepareStatement("SELECT cash_usd FROM wallet WHERE user_id=? FOR UPDATE");
                qCash.setLong(1, userId);
                rs = qCash.executeQuery();
                if (!rs.next()) {
                    write(resp, new JsonResp(false, "Wallet not found"));
                    c.rollback();
                    return;
                }
                BigDecimal cash = rs.getBigDecimal(1);
                rs.close();

                BigDecimal tradeValue = priceUsd.multiply(BigDecimal.valueOf(qty));

                if ("BUY".equalsIgnoreCase(side)) {
                    if (cash.compareTo(tradeValue) < 0) {
                        write(resp, new JsonResp(false, "Insufficient cash"));
                        c.rollback();
                        return;
                    }
                    // upsert position
                    qPos = c.prepareStatement("SELECT id, qty, total_cost_usd, min_price_usd, max_price_usd FROM positions WHERE user_id=? AND event_id=? FOR UPDATE");
                    qPos.setLong(1, userId);
                    qPos.setString(2, eventId);
                    rs = qPos.executeQuery();
                    if (rs.next()) {
                        long pid = rs.getLong(1);
                        int oldQty = rs.getInt(2);
                        BigDecimal oldCost = rs.getBigDecimal(3);
                        BigDecimal minP = rs.getBigDecimal(4);
                        BigDecimal maxP = rs.getBigDecimal(5);
                        rs.close();

                        int newQty = oldQty + qty;
                        BigDecimal newCost = oldCost.add(tradeValue);
                        BigDecimal newMin = minP.min(priceUsd);
                        BigDecimal newMax = maxP.max(priceUsd);

                        uPos = c.prepareStatement("UPDATE positions SET qty=?, total_cost_usd=?, min_price_usd=?, max_price_usd=? WHERE id=?");
                        uPos.setInt(1, newQty);
                        uPos.setBigDecimal(2, newCost);
                        uPos.setBigDecimal(3, newMin);
                        uPos.setBigDecimal(4, newMax);
                        uPos.setLong(5, pid);
                        uPos.executeUpdate();
                    } else {
                        iPos = c.prepareStatement("INSERT INTO positions(user_id, event_id, event_name, qty, total_cost_usd, min_price_usd, max_price_usd) VALUES(?,?,?,?,?,?,?)");
                        iPos.setLong(1, userId);
                        iPos.setString(2, eventId);
                        iPos.setString(3, eventName);
                        iPos.setInt(4, qty);
                        iPos.setBigDecimal(5, tradeValue);
                        iPos.setBigDecimal(6, priceUsd);
                        iPos.setBigDecimal(7, priceUsd);
                        iPos.executeUpdate();
                    }

                    uCash = c.prepareStatement("UPDATE wallet SET cash_usd = cash_usd - ? WHERE user_id=?");
                    uCash.setBigDecimal(1, tradeValue);
                    uCash.setLong(2, userId);
                    uCash.executeUpdate();

                } else { // SELL
                    qPos = c.prepareStatement("SELECT id, qty, total_cost_usd FROM positions WHERE user_id=? AND event_id=? FOR UPDATE");
                    qPos.setLong(1, userId);
                    qPos.setString(2, eventId);
                    rs = qPos.executeQuery();
                    if (!rs.next()) {
                        write(resp, new JsonResp(false, "No position to sell"));
                        c.rollback();
                        return;
                    }
                    long pid = rs.getLong(1);
                    int oldQty = rs.getInt(2);
                    BigDecimal oldCost = rs.getBigDecimal(3);
                    rs.close();

                    if (qty > oldQty) {
                        write(resp, new JsonResp(false, "Sell qty exceeds position"));
                        c.rollback();
                        return;
                    }

                    int newQty = oldQty - qty;
                    BigDecimal avgCostPer = oldQty == 0 ? BigDecimal.ZERO
                            : oldCost.divide(BigDecimal.valueOf(oldQty), 6, java.math.RoundingMode.HALF_UP);
                    BigDecimal newCost = avgCostPer.multiply(BigDecimal.valueOf(newQty));

                    if (newQty == 0) {
                        uPos = c.prepareStatement("DELETE FROM positions WHERE id=?");
                        uPos.setLong(1, pid);
                        uPos.executeUpdate();
                    } else {
                        uPos = c.prepareStatement("UPDATE positions SET qty=?, total_cost_usd=? WHERE id=?");
                        uPos.setInt(1, newQty);
                        uPos.setBigDecimal(2, newCost);
                        uPos.setLong(3, pid);
                        uPos.executeUpdate();
                    }

                    uCash = c.prepareStatement("UPDATE wallet SET cash_usd = cash_usd + ? WHERE user_id=?");
                    uCash.setBigDecimal(1, tradeValue);
                    uCash.setLong(2, userId);
                    uCash.executeUpdate();
                }

                c.commit();
                write(resp, new JsonResp(true, "Done"));
            } catch (Exception e) {
                if (c != null) try { c.rollback(); } catch (Exception ignore) {}
                write(resp, new JsonResp(false, "DB error: " + e.getMessage()));
            } finally {
                JDBCConnector.closeQuiet(rs);
                JDBCConnector.closeQuiet(qCash);
                JDBCConnector.closeQuiet(uCash);
                JDBCConnector.closeQuiet(qPos);
                JDBCConnector.closeQuiet(iPos);
                JDBCConnector.closeQuiet(uPos);
                if (c != null) try { c.setAutoCommit(true); } catch (Exception ignore) {}
                JDBCConnector.closeQuiet(c);
            }
        } catch (Exception e) {
            write(resp, new JsonResp(false, "Server error: " + e.getMessage()));
        }
    }

    private void write(HttpServletResponse resp, JsonResp jr) throws IOException {
        try (PrintWriter out = resp.getWriter()) { out.write(jr.toJson()); }
    }

    private int parseInt(String raw) {
        try { return Integer.parseInt(raw); } catch (Exception e) { return 0; }
    }

    private BigDecimal parseDecimal(String raw) {
        try { return raw == null ? null : new BigDecimal(raw); } catch (Exception e) { return null; }
    }
}
