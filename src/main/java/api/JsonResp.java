package api;

public class JsonResp<T> {
    public boolean success;
    public String message;
    public T data;

    public JsonResp() {}

    public JsonResp(boolean success, String message, T data) {
        this.success = success;
        this.message  = message;
        this.data     = data;
    }

    public static <T> JsonResp<T> ok(T data) {
        return new JsonResp<>(true, null, data);
    }

    public static <T> JsonResp<T> ok(String message, T data) {
        return new JsonResp<>(true, message, data);
    }

    public static <T> JsonResp<T> error(String message) {
        return new JsonResp<>(false, message, null);
    }
}
