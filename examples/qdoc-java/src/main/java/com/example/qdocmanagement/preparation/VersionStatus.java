package com.example.qdocmanagement.preparation;

import vision.noesis.annotations.ValueObject;

/**
 * The workflow status of a version: new, approved, published, no longer in
 * force or archived.
 */
@ValueObject
public enum VersionStatus {

	NEW,

	APPROVED,

	PUBLISHED,

	NO_LONGER_IN_FORCE,

	ARCHIVED

}
