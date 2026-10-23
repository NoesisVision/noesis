package com.example.qdocmanagement.notifications;

import java.lang.System.Logger;
import java.lang.System.Logger.Level;
import java.util.Objects;

import vision.noesis.annotations.ApplicationService;
import vision.noesis.annotations.CommandHandler;

/**
 * The service the Notifications subsystem offers every other subsystem: takes a
 * request to tell users something and has a notification delivered to each of
 * them.
 */
@ApplicationService
public class NotificationService {

	private static final Logger LOG = System.getLogger(NotificationService.class.getName());

	private final NotificationSender sender;

	public NotificationService(NotificationSender sender) {
		this.sender = Objects.requireNonNull(sender, "sender");
	}

	/**
	 * Tells each user another subsystem names what that subsystem wants them
	 * told: one notification per recipient, with the subject and the body of the
	 * request. A failed delivery to one recipient stops no other.
	 * @param command the request: the recipients, the subject and the body
	 */
	@CommandHandler
	public void notifyUsers(NotifyUsers command) {
		for (Recipient recipient : command.recipients()) {
			Notification notification = new Notification(recipient, command.subject(), command.body());
			try {
				sender.send(notification);
			}
			catch (RuntimeException failure) {
				LOG.log(Level.WARNING, "Delivering a notification to " + recipient.userId() + " failed", failure);
			}
		}
	}

}
