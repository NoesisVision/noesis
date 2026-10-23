package com.acme.shop.orders;

import vision.noesis.annotations.Command;

/** @param note what the customer added, if anything */
@Command
public record PlaceOrder(OrderId orderId, String note) {}
