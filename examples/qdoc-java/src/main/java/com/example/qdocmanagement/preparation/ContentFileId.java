package com.example.qdocmanagement.preparation;

import java.util.Objects;
import java.util.UUID;

import vision.noesis.annotations.Identifier;

/**
 * Identity of a content file.
 *
 * @param value the identifier
 */
@Identifier
public record ContentFileId(UUID value) {

	public ContentFileId {
		Objects.requireNonNull(value, "value");
	}

	static ContentFileId newId() {
		return new ContentFileId(UUID.randomUUID());
	}

}
