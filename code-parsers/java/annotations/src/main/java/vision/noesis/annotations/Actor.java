package vision.noesis.annotations;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Repeatable;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Names an actor of the Noesis graph: a person or a role that calls the
 * behavior the annotated method is, or every behavior of the annotated type.
 * Repeat it for several actors. The method keeps nothing of it; the actor is
 * an element of its own, which a design connects to the manual processes it
 * performs.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
@Repeatable(Actor.Actors.class)
public @interface Actor {

    /** The actor's name, e.g. {@code "Quality manager"}; annotations naming one actor share it. */
    String value();

    /** The container Java writes for an {@code @Actor} repeated on one element. */
    @Documented
    @Retention(RetentionPolicy.RUNTIME)
    @Target({ElementType.METHOD, ElementType.TYPE})
    @interface Actors {

        Actor[] value();
    }
}
