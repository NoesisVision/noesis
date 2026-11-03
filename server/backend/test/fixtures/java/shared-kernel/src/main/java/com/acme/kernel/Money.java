package com.acme.kernel;

import java.math.BigDecimal;

/** An amount in a currency. */
public record Money(BigDecimal amount, String currency) {

    public Money add(Money other) {
        return new Money(amount.add(other.amount), currency);
    }
}
