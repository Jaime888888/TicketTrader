package api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;

/** Shared session helpers for endpoints that operate on user-owned data. */
public final class AuthUtil {
    private static final String USER_ID_ATTRIBUTE = "authenticatedUserId";

    private AuthUtil() {}

    public static void signIn(HttpServletRequest request, long userId) {
        HttpSession existing = request.getSession(false);
        if (existing != null) existing.invalidate();

        HttpSession session = request.getSession(true);
        session.setAttribute(USER_ID_ATTRIBUTE, userId);
    }

    public static Long requireUserId(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        HttpSession session = request.getSession(false);
        Object value = session == null ? null : session.getAttribute(USER_ID_ATTRIBUTE);
        if (value instanceof Number) return ((Number) value).longValue();

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(JsonResp.error("Authentication required").toJson());
        return null;
    }

    public static void signOut(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
    }
}
