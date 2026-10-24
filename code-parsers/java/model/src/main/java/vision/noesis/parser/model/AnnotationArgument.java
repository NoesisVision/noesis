package vision.noesis.parser.model;

/** Always named by the parameter or element, so positional and named spellings read the same. */
public record AnnotationArgument(String name, boolean positional, AnnotationValue value) {}
