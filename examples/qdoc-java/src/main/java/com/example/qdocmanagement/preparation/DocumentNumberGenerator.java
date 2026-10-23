package com.example.qdocmanagement.preparation;

import vision.noesis.annotations.DomainService;

/**
 * Gives a new QDoc its document number, and owns the rules by which document
 * numbers are composed, sequenced and kept unique. The format, the sequence and
 * the uniqueness are defined by UC-2.
 */
@DomainService
@FunctionalInterface
public interface DocumentNumberGenerator {

	/**
	 * Gives the QDoc being created its document number.
	 * @param documentType the type of the QDoc being created, available to a
	 *     type-aware format
	 * @return the new document number
	 */
	DocumentNumber next(DocumentType documentType);

}
