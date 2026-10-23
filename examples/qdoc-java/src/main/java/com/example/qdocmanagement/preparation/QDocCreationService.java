package com.example.qdocmanagement.preparation;

import java.time.Clock;
import java.util.List;
import java.util.Objects;

import com.example.qdocmanagement.notifications.NotificationService;
import org.springframework.transaction.annotation.Transactional;
import vision.noesis.annotations.ApplicationService;
import vision.noesis.annotations.CommandHandler;

/**
 * Use cases that create QDocs in the Preparation subsystem.
 */
@ApplicationService
public class QDocCreationService {

	private final QDocRepository qdocs;

	private final DocumentNumberGenerator documentNumbers;

	private final IdentityProvider identities;

	private final PreparationEventPublisher events;

	private final NotificationService notifications;

	private final Clock clock;

	public QDocCreationService(QDocRepository qdocs, DocumentNumberGenerator documentNumbers,
			IdentityProvider identities, PreparationEventPublisher events, NotificationService notifications,
			Clock clock) {
		this.qdocs = Objects.requireNonNull(qdocs, "qdocs");
		this.documentNumbers = Objects.requireNonNull(documentNumbers, "documentNumbers");
		this.identities = Objects.requireNonNull(identities, "identities");
		this.events = Objects.requireNonNull(events, "events");
		this.notifications = Objects.requireNonNull(notifications, "notifications");
		this.clock = Objects.requireNonNull(clock, "clock");
	}

	/**
	 * Creates a QDoc on a quality manager's request: gives it a document number,
	 * starts its first version with the people the request names, announces the
	 * new QDoc to the other subsystems and has every quality manager told of it.
	 *
	 * <p>Actors: Quality manager.
	 * @param command the QDoc creation request
	 * @return the identity of the created QDoc
	 */
	@CommandHandler
	@Transactional
	public QDocId createQDoc(CreateQDoc command) {
		if (!identities.isQualityManager(command.requestedBy())) {
			throw new NotAQualityManagerException(command.requestedBy());
		}
		QDoc qdoc = QDoc.create(command, documentNumbers.next(command.documentType()), clock.instant());
		qdocs.save(qdoc);
		List<QDocCreated> created = qdoc.pullEvents();
		created.forEach(events::publish);
		created.forEach(this::notifyQualityManagers);
		return qdoc.id();
	}

	private void notifyQualityManagers(QDocCreated event) {
		notifications.notifyUsers(NewQDocNotification.of(event).to(identities.findQualityManagers()));
	}

}
