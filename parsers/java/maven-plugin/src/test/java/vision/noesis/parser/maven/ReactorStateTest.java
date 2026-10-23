package vision.noesis.parser.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.apache.maven.execution.DefaultMavenExecutionRequest;
import org.apache.maven.execution.DefaultMavenExecutionResult;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.project.MavenProject;
import org.junit.jupiter.api.Test;

/**
 * Under {@code -T} the first modules start at once, each asking for the reactor's state before any of them has made it;
 * a second state would write a manifest of its own modules only, over the first one's.
 */
class ReactorStateTest {

    private static final int THREADS = 8;
    private static final int ROUNDS = 500;

    @Test
    void modulesStartingTogetherShareOneState() throws Exception {
        List<MavenProject> projects = List.of(new MavenProject(), new MavenProject(), new MavenProject());
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        try {
            for (int round = 0; round < ROUNDS; round++) {
                MavenSession session = new MavenSession(null, new DefaultMavenExecutionRequest(), new DefaultMavenExecutionResult(), projects);
                CountDownLatch start = new CountDownLatch(1);
                List<Future<ReactorState>> states = new ArrayList<>();
                for (int i = 0; i < THREADS; i++) {
                    states.add(pool.submit(() -> {
                        start.await();
                        return ReactorState.of(session);
                    }));
                }
                start.countDown();
                Set<ReactorState> distinct = Collections.newSetFromMap(new IdentityHashMap<>());
                for (Future<ReactorState> state : states) distinct.add(state.get());
                assertEquals(1, distinct.size(), "states in round " + round);
            }
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void aSessionCloneSharesItsBuildsState() {
        MavenSession session = new MavenSession(null, new DefaultMavenExecutionRequest(), new DefaultMavenExecutionResult(), List.of(new MavenProject()));
        assertSame(ReactorState.of(session), ReactorState.of(session.clone()));
    }
}
