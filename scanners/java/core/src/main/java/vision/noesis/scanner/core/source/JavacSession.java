package vision.noesis.scanner.core.source;

import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.util.DocTrees;
import com.sun.source.util.JavacTask;
import com.sun.source.util.Trees;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;
import javax.lang.model.util.Elements;
import javax.lang.model.util.Types;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.StandardLocation;
import javax.tools.ToolProvider;
import vision.noesis.scanner.core.ArtifactInput;
import vision.noesis.scanner.core.ClasspathEntry;

/** One javac run over an artifact's sources: parsed and attributed trees, the symbol tables, the compiler's diagnostics. */
final class JavacSession implements AutoCloseable {

    private final StandardJavaFileManager fileManager;
    private final JavacTask task;
    private final DiagnosticCollector<JavaFileObject> diagnostics;
    private final List<CompilationUnitTree> units;
    private final Map<URI, CompilationUnitTree> unitsByUri = new HashMap<>();
    private final Trees trees;
    private final DocTrees docTrees;
    private final Elements elements;
    private final Types types;

    private JavacSession(StandardJavaFileManager fileManager, JavacTask task, DiagnosticCollector<JavaFileObject> diagnostics, List<CompilationUnitTree> units) {
        this.fileManager = fileManager;
        this.task = task;
        this.diagnostics = diagnostics;
        this.units = units;
        for (CompilationUnitTree unit : units) unitsByUri.put(unit.getSourceFile().toUri(), unit);
        this.trees = Trees.instance(task);
        this.docTrees = DocTrees.instance(task);
        this.elements = task.getElements();
        this.types = task.getTypes();
    }

    /** Null when the running JVM has no compiler (a JRE). */
    static JavacSession open(ArtifactInput input) throws IOException {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) return null;
        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        StandardJavaFileManager fileManager = compiler.getStandardFileManager(diagnostics, Locale.ENGLISH, input.encoding());
        fileManager.setLocationFromPaths(StandardLocation.CLASS_PATH, classpathWithoutOwnClasses(input));
        List<Path> sources = sourceFiles(input.sourceRoots());
        Iterable<? extends JavaFileObject> files = fileManager.getJavaFileObjectsFromPaths(sources);
        List<String> options = new ArrayList<>(List.of(
                "-proc:none",
                "--release", Integer.toString(input.release()),
                "-implicit:none",
                "-Xmaxerrs", "100000",
                "-Xmaxwarns", "100000",
                "-encoding", input.encoding().name()));
        JavacTask task = (JavacTask) compiler.getTask(null, fileManager, diagnostics, options, null, files);
        List<CompilationUnitTree> units = new ArrayList<>();
        task.parse().forEach(units::add);
        task.analyze();
        return new JavacSession(fileManager, task, diagnostics, units);
    }

    /** Sources bind to sources: the module's own classes would shadow them with a stale copy. */
    private static List<Path> classpathWithoutOwnClasses(ArtifactInput input) {
        Path own = input.outputDirectory().toAbsolutePath().normalize();
        List<Path> paths = new ArrayList<>();
        for (ClasspathEntry entry : input.classpath()) {
            if (!entry.path().toAbsolutePath().normalize().equals(own)) paths.add(entry.path());
        }
        return paths;
    }

    private static List<Path> sourceFiles(List<Path> roots) throws IOException {
        List<Path> files = new ArrayList<>();
        for (Path root : roots) {
            if (!Files.isDirectory(root)) continue;
            try (Stream<Path> walk = Files.walk(root)) {
                walk.filter(path -> path.toString().endsWith(".java") && Files.isRegularFile(path)).forEach(files::add);
            }
        }
        files.sort(null);
        return files;
    }

    List<CompilationUnitTree> units() {
        return units;
    }

    CompilationUnitTree unitOf(URI uri) {
        return unitsByUri.get(uri);
    }

    List<Diagnostic<? extends JavaFileObject>> diagnostics() {
        return diagnostics.getDiagnostics();
    }

    Trees trees() {
        return trees;
    }

    DocTrees docTrees() {
        return docTrees;
    }

    Elements elements() {
        return elements;
    }

    Types types() {
        return types;
    }

    /** Where a classpath type was read from, or null when the file manager does not know. */
    URI classFileOf(String binaryName) {
        try {
            JavaFileObject file = fileManager.getJavaFileForInput(StandardLocation.CLASS_PATH, binaryName, JavaFileObject.Kind.CLASS);
            return file == null ? null : file.toUri();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    String sourceText(CompilationUnitTree unit) {
        try {
            return unit.getSourceFile().getCharContent(true).toString();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public void close() throws IOException {
        fileManager.close();
    }
}
