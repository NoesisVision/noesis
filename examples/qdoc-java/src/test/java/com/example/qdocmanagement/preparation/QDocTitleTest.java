package com.example.qdocmanagement.preparation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

class QDocTitleTest {

	@Nested
	@DisplayName("A title is never blank")
	class ATitleIsNeverBlank {

		@Test
		@DisplayName("Blank title")
		void blank_title() {
			// given a quality manager
			// when the quality manager submits a QDoc creation request whose title is only spaces
			// then the request is rejected and no QDoc is created
			assertThatExceptionOfType(BlankQDocTitleException.class).isThrownBy(() -> new QDocTitle("   "));
		}

	}

}
