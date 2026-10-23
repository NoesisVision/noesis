package vision.noesis.scanner.core;

import vision.noesis.scanner.model.CodeModelFile;

/** One way of reading an artifact into the model; both engines fill the same {@link ModelBuilder}. */
public interface Engine {

    CodeModelFile scan(ArtifactInput input, ScanSession session);
}
