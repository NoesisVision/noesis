package com.example.qdocmanagement.preparation;

import com.example.qdocmanagement.DomainException;

/**
 * Thrown when a user who lacks the quality manager role asks to create a QDoc.
 */
public class NotAQualityManagerException extends DomainException {

	NotAQualityManagerException(UserId user) {
		super("Only quality managers create QDocs; user " + user.value() + " does not hold the quality manager role.");
	}

}
