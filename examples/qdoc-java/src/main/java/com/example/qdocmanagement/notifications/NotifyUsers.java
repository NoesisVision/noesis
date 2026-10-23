package com.example.qdocmanagement.notifications;

import java.util.List;
import java.util.Objects;

import vision.noesis.annotations.Command;

/**
 * Command: a request from another subsystem to tell users something, naming the
 * recipients, a subject and a body. The requesting subsystem chooses the
 * recipients and writes the text.
 *
 * @param recipients the users to notify
 * @param subject what the notification is about, in one line
 * @param body the text of the notification
 */
@Command
public record NotifyUsers(List<Recipient> recipients, String subject, String body) {

	public NotifyUsers {
		recipients = List.copyOf(Objects.requireNonNull(recipients, "recipients"));
		Objects.requireNonNull(subject, "subject");
		Objects.requireNonNull(body, "body");
	}

}
