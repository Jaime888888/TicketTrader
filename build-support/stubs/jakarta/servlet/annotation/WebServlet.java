package jakarta.servlet.annotation;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
@Retention(RetentionPolicy.RUNTIME)
public @interface WebServlet {
    String name() default "";
    String[] urlPatterns() default {};
}
