package vision.noesis.scanner.core.hybrid;

import vision.noesis.scanner.core.ArtifactInput;
import vision.noesis.scanner.core.ArtifactNodes;
import vision.noesis.scanner.core.Engine;
import vision.noesis.scanner.core.EngineKind;
import vision.noesis.scanner.core.ScanSession;
import vision.noesis.scanner.core.bytecode.BytecodeEngine;
import vision.noesis.scanner.core.java.JavaIds;
import vision.noesis.scanner.core.source.SourceEngine;
import vision.noesis.scanner.model.ArtifactNode;
import vision.noesis.scanner.model.CodeModelFile;

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
    public CodeModelFile scan(ArtifactInput input, ScanSession session) {
        ArtifactNode artifact = ArtifactNodes.of(input, session, JavaIds.artifact(input.artifactId()), EngineKind.HYBRID);
        CodeModelFile fromSource = source.scan(input, session);
        CodeModelFile fromBytecode = bytecode.scan(input, session);
        return ModelMerge.merge(fromSource, fromBytecode, artifact, session);
    }
}
