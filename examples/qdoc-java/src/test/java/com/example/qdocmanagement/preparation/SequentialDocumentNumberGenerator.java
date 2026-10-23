package com.example.qdocmanagement.preparation;

import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Stands in for the document number generator until UC-2 defines its format,
 * sequence and uniqueness.
 */
class SequentialDocumentNumberGenerator implements DocumentNumberGenerator {

	private final AtomicInteger sequence = new AtomicInteger();

	@Override
	public DocumentNumber next(DocumentType documentType) {
		return new DocumentNumber(
				"%s-%04d".formatted(documentType.value().toUpperCase(Locale.ROOT), sequence.incrementAndGet()));
	}

}
