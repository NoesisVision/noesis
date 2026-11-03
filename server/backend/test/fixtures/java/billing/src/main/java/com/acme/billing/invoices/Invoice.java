package com.acme.billing.invoices;

import com.acme.kernel.ExchangeRates;
import com.acme.kernel.Money;
import vision.noesis.annotations.AggregateRoot;

/** An invoice, totalled in the kernel's money. */
@AggregateRoot
public class Invoice {

    private final String number;
    private Money total;

    public Invoice(String number, Money total) {
        this.number = number;
        this.total = total;
    }

    /** The total, in the kernel's money: a type of a library no scan reads, which .noesis/libraries/shared-kernel.json lists. */
    public Money getTotal() {
        return total;
    }

    /** The total converted to another currency. */
    public Money totalIn(String currency, ExchangeRates rates) {
        return rates.convert(total, currency);
    }

    @Override
    public String toString() {
        return "Invoice " + number;
    }
}
