package com.example.qdocmanagement.preparation;

import com.example.qdocmanagement.DomainException;

/**
 * Thrown when a QDoc creation request lacks the title, the document type or an
 * author.
 */
public class IncompleteQDocCreationRequestException extends DomainException {

	IncompleteQDocCreationRequestException(String missing) {
		super("A creation request names a title, a document type and at least one author; this one names no "
				+ missing + ".");
	}

}
