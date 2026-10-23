package com.example.qdocmanagement.preparation;

import com.example.qdocmanagement.DomainException;

/**
 * Thrown when a document type is not on the list of document types.
 */
public class UnknownDocumentTypeException extends DomainException {

	UnknownDocumentTypeException(String value) {
		super("A document type comes from the list of document types (procedure, guideline, instruction, policy); '"
				+ value + "' is not on it.");
	}

}
