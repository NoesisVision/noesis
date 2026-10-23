package vision.noesis.scanner.model;

import java.util.List;

public record Signature(List<Parameter> parameters, TypeRef returnType, Passing returnPassing, List<Annotation> returnAnnotations) {}
