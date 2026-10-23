package vision.noesis.scanner.core.hybrid;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import vision.noesis.scanner.core.Diagnostics;
import vision.noesis.scanner.core.EngineKind;
import vision.noesis.scanner.core.Fixtures;
import vision.noesis.scanner.core.JavaScanner;
import vision.noesis.scanner.core.ScanSession;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.DeclarationNode;
import vision.noesis.scanner.model.Origin;

/** The merge when one of its inputs is missing: the source engine failed on the module. */
class ModelMergeTest {

    @Test
    void aSourceEngineThatFailedLeavesTheBytecodeModelAsItIsWithTheFailure() {
        CodeModelFile bytecode = Fixtures.lombok(EngineKind.BYTECODE).model("java-lombok");
        CodeModelFile failed = CodeModelFile.sorted(bytecode.generator(), bytecode.artifact(), List.of(), List.of(), List.of(),
                List.of(Diagnostics.error(Diagnostics.MODULE_NOT_SCANNED, "Module java-lombok could not be scanned: boom")));
        ScanSession session = new ScanSession(new JavaScanner(Fixtures.GENERATOR_VERSION).generator(), Fixtures.lombokRequest(EngineKind.HYBRID));

        CodeModelFile merged = ModelMerge.merge(failed, bytecode, bytecode.artifact(), session);

        assertEquals(bytecode.nodes(), merged.nodes(), "nodes as bytecode has them: none relabelled as generated");
        assertTrue(merged.nodes().stream().map(DeclarationNode::origin).noneMatch(origin -> origin == Origin.GENERATED));
        assertEquals(bytecode.edges().size(), merged.edges().size());
        assertTrue(merged.diagnostics().stream().anyMatch(d -> d.code().equals(Diagnostics.MODULE_NOT_SCANNED)), merged.diagnostics().toString());
    }
}
