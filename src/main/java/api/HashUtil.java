package api;

import java.security.MessageDigest;

public final class HashUtil {
    private HashUtil() {}

    public static String sha256(String raw) {
        if (raw == null) return "";
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(raw.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("Unable to hash string", e);
        }
    }
}
