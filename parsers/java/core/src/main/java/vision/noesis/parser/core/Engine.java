package vision.noesis.parser.core;

import vision.noesis.parser.model.CodeModelFile;

/** One way of reading an artifact into the model; both engines fill the same {@link ModelBuilder}. */
public interface Engine {

    CodeModelFile parse(ArtifactInput input, ParseSession session);
}
