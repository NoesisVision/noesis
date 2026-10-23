package vision.noesis.parser.core.java;

import java.io.Closeable;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.nio.file.FileSystem;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * The JDK's class files of one release, read from the running JDK's {@code lib/ct.sym} the way {@code javac --release}
 * does. The bytecode engine resolves JDK classes through them, so it binds the same JDK API as the source engine
 * whatever JDK runs the parse: a parse for release 17 never sees {@code java.util.SequencedCollection}.
 *
 * <p>{@code ct.sym} is a zip of stripped class files ({@code .sig}) under one directory per set of releases, named by
 * one character per release ({@code 8}, {@code 9}, {@code A} for 10 and so on, {@code BCD} for a file identical in
 * 11, 12 and 13), then the module and the package path. A class is extracted to a temporary directory on first use,
 * because ArchUnit imports from URLs, and the directory is deleted on close.
 */
public final class ReleaseClassFiles implements Closeable {

    private final int release;
    private final FileSystem ctSym;
    private final Map<String, Entry> index;
    private final Path extracted;
    private final Map<String, Optional<URL>> urls = new HashMap<>();

    private record Entry(String module, Path sig) {}

    private ReleaseClassFiles(int release, FileSystem ctSym, Map<String, Entry> index, Path extracted) {
        this.release = release;
        this.ctSym = ctSym;
        this.index = index;
        this.extracted = extracted;
    }

    /**
     * The release's class files, or empty when the running JDK has no {@code ct.sym} or none for that release. A JDK
     * keeps no signatures of its own release (javac reads them from the runtime image), so a parse for the running
     * JDK's release gets empty too, and the engine reads the running JDK, which is the same API.
     */
    public static Optional<ReleaseClassFiles> open(int release) {
        Path ctSym = Path.of(System.getProperty("java.home"), "lib", "ct.sym");
        if (!Files.isRegularFile(ctSym)) return Optional.empty();
        FileSystem fs = null;
        try {
            fs = FileSystems.newFileSystem(ctSym);
            Map<String, Entry> index = index(fs, codeOf(release));
            if (index.isEmpty()) {
                fs.close();
                return Optional.empty();
            }
            Path extracted = Files.createTempDirectory("noesis-jdk" + release + "-");
            return Optional.of(new ReleaseClassFiles(release, fs, index, extracted));
        } catch (IOException | RuntimeException e) {
            closeQuietly(fs);
            return Optional.empty();
        }
    }

    /** The character naming a release in {@code ct.sym}'s directory names. */
    static char codeOf(int release) {
        return release < 10 ? (char) ('0' + release) : (char) ('A' + release - 10);
    }

    private static Map<String, Entry> index(FileSystem fs, char code) throws IOException {
        Map<String, Entry> index = new HashMap<>();
        for (Path root : fs.getRootDirectories()) {
            for (Path versions : list(root)) {
                if (!Files.isDirectory(versions) || versions.getFileName().toString().indexOf(code) < 0) continue;
                for (Path module : list(versions)) {
                    if (!Files.isDirectory(module)) continue;
                    String moduleName = module.getFileName().toString();
                    try (Stream<Path> files = Files.walk(module)) {
                        files.filter(file -> file.toString().endsWith(".sig")).forEach(file -> {
                            String relative = module.relativize(file).toString();
                            index.putIfAbsent(relative.substring(0, relative.length() - ".sig".length()), new Entry(moduleName, file));
                        });
                    }
                }
            }
        }
        return index;
    }

    private static List<Path> list(Path directory) throws IOException {
        try (Stream<Path> children = Files.list(directory)) {
            return children.sorted().toList();
        }
    }

    public int release() {
        return release;
    }

    /** The URL of a class resource ({@code java/util/List.class}) in this release; empty for any other resource or a class the release lacks. */
    public Optional<URL> resource(String resourceName) {
        if (!resourceName.endsWith(".class")) return Optional.empty();
        return urls.computeIfAbsent(resourceName, this::extract);
    }

    private Optional<URL> extract(String resourceName) {
        Entry entry = index.get(resourceName.substring(0, resourceName.length() - ".class".length()));
        if (entry == null) return Optional.empty();
        try {
            Path target = extracted.resolve(entry.module()).resolve(resourceName.replace('/', extracted.getFileSystem().getSeparator().charAt(0)));
            Files.createDirectories(target.getParent());
            Files.copy(entry.sig(), target, StandardCopyOption.REPLACE_EXISTING);
            return Optional.of(target.toUri().toURL());
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    /** The JDK module of a class file extracted here, by its URI; empty for any other URI. */
    public Optional<String> moduleOf(URI uri) {
        if (!"file".equals(uri.getScheme())) return Optional.empty();
        Path path = Path.of(uri).toAbsolutePath().normalize();
        Path root = extracted.toAbsolutePath().normalize();
        if (!path.startsWith(root) || path.getNameCount() <= root.getNameCount()) return Optional.empty();
        return Optional.of(path.getName(root.getNameCount()).toString());
    }

    @Override
    public void close() {
        closeQuietly(ctSym);
        try (Stream<Path> files = Files.walk(extracted)) {
            for (Path file : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(file);
        } catch (IOException e) {
            // A leftover temporary directory is not worth failing the parse.
        }
    }

    private static void closeQuietly(FileSystem fs) {
        if (fs == null) return;
        try {
            fs.close();
        } catch (IOException e) {
            // Nothing to do about a zip that will not close.
        }
    }
}
