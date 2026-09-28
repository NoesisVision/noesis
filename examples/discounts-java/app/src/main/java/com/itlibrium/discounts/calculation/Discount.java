package com.itlibrium.discounts.calculation;

import vision.noesis.annotations.DomainService;

import lombok.Value;

@DomainService
interface Discount {
    DiscountedOffer apply(DiscountedOffer discountedOffer);
}

@DomainService
interface ProductDiscount extends Discount {

    @Override
    default DiscountedOffer apply(DiscountedOffer previous) {
        return new DiscountedOffer(previous.getProducts().map(this::apply), previous.getOfferLevelDiscounts());
    }

    DiscountedProduct apply(DiscountedProduct previous);
}

@DomainService
@Value
class FixedDiscount implements Discount {

    DiscountAmount fixedDiscountAmount;

    @Override
    public DiscountedOffer apply(DiscountedOffer previous) {
        return new DiscountedOffer(previous.getProducts(), previous.getOfferLevelDiscounts().append(fixedDiscountAmount));
    }
}

@DomainService
@Value
class PercentageDiscount implements Discount {

    int percentage;

    @Override
    public DiscountedOffer apply(DiscountedOffer previous) {
        return new DiscountedOffer(previous.getProducts(), previous.getOfferLevelDiscounts().append(new DiscountAmount(this)));
    }
}

@DomainService
@Value
class ExclusiveOfferLevelDiscount implements Discount {

    Discount discountToApply;
    Class<? extends Discount> discountTypeWhichIsExclusive;


    @Override
    public DiscountedOffer apply(DiscountedOffer previous) {
        if(offerLevelDiscountsContainExclusiveOne(previous)) {
            return previous;
        }
        return discountToApply.apply(previous);
    }

    private boolean offerLevelDiscountsContainExclusiveOne(DiscountedOffer previous) {
        return previous.getOfferLevelDiscounts().find(a -> a.getAppliedDiscount().getClass().isInstance(discountTypeWhichIsExclusive)).isDefined();
    }
}
