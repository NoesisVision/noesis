package com.itlibrium.discounts.calculation;

import com.itlibrium.discounts.users.UserId;
import com.itlibrium.discounts.users.UserStatus;
import com.itlibrium.discounts.users.UserStatusProvider;
import com.itlibrium.discounts.weather.Weather;
import com.itlibrium.discounts.weather.WeatherProvider;
import io.vavr.collection.List;
import io.vavr.control.Option;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DiscountPolicyFactoryTest {

    private static final UserId USER_ID = new UserId(UUID.randomUUID());

    @Test
    void vipUserInTheRainGetsBothDiscounts() {
        List<Discount> discounts = discountsFor(true, Option.some(new Weather(0.5)));

        assertEquals(2, discounts.size());
        assertTrue(discounts.exists(d -> d instanceof FixedDiscount));
        assertTrue(discounts.exists(d -> d instanceof PercentageDiscount));
    }

    @Test
    void nonVipUserInTheRainGetsOnlyThePrecipitationDiscount() {
        List<Discount> discounts = discountsFor(false, Option.some(new Weather(0.5)));

        assertEquals(List.of(new PercentageDiscount(10)), discounts);
    }

    @Test
    void dryWeatherGrantsNoDiscountToANonVipUser() {
        assertTrue(discountsFor(false, Option.some(new Weather(0))).isEmpty());
    }

    @Test
    void unknownWeatherGrantsNoDiscountToANonVipUser() {
        assertTrue(discountsFor(false, Option.none()).isEmpty());
    }

    @Test
    void weatherIsReadOncePerResolution() {
        CountingWeatherProvider weatherProvider = new CountingWeatherProvider(Option.some(new Weather(0.5)));

        new DiscountPolicyFactory(new DiscountsConfigProvider(), userStatusProvider(false), weatherProvider).get(USER_ID);

        assertEquals(1, weatherProvider.calls);
    }

    private static List<Discount> discountsFor(boolean vip, Option<Weather> weather) {
        return new DiscountPolicyFactory(
            new DiscountsConfigProvider(), userStatusProvider(vip), () -> weather
        ).get(USER_ID);
    }

    private static UserStatusProvider userStatusProvider(boolean vip) {
        return new UserStatusProvider() {
            @Override
            public UserStatus getFor(UserId userId) {
                return new UserStatus(vip);
            }
        };
    }

    private static final class CountingWeatherProvider implements WeatherProvider {

        private final Option<Weather> weather;
        private int calls;

        private CountingWeatherProvider(Option<Weather> weather) {
            this.weather = weather;
        }

        @Override
        public Option<Weather> getCurrent() {
            calls++;
            return weather;
        }
    }
}
