package com.example.qdocmanagement.preparation;

import java.time.Clock;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

import com.example.qdocmanagement.DomainException;
import com.example.qdocmanagement.notifications.Notification;
import com.example.qdocmanagement.notifications.NotificationService;
import com.example.qdocmanagement.notifications.Recipient;
import com.example.qdocmanagement.notifications.RecordingNotificationSender;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import static com.example.qdocmanagement.preparation.PreparationFixtures.ALICE;
import static com.example.qdocmanagement.preparation.PreparationFixtures.NOW;
import static com.example.qdocmanagement.preparation.PreparationFixtures.aRequestNamingNoAuthor;
import static com.example.qdocmanagement.preparation.PreparationFixtures.aValidCreationRequest;
import static com.example.qdocmanagement.preparation.PreparationFixtures.procedure;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * The steps of features/preparation/creating-a-qdoc.feature, over the
 * in-memory doubles the unit tests use. Every When step submits the request
 * through {@link QDocCreationService#createQDoc}, the behavior that governs
 * the rules of the feature.
 */
public class CreatingAQDocSteps {

	private final InMemoryQDocRepository qdocs = new InMemoryQDocRepository();

	private final StubIdentityProvider identities = new StubIdentityProvider();

	private final RecordingPreparationEventPublisher events = new RecordingPreparationEventPublisher();

	private final RecordingNotificationSender notificationSender = new RecordingNotificationSender();

	private final QDocCreationService service = new QDocCreationService(qdocs, new SequentialDocumentNumberGenerator(),
			identities, events, new NotificationService(notificationSender), Clock.fixed(NOW, ZoneOffset.UTC));

	private final List<UserId> qualityManagers = new ArrayList<>();

	private UserId manager;

	private UserId user;

	private QDocId created;

	private DomainException rejection;

	@Given("a quality manager")
	public void aQualityManager() {
		manager = identities.qualityManager();
		qualityManagers.add(manager);
	}

	@Given("{int} more quality managers")
	public void moreQualityManagers(int count) {
		for (int i = 0; i < count; i++) {
			qualityManagers.add(identities.qualityManager());
		}
	}

	@Given("a user holding only the {word} role")
	public void aUserHoldingOnlyTheRole(String role) {
		user = identities.userHolding(role);
	}

	@When("that user submits a valid QDoc creation request")
	public void thatUserSubmitsAValidRequest() {
		submit(() -> aValidCreationRequest(user));
	}

	@When("the quality manager submits a valid QDoc creation request")
	public void theQualityManagerSubmitsAValidRequest() {
		submit(() -> aValidCreationRequest(manager));
	}

	@When("the quality manager submits a QDoc creation request whose title is only spaces")
	public void theQualityManagerSubmitsABlankTitle() {
		submit(() -> new CreateQDoc(manager, new QDocTitle("   "), procedure(), List.of(ALICE), List.of(), List.of()));
	}

	@When("the quality manager submits a QDoc creation request naming no author")
	public void theQualityManagerSubmitsARequestNamingNoAuthor() {
		submit(() -> aRequestNamingNoAuthor(manager));
	}

	@Then("the request is rejected and no QDoc is created")
	public void theRequestIsRejected() {
		assertThat(rejection).isNotNull();
		assertThat(qdocs.all()).isEmpty();
	}

	@Then("the QDoc is created")
	public void theQDocIsCreated() {
		assertThat(rejection).isNull();
		assertThat(qdocs.find(created)).isPresent();
	}

	@Then("the new QDoc carries a document number")
	public void theNewQDocCarriesADocumentNumber() {
		assertThat(qdoc().documentNumber().value()).isNotBlank();
	}

	@Then("the QDoc has the status active")
	public void theQDocIsActive() {
		assertThat(qdoc().status()).isEqualTo(QDocStatus.ACTIVE);
	}

	@Then("the QDoc has exactly one version, numbered 1, with the status new")
	public void theQDocHasOneNewVersion() {
		assertThat(qdoc().versions()).singleElement().satisfies(version -> {
			assertThat(version.number()).isEqualTo(1);
			assertThat(version.status()).isEqualTo(VersionStatus.NEW);
		});
	}

	@Then("each of the {int} quality managers is notified of the new QDoc")
	public void eachQualityManagerIsNotified(int count) {
		assertThat(qualityManagers).hasSize(count);
		assertThat(notificationSender.delivered.stream().map(Notification::recipient))
			.containsExactlyInAnyOrderElementsOf(qualityManagers.stream().map(m -> new Recipient(m.value())).toList());
	}

	@Then("no quality manager is notified")
	public void noQualityManagerIsNotified() {
		assertThat(notificationSender.delivered).isEmpty();
	}

	/** Submits the request the supplier builds; building it may already reject it. */
	private void submit(Supplier<CreateQDoc> request) {
		try {
			created = service.createQDoc(request.get());
		}
		catch (DomainException rejected) {
			rejection = rejected;
		}
	}

	private QDoc qdoc() {
		return qdocs.find(created).orElseThrow();
	}

}
