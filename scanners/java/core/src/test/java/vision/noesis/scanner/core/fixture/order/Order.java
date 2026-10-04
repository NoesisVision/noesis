package vision.noesis.scanner.core.fixture.order;

import vision.noesis.annotations.AggregateRoot;
import vision.noesis.annotations.CommandHandler;

@AggregateRoot
public class Order {

    private final OrderId id;
    private OrderPlaced lastEvent;

    public Order(OrderId id) {
        this.id = id;
    }

    @CommandHandler
    public OrderPlaced place(String item) {
        lastEvent = new OrderPlaced(id, item);
        return lastEvent;
    }

    OrderId id() {
        return id;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof Order order && id.equals(order.id);
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }
}
