package vision.noesis.scanner.model;

import java.util.List;

public record Annotation(TypeRef type, List<AnnotationArgument> arguments) {}
