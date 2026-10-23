package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import vision.noesis.parser.model.CodeModelFile;

/** The source and the bytecode engine write the same model for the fixture, up to the gaps {@link AgreementRules} names. */
class EngineAgreementTest {

    @Test
    void bothEnginesAgreeOnTheFixture() {
        ParseResult source = Fixtures.source();
        ParseResult bytecode = Fixtures.bytecode();
        AgreementRules rules = new AgreementRules(source.models());
        for (CodeModelFile model : source.models()) rules.compare(model, bytecode.model(model.artifact().name()));
        List<String> differences = rules.differences();
        assertTrue(differences.isEmpty(), () -> differences.size() + " differences between the engines; first " + Math.min(differences.size(), 120) + ":\n  "
                + String.join("\n  ", differences.subList(0, Math.min(differences.size(), 120))));
    }
}
