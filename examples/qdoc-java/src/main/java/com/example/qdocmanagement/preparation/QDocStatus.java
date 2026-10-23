package com.example.qdocmanagement.preparation;

import vision.noesis.annotations.ValueObject;

/**
 * The status of a QDoc itself: active or archived. Workflow statuses belong to
 * versions, not to the QDoc.
 */
@ValueObject
public enum QDocStatus {

	ACTIVE,

	ARCHIVED

}
