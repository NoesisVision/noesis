package com.example.qdocmanagement.preparation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static com.example.qdocmanagement.preparation.PreparationFixtures.aCreatedQDoc;
import static org.assertj.core.api.Assertions.assertThat;

class QDocTest {

	@Nested
	@DisplayName("A QDoc keeps at least one version")
	class AQDocKeepsAtLeastOneVersion {

		@Test
		@DisplayName("Creation yields a version")
		void creation_yields_a_version() {
			// given a quality manager
			// when the quality manager creates a QDoc
			QDoc qdoc = aCreatedQDoc();

			// then the QDoc holds one version
			assertThat(qdoc.versions()).hasSize(1);
		}

	}

	@Nested
	@DisplayName("create")
	class CreateTests {

		@Nested
		@DisplayName("A new QDoc is active")
		class ANewQDocIsActive {

			@Test
			@DisplayName("New QDoc listed as active")
			void new_qdoc_listed_as_active() {
				// given a quality manager
				// when the quality manager creates a QDoc
				QDoc qdoc = aCreatedQDoc();

				// then the QDoc is listed with the status active
				assertThat(qdoc.status()).isEqualTo(QDocStatus.ACTIVE);
			}

		}

	}

}
