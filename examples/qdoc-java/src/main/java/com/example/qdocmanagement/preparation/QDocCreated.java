package com.example.qdocmanagement.preparation;

import java.time.Instant;
import java.util.Objects;

import vision.noesis.annotations.Event;

/**
 * Event: a QDoc was created. Published by the Preparation subsystem for any
 * subsystem that follows new QDocs.
 *
 * @param qdocId the new QDoc
 * @param title its title
 * @param documentNumber its document number
 * @param createdBy the quality manager who created it
 * @param createdAt when it was created
 */
@Event
public record QDocCreated(QDocId qdocId, QDocTitle title, DocumentNumber documentNumber, UserId createdBy,
		Instant createdAt) {

	public QDocCreated {
		Objects.requireNonNull(qdocId, "qdocId");
		Objects.requireNonNull(title, "title");
		Objects.requireNonNull(documentNumber, "documentNumber");
		Objects.requireNonNull(createdBy, "createdBy");
		Objects.requireNonNull(createdAt, "createdAt");
	}

}
