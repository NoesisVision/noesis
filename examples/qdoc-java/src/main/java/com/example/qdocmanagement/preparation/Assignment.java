package com.example.qdocmanagement.preparation;

import java.util.Objects;

import vision.noesis.annotations.ValueObject;

/**
 * The link between a user, a version and one role the user holds on the
 * version.
 *
 * @param user the assigned user
 * @param role the role the user holds on the version
 */
@ValueObject
public record Assignment(UserId user, AssignmentRole role) {

	public Assignment {
		Objects.requireNonNull(user, "user");
		Objects.requireNonNull(role, "role");
	}

}
