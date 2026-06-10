package vision.noesis.scanner.core.fixture.order;

import vision.noesis.annotations.Command;

@Command
public record PlaceOrder(String item) {
}
