package vision.noesis.fixture.syntax.annotations;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD, ElementType.FIELD, ElementType.PARAMETER, ElementType.TYPE_PARAMETER, ElementType.LOCAL_VARIABLE, ElementType.CONSTRUCTOR})
public @interface OwnAnnotation {

    String value() default "";

    int priority() default 0;

    String[] tags() default {};
}
