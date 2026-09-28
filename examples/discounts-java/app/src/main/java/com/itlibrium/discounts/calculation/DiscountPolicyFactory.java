package com.itlibrium.discounts.calculation;

import vision.noesis.annotations.Factory;

import com.itlibrium.discounts.users.UserId;
import com.itlibrium.discounts.users.UserStatus;
import com.itlibrium.discounts.users.UserStatusProvider;
import com.itlibrium.discounts.weather.Weather;
import com.itlibrium.discounts.weather.WeatherProvider;
import io.vavr.collection.List;
import io.vavr.control.Option;
import lombok.RequiredArgsConstructor;

@Factory
@RequiredArgsConstructor
public class DiscountPolicyFactory {

    private final DiscountsConfigProvider discountsConfigProvider;

    private final UserStatusProvider userStatusProvider;

    private final WeatherProvider weatherProvider;

    List<Discount> get(UserId userId) {
        UserStatus userStatus = userStatusProvider.getFor(userId);
        Option<Weather> weather = weatherProvider.getCurrent();
        DiscountConfig discountConfig = discountsConfigProvider.getDiscountsConfig();
        Conditions conditions = Conditions.builder().userStatus(userStatus).weather(weather).build();
        return discountConfig.getDiscountsForConditions(conditions);
    }
}
