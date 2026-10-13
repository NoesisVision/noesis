package com.acme.orders.infrastructure.persistence;
@Adapter(Direction.SECONDARY)
public class InMemoryOrderRepository implements OrderRepository {
    @Override
    public void save(Order order) {}
}
