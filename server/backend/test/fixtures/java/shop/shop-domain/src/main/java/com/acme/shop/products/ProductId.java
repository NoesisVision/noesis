package com.acme.shop.products;

import vision.noesis.annotations.Identifier;

/** Identifies a product in the catalogue. */
@Identifier
public record ProductId(String value) {}
