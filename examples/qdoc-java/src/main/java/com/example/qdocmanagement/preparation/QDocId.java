package com.example.qdocmanagement.preparation;

import java.util.Objects;
import java.util.UUID;

import vision.noesis.annotations.Identifier;

/**
 * Identity of a QDoc inside the QDoc System. Technical identifier, not the
 * document number people use.
 *
 * @param value the identifier
 */
@Identifier
public record QDocId(UUID value) {

	public QDocId {
		Objects.requireNonNull(value, "value");
	}

	static QDocId newId() {
		return new QDocId(UUID.randomUUID());
	}

}
