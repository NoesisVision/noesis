package com.acme.orders.order;
@Event
public record OrderPlaced(OrderId orderId, String item) {}
