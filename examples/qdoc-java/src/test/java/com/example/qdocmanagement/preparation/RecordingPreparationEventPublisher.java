package com.example.qdocmanagement.preparation;

import java.util.ArrayList;
import java.util.List;

class RecordingPreparationEventPublisher implements PreparationEventPublisher {

	final List<QDocCreated> published = new ArrayList<>();

	@Override
	public void publish(QDocCreated event) {
		published.add(event);
	}

}
