package vision.noesis.scanner.core.fixture.order;

import vision.noesis.annotations.ValueObject;

@ValueObject
public enum OrderStatus {
    PLACED,
    CANCELLED;

    public boolean isFinal() {
        return this == CANCELLED;
    }
}
