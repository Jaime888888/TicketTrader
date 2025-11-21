package api;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import db.JDBCConnector;
import jakarta.servlet.http.*;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.ServletException;
import java.io.*;
import java.math.BigDecimal;
import java.sql.*;

@WebServlet(name = "TradeServlet", urlPatterns = {"/trade"})
public class TradeServlet extends HttpServlet {
    private final Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        try (BufferedReader br = req.getReader()) {
            JsonObject body = gson.fromJson(br, JsonObject.class);
            long userId   = body.get("userId").getAsLong();
            String side   = body.get("side").getAsString(); // "BUY" or "SELL"
            String eventId  = body.get("eventId").getAsString();
            String eventName = body.has("eventName") && !body.get("eventName").isJsonNull()
                    ? body.get("eventName").getAsString() : "";
            int qty       = body.get("qty").getAsInt();
            BigDecimal priceUsd = body.get("priceUsd").getAsBigDecimal();

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
        try (PrintWriter out = resp.getWriter()) { out.write(gson.toJson(jr)); }
    }
}
