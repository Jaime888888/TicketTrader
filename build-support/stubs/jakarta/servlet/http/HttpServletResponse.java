package jakarta.servlet.http;
import java.io.PrintWriter;
public interface HttpServletResponse {
    int SC_BAD_REQUEST = 400;
    int SC_METHOD_NOT_ALLOWED = 405;
    int SC_INTERNAL_SERVER_ERROR = 500;
    int SC_OK = 200;
    void setStatus(int sc);
    void setContentType(String type);
    PrintWriter getWriter();
}
