package api;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Lightweight in-memory auth store used when the database is unavailable. It
 * mirrors the basic contract of the users table so login/register can still
 * succeed in demo environments.
 */
public final class InMemoryAuthStore {
    public static class User {
        public long id;
        public String username;
        public String email;
        public String passwordHash;
    }

    private static final AtomicLong SEQ = new AtomicLong(1000);
    private static final Map<String, User> USERS = new ConcurrentHashMap<>();

    static {
        // Seed demo user so logins still work without MySQL.
        addUser(1L, "demo", "demo@example.com", LoginServlet.hash("demo123"));
    }

    private InMemoryAuthStore() {}

    public static User find(String usernameOrEmail) {
        if (usernameOrEmail == null) return null;
        return USERS.get(key(usernameOrEmail));
    }

    public static boolean usernameExists(String username) {
        return USERS.containsKey(key(username));
    }

    public static boolean emailExists(String email) {
        return USERS.containsKey(key(email));
    }

    public static User insert(String username, String email, String passwordHash) {
        long id = SEQ.getAndIncrement();
        return addUser(id, username, email, passwordHash);
    }

    private static User addUser(long id, String username, String email, String passwordHash) {
        User u = new User();
        u.id = id;
        u.username = username;
        u.email = email;
        u.passwordHash = passwordHash;
        USERS.put(key(username), u);
        USERS.put(key(email), u);
        return u;
    }

    private static String key(String s) { return s == null ? "" : s.trim().toLowerCase(); }
}
