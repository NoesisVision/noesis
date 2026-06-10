package vision.noesis.scanner.core;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import vision.noesis.scanner.core.config.ScanConfig;
import vision.noesis.scanner.core.derive.BehaviourDeriver;
import vision.noesis.scanner.core.derive.Derived;
import vision.noesis.scanner.core.derive.InvocationDeriver;
import vision.noesis.scanner.core.derive.MessageEdgeDeriver;
import vision.noesis.scanner.core.derive.ModuleDeriver;
import vision.noesis.scanner.core.derive.PortBindingDeriver;
import vision.noesis.scanner.core.detect.StereotypeDetector;
import vision.noesis.scanner.core.model.Edge;
import vision.noesis.scanner.core.model.Graph;
import vision.noesis.scanner.core.model.Node;
import vision.noesis.scanner.core.model.ScanInfo;

/**
 * Facade: imports compiled classes with ArchUnit, detects annotated building
 * blocks and messages, derives behaviours and relations (design-doc §9.4).
 */
public final class JavaScanner {

    public Graph scan(ScanConfig config) {
        JavaClasses classes = new ClassFileImporter().importPaths(config.classDirs());

        Map<JavaClass, Node> classNodes = new StereotypeDetector(config.stereotypes()).detect(classes);

        Derived derived = new ModuleDeriver().derive(classNodes);
        Map<JavaMethod, Node> behaviours = new BehaviourDeriver().derive(classNodes, derived);
        new InvocationDeriver().derive(behaviours, derived);
        new MessageEdgeDeriver().derive(behaviours, classNodes, derived);
        new PortBindingDeriver().derive(classNodes, derived);

        List<Node> nodes = new ArrayList<>(derived.nodes);
        nodes.addAll(classNodes.values());
        List<Edge> edges = List.copyOf(derived.edges);

        return new Graph(scanInfo(config.moduleName()), List.copyOf(nodes), edges);
    }

    private static ScanInfo scanInfo(String moduleName) {
        String version = JavaScanner.class.getPackage().getImplementationVersion();
        return new ScanInfo(
                "noesis-java-scanner",
                version != null ? version : "dev",
                Instant.now().toString(),
                moduleName);
    }
}
