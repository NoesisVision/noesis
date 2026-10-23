package vision.noesis.fixture.syntax.annotations;

import java.lang.annotation.ElementType;
import java.util.List;
import vision.noesis.annotations.AggregateRoot;
import vision.noesis.annotations.CommandHandler;
import vision.noesis.annotations.QueryHandler;
import vision.noesis.annotations.ValueObject;
import vision.noesis.fixture.other.OtherAnnotation;
import vision.noesis.fixture.syntax.types.InterfaceKinds.AnnotationWithDefaults;

/** Annotations from the own module, the other module, the platform and the Noesis library, with every value kind, on every placement. */
@OwnAnnotation(value = "type", priority = 2, tags = {"a", "b"})
@AnnotationWithDefaults(required = 7L, type = String.class, kind = ElementType.FIELD, nested = @OtherAnnotation("outer"))
@AggregateRoot
public class AnnotationUsage<@OwnAnnotation("typeParameter") T> {

    @OwnAnnotation("field")
    @Deprecated
    public int annotatedField;

    @OtherAnnotation
    public List<T> fromOtherModule;

    @OwnAnnotation("constructor")
    public AnnotationUsage() {
    }

    @OwnAnnotation
    @CommandHandler
    public void positionalOnly(@OwnAnnotation("parameter") int parameter) {
        @OwnAnnotation("local")
        int local = parameter;
        System.out.println(local);
    }

    @QueryHandler
    @SuppressWarnings({"unchecked", "rawtypes"})
    public T query() {
        return null;
    }

    @ValueObject
    public record AnnotatedRecord(@OwnAnnotation("component") String text) {}
}
