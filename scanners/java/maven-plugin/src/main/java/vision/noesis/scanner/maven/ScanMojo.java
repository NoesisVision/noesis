package vision.noesis.scanner.maven;

import java.io.File;
import java.nio.file.Path;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugins.annotations.LifecyclePhase;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;
import org.apache.maven.plugins.annotations.ResolutionScope;
import org.apache.maven.project.MavenProject;
import vision.noesis.scanner.core.JavaScanner;
import vision.noesis.scanner.core.config.ScanConfig;
import vision.noesis.scanner.core.export.JsonGraphWriter;
import vision.noesis.scanner.core.model.Graph;

/**
 * Scans the module's compiled classes and writes the building-block graph
 * to {@code target/noesis/graph.json}. Binds after compilation.
 */
@Mojo(name = "scan",
        defaultPhase = LifecyclePhase.PROCESS_CLASSES,
        requiresDependencyResolution = ResolutionScope.COMPILE,
        threadSafe = true)
public class ScanMojo extends AbstractMojo {

    @Parameter(defaultValue = "${project}", readonly = true, required = true)
    private MavenProject project;

    @Parameter(property = "noesis.skip", defaultValue = "false")
    private boolean skip;

    @Parameter(property = "noesis.outputFile",
            defaultValue = "${project.build.directory}/noesis/graph.json")
    private File outputFile;

    @Override
    public void execute() {
        if (skip || "pom".equals(project.getPackaging())) {
            getLog().info("Noesis scan skipped");
            return;
        }
        Path classesDir = Path.of(project.getBuild().getOutputDirectory());
        if (!classesDir.toFile().isDirectory()) {
            getLog().info("No compiled classes at " + classesDir + " — nothing to scan");
            return;
        }

        Graph graph = new JavaScanner().scan(ScanConfig.of(classesDir, project.getArtifactId()));
        new JsonGraphWriter().write(graph, outputFile.toPath());
        getLog().info("Noesis graph: " + graph.nodes().size() + " nodes, "
                + graph.edges().size() + " edges -> " + outputFile);
    }
}
