package vision.noesis.scanner.core.fixture.order;

import java.util.ArrayList;
import java.util.List;
import vision.noesis.annotations.ApplicationService;
import vision.noesis.annotations.EventHandler;

@ApplicationService
public class OrderNotifier {

    private final List<String> notified = new ArrayList<>();

    @EventHandler
    public void onOrderPlaced(OrderPlaced event) {
        notified.add(event.item());
    }
}
