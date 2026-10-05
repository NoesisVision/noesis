package vision.noesis.scanner.core.config;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import vision.noesis.scanner.core.model.BehaviourType;
import vision.noesis.scanner.core.model.NodeType;
import vision.noesis.scanner.core.model.PortDirection;

/**
 * Maps annotation FQNs to stereotypes: type annotations to building blocks and
 * messages, method annotations to behaviour types. The scanner has no compile
 * dependency on any annotation library — detection matches names found in
 * bytecode, so teams can plug in their own vocabulary. jMolecules and noesis
 * mappings are built in.
 */
public final class StereotypeMapping {

    /** A stereotype target; {@code direction} is null when it comes from an annotation attribute. */
    public record MappedStereotype(NodeType type, PortDirection direction) {

        public static MappedStereotype of(NodeType type) {
            return new MappedStereotype(type, null);
        }
    }

    private final Map<String, MappedStereotype> byAnnotationFqn;
    private final Map<String, BehaviourType> behaviourTypesByAnnotationFqn;

    private StereotypeMapping(
            Map<String, MappedStereotype> byAnnotationFqn,
            Map<String, BehaviourType> behaviourTypesByAnnotationFqn) {
        this.byAnnotationFqn = Map.copyOf(byAnnotationFqn);
        this.behaviourTypesByAnnotationFqn = Map.copyOf(behaviourTypesByAnnotationFqn);
    }

    public Optional<MappedStereotype> stereotypeOf(String annotationFqn) {
        return Optional.ofNullable(byAnnotationFqn.get(annotationFqn));
    }

    public Map<String, MappedStereotype> asMap() {
        return byAnnotationFqn;
    }

    /** Method annotations that give a behaviour its type. */
    public Map<String, BehaviourType> behaviourTypes() {
        return behaviourTypesByAnnotationFqn;
    }

    /** This mapping plus additional type annotations; additions win on conflict. */
    public StereotypeMapping plus(Map<String, MappedStereotype> additions) {
        Map<String, MappedStereotype> merged = new LinkedHashMap<>(byAnnotationFqn);
        merged.putAll(additions);
        return new StereotypeMapping(merged, behaviourTypesByAnnotationFqn);
    }

    /** This mapping plus additional method annotations; additions win on conflict. */
    public StereotypeMapping plusBehaviourTypes(Map<String, BehaviourType> additions) {
        Map<String, BehaviourType> merged = new LinkedHashMap<>(behaviourTypesByAnnotationFqn);
        merged.putAll(additions);
        return new StereotypeMapping(byAnnotationFqn, merged);
    }

    /** jMolecules + noesis vocabularies. */
    public static StereotypeMapping defaults() {
        StereotypeMapping noesis = noesis();
        return jMolecules().plus(noesis.asMap()).plusBehaviourTypes(noesis.behaviourTypes());
    }

    /**
     * The noesis vocabulary. {@code @Command}, {@code @Query} and {@code @Event} mark
     * message classes; {@code @CommandHandler}, {@code @QueryHandler} and
     * {@code @EventHandler} mark the behaviours that handle them.
     */
    public static StereotypeMapping noesis() {
        Map<String, MappedStereotype> m = new LinkedHashMap<>();
        String p = "vision.noesis.annotations.";
        m.put(p + "AggregateRoot", MappedStereotype.of(NodeType.AGGREGATE_ROOT));
        m.put(p + "DomainEntity", MappedStereotype.of(NodeType.ENTITY));
        m.put(p + "ValueObject", MappedStereotype.of(NodeType.VALUE_OBJECT));
        m.put(p + "Identifier", MappedStereotype.of(NodeType.IDENTIFIER));
        m.put(p + "DomainService", MappedStereotype.of(NodeType.DOMAIN_SERVICE));
        m.put(p + "ApplicationService", MappedStereotype.of(NodeType.APPLICATION_SERVICE));
        m.put(p + "Repository", MappedStereotype.of(NodeType.REPOSITORY));
        m.put(p + "Factory", MappedStereotype.of(NodeType.FACTORY));
        // direction read from the annotation's `value` attribute
        m.put(p + "ExternalIntegration", MappedStereotype.of(NodeType.PORT));
        m.put(p + "Adapter", MappedStereotype.of(NodeType.ADAPTER));
        m.put(p + "Command", MappedStereotype.of(NodeType.COMMAND));
        m.put(p + "Query", MappedStereotype.of(NodeType.QUERY));
        m.put(p + "Event", MappedStereotype.of(NodeType.EVENT));

        Map<String, BehaviourType> b = new LinkedHashMap<>();
        b.put(p + "CommandHandler", BehaviourType.COMMAND);
        b.put(p + "QueryHandler", BehaviourType.QUERY);
        b.put(p + "EventHandler", BehaviourType.EVENT);
        return new StereotypeMapping(m, b);
    }

    public static StereotypeMapping jMolecules() {
        Map<String, MappedStereotype> m = new LinkedHashMap<>();
        m.put("org.jmolecules.ddd.annotation.AggregateRoot", MappedStereotype.of(NodeType.AGGREGATE_ROOT));
        m.put("org.jmolecules.ddd.annotation.Entity", MappedStereotype.of(NodeType.ENTITY));
        m.put("org.jmolecules.ddd.annotation.ValueObject", MappedStereotype.of(NodeType.VALUE_OBJECT));
        // jMolecules @Service is a domain service in DDD terms
        m.put("org.jmolecules.ddd.annotation.Service", MappedStereotype.of(NodeType.DOMAIN_SERVICE));
        m.put("org.jmolecules.ddd.annotation.Repository", MappedStereotype.of(NodeType.REPOSITORY));
        m.put("org.jmolecules.ddd.annotation.Factory", MappedStereotype.of(NodeType.FACTORY));
        m.put("org.jmolecules.event.annotation.DomainEvent", MappedStereotype.of(NodeType.EVENT));
        m.put("org.jmolecules.architecture.cqrs.Command", MappedStereotype.of(NodeType.COMMAND));
        m.put("org.jmolecules.architecture.hexagonal.Port", MappedStereotype.of(NodeType.PORT));
        m.put("org.jmolecules.architecture.hexagonal.PrimaryPort",
                new MappedStereotype(NodeType.PORT, PortDirection.PRIMARY));
        m.put("org.jmolecules.architecture.hexagonal.SecondaryPort",
                new MappedStereotype(NodeType.PORT, PortDirection.SECONDARY));
        m.put("org.jmolecules.architecture.hexagonal.Adapter", MappedStereotype.of(NodeType.ADAPTER));
        m.put("org.jmolecules.architecture.hexagonal.PrimaryAdapter",
                new MappedStereotype(NodeType.ADAPTER, PortDirection.PRIMARY));
        m.put("org.jmolecules.architecture.hexagonal.SecondaryAdapter",
                new MappedStereotype(NodeType.ADAPTER, PortDirection.SECONDARY));
        // jMolecules has no @Query and no @ApplicationService — teams supply those
        // via the noesis annotations or a custom mapping (design-doc §9.4).

        Map<String, BehaviourType> b = new LinkedHashMap<>();
        b.put("org.jmolecules.architecture.cqrs.CommandHandler", BehaviourType.COMMAND);
        b.put("org.jmolecules.event.annotation.DomainEventHandler", BehaviourType.EVENT);
        return new StereotypeMapping(m, b);
    }
}
