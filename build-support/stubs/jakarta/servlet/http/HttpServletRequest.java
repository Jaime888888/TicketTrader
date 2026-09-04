package jakarta.servlet.http;
import java.io.BufferedReader;
public interface HttpServletRequest {
    BufferedReader getReader();
    String getParameter(String name);
    HttpSession getSession();
    HttpSession getSession(boolean create);
}
