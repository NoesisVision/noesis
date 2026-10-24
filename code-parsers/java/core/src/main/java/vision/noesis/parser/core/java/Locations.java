package vision.noesis.parser.core.java;

import java.nio.file.Path;
import vision.noesis.parser.model.SourceSpan;

/** Repository-relative, forward-slash file paths; a path outside the repository stays absolute. */
public final class Locations {

    private final Path repositoryRoot;

    public Locations(Path repositoryRoot) {
        this.repositoryRoot = repositoryRoot.toAbsolutePath().normalize();
    }

    public Path repositoryRoot() {
        return repositoryRoot;
    }

    public String relativePath(Path path) {
        Path full = path.toAbsolutePath().normalize();
        String relative = full.startsWith(repositoryRoot) ? repositoryRoot.relativize(full).toString() : full.toString();
        return relative.replace('\\', '/');
    }

    /** A location known by file and line only, as bytecode gives it: columns 0, end on the same line. */
    public SourceSpan lineOnly(Path file, int line) {
        return new SourceSpan(relativePath(file), line, 0, line, 0);
    }
}
