package com.acme.shop.orders;

import vision.noesis.annotations.ValueObject;

/** An amount in a currency. */
@ValueObject
public record Money(long amount, String currency) {

    public static Money zero(String currency) {
        return new Money(0, currency);
    }

    public Money add(Money other) {
        return new Money(amount + other.amount, currency);
    }
}
