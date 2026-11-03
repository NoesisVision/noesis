package com.acme.shop.orders;

import java.time.Instant;
import vision.noesis.annotations.TechnicalService;

/** The time orders are placed at: a technical service, no part of the domain. */
@TechnicalService
public interface Clock {

    Instant now();
}
