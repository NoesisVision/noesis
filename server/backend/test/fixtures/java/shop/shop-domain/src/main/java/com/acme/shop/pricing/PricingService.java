package com.acme.shop.pricing;

import com.acme.shop.orders.Money;
import com.acme.shop.orders.Order;
import com.acme.shop.orders.OrderId;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import vision.noesis.annotations.DomainService;

/** Prices orders. */
@DomainService
public class PricingService {

    private final PriceRepository prices;

    public PricingService(PriceRepository prices) {
        this.prices = prices;
    }

    public Money priceFor(Order order) {
        return order.total();
    }

    public List<Money> history(OrderId id) {
        return List.of(prices.get(id).total());
    }

    public Optional<Money> tryPrice(Order order) {
        return Optional.of(priceFor(order));
    }

    public CompletableFuture<Money> priceLater(Order order) {
        return CompletableFuture.supplyAsync(() -> priceFor(order));
    }

    public void discount() {
    }
}
