package com.example.qdocmanagement.preparation;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import vision.noesis.annotations.AggregateRoot;

/**
 * A quality document: a package of files that always works as a whole. Has a
 * title, a document type, a document number and one or more versions; is
 * either active or archived.
 *
 * <p>Invariants:
 * <ul>
 * <li>A QDoc keeps at least one version: every QDoc holds at least one version
 * at all times (FR-PRE-010); no operation leaves a QDoc with zero versions.</li>
 * </ul>
 */
@AggregateRoot
public final class QDoc {

	private final QDocId id;

	private final QDocTitle title;

	private final DocumentType documentType;

	private final DocumentNumber documentNumber;

	private final QDocStatus status;

	private final List<Version> versions = new ArrayList<>();

	private final UserId createdBy;

	private final Instant createdAt;

	@SuppressWarnings("unused") // optimistic locking, mapped by the persistence adapter
	private long version;

	private final List<QDocCreated> events = new ArrayList<>();

	private QDoc(QDocId id, QDocTitle title, DocumentType documentType, DocumentNumber documentNumber,
			QDocStatus status, Version firstVersion, UserId createdBy, Instant createdAt) {
		this.id = Objects.requireNonNull(id, "id");
		this.title = Objects.requireNonNull(title, "title");
		this.documentType = Objects.requireNonNull(documentType, "documentType");
		this.documentNumber = Objects.requireNonNull(documentNumber, "documentNumber");
		this.status = Objects.requireNonNull(status, "status");
		this.versions.add(Objects.requireNonNull(firstVersion, "firstVersion"));
		this.createdBy = Objects.requireNonNull(createdBy, "createdBy");
		this.createdAt = Objects.requireNonNull(createdAt, "createdAt");
	}

	/**
	 * Creates an active QDoc from a validated creation request and its document
	 * number, together with its first version. Records the {@link QDocCreated}
	 * event, telling the other subsystems the QDoc exists, for the application
	 * service to publish.
	 * @param command the validated creation request: the title, the document
	 *     type, the creator and the authors, reviewers and approvers to assign to
	 *     version 1
	 * @param documentNumber the number the generator gave
	 * @param now when the QDoc is created
	 * @return the new QDoc
	 */
	public static QDoc create(CreateQDoc command, DocumentNumber documentNumber, Instant now) {
		Version first = Version.createFirst(command.authors(), command.reviewers(), command.approvers());
		QDoc qdoc = new QDoc(QDocId.newId(), command.title(), command.documentType(), documentNumber,
				QDocStatus.ACTIVE, first, command.requestedBy(), now);
		qdoc.events.add(new QDocCreated(qdoc.id, qdoc.title, qdoc.documentNumber, qdoc.createdBy, qdoc.createdAt));
		return qdoc;
	}

	QDocId id() {
		return id;
	}

	QDocTitle title() {
		return title;
	}

	DocumentType documentType() {
		return documentType;
	}

	DocumentNumber documentNumber() {
		return documentNumber;
	}

	QDocStatus status() {
		return status;
	}

	List<Version> versions() {
		return List.copyOf(versions);
	}

	UserId createdBy() {
		return createdBy;
	}

	Instant createdAt() {
		return createdAt;
	}

	List<QDocCreated> pullEvents() {
		List<QDocCreated> pulled = List.copyOf(events);
		events.clear();
		return pulled;
	}

}
