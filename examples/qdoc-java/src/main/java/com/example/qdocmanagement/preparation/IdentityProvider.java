package com.example.qdocmanagement.preparation;

import java.util.List;

import vision.noesis.annotations.Direction;
import vision.noesis.annotations.ExternalIntegration;

/**
 * Port to the Identity subsystem, or to a directory the organisation runs:
 * answers which roles a user holds and which users hold the quality manager
 * role.
 */
@ExternalIntegration(Direction.SECONDARY)
public interface IdentityProvider {

	/**
	 * Answers whether the user holds the quality manager role at the moment of
	 * the call.
	 * @param user the user to check
	 * @return true when the user holds the quality manager role
	 */
	boolean isQualityManager(UserId user);

	/**
	 * Lists every user who holds the quality manager role in the organisation at
	 * the moment of the call.
	 * @return the quality managers
	 */
	List<UserId> findQualityManagers();

}
