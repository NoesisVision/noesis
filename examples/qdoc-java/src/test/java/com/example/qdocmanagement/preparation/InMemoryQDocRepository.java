package com.example.qdocmanagement.preparation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

class InMemoryQDocRepository implements QDocRepository {

	private final Map<QDocId, QDoc> qdocs = new LinkedHashMap<>();

	@Override
	public void save(QDoc qdoc) {
		qdocs.put(qdoc.id(), qdoc);
	}

	Optional<QDoc> find(QDocId id) {
		return Optional.ofNullable(qdocs.get(id));
	}

	List<QDoc> all() {
		return new ArrayList<>(qdocs.values());
	}

}
