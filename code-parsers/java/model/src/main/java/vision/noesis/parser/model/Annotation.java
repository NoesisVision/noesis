package vision.noesis.parser.model;

import java.util.List;

public record Annotation(TypeRef type, List<AnnotationArgument> arguments) {}
