package vision.noesis.scanner.core.fixture.order;

import vision.noesis.annotations.ApplicationService;
import vision.noesis.annotations.CommandHandler;
import vision.noesis.annotations.QueryHandler;

@ApplicationService
public class OrderApplicationService {

    private final OrderRepository repository;

    public OrderApplicationService(OrderRepository repository) {
        this.repository = repository;
    }

    @CommandHandler
    public void handle(PlaceOrder command) {
        Order order = new Order(new OrderId("o-1"));
        order.place(command.item());
        repository.save(order);
    }

    @QueryHandler
    public boolean isPlaced(OrderId id) {
        return repository.exists(id);
    }
}
