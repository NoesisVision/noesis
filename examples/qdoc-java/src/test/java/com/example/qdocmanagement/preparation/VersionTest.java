package com.example.qdocmanagement.preparation;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static com.example.qdocmanagement.preparation.PreparationFixtures.ALICE;
import static com.example.qdocmanagement.preparation.PreparationFixtures.BOB;
import static com.example.qdocmanagement.preparation.PreparationFixtures.CAROL;
import static com.example.qdocmanagement.preparation.PreparationFixtures.DAVE;
import static com.example.qdocmanagement.preparation.PreparationFixtures.assigned;
import static org.assertj.core.api.Assertions.assertThat;

class VersionTest {

	@Nested
	@DisplayName("createFirst")
	class CreateFirstTests {

		@Nested
		@DisplayName("Version 1 starts with the status new")
		class Version1StartsWithTheStatusNew {

			@Test
			@DisplayName("One version, numbered 1, new")
			void one_version_numbered_1_new() {
				// given a quality manager
				// when the quality manager creates a QDoc
				Version version = Version.createFirst(List.of(ALICE), List.of(), List.of());

				// then the QDoc has exactly one version, numbered 1, with the status new
				assertThat(version.number()).isEqualTo(1);
				assertThat(version.status()).isEqualTo(VersionStatus.NEW);
			}

		}

		@Nested
		@DisplayName("Version 1 holds one empty content file")
		class Version1HoldsOneEmptyContentFile {

			@Test
			@DisplayName("Empty content file")
			void empty_content_file() {
				// given a quality manager
				// when the quality manager creates a QDoc
				Version version = Version.createFirst(List.of(ALICE), List.of(), List.of());

				// then version 1 holds one content file with no text and no attachment
				assertThat(version.contentFiles()).singleElement()
					.satisfies(file -> assertThat(file.text()).isEmpty());
			}

		}

		@Nested
		@DisplayName("The named authors are assigned to version 1")
		class TheNamedAuthorsAreAssignedToVersion1 {

			@Test
			@DisplayName("Authors assigned")
			void authors_assigned() {
				// given a creation request naming two authors
				// when the quality manager creates the QDoc
				Version version = Version.createFirst(List.of(ALICE, BOB), List.of(), List.of());

				// then both appear as authors of version 1 and can edit the content file
				assertThat(assigned(version, AssignmentRole.AUTHOR)).containsExactly(ALICE, BOB);
			}

		}

		@Nested
		@DisplayName("The named reviewers are assigned to version 1")
		class TheNamedReviewersAreAssignedToVersion1 {

			@Test
			@DisplayName("Two reviewers")
			void two_reviewers() {
				// given a creation request naming two reviewers
				// when the quality manager creates the QDoc
				Version version = Version.createFirst(List.of(ALICE), List.of(CAROL, DAVE), List.of());

				// then version 1 has the two reviewers
				assertThat(assigned(version, AssignmentRole.REVIEWER)).containsExactly(CAROL, DAVE);
			}

			@Test
			@DisplayName("No reviewer")
			void no_reviewer() {
				// given a creation request naming no reviewer
				// when the quality manager creates the QDoc
				Version version = Version.createFirst(List.of(ALICE), List.of(), List.of());

				// then the request is accepted and version 1 has no reviewer
				assertThat(assigned(version, AssignmentRole.REVIEWER)).isEmpty();
			}

		}

		@Nested
		@DisplayName("The named approvers are assigned to version 1")
		class TheNamedApproversAreAssignedToVersion1 {

			@Test
			@DisplayName("Two approvers")
			void two_approvers() {
				// given a creation request naming two approvers
				// when the quality manager creates the QDoc
				Version version = Version.createFirst(List.of(ALICE), List.of(), List.of(CAROL, DAVE));

				// then version 1 has the two approvers
				assertThat(assigned(version, AssignmentRole.APPROVER)).containsExactly(CAROL, DAVE);
			}

			@Test
			@DisplayName("No approver")
			void no_approver() {
				// given a creation request naming no approver
				// when the quality manager creates the QDoc
				Version version = Version.createFirst(List.of(ALICE), List.of(), List.of());

				// then the request is accepted and version 1 has no approver
				assertThat(assigned(version, AssignmentRole.APPROVER)).isEmpty();
			}

		}

	}

}
