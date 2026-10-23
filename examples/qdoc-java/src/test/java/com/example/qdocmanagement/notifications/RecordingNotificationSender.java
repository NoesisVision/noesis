package com.example.qdocmanagement.notifications;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Keeps every notification it delivered. Fails delivery to the recipients a
 * test names. Public because the full-graph tests of other subsystems use it.
 */
public class RecordingNotificationSender implements NotificationSender {

	public final List<Notification> delivered = new ArrayList<>();

	private final Set<Recipient> failing = new HashSet<>();

	public void failFor(Recipient recipient) {
		failing.add(recipient);
	}

	@Override
	public void send(Notification notification) {
		if (failing.contains(notification.recipient())) {
			throw new IllegalStateException("delivery to " + notification.recipient().userId() + " failed");
		}
		delivered.add(notification);
	}

}
