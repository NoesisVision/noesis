package com.acme.shop.orders;

import vision.noesis.annotations.ValueObject;

@ValueObject
public enum OrderStatus {
    NEW,
    PLACED
}
