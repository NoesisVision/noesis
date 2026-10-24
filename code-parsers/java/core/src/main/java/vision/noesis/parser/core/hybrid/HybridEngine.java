package vision.noesis.parser.core.hybrid;

import vision.noesis.parser.core.ArtifactInput;
import vision.noesis.parser.core.ArtifactNodes;
import vision.noesis.parser.core.Diagnostics;
import vision.noesis.parser.core.Engine;
import vision.noesis.parser.core.EngineKind;
import vision.noesis.parser.core.ParseSession;
import vision.noesis.parser.core.bytecode.BytecodeEngine;
import vision.noesis.parser.core.source.SourceEngine;
import vision.noesis.parser.model.ArtifactNode;
import vision.noesis.parser.model.CodeModelFile;

/**
 * Both engines over the same module, merged by id: the source engine's model is the base, and the bytecode engine
 * fills in what the sources alone cannot show, which is the members an annotation processor generated (Lombok's
 * accessors, builders and constructors) and the calls the source engine could not bind because of them. Everything
 * the source engine holds keeps its source fidelity (receivers, type arguments, casts, Javadoc, columns); what comes
 * from the class files is marked {@code java.engine = bytecode} on the node or site and {@code generated} as origin.
 * {@link ModelMerge} is the rule set.
 */
public final class HybridEngine implements Engine {

    private final SourceEngine source = new SourceEngine();
    private final BytecodeEngine bytecode = new BytecodeEngine();

    @Override
    public CodeModelFile parse(ArtifactInput input, ParseSession session) {
        ArtifactNode artifact = ArtifactNodes.of(input, session, input.id(), EngineKind.HYBRID);
        CodeModelFile fromSource = source.parse(input, session);
        CodeModelFile fromBytecode = bytecode.parse(input, session);
        try {
            return ModelMerge.merge(fromSource, fromBytecode, artifact, session);
        } catch (RuntimeException | StackOverflowError e) {
            return Diagnostics.notParsed(input, artifact, session, "the merge of the source and bytecode models failed: " + Diagnostics.describe(e));
        }
    }
}
