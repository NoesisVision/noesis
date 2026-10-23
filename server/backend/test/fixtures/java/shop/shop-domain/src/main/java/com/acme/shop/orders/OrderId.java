package com.acme.shop.orders;

import java.util.UUID;
import vision.noesis.annotations.Identifier;

@Identifier
public record OrderId(UUID value) {}
