package com.acme.shop.orders;

import com.acme.shop.products.ProductId;
import vision.noesis.annotations.DomainEntity;

/** One product in an order, with the quantity ordered. */
@DomainEntity
public class OrderLine {

    private final ProductId product;
    private final int quantity;
    public Money unitPrice;

    public OrderLine(ProductId product, int quantity) {
        this.product = product;
        this.quantity = quantity;
    }

    /** The line's price: quantity times unit price. */
    public Money price() {
        return unitPrice == null ? Money.zero("EUR") : new Money(unitPrice.amount() * quantity, unitPrice.currency());
    }

    public ProductId product() {
        return product;
    }
}
