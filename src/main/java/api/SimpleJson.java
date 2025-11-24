package api;

import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Minimal JSON utilities to avoid external dependencies. */
public final class SimpleJson {
    private static final Pattern PAIR = Pattern.compile("\"([^\\\"]+)\"\\s*:\\s*(\"([^\\\"]*)\"|[-0-9.]+|true|false|null)");

    private SimpleJson() {}

    public static Map<String, String> parseObject(String json) {
        Map<String, String> map = new HashMap<>();
        if (json == null) return map;
        Matcher m = PAIR.matcher(json);
        while (m.find()) {
            String key = m.group(1);
            String rawVal = m.group(2);
            String val = rawVal;
            if (rawVal != null && rawVal.startsWith("\"")) {
                val = rawVal.substring(1, rawVal.length() - 1);
            }
            map.put(key, val);
        }
        return map;
    }

    public static List<Map<String, String>> parseArrayOfObjects(String json) {
        List<Map<String, String>> list = new ArrayList<>();
        if (json == null) return list;
        String trimmed = json.trim();
        if (trimmed.startsWith("[")) trimmed = trimmed.substring(1);
        if (trimmed.endsWith("]")) trimmed = trimmed.substring(0, trimmed.length() - 1);
        int depth = 0; int start = -1;
        for (int i = 0; i < trimmed.length(); i++) {
            char ch = trimmed.charAt(i);
            if (ch == '{') {
                if (depth == 0) start = i;
                depth++;
            } else if (ch == '}') {
                depth--;
                if (depth == 0 && start >= 0) {
                    String obj = trimmed.substring(start, i + 1);
                    list.add(parseObject(obj));
                    start = -1;
                }
            }
        }
        return list;
    }

    public static String stringify(Object value) {
        if (value == null) return "null";
        if (value instanceof String) return quote((String) value);
        if (value instanceof Number || value instanceof Boolean) return String.valueOf(value);
        if (value.getClass().isArray()) {
            int len = Array.getLength(value);
            List<String> items = new ArrayList<>();
            for (int i = 0; i < len; i++) items.add(stringify(Array.get(value, i)));
            return "[" + String.join(",", items) + "]";
        }
        if (value instanceof Iterable<?>) {
            List<String> items = new ArrayList<>();
            for (Object o : (Iterable<?>) value) items.add(stringify(o));
            return "[" + String.join(",", items) + "]";
        }
        if (value instanceof Map<?,?>) {
            List<String> pairs = new ArrayList<>();
            for (Map.Entry<?,?> e : ((Map<?,?>) value).entrySet()) {
                pairs.add(quote(String.valueOf(e.getKey())) + ":" + stringify(e.getValue()));
            }
            return "{" + String.join(",", pairs) + "}";
        }
        // Fallback: reflect public fields
        Map<String, Object> fields = new LinkedHashMap<>();
        for (Field f : value.getClass().getDeclaredFields()) {
            try {
                f.setAccessible(true);
                fields.put(f.getName(), f.get(value));
            } catch (Exception ignored) {}
        }
        return stringify(fields);
    }

    private static String quote(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
