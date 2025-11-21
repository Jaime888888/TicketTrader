package api;

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@WebServlet(name = "SearchServlet", urlPatterns = {"/search"})
public class SearchServlet extends HttpServlet {
    private final Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        String keyword = param(req, "keyword");
        String city = param(req, "city");

        try {
            List<Event> events = loadMockEvents();
            List<Event> filtered = events.stream()
                    .filter(e -> matches(e, keyword, city))
                    .collect(Collectors.toList());
            write(resp, JsonResp.ok(filtered));
        } catch (Exception e) {
            write(resp, JsonResp.error("Search failed: " + e.getMessage()));
        }
    }

    private List<Event> loadMockEvents() throws IOException {
        // Try to read the mock JSON file packaged in the webapp for quick local demos.
        String realPath = getServletContext().getRealPath("/mock/getEvents/search");
        if (realPath != null) {
            Path p = Path.of(realPath);
            if (Files.exists(p)) {
                String json = Files.readString(p);
                Event[] arr = gson.fromJson(json, Event[].class);
                List<Event> list = new ArrayList<>();
                if (arr != null) Collections.addAll(list, arr);
                return list;
            }
        }

        // Fallback to a tiny built-in list if the mock file is missing.
        List<Event> list = new ArrayList<>();
        list.add(new Event("E1", "Taylor Swift | The Eras Tour", "SoFi Stadium", "2025-12-20", ""));
        list.add(new Event("E2", "Los Angeles Lakers vs Boston Celtics", "Crypto.com Arena", "2025-12-25", ""));
        return list;
    }

    private boolean matches(Event e, String keyword, String city) {
        boolean keywordOk = keyword.isEmpty() || contains(e.name, keyword) || contains(e.venue, keyword);
        boolean cityOk = city.isEmpty() || contains(e.venue, city);
        return keywordOk && cityOk;
    }

    private boolean contains(String haystack, String needle) {
        if (haystack == null) return false;
        return haystack.toLowerCase(Locale.ROOT).contains(needle.toLowerCase(Locale.ROOT));
    }

    private String param(HttpServletRequest req, String name) {
        String v = req.getParameter(name);
        return v == null ? "" : v.trim();
    }

    private void write(HttpServletResponse resp, JsonResp jr) throws IOException {
        try (PrintWriter out = resp.getWriter()) { out.write(gson.toJson(jr)); }
    }

    private static class Event {
        @SerializedName(value = "id", alternate = {"eventId"})
        String id;
        String name;
        String venue;
        @SerializedName(value = "localDate", alternate = {"date"})
        String localDate;
        String image;

        Event(String id, String name, String venue, String localDate, String image) {
            this.id = id; this.name = name; this.venue = venue; this.localDate = localDate; this.image = image;
        }
    }
}
