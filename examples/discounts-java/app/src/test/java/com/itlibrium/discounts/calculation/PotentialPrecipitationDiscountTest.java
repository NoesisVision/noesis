package com.itlibrium.discounts.calculation;

import com.itlibrium.discounts.users.UserStatus;
import com.itlibrium.discounts.weather.Weather;
import io.vavr.control.Option;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PotentialPrecipitationDiscountTest {

    private final PercentageDiscount discount = new PercentageDiscount(10);
    private final PotentialPrecipitationDiscount potentialDiscount = new PotentialPrecipitationDiscount(discount);

    @Test
    void isApplicableWhenItRains() {
        assertTrue(potentialDiscount.isApplicableFor(conditionsWith(Option.some(new Weather(0.5)))));
    }

    @Test
    void isNotApplicableWhenWeatherIsDry() {
        assertFalse(potentialDiscount.isApplicableFor(conditionsWith(Option.some(new Weather(0)))));
    }

    @Test
    void isNotApplicableWhenWeatherIsUnknown() {
        assertFalse(potentialDiscount.isApplicableFor(conditionsWith(Option.none())));
    }

    @Test
    void returnsConfiguredPercentageDiscount() {
        assertSame(discount, potentialDiscount.getDiscount());
    }

    private static Conditions conditionsWith(Option<Weather> weather) {
        return Conditions.builder().userStatus(new UserStatus(false)).weather(weather).build();
    }
}
