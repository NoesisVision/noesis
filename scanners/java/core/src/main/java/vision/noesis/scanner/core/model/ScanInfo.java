package vision.noesis.scanner.core.model;

/** Provenance of a scan; {@code timestamp} is ISO-8601. */
public record ScanInfo(
        String tool,
        String version,
        String timestamp,
        String module) {
}
