package com.example.qdocmanagement.preparation;

import java.time.Instant;
import java.util.List;

final class PreparationFixtures {

	static final Instant NOW = Instant.parse("2026-10-01T09:00:00Z");

	static final UserId MANAGER = new UserId("manager");

	static final UserId ALICE = new UserId("alice");

	static final UserId BOB = new UserId("bob");

	static final UserId CAROL = new UserId("carol");

	static final UserId DAVE = new UserId("dave");

	private PreparationFixtures() {
	}

	static QDocTitle aTitle() {
		return new QDocTitle("Supplier audit");
	}

	static DocumentType procedure() {
		return new DocumentType("procedure");
	}

	static CreateQDoc aValidCreationRequest(UserId requester) {
		return new CreateQDoc(requester, aTitle(), procedure(), List.of(ALICE), List.of(), List.of());
	}

	static CreateQDoc aRequestNamingNoAuthor(UserId requester) {
		return new CreateQDoc(requester, aTitle(), procedure(), List.of(), List.of(), List.of());
	}

	static QDoc aCreatedQDoc() {
		return QDoc.create(aValidCreationRequest(MANAGER), new DocumentNumber("PROCEDURE-0001"), NOW);
	}

	static List<UserId> assigned(Version version, AssignmentRole role) {
		return version.assignments().stream().filter(a -> a.role() == role).map(Assignment::user).toList();
	}

}
