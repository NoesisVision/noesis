package com.example.qdocmanagement.preparation;

import com.example.qdocmanagement.DomainException;

/**
 * Thrown when a QDoc title holds no character other than whitespace.
 */
public class BlankQDocTitleException extends DomainException {

	BlankQDocTitleException() {
		super("A title is never blank: a QDoc title holds at least one character other than whitespace.");
	}

}
