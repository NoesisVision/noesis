package vision.noesis.scanner.core.config;

import java.nio.file.Path;
import java.util.List;

/** Input to a scan; build-tool adapters construct this from project metadata. */
public record ScanConfig(
        List<Path> classDirs,
        String moduleName,
        StereotypeMapping stereotypes) {

    public static ScanConfig of(Path classDir, String moduleName) {
        return new ScanConfig(List.of(classDir), moduleName, StereotypeMapping.defaults());
    }
}
