package com.example.qdocmanagement.preparation;

import java.util.Objects;

import vision.noesis.annotations.ValueObject;

/**
 * The title of a QDoc.
 *
 * @param value the title text
 */
@ValueObject
public record QDocTitle(String value) {

	public QDocTitle {
		Objects.requireNonNull(value, "value");
		if (value.isBlank()) {
			throw new BlankQDocTitleException();
		}
	}

}
