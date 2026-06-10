package vision.noesis.scanner.core.fixture.order;

import vision.noesis.annotations.ApplicationService;

@ApplicationService
public class OrderApplicationService {

    private final OrderRepository repository;

    public OrderApplicationService(OrderRepository repository) {
        this.repository = repository;
    }

    public void handle(PlaceOrder command) {
        Order order = new Order(new OrderId("o-1"));
        order.place(command.item());
        repository.save(order);
    }
}
