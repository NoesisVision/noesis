package com.example.qdocmanagement.notifications;

import vision.noesis.annotations.Direction;
import vision.noesis.annotations.ExternalIntegration;

/**
 * Port that delivers a notification to a user.
 */
@ExternalIntegration(Direction.SECONDARY)
public interface NotificationSender {

	/**
	 * Delivers one notification to its recipient.
	 * @param notification the notification to deliver
	 */
	void send(Notification notification);

}
