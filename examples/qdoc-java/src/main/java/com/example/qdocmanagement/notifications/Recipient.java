package com.example.qdocmanagement.notifications;

import java.util.Objects;

import vision.noesis.annotations.ValueObject;

/**
 * A user a notification goes to, by the user's identifier in the identity
 * provider.
 *
 * @param userId the user's identifier in the identity provider
 */
@ValueObject
public record Recipient(String userId) {

	public Recipient {
		Objects.requireNonNull(userId, "userId");
	}

}
