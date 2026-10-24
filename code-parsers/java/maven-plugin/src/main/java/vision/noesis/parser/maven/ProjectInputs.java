package vision.noesis.parser.maven;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.maven.artifact.Artifact;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.model.Plugin;
import org.apache.maven.model.PluginExecution;
import org.apache.maven.project.MavenProject;
import org.codehaus.plexus.util.xml.Xpp3Dom;
import vision.noesis.parser.core.ArtifactInput;
import vision.noesis.parser.core.ClasspathEntry;
import vision.noesis.parser.core.java.JavaIds;
import vision.noesis.parser.model.ArtifactDependency;
import vision.noesis.parser.model.ArtifactKind;
import vision.noesis.parser.model.PackageReference;

/** What the engines need about a Maven module, read off the resolved project. */
final class ProjectInputs {

    private ProjectInputs() {}

    static ArtifactInput of(MavenProject project, MavenSession session, Integer release) {
        Set<String> reactor = new HashSet<>();
        for (MavenProject other : session.getProjects()) reactor.add(other.getGroupId() + ":" + other.getArtifactId());
        List<String> names = moduleNames(session);
        List<ClasspathEntry> classpath = new ArrayList<>();
        for (Artifact artifact : project.getArtifacts()) {
            if (artifact.getFile() == null || Artifact.SCOPE_TEST.equals(artifact.getScope())) continue;
            classpath.add(new ClasspathEntry(artifact.getFile().toPath(), dependencyOf(artifact, reactor, names)));
        }
        List<Path> sourceRoots = new ArrayList<>();
        for (String root : project.getCompileSourceRoots()) sourceRoots.add(Path.of(root));
        return new ArtifactInput(
                project.getGroupId(),
                project.getArtifactId(),
                project.getVersion(),
                project.getBasedir().toPath(),
                project.getFile() == null ? null : project.getFile().toPath(),
                sourceRoots,
                Path.of(project.getBuild().getOutputDirectory()),
                classpath,
                release != null ? release : releaseOf(project, session.getUserProperties()),
                encodingOf(project),
                project.getPackaging(),
                mainClassOf(project, session.getUserProperties()),
                uniqueName(project.getGroupId(), project.getArtifactId(), names),
                Path.of(project.getBuild().getDirectory()));
    }

    /** The artifact ids of the reactor's parsed modules (every packaging but {@code pom}), once per module. */
    static List<String> moduleNames(MavenSession session) {
        List<String> names = new ArrayList<>();
        for (MavenProject other : session.getProjects()) {
            if (!"pom".equals(other.getPackaging())) names.add(other.getArtifactId());
        }
        return names;
    }

    /** The module's artifact id, or {@code groupId:artifactId} when another module of the reactor has the same artifact id. */
    static String uniqueName(String groupId, String artifactId, List<String> names) {
        return JavaIds.moduleName(artifactId, groupId + ":" + artifactId, names);
    }

    /** A reactor sibling is a source artifact; anything else is a library named by its Maven coordinates. */
    private static ArtifactDependency dependencyOf(Artifact artifact, Set<String> reactor, List<String> names) {
        if (reactor.contains(artifact.getGroupId() + ":" + artifact.getArtifactId())) {
            return new ArtifactDependency(JavaIds.artifact(uniqueName(artifact.getGroupId(), artifact.getArtifactId(), names)), ArtifactKind.SOURCE, null);
        }
        String packageId = artifact.getGroupId() + ":" + artifact.getArtifactId() + (artifact.getClassifier() == null || artifact.getClassifier().isEmpty() ? "" : ":" + artifact.getClassifier());
        String version = artifact.getBaseVersion() == null ? artifact.getVersion() : artifact.getBaseVersion();
        return new ArtifactDependency(JavaIds.libraryArtifact(packageId, version), ArtifactKind.LIBRARY, new PackageReference(packageId, version));
    }

    /**
     * The compiler plugin's {@code release}, else its {@code target}, else its {@code source}, else the running JVM. Each
     * is read as the compiler plugin reads it: its {@code default-compile} execution's configuration, else the plugin's,
     * else the {@code maven.compiler.*} property from the command line, else from the POM.
     */
    static int releaseOf(MavenProject project, Properties userProperties) {
        Plugin compiler = project.getPlugin("org.apache.maven.plugins:maven-compiler-plugin");
        PluginExecution compile = compiler == null ? null : compiler.getExecutionsAsMap().get("default-compile");
        for (String parameter : List.of("release", "target", "source")) {
            String configured = compile == null ? null : valueAt(compile.getConfiguration(), parameter);
            if (configured == null && compiler != null) configured = valueAt(compiler.getConfiguration(), parameter);
            String value = configured != null ? interpolated(configured, project, userProperties) : property("maven.compiler." + parameter, project, userProperties);
            if (value == null) continue;
            String feature = value.startsWith("1.") ? value.substring(2) : value;
            try {
                return Integer.parseInt(feature.trim());
            } catch (NumberFormatException ignored) {
                // Not a number: try the next parameter.
            }
        }
        return Runtime.version().feature();
    }

    private static Charset encodingOf(MavenProject project) {
        String encoding = project.getProperties().getProperty("project.build.sourceEncoding");
        try {
            return encoding == null || encoding.isBlank() ? StandardCharsets.UTF_8 : Charset.forName(encoding.trim());
        } catch (IllegalArgumentException e) {
            return StandardCharsets.UTF_8;
        }
    }

    /**
     * The jar plugin's {@code archive/manifest/mainClass} or the Spring Boot plugin's {@code mainClass}, with
     * {@code ${property}} references resolved from the command line's and the project's properties; null when none is
     * configured or a reference is unresolved (the Spring Boot parent's {@code ${start-class}} when the project does not
     * set it).
     */
    private static String mainClassOf(MavenProject project, Properties userProperties) {
        String jarMain = configured(project.getPlugin("org.apache.maven.plugins:maven-jar-plugin"), "archive", "manifest", "mainClass");
        String configured = jarMain != null ? jarMain : configured(project.getPlugin("org.springframework.boot:spring-boot-maven-plugin"), "mainClass");
        return configured == null ? null : interpolated(configured, project, userProperties);
    }

    /** The value with its {@code ${property}} references resolved as Maven resolves a plugin parameter; null when one is unresolved. */
    private static String interpolated(String value, MavenProject project, Properties userProperties) {
        Matcher matcher = PROPERTY_REFERENCE.matcher(value);
        StringBuilder resolved = new StringBuilder();
        while (matcher.find()) {
            String property = property(matcher.group(1), project, userProperties);
            if (property == null) return null;
            matcher.appendReplacement(resolved, Matcher.quoteReplacement(property));
        }
        matcher.appendTail(resolved);
        return resolved.toString();
    }

    /** A property from the command line, else from the POM; null when neither sets it. */
    private static String property(String name, MavenProject project, Properties userProperties) {
        String value = userProperties.getProperty(name);
        if (value == null || value.isBlank()) value = project.getProperties().getProperty(name);
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static final Pattern PROPERTY_REFERENCE = Pattern.compile("\\$\\{([^}]+)}");

    private static String configured(Plugin plugin, String... path) {
        return plugin == null ? null : valueAt(plugin.getConfiguration(), path);
    }

    private static String valueAt(Object configuration, String... path) {
        if (!(configuration instanceof Xpp3Dom dom)) return null;
        Xpp3Dom current = dom;
        for (String step : path) {
            current = current.getChild(step);
            if (current == null) return null;
        }
        String value = current.getValue();
        return value == null || value.isBlank() ? null : value.trim();
    }
}
