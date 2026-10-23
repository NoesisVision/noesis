package vision.noesis.parser.model;

/** Passed in by the server; the parser does not read git. */
public record RepositoryInfo(String name, String revision) {}
