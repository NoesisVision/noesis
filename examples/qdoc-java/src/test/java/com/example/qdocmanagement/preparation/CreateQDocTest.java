package com.example.qdocmanagement.preparation;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static com.example.qdocmanagement.preparation.PreparationFixtures.ALICE;
import static com.example.qdocmanagement.preparation.PreparationFixtures.MANAGER;
import static com.example.qdocmanagement.preparation.PreparationFixtures.aTitle;
import static com.example.qdocmanagement.preparation.PreparationFixtures.procedure;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

class CreateQDocTest {

	@Nested
	@DisplayName("A creation request names a title, a document type and at least one author")
	class ACreationRequestNamesATitleADocumentTypeAndAtLeastOneAuthor {

		@Test
		@DisplayName("No title")
		void no_title() {
			// given a quality manager
			// when the quality manager submits a creation request without a title
			// then the request is rejected and no QDoc is created
			assertThatExceptionOfType(IncompleteQDocCreationRequestException.class)
				.isThrownBy(() -> new CreateQDoc(MANAGER, null, procedure(), List.of(ALICE), List.of(), List.of()))
				.withMessageContaining("title");
		}

		@Test
		@DisplayName("No document type")
		void no_document_type() {
			// given a quality manager
			// when the quality manager submits a creation request without a document type
			// then the request is rejected and no QDoc is created
			assertThatExceptionOfType(IncompleteQDocCreationRequestException.class)
				.isThrownBy(() -> new CreateQDoc(MANAGER, aTitle(), null, List.of(ALICE), List.of(), List.of()))
				.withMessageContaining("document type");
		}

		@Test
		@DisplayName("No author")
		void no_author() {
			// given a quality manager
			// when the quality manager submits a creation request naming no author
			// then the request is rejected and no QDoc is created
			assertThatExceptionOfType(IncompleteQDocCreationRequestException.class)
				.isThrownBy(() -> new CreateQDoc(MANAGER, aTitle(), procedure(), List.of(), List.of(), List.of()))
				.withMessageContaining("author");
		}

		@Test
		@DisplayName("All mandatory data")
		void all_mandatory_data() {
			// given a quality manager
			// when the quality manager submits a creation request with a title, the document type procedure and one author, and no reviewer or approver
			CreateQDoc request = new CreateQDoc(MANAGER, aTitle(), procedure(), List.of(ALICE), null, null);

			// then the request is accepted and the QDoc is created
			assertThat(request.authors()).containsExactly(ALICE);
			assertThat(request.reviewers()).isEmpty();
			assertThat(request.approvers()).isEmpty();
		}

	}

}
