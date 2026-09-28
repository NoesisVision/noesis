package com.itlibrium.discounts.offers;

import vision.noesis.annotations.ValueObject;

import io.vavr.collection.List;
import lombok.Value;

@ValueObject
@Value
public class Offer {
    List<Product> products;
}
