package com.acme.shop.orders;

import com.acme.shop.products.ProductId;
import vision.noesis.annotations.Event;

@Event
public record OrderLineAdded(OrderId orderId, ProductId product) {}
