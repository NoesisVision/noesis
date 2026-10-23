package vision.noesis.scanner.model;

/** Passed in by the server; the scanner does not read git. */
public record RepositoryInfo(String name, String revision) {}
