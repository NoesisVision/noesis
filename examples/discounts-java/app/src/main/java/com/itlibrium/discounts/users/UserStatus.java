package com.itlibrium.discounts.users;

import vision.noesis.annotations.ValueObject;

import lombok.Value;

@ValueObject
@Value
public class UserStatus {
    boolean vip;
}
