package com.itlibrium.discounts.users;

import vision.noesis.annotations.Identifier;

import lombok.Value;

import java.util.UUID;

@Identifier
@Value
public class UserId {
    UUID id;
}
