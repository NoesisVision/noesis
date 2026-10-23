package com.example.qdocmanagement.preparation;

import java.util.Objects;

import vision.noesis.annotations.ValueObject;

/**
 * The human-facing identifier a QDoc gets at creation, for searching and for
 * referring to the QDoc. Not a security device.
 *
 * @param value the composed document number
 */
@ValueObject
public record DocumentNumber(String value) {

	public DocumentNumber {
		Objects.requireNonNull(value, "value");
	}

}
