package com.itlibrium.discounts.weather;

import vision.noesis.annotations.Direction;
import vision.noesis.annotations.Port;

import io.vavr.control.Option;

@Port(Direction.SECONDARY)
public interface WeatherProvider {

    /**
     * Current weather at the shop's fixed location, or none when it cannot be determined.
     * Never throws: any provider failure is expressed as an empty result.
     */
    Option<Weather> getCurrent();
}
