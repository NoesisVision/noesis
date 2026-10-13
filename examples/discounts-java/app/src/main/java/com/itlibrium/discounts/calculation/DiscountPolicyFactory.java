package com.itlibrium.discounts.calculation;

import vision.noesis.annotations.Factory;

import com.itlibrium.discounts.users.UserId;
import com.itlibrium.discounts.users.UserStatus;
import com.itlibrium.discounts.users.UserStatusProvider;
import io.vavr.collection.List;
import lombok.RequiredArgsConstructor;

@Factory
@RequiredArgsConstructor
public class DiscountPolicyFactory {

    private final DiscountsConfigProvider discountsConfigProvider;

    private final UserStatusProvider userStatusProvider;

    List<Discount> get(UserId userId) {
        UserStatus userStatus = userStatusProvider.getFor(userId);
        DiscountConfig discountConfig = discountsConfigProvider.getDiscountsConfig();
        Conditions conditions = Conditions.builder().userStatus(userStatus).build();
        return discountConfig.getDiscountsForConditions(conditions);
    }
}
