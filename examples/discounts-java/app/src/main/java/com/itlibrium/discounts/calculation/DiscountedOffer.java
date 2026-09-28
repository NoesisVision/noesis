package com.itlibrium.discounts.calculation;

import vision.noesis.annotations.ValueObject;

import com.itlibrium.discounts.offers.Offer;
import io.vavr.collection.List;
import lombok.Value;

@ValueObject
@Value
class DiscountedOffer {

    List<DiscountedProduct> products;
    List<DiscountAmount> offerLevelDiscounts;

    static DiscountedOffer createFrom(Offer offer) {
        return new DiscountedOffer(offer.getProducts().map(DiscountedProduct::from), List.of());
    }

    DiscountedOffer applyDiscount(Discount discount) {
        return discount.apply(this);
    }
}
