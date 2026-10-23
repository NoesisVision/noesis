package com.example.qdocmanagement;

/**
 * A broken rule of the QDoc System. Every domain exception extends it.
 */
public abstract class DomainException extends RuntimeException {

	protected DomainException(String message) {
		super(message);
	}

}
