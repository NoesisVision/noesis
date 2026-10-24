package vision.noesis.parser.core.bytecode;

import java.io.IOException;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.Optional;
import vision.noesis.parser.core.java.ReleaseClassFiles;

/**
 * The class loader ArchUnit resolves referenced classes through ({@link #getResource}): the JDK of the module's
 * release first, as javac's boot class path comes first, then the compile classpath. Without the release's class
 * files the running JDK's platform loader stands in for the JDK.
 */
final class ParseClassLoader extends URLClassLoader {

    private final ReleaseClassFiles release;

    ParseClassLoader(URL[] classpath, ReleaseClassFiles release) {
        super(classpath, ClassLoader.getPlatformClassLoader());
        this.release = release;
    }

    @Override
    public URL getResource(String name) {
        if (release == null || !name.endsWith(".class")) return super.getResource(name);
        Optional<URL> fromRelease = release.resource(name);
        return fromRelease.isPresent() ? fromRelease.get() : findResource(name);
    }

    @Override
    public Enumeration<URL> getResources(String name) throws IOException {
        if (release == null || !name.endsWith(".class")) return super.getResources(name);
        Optional<URL> fromRelease = release.resource(name);
        return fromRelease.isPresent() ? Collections.enumeration(List.of(fromRelease.get())) : findResources(name);
    }
}
