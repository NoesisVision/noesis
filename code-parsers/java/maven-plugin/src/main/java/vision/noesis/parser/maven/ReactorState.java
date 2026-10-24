package vision.noesis.parser.maven;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.WeakHashMap;
import java.util.function.BiFunction;
import org.apache.maven.execution.MavenExecutionRequest;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.project.MavenProject;
import vision.noesis.parser.model.CodeModelWriter;
import vision.noesis.parser.model.Diagnostic;
import vision.noesis.parser.model.Language;
import vision.noesis.parser.model.ManifestArtifact;
import vision.noesis.parser.model.ParseManifest;

/**
 * What the modules of one reactor build share: the files written so far in reactor order, so the manifest is complete
 * after the last module and partial after a stopped build. Under {@code -T} modules finish in parallel, so the manifest
 * is written under the same lock that records them.
 */
final class ReactorState {

    /**
     * By the build's request, which every module's session shares (older Maven clones the session per module). Not the
     * top-level project's plugin context: {@link MavenSession#getPluginContext} creates it without a lock, so two
     * modules starting together under {@code -T} could each get a context, and a state, of their own. Weak, so a
     * long-lived JVM (mvnd) lets a finished build's state go.
     */
    private static final Map<MavenExecutionRequest, ReactorState> BY_BUILD = Collections.synchronizedMap(new WeakHashMap<>());

    private final List<MavenProject> order;
    private final Map<Integer, ManifestArtifact> written = new TreeMap<>();
    private final Set<String> usedFileNames = new HashSet<>();
    private final List<Diagnostic> diagnostics = new ArrayList<>();

    private ReactorState(List<MavenProject> order) {
        this.order = order;
    }

    static ReactorState of(MavenSession session) {
        return BY_BUILD.computeIfAbsent(session.getRequest(), request -> new ReactorState(session.getProjects()));
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
