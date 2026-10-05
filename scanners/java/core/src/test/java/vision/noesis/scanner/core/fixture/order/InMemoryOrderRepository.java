package vision.noesis.scanner.core.fixture.order;

import java.util.ArrayList;
import java.util.List;
import vision.noesis.annotations.Adapter;
import vision.noesis.annotations.Direction;

@Adapter(Direction.SECONDARY)
public class InMemoryOrderRepository implements OrderRepository {

    private final List<Order> orders = new ArrayList<>();

    @Override
    public void save(Order order) {
        orders.add(order);
    }

    @Override
    public boolean exists(OrderId id) {
        return orders.stream().anyMatch(order -> order.id().equals(id));
    }
}
