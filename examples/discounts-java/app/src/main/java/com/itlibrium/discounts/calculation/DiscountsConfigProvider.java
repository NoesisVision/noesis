package com.itlibrium.discounts.calculation;

import vision.noesis.annotations.Repository;

import io.vavr.collection.List;

@Repository
public class DiscountsConfigProvider {

    public DiscountConfig getDiscountsConfig() {
        return new DiscountConfig(List.of(
            new PotentialVipUserDiscount(new FixedDiscount(new DiscountAmount())),
            new PotentialPrecipitationDiscount(new PercentageDiscount(10))
        ));
    }
}
