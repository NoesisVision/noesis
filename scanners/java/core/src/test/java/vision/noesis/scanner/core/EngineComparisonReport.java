package vision.noesis.scanner.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.stream.Collectors;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.DeclarationNode;
import vision.noesis.scanner.model.Diagnostic;
import vision.noesis.scanner.model.Edge;
import vision.noesis.scanner.model.FieldNode;
import vision.noesis.scanner.model.MethodNode;
import vision.noesis.scanner.model.NamespaceNode;
import vision.noesis.scanner.model.NodeId;
import vision.noesis.scanner.model.SourceSpan;
import vision.noesis.scanner.model.StubNode;
import vision.noesis.scanner.model.TypeNode;
import vision.noesis.scanner.model.TypeParameter;
import vision.noesis.scanner.model.TypeParameterConstraint;
import vision.noesis.scanner.model.TypeRef;

/**
 * The unfiltered difference between the engines over the fixture, counted per category, beside what each engine
 * holds: the measurements behind the comparison of the approaches. The first engine is the baseline every other one is
 * measured against. {@link AgreementRules} says which of these differences are accepted; this report says how big each
 * one is.
 */
final class EngineComparisonReport {

    /** One engine's scan under the label the report prints for it. */
    record Labelled(String label, ScanResult result) {}

    private final StringBuilder out = new StringBuilder();

    /**
     * The sections for every artifact of the first (baseline) result: one inventory table with a column per engine,
     * then, per other engine, the unfiltered differences against the baseline. An engine without a model for an
     * artifact shows {@code -} in the inventory and gets no difference sections for it. No document title; the test
     * composes the file.
     */
    static String of(List<Labelled> engines) {
        EngineComparisonReport report = new EngineComparisonReport();
        Labelled baseline = engines.get(0);
        for (CodeModelFile model : baseline.result().models()) {
            String artifact = model.artifact().name();
            List<CodeModelFile> models = new ArrayList<>();
            for (Labelled engine : engines) models.add(modelOrNull(engine.result(), artifact));
            report.out.append("\n## ").append(artifact).append("\n");
            report.inventory(engines.stream().map(Labelled::label).collect(Collectors.toList()), models);
            for (int i = 1; i < engines.size(); i++) {
                if (models.get(i) != null) report.compare(baseline.label(), model, engines.get(i).label(), models.get(i));
            }
        }
        return report.out.toString();
    }

    private static CodeModelFile modelOrNull(ScanResult result, String artifact) {
        try {
            return result.model(artifact);
        } catch (IllegalArgumentException missing) {
            return null;
        }
    }

    private void compare(String leftLabel, CodeModelFile left, String rightLabel, CodeModelFile right) {
        out.append("\n### ").append(rightLabel).append(" versus ").append(leftLabel).append("\n");
        nodeDifferences(leftLabel, left, rightLabel, right);
        structuralDifferences(leftLabel, left, rightLabel, right);
        bodyDifferences(leftLabel, left, rightLabel, right);
        stubAndDiagnosticDifferences(leftLabel, left, rightLabel, right);
    }

    // --- What each engine holds --------------------------------------------------------------------------------------

    /** The inventory of every engine's model for one artifact; a {@code null} model shows as {@code -}. */
    private void inventory(List<String> labels, List<CodeModelFile> models) {
        table("What each engine wrote", "Measure", labels, List.of(
                row("namespace nodes", models, m -> count(m.nodes(), NamespaceNode.class)),
                row("type nodes", models, m -> count(m.nodes(), TypeNode.class)),
                row("method nodes", models, m -> count(m.nodes(), MethodNode.class)),
                row("field nodes", models, m -> count(m.nodes(), FieldNode.class)),
                row("nodes with a location", models, m -> m.nodes().stream().filter(n -> !n.locations().isEmpty()).count()),
                row("nodes located to a line (line > 0)", models, m -> m.nodes().stream().filter(n -> n.locations().stream().anyMatch(s -> s.startLine() > 0)).count()),
                row("nodes located to a column (column > 0)", models, m -> m.nodes().stream().filter(n -> n.locations().stream().anyMatch(s -> s.startColumn() > 0)).count()),
                row("nodes with documentation", models, m -> m.nodes().stream().filter(n -> n.documentation() != null && !n.documentation().isEmpty()).count()),
                row("nodes with annotations", models, m -> m.nodes().stream().filter(n -> !n.annotations().isEmpty()).count()),
                row("annotations on nodes", models, m -> m.nodes().stream().mapToLong(n -> n.annotations().size()).sum()),
                row("generated members", models, m -> m.nodes().stream().filter(n -> n.origin() == vision.noesis.scanner.model.Origin.GENERATED).count()),
                row("methods with parameters named arg<i>", models, m -> methods(m).filter(x -> x.signature().parameters().stream().anyMatch(p -> p.name().matches("arg\\d+"))).count()),
                row("CONTAINS edges", models, m -> count(m.edges(), Edge.Contains.class)),
                row("EXTENDS edges", models, m -> count(m.edges(), Edge.Extends.class)),
                row("IMPLEMENTS edges", models, m -> count(m.edges(), Edge.Implements.class)),
                row("OVERRIDES edges", models, m -> count(m.edges(), Edge.Overrides.class)),
                row("IMPLEMENTS_MEMBER edges", models, m -> count(m.edges(), Edge.ImplementsMember.class)),
                row("INVOKES edges", models, m -> count(m.edges(), Edge.Invokes.class)),
                row("INVOKES with type arguments", models, m -> invokes(m).filter(e -> !e.typeArguments().isEmpty()).count()),
                row("INVOKES via closure", models, m -> invokes(m).filter(e -> e.site().viaClosure()).count()),
                row("INVOKES with a column", models, m -> invokes(m).filter(e -> e.site().location().startColumn() > 0).count()),
                row("INVOKES receiver = other", models, m -> invokes(m).filter(e -> e.receiver() == vision.noesis.scanner.model.ExpressionKind.OTHER).count()),
                row("INVOKES receiver kinds used", models, m -> invokes(m).map(Edge.Invokes::receiver).distinct().count()),
                row("INVOKES to unresolved targets", models, m -> invokes(m).filter(e -> e.to().value().contains("unresolved")).count()),
                row("ACCESSES edges", models, m -> count(m.edges(), Edge.Accesses.class)),
                row("ACCESSES readWrite", models, m -> accesses(m).filter(e -> e.access() == vision.noesis.scanner.model.AccessKind.READ_WRITE).count()),
                row("ACCESSES receiver kinds used", models, m -> accesses(m).map(Edge.Accesses::receiver).distinct().count()),
                row("USES_TYPE edges", models, m -> count(m.edges(), Edge.UsesType.class)),
                row("USES_TYPE cast", models, m -> usesTypes(m).filter(e -> e.role() == vision.noesis.scanner.model.TypeUseRole.CAST).count()),
                row("USES_TYPE creation", models, m -> usesTypes(m).filter(e -> e.role() == vision.noesis.scanner.model.TypeUseRole.CREATION).count()),
                row("USES_TYPE typeTest", models, m -> usesTypes(m).filter(e -> e.role() == vision.noesis.scanner.model.TypeUseRole.TYPE_TEST).count()),
                row("stubs", models, m -> (long) m.stubs().size()),
                row("diagnostics", models, m -> (long) m.diagnostics().size())));
        List<Map<String, Long>> codesByEngine = new ArrayList<>();
        Set<String> codes = new TreeSet<>();
        for (CodeModelFile model : models) {
            Map<String, Long> byCode = model == null ? Map.of() : model.diagnostics().stream().collect(Collectors.groupingBy(Diagnostic::code, TreeMap::new, Collectors.counting()));
            codesByEngine.add(byCode);
            codes.addAll(byCode.keySet());
        }
        if (!codes.isEmpty()) {
            List<String[]> rows = new ArrayList<>();
            for (String code : codes) {
                String[] row = new String[models.size() + 1];
                row[0] = code;
                for (int i = 0; i < models.size(); i++) row[i + 1] = models.get(i) == null ? "-" : String.valueOf(codesByEngine.get(i).getOrDefault(code, 0L));
                rows.add(row);
            }
            table("Diagnostics by code", "Code", labels, rows);
        }
    }

    // --- Nodes -------------------------------------------------------------------------------------------------------

    private void nodeDifferences(String leftLabel, CodeModelFile leftModel, String rightLabel, CodeModelFile rightModel) {
        Map<NodeId, DeclarationNode> left = byId(leftModel);
        Map<NodeId, DeclarationNode> right = byId(rightModel);
        Map<String, Long> counts = new TreeMap<>();
        Map<String, List<String>> examples = new TreeMap<>();
        for (NodeId id : left.keySet()) if (!right.containsKey(id)) bump(counts, examples, "node only in " + leftLabel, id.value());
        for (NodeId id : right.keySet()) {
            if (!left.containsKey(id)) bump(counts, examples, "node only in " + rightLabel + (id.value().endsWith("#.cctor()") ? ": .cctor" : ": other"), id.value());
        }
        for (NodeId id : left.keySet()) {
            DeclarationNode s = left.get(id);
            DeclarationNode b = right.get(id);
            if (b == null) continue;
            Map<String, String> ls = fields(s);
            Map<String, String> rs = fields(b);
            for (String field : ls.keySet()) {
                if (!ls.get(field).equals(rs.get(field))) bump(counts, examples, "field differs: " + field, id.value() + " (" + ls.get(field) + " | " + rs.get(field) + ")");
            }
        }
        differenceTable("Node differences (unfiltered)", counts, examples);
    }

    private static Map<String, String> fields(DeclarationNode node) {
        Map<String, String> fields = new TreeMap<>();
        fields.put("name", node.name());
        fields.put("origin", node.origin().id());
        fields.put("location.file", node.locations().stream().map(SourceSpan::file).collect(Collectors.joining(",")));
        fields.put("location.line", node.locations().stream().map(s -> String.valueOf(s.startLine())).collect(Collectors.joining(",")));
        fields.put("location.column", node.locations().stream().map(s -> String.valueOf(s.startColumn())).collect(Collectors.joining(",")));
        fields.put("documentation", String.valueOf(node.documentation() != null && !node.documentation().isEmpty()));
        fields.put("annotations", node.annotations().stream().map(a -> a.type().canonical() + a.arguments().stream().map(arg -> arg.name() + (arg.positional() ? "!" : "=") + arg.value()).sorted().collect(Collectors.toList())).sorted().collect(Collectors.joining(" ")));
        fields.put("bag", new TreeMap<>(node.languageSpecific().entries()).toString());
        if (node instanceof TypeNode type) {
            fields.put("typeKind", type.typeKind().id());
            fields.put("visibility", type.visibility().id());
            fields.put("modifiers", sorted(type.modifiers()));
            fields.put("typeParameters", typeParameters(type.typeParameters()));
        } else if (node instanceof MethodNode method) {
            fields.put("methodKind", method.methodKind().id());
            fields.put("visibility", method.visibility().id());
            fields.put("modifiers", sorted(method.modifiers()));
            fields.put("bodiless", Boolean.toString(method.bodiless()));
            fields.put("typeParameters", typeParameters(method.typeParameters()));
            fields.put("parameterNames", method.signature().parameters().stream().map(p -> p.name()).collect(Collectors.joining(",")));
            fields.put("parameterTypes", method.signature().parameters().stream().map(p -> p.type().canonical() + (p.variadic() ? "..." : "")).collect(Collectors.joining(",")));
            fields.put("parameterAnnotations", method.signature().parameters().stream().map(p -> p.annotations().stream().map(a -> a.type().canonical()).sorted().collect(Collectors.joining("+"))).collect(Collectors.joining(",")));
            fields.put("returnType", method.signature().returnType().canonical());
        } else if (node instanceof FieldNode field) {
            fields.put("fieldKind", field.fieldKind().id());
            fields.put("visibility", field.visibility().id());
            fields.put("modifiers", sorted(field.modifiers()));
            fields.put("type", field.type().canonical());
            fields.put("constantValue", String.valueOf(field.constantValue()));
        }
        return fields;
    }

    // --- Structure ---------------------------------------------------------------------------------------------------

    private void structuralDifferences(String leftLabel, CodeModelFile leftModel, String rightLabel, CodeModelFile rightModel) {
        Map<String, Long> counts = new TreeMap<>();
        Map<String, List<String>> examples = new TreeMap<>();
        Set<String> left = structural(leftModel);
        Set<String> right = structural(rightModel);
        for (String edge : left) if (!right.contains(edge)) bump(counts, examples, edge.substring(0, edge.indexOf(' ')) + " only in " + leftLabel, edge);
        for (String edge : right) if (!left.contains(edge)) bump(counts, examples, edge.substring(0, edge.indexOf(' ')) + " only in " + rightLabel, edge);
        differenceTable("Structural edge differences (unfiltered)", counts, examples);
    }

    private static Set<String> structural(CodeModelFile model) {
        Set<String> edges = new TreeSet<>();
        for (Edge edge : model.edges()) {
            if (edge instanceof Edge.Contains e) edges.add("CONTAINS " + e.from() + " -> " + e.to());
            else if (edge instanceof Edge.Extends e) edges.add("EXTENDS " + e.from() + " -> " + e.to().canonical());
            else if (edge instanceof Edge.Implements e) edges.add("IMPLEMENTS " + e.from() + " -> " + e.to().canonical());
            else if (edge instanceof Edge.Overrides e) edges.add("OVERRIDES " + e.from() + " -> " + e.to());
            else if (edge instanceof Edge.ImplementsMember e) edges.add("IMPLEMENTS_MEMBER " + e.from() + " -> " + e.to() + " | " + e.interfaceType().canonical() + " | on " + e.declaredOn());
        }
        return edges;
    }

    // --- Bodies ------------------------------------------------------------------------------------------------------

    private void bodyDifferences(String leftLabel, CodeModelFile leftModel, String rightLabel, CodeModelFile rightModel) {
        Map<String, Long> counts = new TreeMap<>();
        Map<String, List<String>> examples = new TreeMap<>();
        Set<NodeId> scannedTypes = leftModel.nodes().stream().filter(TypeNode.class::isInstance).map(DeclarationNode::id).collect(Collectors.toSet());
        Map<String, List<Edge.Invokes>> leftCalls = calls(leftModel);
        Map<String, List<Edge.Invokes>> rightCalls = calls(rightModel);
        for (Map.Entry<String, List<Edge.Invokes>> call : leftCalls.entrySet()) {
            int missing = call.getValue().size() - rightCalls.getOrDefault(call.getKey(), List.of()).size();
            for (int i = 0; i < missing; i++) bump(counts, examples, "INVOKES only in " + leftLabel + ": " + originOf(call.getValue().get(0), scannedTypes), call.getKey());
        }
        for (Map.Entry<String, List<Edge.Invokes>> call : rightCalls.entrySet()) {
            int missing = call.getValue().size() - leftCalls.getOrDefault(call.getKey(), List.of()).size();
            for (int i = 0; i < missing; i++) bump(counts, examples, "INVOKES only in " + rightLabel + ": " + originOf(call.getValue().get(0), scannedTypes), call.getKey());
        }
        for (Map.Entry<String, List<Edge.Invokes>> call : leftCalls.entrySet()) {
            List<Edge.Invokes> others = rightCalls.get(call.getKey());
            if (others == null) continue;
            for (int i = 0; i < Math.min(call.getValue().size(), others.size()); i++) {
                Edge.Invokes left = call.getValue().get(i);
                Edge.Invokes right = others.get(i);
                if (left.receiver() != right.receiver()) bump(counts, examples, "INVOKES receiver differs", call.getKey() + " (" + left.receiver() + " | " + right.receiver() + ")");
                if (!left.typeArguments().equals(right.typeArguments())) bump(counts, examples, "INVOKES typeArguments differ", call.getKey());
                if (left.site().viaClosure() != right.site().viaClosure()) bump(counts, examples, "INVOKES viaClosure differs", call.getKey());
                if (!left.site().languageSpecific().equals(right.site().languageSpecific())) bump(counts, examples, "INVOKES site bag differs", call.getKey());
                if (left.site().location().startLine() != right.site().location().startLine()) {
                    bump(counts, examples, "INVOKES on a different line", call.getKey() + " (" + left.site().location().startLine() + " | " + right.site().location().startLine() + ")");
                }
            }
        }
        Map<String, List<Edge.Accesses>> leftAccesses = accessesByKey(leftModel);
        Map<String, List<Edge.Accesses>> rightAccesses = accessesByKey(rightModel);
        for (Map.Entry<String, List<Edge.Accesses>> access : leftAccesses.entrySet()) {
            int missing = access.getValue().size() - rightAccesses.getOrDefault(access.getKey(), List.of()).size();
            for (int i = 0; i < missing; i++) bump(counts, examples, "ACCESSES only in " + leftLabel, access.getKey());
        }
        for (Map.Entry<String, List<Edge.Accesses>> access : rightAccesses.entrySet()) {
            int missing = access.getValue().size() - leftAccesses.getOrDefault(access.getKey(), List.of()).size();
            for (int i = 0; i < missing; i++) bump(counts, examples, "ACCESSES only in " + rightLabel, access.getKey());
        }
        for (Map.Entry<String, List<Edge.Accesses>> access : leftAccesses.entrySet()) {
            List<Edge.Accesses> others = rightAccesses.get(access.getKey());
            if (others == null) continue;
            for (int i = 0; i < Math.min(access.getValue().size(), others.size()); i++) {
                Edge.Accesses left = access.getValue().get(i);
                Edge.Accesses right = others.get(i);
                if (left.access() != right.access()) bump(counts, examples, "ACCESSES kind differs", access.getKey() + " (" + left.access() + " | " + right.access() + ")");
                if (left.receiver() != right.receiver()) bump(counts, examples, "ACCESSES receiver differs", access.getKey() + " (" + left.receiver() + " | " + right.receiver() + ")");
                if (left.site().location().startLine() != right.site().location().startLine()) {
                    bump(counts, examples, "ACCESSES on a different line", access.getKey() + " (" + left.site().location().startLine() + " | " + right.site().location().startLine() + ")");
                }
            }
        }
        Map<String, Long> leftUses = usesTypes(leftModel).collect(Collectors.groupingBy(e -> e.role().id() + " " + e.from() + " -> " + e.to().canonical(), TreeMap::new, Collectors.counting()));
        Map<String, Long> rightUses = usesTypes(rightModel).collect(Collectors.groupingBy(e -> e.role().id() + " " + e.from() + " -> " + e.to().canonical(), TreeMap::new, Collectors.counting()));
        for (Map.Entry<String, Long> use : leftUses.entrySet()) {
            long missing = use.getValue() - rightUses.getOrDefault(use.getKey(), 0L);
            for (long i = 0; i < missing; i++) bump(counts, examples, "USES_TYPE only in " + leftLabel + ": " + use.getKey().substring(0, use.getKey().indexOf(' ')), use.getKey());
        }
        for (Map.Entry<String, Long> use : rightUses.entrySet()) {
            long missing = use.getValue() - leftUses.getOrDefault(use.getKey(), 0L);
            for (long i = 0; i < missing; i++) bump(counts, examples, "USES_TYPE only in " + rightLabel + ": " + use.getKey().substring(0, use.getKey().indexOf(' ')), use.getKey());
        }
        differenceTable("Body edge differences (unfiltered; sites keyed by caller and target, paired in line order)", counts, examples);
    }

    private static String originOf(Edge.Invokes call, Set<NodeId> scannedTypes) {
        String path = call.to().canonicalPath();
        NodeId type = NodeId.of(vision.noesis.scanner.model.NodeKindLetter.TYPE, path.substring(0, path.indexOf('#')));
        if (call.site().languageSpecific().get("java.implicitSuperCall") != null) return "implicit super()";
        return scannedTypes.contains(type) ? "scanned target" : "external target";
    }

    /** Calls grouped by caller and target, each group in line order, so the n-th call of a target pairs with the n-th of the other engine. */
    private static Map<String, List<Edge.Invokes>> calls(CodeModelFile model) {
        Map<String, List<Edge.Invokes>> calls = new TreeMap<>();
        invokes(model).sorted(java.util.Comparator.comparingInt(e -> e.site().location().startLine())).forEach(e -> calls.computeIfAbsent(e.from() + " -> " + e.to(), k -> new ArrayList<>()).add(e));
        return calls;
    }

    private static Map<String, List<Edge.Accesses>> accessesByKey(CodeModelFile model) {
        Map<String, List<Edge.Accesses>> accesses = new TreeMap<>();
        accesses(model).sorted(java.util.Comparator.comparingInt(e -> e.site().location().startLine())).forEach(e -> accesses.computeIfAbsent(e.from() + " -> " + e.to(), k -> new ArrayList<>()).add(e));
        return accesses;
    }

    // --- Stubs and diagnostics ---------------------------------------------------------------------------------------

    private void stubAndDiagnosticDifferences(String leftLabel, CodeModelFile leftModel, String rightLabel, CodeModelFile rightModel) {
        Map<String, Long> counts = new TreeMap<>();
        Map<String, List<String>> examples = new TreeMap<>();
        Map<NodeId, StubNode> left = leftModel.stubs().stream().collect(Collectors.toMap(StubNode::id, s -> s));
        Map<NodeId, StubNode> right = rightModel.stubs().stream().collect(Collectors.toMap(StubNode::id, s -> s));
        for (NodeId id : new TreeSet<>(left.keySet())) {
            if (!right.containsKey(id)) bump(counts, examples, "stub only in " + leftLabel, id.value());
            else if (!left.get(id).equals(right.get(id))) bump(counts, examples, "stub differs", id.value() + " (" + left.get(id) + " | " + right.get(id) + ")");
        }
        for (NodeId id : new TreeSet<>(right.keySet())) if (!left.containsKey(id)) bump(counts, examples, "stub only in " + rightLabel, id.value());
        differenceTable("Stub differences (unfiltered)", counts, examples);
    }

    // --- Rendering ---------------------------------------------------------------------------------------------------

    /** A table with the first column as given and one right-aligned column per engine label. */
    private void table(String title, String firstColumn, List<String> labels, List<String[]> rows) {
        out.append("\n### ").append(title).append("\n\n| ").append(firstColumn).append(" |");
        for (String label : labels) out.append(" ").append(label).append(" |");
        out.append("\n| --- |");
        for (int i = 0; i < labels.size(); i++) out.append(" ---: |");
        out.append("\n");
        for (String[] row : rows) {
            out.append("|");
            for (String cell : row) out.append(" ").append(cell).append(" |");
            out.append("\n");
        }
    }

    private void differenceTable(String title, Map<String, Long> counts, Map<String, List<String>> examples) {
        out.append("\n#### ").append(title).append("\n\n");
        if (counts.isEmpty()) {
            out.append("None.\n");
            return;
        }
        out.append("| Difference | Count | First examples |\n| --- | ---: | --- |\n");
        for (Map.Entry<String, Long> entry : counts.entrySet()) {
            out.append("| ").append(entry.getKey()).append(" | ").append(entry.getValue()).append(" | ")
                    .append(examples.get(entry.getKey()).stream().map(e -> "`" + e.replace("|", "\\|") + "`").collect(Collectors.joining("<br>"))).append(" |\n");
        }
    }

    /** One inventory row: the measure of every engine's model in turn, {@code -} where the engine has none. */
    private static String[] row(String label, List<CodeModelFile> models, Function<CodeModelFile, Long> measure) {
        String[] row = new String[models.size() + 1];
        row[0] = label;
        for (int i = 0; i < models.size(); i++) row[i + 1] = models.get(i) == null ? "-" : String.valueOf(measure.apply(models.get(i)));
        return row;
    }

    private static void bump(Map<String, Long> counts, Map<String, List<String>> examples, String category, String example) {
        counts.merge(category, 1L, Long::sum);
        List<String> list = examples.computeIfAbsent(category, k -> new ArrayList<>());
        if (list.size() < 3) list.add(example);
    }

    private static long count(List<?> items, Class<?> kind) {
        return items.stream().filter(kind::isInstance).count();
    }

    private static java.util.stream.Stream<MethodNode> methods(CodeModelFile model) {
        return model.nodes().stream().filter(MethodNode.class::isInstance).map(MethodNode.class::cast);
    }

    private static java.util.stream.Stream<Edge.Invokes> invokes(CodeModelFile model) {
        return model.edges().stream().filter(Edge.Invokes.class::isInstance).map(Edge.Invokes.class::cast);
    }

    private static java.util.stream.Stream<Edge.Accesses> accesses(CodeModelFile model) {
        return model.edges().stream().filter(Edge.Accesses.class::isInstance).map(Edge.Accesses.class::cast);
    }

    private static java.util.stream.Stream<Edge.UsesType> usesTypes(CodeModelFile model) {
        return model.edges().stream().filter(Edge.UsesType.class::isInstance).map(Edge.UsesType.class::cast);
    }

    private static Map<NodeId, DeclarationNode> byId(CodeModelFile model) {
        Map<NodeId, DeclarationNode> nodes = new LinkedHashMap<>();
        for (DeclarationNode node : model.nodes()) nodes.put(node.id(), node);
        return nodes;
    }

    private static String sorted(List<? extends Enum<?>> values) {
        return values.stream().map(Enum::name).sorted().collect(Collectors.joining(","));
    }

    private static String typeParameters(List<TypeParameter> parameters) {
        return parameters.stream().map(p -> p.name() + "@" + p.ordinal() + p.constraints().stream()
                .map(c -> c instanceof TypeParameterConstraint.TypeConstraint t ? t.type().canonical() : c.toString()).collect(Collectors.toList())
                + p.annotations().stream().map(a -> a.type().canonical()).collect(Collectors.toList())).collect(Collectors.joining(", "));
    }

    static String canonical(TypeRef type) {
        return type.canonical();
    }
}
