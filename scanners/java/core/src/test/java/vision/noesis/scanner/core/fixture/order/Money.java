package vision.noesis.scanner.core.fixture.order;

import java.math.BigDecimal;
import vision.noesis.annotations.ValueObject;

@ValueObject
public record Money(BigDecimal amount) {

    public Money add(Money other) {
        return new Money(amount.add(other.amount));
    }
}
