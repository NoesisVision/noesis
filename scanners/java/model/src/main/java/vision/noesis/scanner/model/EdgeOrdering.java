package vision.noesis.scanner.model;

import java.util.Comparator;

/** Sort key of an edge: kind, from, canonical string of the target, location. */
public final class EdgeOrdering {

    private EdgeOrdering() {}

    public record Key(String kind, String from, String to, SourceSpan location) {}

    /** Two accesses of one field at one site (a compound assignment in bytecode) tie on the key; the edge's own text breaks the tie. */
    public static final Comparator<Edge> COMPARATOR = Comparator.comparing(EdgeOrdering::keyOf,
            Comparator.comparing(Key::kind).thenComparing(Key::from).thenComparing(Key::to).thenComparing(Key::location, SourceSpan.NULLS_FIRST))
            .thenComparing(Edge::toString);

    public static Key keyOf(Edge edge) {
        if (edge instanceof Edge.Contains e) return new Key("CONTAINS", e.from().value(), e.to().value(), null);
        if (edge instanceof Edge.Extends e) return new Key("EXTENDS", e.from().value(), e.to().canonical(), null);
        if (edge instanceof Edge.Implements e) return new Key("IMPLEMENTS", e.from().value(), e.to().canonical(), null);
        if (edge instanceof Edge.Overrides e) return new Key("OVERRIDES", e.from().value(), e.to().value(), null);
        if (edge instanceof Edge.ImplementsMember e) {
            return new Key("IMPLEMENTS_MEMBER", e.from().value(), e.to().value() + "@" + e.interfaceType().canonical() + "@" + e.declaredOn().value(), null);
        }
        if (edge instanceof Edge.Invokes e) return new Key("INVOKES", e.from().value(), e.to().value(), e.site().location());
        if (edge instanceof Edge.Accesses e) return new Key("ACCESSES", e.from().value(), e.to().value(), e.site().location());
        if (edge instanceof Edge.UsesType e) return new Key("USES_TYPE", e.from().value(), e.to().canonical(), e.site().location());
        throw new IllegalArgumentException("Unknown edge: " + edge);
    }
}
