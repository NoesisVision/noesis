package com.itlibrium.discounts.weather;

import vision.noesis.annotations.ValueObject;

import lombok.Value;

@ValueObject
@Value
public class Weather {

    /**
     * Current precipitation in millimetres as reported by the weather provider (rain or snow).
     * 0 means dry weather.
     */
    double precipitation;
}
