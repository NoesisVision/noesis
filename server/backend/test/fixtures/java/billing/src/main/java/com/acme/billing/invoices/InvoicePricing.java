package com.acme.billing.invoices;

import com.acme.kernel.ExchangeRates;
import com.acme.kernel.Money;
import vision.noesis.annotations.DomainService;

/** Prices invoices in the currency a customer pays in. */
@DomainService
public class InvoicePricing {

    private final ExchangeRates rates;

    public InvoicePricing(ExchangeRates rates) {
        this.rates = rates;
    }

    public Money priceIn(Invoice invoice, String currency) {
        return invoice.totalIn(currency, rates);
    }
}
