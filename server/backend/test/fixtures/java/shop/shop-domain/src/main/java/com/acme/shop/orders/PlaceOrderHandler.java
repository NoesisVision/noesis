package com.acme.shop.orders;

import com.acme.shop.pricing.PricingService;
import vision.noesis.annotations.ApplicationService;
import vision.noesis.annotations.CommandHandler;

/** Places an order on behalf of the customer. */
@ApplicationService
public class PlaceOrderHandler {

    private final Order.Repository repository;
    private final PricingService pricing;

    public PlaceOrderHandler(Order.Repository repository, PricingService pricing) {
        this.repository = repository;
        this.pricing = pricing;
    }

    @CommandHandler
    public void handle(PlaceOrder command) {
        Order order = repository.getBy(command.orderId());
        order.placeOrder();
        logTotal(order);
        pricing.priceFor(order);
        repository.save(order);
    }

    private void logTotal(Order order) {
        System.out.println(order.total());
    }
}
