package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import vision.noesis.parser.core.java.ReleaseClassFiles;

/** The JDK API of a release read from ct.sym, independent of the JDK that runs the test. */
class ReleaseClassFilesTest {

    @Test
    void release17HasListButNoSequencedCollection() throws IOException {
        Optional<ReleaseClassFiles> opened = ReleaseClassFiles.open(17);
        if (opened.isEmpty()) {
            assertEquals(17, Runtime.version().feature(), "a JDK has no signatures of its own release only");
            return;
        }
        try (ReleaseClassFiles release = opened.get()) {
            Optional<URL> list = release.resource("java/util/List.class");
            assertTrue(list.isPresent());
            try (InputStream in = list.get().openStream()) {
                byte[] magic = in.readNBytes(4);
                assertEquals(0xCAFEBABE, ((magic[0] & 0xff) << 24) | ((magic[1] & 0xff) << 16) | ((magic[2] & 0xff) << 8) | (magic[3] & 0xff));
            }
            assertTrue(release.resource("java/util/SequencedCollection.class").isEmpty(), "added in JDK 21");
            assertTrue(release.resource("java/util/List.sig").isEmpty(), "only class resources");
            assertEquals(Optional.of("java.base"), release.moduleOf(uri(list.get())));
            assertEquals(Optional.of("java.sql"), release.moduleOf(uri(release.resource("java/sql/Connection.class").orElseThrow())));
            assertTrue(release.moduleOf(java.net.URI.create("jrt:/java.base/java/util/List.class")).isEmpty());
        }
    }

    @Test
    void release21HasSequencedCollectionWhenTheJdkKnowsIt() {
        Optional<ReleaseClassFiles> release = ReleaseClassFiles.open(21);
        if (release.isEmpty()) return; // the running JDK is older than 21
        try (ReleaseClassFiles files = release.get()) {
            assertTrue(files.resource("java/util/SequencedCollection.class").isPresent());
        }
    }

    @Test
    void unknownReleaseIsAbsent() {
        assertFalse(ReleaseClassFiles.open(99).isPresent());
        assertFalse(ReleaseClassFiles.open(3).isPresent());
    }

    private static java.net.URI uri(URL url) {
        try {
            return url.toURI();
        } catch (java.net.URISyntaxException e) {
            throw new IllegalStateException(e);
        }
    }
}
