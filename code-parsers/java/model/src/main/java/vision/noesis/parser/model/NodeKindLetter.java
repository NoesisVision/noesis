package vision.noesis.parser.model;

/** The letter before the colon of a {@link NodeId}. */
public enum NodeKindLetter {
    ARTIFACT('A'),
    NAMESPACE('N'),
    TYPE('T'),
    METHOD('M'),
    PROPERTY('P'),
    FIELD('F');

    private final char letter;

    NodeKindLetter(char letter) {
        this.letter = letter;
    }

    public char letter() {
        return letter;
    }

    public static NodeKindLetter of(char letter) {
        for (NodeKindLetter kind : values()) {
            if (kind.letter == letter) return kind;
        }
        throw new IllegalArgumentException("Not a node kind letter: " + letter);
    }
}
