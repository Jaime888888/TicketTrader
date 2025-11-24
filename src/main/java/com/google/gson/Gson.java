package com.google.gson;

import api.SimpleJson;

/**
 * Minimal Gson stub to satisfy build/runtime environments that expect the
 * library on the classpath. The application now uses {@link SimpleJson} for
 * actual JSON handling.
 */
public class Gson {
    public Gson() {}

    public String toJson(Object value) {
        return SimpleJson.stringify(value);
    }

    public <T> T fromJson(String json, Class<T> clazz) {
        // SimpleJson already handles parsing internally; this stub only needs
        // to satisfy type resolution. Callers expecting deserialization should
        // use SimpleJson directly.
        try {
            return clazz.getDeclaredConstructor().newInstance();
        } catch (Exception e) {
            return null;
        }
    }
}
