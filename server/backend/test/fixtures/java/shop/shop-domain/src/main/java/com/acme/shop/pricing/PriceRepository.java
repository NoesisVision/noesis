package com.acme.shop.pricing;

import com.acme.shop.orders.Order;
import com.acme.shop.orders.OrderId;
import vision.noesis.annotations.Repository;

@Repository
public interface PriceRepository {
    Order get(OrderId id);
}
