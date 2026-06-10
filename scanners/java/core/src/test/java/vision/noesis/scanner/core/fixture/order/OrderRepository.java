package vision.noesis.scanner.core.fixture.order;

import vision.noesis.annotations.Direction;
import vision.noesis.annotations.Port;

@Port(Direction.SECONDARY)
public interface OrderRepository {

    void save(Order order);
}
