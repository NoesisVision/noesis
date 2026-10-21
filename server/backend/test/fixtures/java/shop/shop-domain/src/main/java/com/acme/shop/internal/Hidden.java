package com.acme.shop.internal;

import vision.noesis.annotations.ValueObject;

/** In a package noesis-config.json excludes. */
@ValueObject
public record Hidden(int value) {}
