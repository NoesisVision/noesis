package com.example.qdocmanagement.preparation;

import vision.noesis.annotations.ValueObject;

/**
 * The role a user holds on a version: author, reviewer or approver.
 */
@ValueObject
public enum AssignmentRole {

	AUTHOR,

	REVIEWER,

	APPROVER

}
