package vision.noesis.annotations;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a package (on {@code package-info.java}) as a module — a grouping node
 * in the Noesis graph. Without it, modules are derived from package structure.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.PACKAGE)
public @interface Module {

    /** Display name; defaults to the local package name. */
    String value() default "";
}
