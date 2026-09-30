package com.acme.orders.order;
@Port(Direction.SECONDARY)
public interface OrderRepository {
    void save(Order order);
}
