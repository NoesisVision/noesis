package com.acme.shop.orders;

import com.acme.shop.products.ProductId;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.money.CurrencyUnit;
import vision.noesis.annotations.AggregateRoot;
import vision.noesis.annotations.QueryHandler;
import vision.noesis.annotations.Repository;

/** An order *placed* by a customer. */
@AggregateRoot
public class Order {

    private final OrderId id;
    private final List<OrderLine> lines = new ArrayList<>();
    private final Map<ProductId, Integer> quantities = new HashMap<>();
    private Money discount;
    private Instant placedOn;
    private OrderStatus status = OrderStatus.NEW;
    private CurrencyUnit currency;

    private Order(OrderId id) {
        this.id = id;
    }

    public static Order create(OrderId id) {
        return new Order(id);
    }

    public void addLine(ProductId product, int quantity) {
        lines.add(new OrderLine(product, quantity));
        quantities.merge(product, quantity, Integer::sum);
    }

    public void addLine(ProductId product) {
        addLine(product, 1);
    }

    /** Places the order. */
    public void placeOrder() {
        status = OrderStatus.PLACED;
        placedOn = Instant.now();
        debug(total());
    }

    /** The sum of the lines, less the discount. */
    @QueryHandler
    public Money total() {
        Money sum = Money.zero("EUR");
        for (OrderLine line : lines) sum = sum.add(line.price());
        return discount == null ? sum : sum.add(new Money(-discount.amount(), sum.currency()));
    }

    /** The currency the order is priced in: a type of a library no scan reads, which .noesis/libraries/money-api.json lists. */
    public CurrencyUnit getCurrency() {
        return currency;
    }

    public void persist(Repository repository) {
        repository.save(this);
    }

    private void debug(Money money) {
        System.out.println(id + ": " + money);
    }

    @Override
    public String toString() {
        return "Order " + id.value() + " " + status + " " + placedOn;
    }

    /** Where orders are kept. */
    @vision.noesis.annotations.Repository
    public interface Repository {
        Order getBy(OrderId id);

        void save(Order order);
    }
}
