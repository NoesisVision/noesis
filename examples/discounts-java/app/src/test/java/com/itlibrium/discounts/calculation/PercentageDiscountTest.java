package com.itlibrium.discounts.calculation;

import com.itlibrium.discounts.offers.Offer;
import com.itlibrium.discounts.offers.Product;
import io.vavr.collection.List;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

class PercentageDiscountTest {

    @Test
    void appendsOneOfferLevelDiscountAmountReferencingItself() {
        PercentageDiscount discount = new PercentageDiscount(10);
        DiscountedOffer offer = DiscountedOffer.createFrom(new Offer(List.of(new Product())));

        DiscountedOffer discounted = discount.apply(offer);

        assertEquals(1, discounted.getOfferLevelDiscounts().size());
        assertSame(discount, discounted.getOfferLevelDiscounts().head().getAppliedDiscount());
    }

    @Test
    void leavesProductsAndInputOfferUntouched() {
        PercentageDiscount discount = new PercentageDiscount(10);
        DiscountedOffer offer = DiscountedOffer.createFrom(new Offer(List.of(new Product())));

        DiscountedOffer discounted = discount.apply(offer);

        assertSame(offer.getProducts(), discounted.getProducts());
        assertEquals(0, offer.getOfferLevelDiscounts().size());
    }
}
