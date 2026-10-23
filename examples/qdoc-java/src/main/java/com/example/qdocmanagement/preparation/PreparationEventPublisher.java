package com.example.qdocmanagement.preparation;

import vision.noesis.annotations.Direction;
import vision.noesis.annotations.ExternalIntegration;

/**
 * Port that publishes the events of the Preparation subsystem to the other
 * subsystems.
 */
@ExternalIntegration(Direction.SECONDARY)
public interface PreparationEventPublisher {

	/**
	 * Publishes a QDocCreated event to the subscribing subsystems.
	 * @param event the event to publish
	 */
	void publish(QDocCreated event);

}
