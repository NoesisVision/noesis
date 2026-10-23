package vision.noesis.parser.maven;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.BiFunction;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.plugin.descriptor.PluginDescriptor;
import org.apache.maven.project.MavenProject;
import vision.noesis.parser.model.CodeModelWriter;
import vision.noesis.parser.model.Diagnostic;
import vision.noesis.parser.model.Language;
import vision.noesis.parser.model.ManifestArtifact;
import vision.noesis.parser.model.ParseManifest;

/**
 * What the modules of one reactor build share through the plugin context of the top-level project: the files written so
 * far in reactor order, so the manifest is complete after the last module and partial after a stopped build. Under
 * {@code -T} modules finish in parallel, so the manifest is written under the same lock that records them.
 */
final class ReactorState {

    private static final String KEY = ReactorState.class.getName();

    private final List<MavenProject> order;
    private final Map<Integer, ManifestArtifact> written = new TreeMap<>();
    private final Set<String> usedFileNames = new HashSet<>();
    private final List<Diagnostic> diagnostics = new ArrayList<>();

    private ReactorState(List<MavenProject> order) {
        this.order = order;
    }

    @SuppressWarnings("unchecked")
    static ReactorState of(MavenSession session, PluginDescriptor plugin) {
        Map<String, Object> context = session.getPluginContext(plugin, session.getTopLevelProject());
        synchronized (context) {
            return (ReactorState) context.computeIfAbsent(KEY, key -> new ReactorState(session.getProjects()));
        }
    }

    /** Reserves the file name for a module's model, {@code ~2} when another module of the same name came first. */
    synchronized String fileFor(MavenProject project) {
        String name = project.getArtifactId();
        String candidate = name;
        for (int i = 2; !usedFileNames.add(candidate.toLowerCase(Locale.ROOT)); i++) candidate = name + "~" + i;
        return CodeModelWriter.artifactFile(Language.JAVA, candidate);
    }

    /** Records a module whose model file is complete, so the manifest never lists a file still being written. */
    synchronized void written(MavenProject project, ManifestArtifact artifact) {
        written.put(order.indexOf(project), artifact);
    }

    synchronized void diagnostic(Diagnostic diagnostic) {
        diagnostics.add(diagnostic);
    }

    /**
     * Writes the manifest of the modules written so far, in reactor order. One module at a time, so a module that
     * finishes later never overwrites the list with an older one.
     */
    synchronized void writeManifest(Path outputRoot, BiFunction<List<ManifestArtifact>, List<Diagnostic>, ParseManifest> manifest)
            throws IOException {
        CodeModelWriter.writeManifest(outputRoot, manifest.apply(new ArrayList<>(written.values()), new ArrayList<>(diagnostics)));
    }
}
