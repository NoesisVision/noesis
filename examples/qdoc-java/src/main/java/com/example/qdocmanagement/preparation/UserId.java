package com.example.qdocmanagement.preparation;

import java.util.Objects;

import vision.noesis.annotations.Identifier;

/**
 * Identity of a user, a person with an account in the identity provider. The
 * Preparation subsystem refers to users only by this identity.
 *
 * @param value the user's identifier in the identity provider
 */
@Identifier
public record UserId(String value) {

	public UserId {
		Objects.requireNonNull(value, "value");
	}

}
