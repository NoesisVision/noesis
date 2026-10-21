package vision.noesis.scanner.maven;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.plugin.descriptor.PluginDescriptor;
import org.apache.maven.project.MavenProject;
import vision.noesis.scanner.model.CodeModelWriter;
import vision.noesis.scanner.model.Diagnostic;
import vision.noesis.scanner.model.Language;
import vision.noesis.scanner.model.ManifestArtifact;
import vision.noesis.scanner.model.NodeId;

/**
 * What the modules of one reactor build share through the plugin context of the top-level project: the files written so
 * far in reactor order, so the manifest is complete after the last module and partial after a stopped build.
 */
final class ReactorState {

    private static final String KEY = ReactorState.class.getName();

    private final List<MavenProject> order;
    private final Map<Integer, ManifestArtifact> written = new TreeMap<>();
    private final Set<String> usedFileNames = new HashSet<>();
    private final List<Diagnostic> diagnostics = new ArrayList<>();
    private boolean started;

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

    /** True exactly once per build: the first module to run clears the previous scan's output. */
    synchronized boolean start() {
        if (started) return false;
        started = true;
        return true;
    }

    /** Reserves the file name for a module's model, {@code ~2} when another module of the same name came first. */
    synchronized String fileFor(MavenProject project, NodeId artifactId) {
        String name = project.getArtifactId();
        String candidate = name;
        for (int i = 2; !usedFileNames.add(candidate.toLowerCase(Locale.ROOT)); i++) candidate = name + "~" + i;
        String file = CodeModelWriter.artifactFile(Language.JAVA, candidate);
        written.put(order.indexOf(project), new ManifestArtifact(artifactId, file));
        return file;
    }

    synchronized void diagnostic(Diagnostic diagnostic) {
        diagnostics.add(diagnostic);
    }

    /** The modules scanned so far, in reactor order. */
    synchronized List<ManifestArtifact> artifacts() {
        return new ArrayList<>(written.values());
    }

    synchronized List<Diagnostic> diagnostics() {
        return new ArrayList<>(diagnostics);
    }
}
