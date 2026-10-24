package vision.noesis.parser.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.io.StringReader;
import java.util.Properties;
import org.apache.maven.model.Build;
import org.apache.maven.model.Model;
import org.apache.maven.model.Plugin;
import org.apache.maven.model.PluginExecution;
import org.apache.maven.project.MavenProject;
import org.codehaus.plexus.util.xml.Xpp3DomBuilder;
import org.codehaus.plexus.util.xml.pull.XmlPullParserException;
import org.junit.jupiter.api.Test;

/**
 * The release the sources are bound against is the one the compiler plugin compiles them for, wherever the build sets
 * it, not the JDK Maven runs on.
 */
class ProjectInputsTest {

    private final Model model = new Model();
    private final Properties userProperties = new Properties();

    @Test
    void theCompilerPluginsReleaseIsTheRelease() throws Exception {
        compilerConfiguration("<release>11</release>");
        assertEquals(11, release());
    }

    @Test
    void theCompilerPluginsTargetIsTheReleaseWithoutOne() throws Exception {
        compilerConfiguration("<source>1.8</source><target>1.8</target>");
        assertEquals(8, release());
    }

    @Test
    void theCompilerPluginsSourceIsTheReleaseWithoutATarget() throws Exception {
        compilerConfiguration("<source>11</source>");
        assertEquals(11, release());
    }

    @Test
    void aPropertyReferenceInTheConfigurationIsResolved() throws Exception {
        model.addProperty("jdk", "21");
        compilerConfiguration("<release>${jdk}</release>");
        assertEquals(21, release());
    }

    @Test
    void theDefaultCompileExecutionWinsOverThePlugin() throws Exception {
        Plugin compiler = compilerConfiguration("<release>11</release>");
        PluginExecution compile = new PluginExecution();
        compile.setId("default-compile");
        compile.setConfiguration(Xpp3DomBuilder.build(new StringReader("<configuration><release>21</release></configuration>")));
        compiler.addExecution(compile);
        assertEquals(21, release());
    }

    @Test
    void theConfigurationWinsOverTheProperty() throws Exception {
        userProperties.setProperty("maven.compiler.release", "17");
        compilerConfiguration("<release>11</release>");
        assertEquals(11, release());
    }

    @Test
    void theReleasePropertyWinsOverAConfiguredTarget() throws Exception {
        model.addProperty("maven.compiler.release", "17");
        compilerConfiguration("<target>1.8</target>");
        assertEquals(17, release());
    }

    @Test
    void theCommandLineWinsOverThePom() {
        model.addProperty("maven.compiler.release", "11");
        userProperties.setProperty("maven.compiler.release", "17");
        assertEquals(17, release());
    }

    @Test
    void thePomsSourcePropertyIsTheReleaseWithoutAnother() {
        model.addProperty("maven.compiler.source", "11");
        assertEquals(11, release());
    }

    @Test
    void theRunningJvmIsTheReleaseWithoutAnything() {
        assertEquals(Runtime.version().feature(), release());
    }

    private Plugin compilerConfiguration(String parameters) throws IOException, XmlPullParserException {
        Plugin compiler = new Plugin();
        compiler.setGroupId("org.apache.maven.plugins");
        compiler.setArtifactId("maven-compiler-plugin");
        compiler.setConfiguration(Xpp3DomBuilder.build(new StringReader("<configuration>" + parameters + "</configuration>")));
        if (model.getBuild() == null) model.setBuild(new Build());
        model.getBuild().addPlugin(compiler);
        return compiler;
    }

    private int release() {
        return ProjectInputs.releaseOf(new MavenProject(model), userProperties);
    }
}
