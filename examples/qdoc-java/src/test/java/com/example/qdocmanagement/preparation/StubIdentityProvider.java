package com.example.qdocmanagement.preparation;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

class StubIdentityProvider implements IdentityProvider {

	private final List<UserId> qualityManagers = new ArrayList<>();

	private final AtomicInteger users = new AtomicInteger();

	/** Registers a user holding the quality manager role. */
	UserId qualityManager() {
		UserId user = new UserId("quality-manager-" + users.incrementAndGet());
		qualityManagers.add(user);
		return user;
	}

	/** A user holding only the given role, which is not the quality manager role. */
	UserId userHolding(String role) {
		return new UserId(role + "-" + users.incrementAndGet());
	}

	@Override
	public boolean isQualityManager(UserId user) {
		return qualityManagers.contains(user);
	}

	@Override
	public List<UserId> findQualityManagers() {
		return List.copyOf(qualityManagers);
	}

}
