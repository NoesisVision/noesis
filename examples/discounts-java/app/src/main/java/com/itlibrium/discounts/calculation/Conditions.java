package com.itlibrium.discounts.calculation;

import vision.noesis.annotations.ValueObject;

import com.itlibrium.discounts.users.UserStatus;
import com.itlibrium.discounts.weather.Weather;
import io.vavr.control.Option;
import lombok.Builder;
import lombok.Value;

@ValueObject
@Value
@Builder
class Conditions {
    UserStatus userStatus;

    /** Current weather snapshot; absent when the weather provider could not deliver one. */
    @Builder.Default
    Option<Weather> weather = Option.none();
}
