package com.itlibrium.discounts.calculation;

import vision.noesis.annotations.ValueObject;

import io.vavr.collection.List;
import lombok.Value;

@ValueObject
@Value
class DiscountConfig {
    List<PotentialDiscount> potentialDiscounts;

    List<Discount> getDiscountsForConditions(Conditions conditions) {
        return potentialDiscounts
            .filter(potentialDiscount -> potentialDiscount.isApplicableFor(conditions))
            .map(PotentialDiscount::getDiscount);
    }
}
