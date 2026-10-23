package com.example.qdocmanagement.preparation;

import java.util.List;
import java.util.Objects;

import vision.noesis.annotations.Command;

/**
 * Command: a quality manager's QDoc creation request, naming the title, the
 * document type, at least one author and, optionally, reviewers and approvers.
 *
 * @param requestedBy the user who submits the request
 * @param title the title of the new QDoc
 * @param documentType the document type of the new QDoc
 * @param authors the authors of version 1; at least one
 * @param reviewers the reviewers of version 1; may be empty or {@code null},
 *     reviewers can be added later (UC-3)
 * @param approvers the approvers of version 1; may be empty or {@code null}, at
 *     least one is needed only when the version is shared (UC-6)
 */
@Command
public record CreateQDoc(UserId requestedBy, QDocTitle title, DocumentType documentType, List<UserId> authors,
		List<UserId> reviewers, List<UserId> approvers) {

	public CreateQDoc {
		Objects.requireNonNull(requestedBy, "requestedBy");
		if (title == null) {
			throw new IncompleteQDocCreationRequestException("a title");
		}
		if (documentType == null) {
			throw new IncompleteQDocCreationRequestException("a document type");
		}
		if (authors == null || authors.isEmpty()) {
			throw new IncompleteQDocCreationRequestException("an author");
		}
		authors = List.copyOf(authors);
		reviewers = reviewers == null ? List.of() : List.copyOf(reviewers);
		approvers = approvers == null ? List.of() : List.copyOf(approvers);
	}

}
