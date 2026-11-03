package vision.noesis.annotations;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Puts a package (on {@code package-info.java}) in a layer of the Noesis
 * graph, with every package below it that no nearer {@code @Layer} claims.
 * Without it, the code has no layers.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.PACKAGE)
public @interface Layer {

    /** The layer's name, e.g. {@code "domain"}; packages naming one layer share it. */
    String value();
}
