package com.example.qdocmanagement.notifications;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationServiceTest {

	private final RecordingNotificationSender sender = new RecordingNotificationSender();

	private final NotificationService service = new NotificationService(sender);

	private static final Recipient ANNA = new Recipient("anna");

	private static final Recipient BEN = new Recipient("ben");

	private static final Recipient CLARA = new Recipient("clara");

	@Nested
	@DisplayName("notifyUsers")
	class NotifyUsersTests {

		@Nested
		@DisplayName("Each named recipient receives the notification")
		class EachNamedRecipientReceivesTheNotification {

			@Test
			@DisplayName("Three recipients notified")
			void three_recipients_notified() {
				// given a request naming 3 recipients, a subject and a body
				NotifyUsers request = new NotifyUsers(List.of(ANNA, BEN, CLARA), "Subject", "Body");

				// when a subsystem asks the Notifications subsystem to notify them
				service.notifyUsers(request);

				// then each of the 3 receives one notification with that subject and that body
				assertThat(sender.delivered).containsExactlyInAnyOrder(new Notification(ANNA, "Subject", "Body"),
						new Notification(BEN, "Subject", "Body"), new Notification(CLARA, "Subject", "Body"));
			}

		}

		@Nested
		@DisplayName("A failed delivery stops no other")
		class AFailedDeliveryStopsNoOther {

			@Test
			@DisplayName("One delivery fails")
			void one_delivery_fails() {
				// given a request naming 3 recipients, and delivery to one of them fails
				NotifyUsers request = new NotifyUsers(List.of(ANNA, BEN, CLARA), "Subject", "Body");
				sender.failFor(ANNA);

				// when a subsystem asks the Notifications subsystem to notify them
				service.notifyUsers(request);

				// then the other 2 recipients each receive the notification with the subject and the body of the request
				assertThat(sender.delivered).containsExactlyInAnyOrder(new Notification(BEN, "Subject", "Body"),
						new Notification(CLARA, "Subject", "Body"));
			}

		}

	}

}
