package com.example.qdocmanagement.preparation;

import java.time.Clock;
import java.time.ZoneOffset;
import java.util.List;

import com.example.qdocmanagement.notifications.Notification;
import com.example.qdocmanagement.notifications.NotificationService;
import com.example.qdocmanagement.notifications.Recipient;
import com.example.qdocmanagement.notifications.RecordingNotificationSender;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static com.example.qdocmanagement.preparation.PreparationFixtures.ALICE;
import static com.example.qdocmanagement.preparation.PreparationFixtures.BOB;
import static com.example.qdocmanagement.preparation.PreparationFixtures.CAROL;
import static com.example.qdocmanagement.preparation.PreparationFixtures.NOW;
import static com.example.qdocmanagement.preparation.PreparationFixtures.aRequestNamingNoAuthor;
import static com.example.qdocmanagement.preparation.PreparationFixtures.aValidCreationRequest;
import static com.example.qdocmanagement.preparation.PreparationFixtures.assigned;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.assertj.core.api.SoftAssertions.assertSoftly;

class QDocCreationServiceTest {

	private final InMemoryQDocRepository qdocs = new InMemoryQDocRepository();

	private final StubIdentityProvider identities = new StubIdentityProvider();

	private final RecordingPreparationEventPublisher events = new RecordingPreparationEventPublisher();

	private final RecordingNotificationSender notificationSender = new RecordingNotificationSender();

	private final QDocCreationService service = new QDocCreationService(qdocs, new SequentialDocumentNumberGenerator(),
			identities, events, new NotificationService(notificationSender), Clock.fixed(NOW, ZoneOffset.UTC));

	private List<Recipient> notifiedRecipients() {
		return notificationSender.delivered.stream().map(Notification::recipient).toList();
	}

	private static Recipient recipient(UserId user) {
		return new Recipient(user.value());
	}

	@Nested
	@DisplayName("createQDoc")
	class CreateQDocTests {

		@Nested
		@DisplayName("Only quality managers create QDocs")
		class OnlyQualityManagersCreateQDocs {

			@ParameterizedTest(name = "{0}")
			@ValueSource(strings = { "author", "reviewer", "approver", "auditor" })
			@DisplayName("Non-quality-managers are rejected")
			void non_quality_managers_are_rejected(String role) {
				// given a user holding only the author role, one holding only the reviewer role, one holding only the approver role and an auditor
				UserId user = identities.userHolding(role);

				// when each submits a valid QDoc creation request
				// then each request is rejected and no QDoc is created
				assertThatExceptionOfType(NotAQualityManagerException.class)
					.isThrownBy(() -> service.createQDoc(aValidCreationRequest(user)));
				assertThat(qdocs.all()).isEmpty();
			}

			@Test
			@DisplayName("A quality manager is accepted")
			void a_quality_manager_is_accepted() {
				// given a user holding the quality manager role
				UserId manager = identities.qualityManager();

				// when the user submits a valid QDoc creation request
				QDocId id = service.createQDoc(aValidCreationRequest(manager));

				// then the QDoc is created
				assertThat(qdocs.find(id)).isPresent();
			}

		}

		@Nested
		@DisplayName("A new QDoc carries a document number")
		class ANewQDocCarriesADocumentNumber {

			@Test
			@DisplayName("Number at creation")
			void number_at_creation() {
				// given a quality manager
				UserId manager = identities.qualityManager();

				// when the quality manager creates a QDoc
				QDocId id = service.createQDoc(aValidCreationRequest(manager));

				// then the new QDoc carries a document number
				assertThat(qdocs.find(id)).get()
					.extracting(QDoc::documentNumber)
					.isNotNull()
					.satisfies(number -> assertThat(number.value()).isNotBlank());
			}

		}

		@Nested
		@DisplayName("A QDoc is saved and announced together")
		class AQDocIsSavedAndAnnouncedTogether {

			@Test
			@DisplayName("An invalid request leaves no trace")
			void an_invalid_request_leaves_no_trace() {
				// given a quality manager
				UserId manager = identities.qualityManager();

				// when the quality manager submits a QDoc creation request that names no author
				// then the request is rejected, no QDoc is saved and no QDocCreated is published
				assertThatExceptionOfType(IncompleteQDocCreationRequestException.class)
					.isThrownBy(() -> service.createQDoc(aRequestNamingNoAuthor(manager)));
				assertThat(qdocs.all()).isEmpty();
				assertThat(events.published).isEmpty();
			}

		}

		@Nested
		@DisplayName("Each quality manager learns of a new QDoc")
		class EachQualityManagerLearnsOfANewQDoc {

			@Test
			@DisplayName("Three quality managers notified")
			void three_quality_managers_notified() {
				// given an organisation with 3 quality managers
				UserId first = identities.qualityManager();
				UserId second = identities.qualityManager();
				UserId third = identities.qualityManager();

				// when one of them creates a QDoc
				QDocId id = service.createQDoc(aValidCreationRequest(first));

				// then each of the 3 receives a notification naming the QDoc, its document number and its creator
				QDoc qdoc = qdocs.find(id).orElseThrow();
				assertThat(notifiedRecipients()).containsExactlyInAnyOrder(recipient(first), recipient(second),
						recipient(third));
				assertThat(notificationSender.delivered).allSatisfy(notification -> assertThat(
						notification.subject() + "\n" + notification.body())
					.contains(qdoc.title().value(), qdoc.documentNumber().value(), first.value()));
			}

			@Test
			@DisplayName("A rejected request notifies nobody")
			void a_rejected_request_notifies_nobody() {
				// given an organisation with 3 quality managers
				UserId first = identities.qualityManager();
				identities.qualityManager();
				identities.qualityManager();

				// when one of them submits a QDoc creation request that names no author
				// then the request is rejected and no quality manager is notified
				assertThatExceptionOfType(IncompleteQDocCreationRequestException.class)
					.isThrownBy(() -> service.createQDoc(aRequestNamingNoAuthor(first)));
				assertThat(notificationSender.delivered).isEmpty();
			}

		}

		@Test
		@DisplayName("Creating a procedure")
		void creating_a_procedure() {
			// given a quality manager and an organisation with 3 quality managers
			UserId manager = identities.qualityManager();
			UserId second = identities.qualityManager();
			UserId third = identities.qualityManager();

			// when the quality manager creates the procedure 'Supplier audit' with one author and two reviewers
			QDocId id = service.createQDoc(new CreateQDoc(manager, new QDocTitle("Supplier audit"),
					new DocumentType("procedure"), List.of(ALICE), List.of(BOB, CAROL), List.of()));

			// then an active QDoc with a document number exists, its version 1 has the status new, one empty content
			// file, the author and the two reviewers, QDocCreated is published and each of the 3 quality managers is
			// notified of the new QDoc
			QDoc qdoc = qdocs.find(id).orElseThrow();
			Version version = qdoc.versions().getFirst();
			assertSoftly(softly -> {
				softly.assertThat(qdoc.status()).isEqualTo(QDocStatus.ACTIVE);
				softly.assertThat(qdoc.documentNumber().value()).isNotBlank();
				softly.assertThat(qdoc.versions()).hasSize(1);
				softly.assertThat(version.number()).isEqualTo(1);
				softly.assertThat(version.status()).isEqualTo(VersionStatus.NEW);
				softly.assertThat(version.contentFiles()).singleElement()
					.satisfies(file -> assertThat(file.text()).isEmpty());
				softly.assertThat(assigned(version, AssignmentRole.AUTHOR)).containsExactly(ALICE);
				softly.assertThat(assigned(version, AssignmentRole.REVIEWER)).containsExactly(BOB, CAROL);
				softly.assertThat(events.published)
					.containsExactly(new QDocCreated(id, qdoc.title(), qdoc.documentNumber(), manager, NOW));
				softly.assertThat(notifiedRecipients())
					.containsExactlyInAnyOrder(recipient(manager), recipient(second), recipient(third));
			});
		}

	}

}
