package vision.noesis.scanner.core.fixture.order;

import vision.noesis.annotations.CommandHandler;
import vision.noesis.annotations.Direction;
import vision.noesis.annotations.ExternalIntegration;

@ExternalIntegration(Direction.SECONDARY)
public interface OrderEventPublisher {

    @CommandHandler
    void publish(OrderPlaced event);
}
