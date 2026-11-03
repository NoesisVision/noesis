package com.example.qdocmanagement.preparation;

import java.time.Clock;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
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
import static com.example.qdocmanagement.preparation.PreparationFixtures.BOB;
import static com.example.qdocmanagement.preparation.PreparationFixtures.CAROL;
import static com.example.qdocmanagement.preparation.PreparationFixtures.DAVE;
import static com.example.qdocmanagement.preparation.PreparationFixtures.NOW;
import static com.example.qdocmanagement.preparation.PreparationFixtures.aRequestNamingNoAuthor;
import static com.example.qdocmanagement.preparation.PreparationFixtures.aTitle;
import static com.example.qdocmanagement.preparation.PreparationFixtures.aValidCreationRequest;
import static com.example.qdocmanagement.preparation.PreparationFixtures.assigned;
import static com.example.qdocmanagement.preparation.PreparationFixtures.procedure;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.SoftAssertions.assertSoftly;

/**
 * The steps of features/preparation/creating-a-qdoc.feature. Each When step
 * calls the behavior that governs its rule, and nothing else that is one:
 * {@link QDocCreationService#createQDoc} over the in-memory doubles for the
 * use case's rules, {@link QDoc#create} and {@link Version#createFirst} alone
 * for the rules of the aggregate and the entity.
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

	private CreateQDoc request;

	private QDocId created;

	private DomainException rejection;

	private QDoc qdoc;

	private Version version;

	/* ------------------------------------------------------------ given */

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

	@Given("a creation request naming two {word}")
	public void aCreationRequestNamingTwo(String people) {
		AssignmentRole role = roleOf(people);
		request = new CreateQDoc(manager, aTitle(), procedure(),
				role == AssignmentRole.AUTHOR ? List.of(ALICE, BOB) : List.of(ALICE),
				role == AssignmentRole.REVIEWER ? List.of(CAROL, DAVE) : List.of(),
				role == AssignmentRole.APPROVER ? List.of(CAROL, DAVE) : List.of());
	}

	@Given("a creation request naming no {word}")
	public void aCreationRequestNamingNo(String person) {
		request = aValidCreationRequest(manager);
	}

	/* ---------------------------------- when: QDocCreationService.createQDoc */

	@When("that user submits a valid QDoc creation request")
	public void thatUserSubmitsAValidRequest() {
		submit(() -> aValidCreationRequest(user));
	}

	@When("the quality manager submits a valid QDoc creation request")
	public void theQualityManagerSubmitsAValidRequest() {
		submit(() -> aValidCreationRequest(manager));
	}

	@When("the quality manager submits a valid QDoc creation request for the document type {word}")
	public void theQualityManagerSubmitsAValidRequestForTheDocumentType(String type) {
		submit(() -> new CreateQDoc(manager, aTitle(), new DocumentType(type), List.of(ALICE), List.of(), List.of()));
	}

	@When("the quality manager submits a creation request with the document type {string}")
	public void theQualityManagerSubmitsARequestWithTheDocumentType(String type) {
		submit(() -> new CreateQDoc(manager, aTitle(), new DocumentType(type), List.of(ALICE), List.of(), List.of()));
	}

	@When("the quality manager submits a QDoc creation request whose title is only spaces")
	public void theQualityManagerSubmitsABlankTitle() {
		submit(() -> new CreateQDoc(manager, new QDocTitle("   "), procedure(), List.of(ALICE), List.of(), List.of()));
	}

	@When("the quality manager submits a creation request without a title")
	public void theQualityManagerSubmitsARequestWithoutATitle() {
		submit(() -> new CreateQDoc(manager, null, procedure(), List.of(ALICE), List.of(), List.of()));
	}

	@When("the quality manager submits a creation request without a document type")
	public void theQualityManagerSubmitsARequestWithoutADocumentType() {
		submit(() -> new CreateQDoc(manager, aTitle(), null, List.of(ALICE), List.of(), List.of()));
	}

	@When("the quality manager submits a creation request naming no author")
	public void theQualityManagerSubmitsARequestNamingNoAuthor() {
		submit(() -> aRequestNamingNoAuthor(manager));
	}

	@When("the quality manager submits a QDoc creation request that names no author")
	public void theQualityManagerSubmitsAQDocRequestThatNamesNoAuthor() {
		submit(() -> aRequestNamingNoAuthor(manager));
	}

	@When("the quality manager submits a creation request with a title, the document type procedure and one author, and no reviewer or approver")
	public void theQualityManagerSubmitsTheMandatoryData() {
		submit(() -> new CreateQDoc(manager, aTitle(), procedure(), List.of(ALICE), List.of(), List.of()));
	}

	@When("the quality manager creates the procedure {string} with one author and two reviewers")
	public void theQualityManagerCreatesTheProcedure(String title) {
		submit(() -> new CreateQDoc(manager, new QDocTitle(title), procedure(), List.of(ALICE), List.of(BOB, CAROL),
				List.of()));
	}

	/* ------------------------------------------------- when: QDoc.create */

	@When("a QDoc is created from a valid request")
	public void aQDocIsCreatedFromAValidRequest() {
		qdoc = QDoc.create(aValidCreationRequest(manager), new DocumentNumber("PROCEDURE-0001"), NOW);
	}

	/* ------------------------------------------- when: Version.createFirst */

	@When("version 1 is created for a valid request")
	public void version1IsCreatedForAValidRequest() {
		CreateQDoc valid = aValidCreationRequest(manager);
		version = Version.createFirst(valid.authors(), valid.reviewers(), valid.approvers());
	}

	@When("version 1 is created for the request")
	public void version1IsCreatedForTheRequest() {
		version = Version.createFirst(request.authors(), request.reviewers(), request.approvers());
	}

	/* ------------------------------------------------------------- then */

	@Then("the request is rejected and no QDoc is created")
	public void theRequestIsRejected() {
		assertThat(rejection).isNotNull();
		assertThat(qdocs.all()).isEmpty();
	}

	@Then("the request is rejected, no QDoc is saved and no QDocCreated is published")
	public void theRequestIsRejectedAndLeavesNoTrace() {
		assertThat(rejection).isNotNull();
		assertThat(qdocs.all()).isEmpty();
		assertThat(events.published).isEmpty();
	}

	@Then("the QDoc is created")
	public void theQDocIsCreated() {
		assertThat(rejection).isNull();
		assertThat(qdocs.find(created)).isPresent();
	}

	@Then("the request is accepted and the QDoc is created")
	public void theRequestIsAcceptedAndTheQDocIsCreated() {
		theQDocIsCreated();
	}

	@Then("the request is accepted and the QDoc carries the document type {word}")
	public void theQDocCarriesTheDocumentType(String type) {
		assertThat(rejection).isNull();
		assertThat(qdoc().documentType()).isEqualTo(new DocumentType(type));
	}

	@Then("the new QDoc carries a document number")
	public void theNewQDocCarriesADocumentNumber() {
		assertThat(qdoc().documentNumber().value()).isNotBlank();
	}

	@Then("the QDoc holds one version")
	public void theQDocHoldsOneVersion() {
		assertThat(qdoc().versions()).hasSize(1);
	}

	@Then("the QDoc is listed with the status active")
	public void theQDocIsActive() {
		assertThat(qdoc().status()).isEqualTo(QDocStatus.ACTIVE);
	}

	@Then("an active QDoc with a document number exists, its version 1 has the status new, one empty content file, the author and the two reviewers, QDocCreated is published and each of the 3 quality managers is notified of the new QDoc")
	public void theProcedureIsCreated() {
		QDoc procedure = qdoc();
		Version first = procedure.versions().getFirst();
		assertSoftly(softly -> {
			softly.assertThat(procedure.status()).isEqualTo(QDocStatus.ACTIVE);
			softly.assertThat(procedure.documentNumber().value()).isNotBlank();
			softly.assertThat(procedure.versions()).hasSize(1);
			softly.assertThat(first.number()).isEqualTo(1);
			softly.assertThat(first.status()).isEqualTo(VersionStatus.NEW);
			softly.assertThat(first.contentFiles()).singleElement()
				.satisfies(file -> assertThat(file.text()).isEmpty());
			softly.assertThat(assigned(first, AssignmentRole.AUTHOR)).containsExactly(ALICE);
			softly.assertThat(assigned(first, AssignmentRole.REVIEWER)).containsExactly(BOB, CAROL);
			softly.assertThat(events.published).containsExactly(new QDocCreated(procedure.id(), procedure.title(),
					procedure.documentNumber(), manager, NOW));
			softly.assertThat(notifiedRecipients()).containsExactlyInAnyOrderElementsOf(recipients(qualityManagers));
		});
	}

	@Then("each of the {int} quality managers receives a notification naming the QDoc, its document number and its creator")
	public void eachQualityManagerReceivesANotification(int count) {
		QDoc notified = qdoc();
		assertThat(qualityManagers).hasSize(count);
		assertThat(notifiedRecipients()).containsExactlyInAnyOrderElementsOf(recipients(qualityManagers));
		assertThat(notificationSender.delivered)
			.allSatisfy(notification -> assertThat(notification.subject() + "\n" + notification.body())
				.contains(notified.title().value(), notified.documentNumber().value(), manager.value()));
	}

	@Then("the request is rejected and no quality manager is notified")
	public void noQualityManagerIsNotified() {
		assertThat(rejection).isNotNull();
		assertThat(notificationSender.delivered).isEmpty();
	}

	@Then("version 1 is numbered 1, with the status new")
	public void version1IsNumbered1WithTheStatusNew() {
		assertThat(version.number()).isEqualTo(1);
		assertThat(version.status()).isEqualTo(VersionStatus.NEW);
	}

	@Then("version 1 holds one content file with no text and no attachment")
	public void version1HoldsOneEmptyContentFile() {
		assertThat(version.contentFiles()).singleElement().satisfies(file -> assertThat(file.text()).isEmpty());
	}

	@Then("both appear as authors of version 1")
	public void bothAppearAsAuthors() {
		assertThat(assigned(version, AssignmentRole.AUTHOR)).containsExactly(ALICE, BOB);
	}

	@Then("version 1 has the two {word}")
	public void version1HasTheTwo(String people) {
		assertThat(assigned(version, roleOf(people))).containsExactly(CAROL, DAVE);
	}

	@Then("version 1 has no {word}")
	public void version1HasNo(String person) {
		assertThat(assigned(version, roleOf(person))).isEmpty();
	}

	/* ---------------------------------------------------------- helpers */

	/** Submits the request the supplier builds; building it may already reject it. */
	private void submit(Supplier<CreateQDoc> request) {
		try {
			created = service.createQDoc(request.get());
		}
		catch (DomainException rejected) {
			rejection = rejected;
		}
	}

	/** The QDoc the When step created: alone, or saved by the use case. */
	private QDoc qdoc() {
		return qdoc != null ? qdoc : qdocs.find(created).orElseThrow();
	}

	/** {@code reviewers} or {@code reviewer} is {@link AssignmentRole#REVIEWER}. */
	private static AssignmentRole roleOf(String people) {
		String role = people.endsWith("s") ? people.substring(0, people.length() - 1) : people;
		return AssignmentRole.valueOf(role.toUpperCase(Locale.ROOT));
	}

	private List<Recipient> notifiedRecipients() {
		return notificationSender.delivered.stream().map(Notification::recipient).toList();
	}

	private static List<Recipient> recipients(List<UserId> users) {
		return users.stream().map(user -> new Recipient(user.value())).toList();
	}

}
