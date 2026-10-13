package com.itlibrium.discounts.calculation;

import vision.noesis.annotations.ValueObject;

import com.itlibrium.discounts.users.UserStatus;
import lombok.Builder;
import lombok.Value;

@ValueObject
@Value
@Builder
class Conditions {
    UserStatus userStatus;
}
