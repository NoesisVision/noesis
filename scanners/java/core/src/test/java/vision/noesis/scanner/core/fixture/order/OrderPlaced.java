package vision.noesis.scanner.core.fixture.order;

import vision.noesis.annotations.Event;

@Event
public record OrderPlaced(OrderId orderId, String item) {
}
