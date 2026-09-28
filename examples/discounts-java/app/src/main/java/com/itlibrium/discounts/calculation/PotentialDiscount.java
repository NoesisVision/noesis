package com.itlibrium.discounts.calculation;

import vision.noesis.annotations.DomainService;

import lombok.RequiredArgsConstructor;

@DomainService
interface PotentialDiscount {
    boolean isApplicableFor(Conditions conditions);
    Discount getDiscount();
}

@DomainService
@RequiredArgsConstructor
class PotentialVipUserDiscount implements PotentialDiscount {
    private final FixedDiscount fixedDiscount;

    public boolean isApplicableFor(Conditions conditions) {
        return conditions.getUserStatus().isVip();
    }

    public Discount getDiscount() {
        return fixedDiscount;
    }
}

@DomainService
@RequiredArgsConstructor
class PotentialPrecipitationDiscount implements PotentialDiscount {
    private final PercentageDiscount discount;

    public boolean isApplicableFor(Conditions conditions) {
        return conditions.getWeather().exists(weather -> weather.getPrecipitation() > 0);
    }

    public PercentageDiscount getDiscount() {
        return discount;
    }
}