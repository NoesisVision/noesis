package com.example.qdocmanagement.preparation;

import java.util.List;
import java.util.Objects;

import com.example.qdocmanagement.notifications.NotifyUsers;
import com.example.qdocmanagement.notifications.Recipient;
import vision.noesis.annotations.ValueObject;

/**
 * The message telling the quality managers about a new QDoc: names the QDoc,
 * its document number and its creator, and gives the subject and the body the
 * Notifications subsystem is asked to deliver.
 *
 * @param qdocTitle the title of the new QDoc
 * @param documentNumber the document number of the new QDoc
 * @param createdBy the quality manager who created the QDoc
 */
@ValueObject
public record NewQDocNotification(QDocTitle qdocTitle, DocumentNumber documentNumber, UserId createdBy) {

	public NewQDocNotification {
		Objects.requireNonNull(qdocTitle, "qdocTitle");
		Objects.requireNonNull(documentNumber, "documentNumber");
		Objects.requireNonNull(createdBy, "createdBy");
	}

	static NewQDocNotification of(QDocCreated event) {
		return new NewQDocNotification(event.title(), event.documentNumber(), event.createdBy());
	}

	String subject() {
		return "New QDoc " + documentNumber.value() + ": " + qdocTitle.value();
	}

	String body() {
		return createdBy.value() + " created the QDoc '" + qdocTitle.value() + "' with the document number "
				+ documentNumber.value() + ".";
	}

	NotifyUsers to(List<UserId> users) {
		return new NotifyUsers(users.stream().map(user -> new Recipient(user.value())).toList(), subject(), body());
	}

}
