package com.acme.orders.order;
@ExternalIntegration(Direction.SECONDARY)
public interface OrderRepository {
    void save(Order order);
}
