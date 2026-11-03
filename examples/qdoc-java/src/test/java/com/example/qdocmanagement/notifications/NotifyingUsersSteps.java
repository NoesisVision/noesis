package com.example.qdocmanagement.notifications;

import java.util.List;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The steps of features/notifications/notifying-users.feature. The When step
 * calls {@link NotificationService#notifyUsers}, the behavior that governs the
 * rules of the feature.
 */
public class NotifyingUsersSteps {

	private static final List<Recipient> RECIPIENTS = List.of(new Recipient("anna"), new Recipient("ben"),
			new Recipient("clara"));

	private final RecordingNotificationSender sender = new RecordingNotificationSender();

	private final NotificationService service = new NotificationService(sender);

	private NotifyUsers request;

	@Given("a request naming {int} recipients, a subject and a body")
	public void aRequestNamingRecipients(int count) {
		request = new NotifyUsers(RECIPIENTS.subList(0, count), "Subject", "Body");
	}

	@Given("delivery to one of them fails")
	public void deliveryToOneOfThemFails() {
		sender.failFor(request.recipients().get(1));
	}

	@When("a subsystem asks the Notifications subsystem to notify them")
	public void aSubsystemAsksToNotifyThem() {
		service.notifyUsers(request);
	}

	@Then("each of the {int} receives one notification with that subject and that body")
	public void eachReceivesOneNotification(int count) {
		assertThat(sender.delivered).hasSize(count)
			.allSatisfy(notification -> assertThat(notification).extracting(Notification::subject, Notification::body)
				.containsExactly("Subject", "Body"));
		assertThat(sender.delivered.stream().map(Notification::recipient)).containsExactlyInAnyOrderElementsOf(RECIPIENTS);
	}

	@Then("the other {int} recipients each receive the notification")
	public void theOtherRecipientsReceiveIt(int count) {
		assertThat(sender.delivered).hasSize(count)
			.extracting(Notification::recipient)
			.doesNotContain(request.recipients().get(1));
	}

}
