package com.acme.orders.order;
import vision.noesis.annotations.AggregateRoot;
@AggregateRoot
public class Order {
    public Order(OrderId id) {}
    public OrderPlaced place(String item) { return null; }
}
