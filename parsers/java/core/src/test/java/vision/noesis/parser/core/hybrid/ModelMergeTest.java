package vision.noesis.parser.core.hybrid;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import vision.noesis.parser.core.Diagnostics;
import vision.noesis.parser.core.EngineKind;
import vision.noesis.parser.core.Fixtures;
import vision.noesis.parser.core.JavaParser;
import vision.noesis.parser.core.ParseSession;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.DeclarationNode;
import vision.noesis.parser.model.Origin;

/** The merge when one of its inputs is missing: the source engine failed on the module. */
class ModelMergeTest {

    @Test
    void aSourceEngineThatFailedLeavesTheBytecodeModelAsItIsWithTheFailure() {
        CodeModelFile bytecode = Fixtures.lombok(EngineKind.BYTECODE).model("java-lombok");
        CodeModelFile failed = CodeModelFile.sorted(bytecode.generator(), bytecode.artifact(), List.of(), List.of(), List.of(),
                List.of(Diagnostics.error(Diagnostics.MODULE_NOT_PARSED, "Module java-lombok could not be parsed: boom")));
        ParseSession session = new ParseSession(new JavaParser(Fixtures.GENERATOR_VERSION).generator(), Fixtures.lombokRequest(EngineKind.HYBRID));

        CodeModelFile merged = ModelMerge.merge(failed, bytecode, bytecode.artifact(), session);

        assertEquals(bytecode.nodes(), merged.nodes(), "nodes as bytecode has them: none relabelled as generated");
        assertTrue(merged.nodes().stream().map(DeclarationNode::origin).noneMatch(origin -> origin == Origin.GENERATED));
        assertEquals(bytecode.edges().size(), merged.edges().size());
        assertTrue(merged.diagnostics().stream().anyMatch(d -> d.code().equals(Diagnostics.MODULE_NOT_PARSED)), merged.diagnostics().toString());
    }
}
