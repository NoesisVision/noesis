package com.itlibrium.discounts.calculation;

import vision.noesis.annotations.ApplicationService;

import com.itlibrium.discounts.offers.Offer;
import com.itlibrium.discounts.users.UserId;
import io.vavr.collection.List;
import lombok.RequiredArgsConstructor;

@ApplicationService
@RequiredArgsConstructor
public class DiscountCalculation {

    private final DiscountPolicyFactory discountsFactory;

    public DiscountedOffer calculate(Offer offer, UserId user) {

        List<Discount> discounts = discountsFactory.get(user);

        return discounts.foldLeft(DiscountedOffer.createFrom(offer), DiscountedOffer::applyDiscount);
    }
}
