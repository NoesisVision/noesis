package com.acme.kernel;

/** Converts money between currencies; each system brings its own rates. */
public interface ExchangeRates {

    Money convert(Money money, String currency);
}
