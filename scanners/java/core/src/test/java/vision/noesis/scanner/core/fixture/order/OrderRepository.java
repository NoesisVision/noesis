package vision.noesis.scanner.core.fixture.order;

import vision.noesis.annotations.Direction;
import vision.noesis.annotations.ExternalIntegration;

@ExternalIntegration(Direction.SECONDARY)
public interface OrderRepository {

    void save(Order order);
}
