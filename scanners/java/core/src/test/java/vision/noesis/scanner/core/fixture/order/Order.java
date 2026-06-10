package vision.noesis.scanner.core.fixture.order;

import vision.noesis.annotations.AggregateRoot;

@AggregateRoot
public class Order {

    private final OrderId id;
    private OrderPlaced lastEvent;

    public Order(OrderId id) {
        this.id = id;
    }

    public OrderPlaced place(String item) {
        lastEvent = new OrderPlaced(id, item);
        return lastEvent;
    }
}
