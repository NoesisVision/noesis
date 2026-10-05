package vision.noesis.scanner.core.fixture.order;

import vision.noesis.annotations.CommandHandler;
import vision.noesis.annotations.Direction;
import vision.noesis.annotations.ExternalIntegration;
import vision.noesis.annotations.QueryHandler;

@ExternalIntegration(Direction.SECONDARY)
public interface OrderRepository {

    @CommandHandler
    void save(Order order);

    @QueryHandler
    boolean exists(OrderId id);
}
