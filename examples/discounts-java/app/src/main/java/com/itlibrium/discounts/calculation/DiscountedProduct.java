package com.itlibrium.discounts.calculation;

import vision.noesis.annotations.ValueObject;

import com.itlibrium.discounts.offers.Product;
import lombok.Getter;

import java.util.List;

@ValueObject
class DiscountedProduct {

    @Getter
    List<DiscountAmount> discountAmounts;

    static DiscountedProduct from(Product product) {
        return new DiscountedProduct();
    }

    DiscountedProduct applyDiscount(ProductDiscount productDiscount) {
        return productDiscount.apply(this);
    }
}
