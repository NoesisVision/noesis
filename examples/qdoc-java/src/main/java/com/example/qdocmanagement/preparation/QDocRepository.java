package com.example.qdocmanagement.preparation;

import vision.noesis.annotations.Repository;

/**
 * Stores and loads QDoc aggregates, whole.
 */
@Repository
public interface QDocRepository {

	/**
	 * Stores a QDoc aggregate, whole.
	 * @param qdoc the QDoc to store
	 */
	void save(QDoc qdoc);

}
