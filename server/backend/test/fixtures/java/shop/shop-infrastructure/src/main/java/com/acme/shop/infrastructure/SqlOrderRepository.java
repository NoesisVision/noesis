package com.acme.shop.infrastructure;

import com.acme.shop.orders.Order;
import com.acme.shop.orders.OrderId;

/** Unannotated: its calls count for the interface's behaviours. */
public class SqlOrderRepository implements Order.Repository {

    @Override
    public Order getBy(OrderId id) {
        return Order.create(id);
    }

    @Override
    public void save(Order order) {
        System.out.println(order.total());
    }
}
