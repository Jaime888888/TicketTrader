import api.SimpleJson;

/**
 * Minimal stub to satisfy environments that still expect a Gson class on the
 * classpath. The servlets now use SimpleJson internally, but Tomcat may still
 * scan for this type during startup.
 */
public class Gson {
    public Gson() {}

    public String toJson(Object value) {
        return SimpleJson.stringify(value);
    }

    public <T> T fromJson(String json, Class<T> clazz) {
        try {
            return clazz.getDeclaredConstructor().newInstance();
        } catch (Exception e) {
            return null;
        }
    }
}
