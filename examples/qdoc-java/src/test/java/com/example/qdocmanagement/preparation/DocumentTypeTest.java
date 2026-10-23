package com.example.qdocmanagement.preparation;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static com.example.qdocmanagement.preparation.PreparationFixtures.ALICE;
import static com.example.qdocmanagement.preparation.PreparationFixtures.MANAGER;
import static com.example.qdocmanagement.preparation.PreparationFixtures.NOW;
import static com.example.qdocmanagement.preparation.PreparationFixtures.aTitle;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

class DocumentTypeTest {

	@Nested
	@DisplayName("A document type comes from the list of document types")
	class ADocumentTypeComesFromTheListOfDocumentTypes {

		@ParameterizedTest(name = "{0}")
		@ValueSource(strings = { "procedure", "guideline", "instruction", "policy" })
		@DisplayName("Each listed type is accepted")
		void each_listed_type_is_accepted(String type) {
			// given a quality manager and a valid creation request
			// when the quality manager submits it once with each of procedure, guideline, instruction and policy
			CreateQDoc request = new CreateQDoc(MANAGER, aTitle(), new DocumentType(type), List.of(ALICE), List.of(),
					List.of());
			QDoc qdoc = QDoc.create(request, new DocumentNumber("N-1"), NOW);

			// then each request is accepted and the QDoc carries the requested document type
			assertThat(qdoc.documentType().value()).isEqualTo(type);
		}

		@Test
		@DisplayName("A type outside the list is rejected")
		void a_type_outside_the_list_is_rejected() {
			// given a quality manager
			// when the quality manager submits a creation request with the document type 'memo'
			// then the request is rejected and no QDoc is created
			assertThatExceptionOfType(UnknownDocumentTypeException.class).isThrownBy(() -> new DocumentType("memo"))
				.withMessageContaining("memo");
		}

	}

}
