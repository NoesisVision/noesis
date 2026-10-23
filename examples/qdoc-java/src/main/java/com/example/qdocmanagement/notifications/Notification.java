package com.example.qdocmanagement.notifications;

import java.util.Objects;

import vision.noesis.annotations.ValueObject;

/**
 * A message to one user: a subject and a body, as the requesting subsystem
 * wrote them.
 *
 * @param recipient the user notified
 * @param subject what the notification is about, in one line
 * @param body the text of the notification
 */
@ValueObject
public record Notification(Recipient recipient, String subject, String body) {

	public Notification {
		Objects.requireNonNull(recipient, "recipient");
		Objects.requireNonNull(subject, "subject");
		Objects.requireNonNull(body, "body");
	}

}
