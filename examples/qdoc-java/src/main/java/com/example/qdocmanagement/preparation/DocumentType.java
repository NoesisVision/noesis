package com.example.qdocmanagement.preparation;

import java.util.Objects;
import java.util.Set;

import vision.noesis.annotations.ValueObject;

/**
 * The type of a QDoc, one of the list of document types: procedure, guideline,
 * instruction, policy. The list may grow.
 *
 * @param value the type: procedure, guideline, instruction or policy
 */
@ValueObject
public record DocumentType(String value) {

	/** The list of document types (FR-PRE-002). Adding a type changes this list, not any QDoc. */
	static final Set<String> LISTED = Set.of("procedure", "guideline", "instruction", "policy");

	public DocumentType {
		Objects.requireNonNull(value, "value");
		if (!LISTED.contains(value)) {
			throw new UnknownDocumentTypeException(value);
		}
	}

}
