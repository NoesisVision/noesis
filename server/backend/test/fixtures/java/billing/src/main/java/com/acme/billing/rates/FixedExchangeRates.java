package com.acme.billing.rates;

import com.acme.kernel.ExchangeRates;
import com.acme.kernel.Money;
import java.math.BigDecimal;
import vision.noesis.annotations.DomainService;

/** Billing's own rates: the kernel's interface, implemented in the scanned code. */
@DomainService
public class FixedExchangeRates implements ExchangeRates {

    private final BigDecimal rate;

    public FixedExchangeRates(BigDecimal rate) {
        this.rate = rate;
    }

    @Override
    public Money convert(Money money, String currency) {
        return new Money(money.amount().multiply(rate), currency);
    }
}
