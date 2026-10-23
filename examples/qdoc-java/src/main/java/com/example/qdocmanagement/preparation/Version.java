package com.example.qdocmanagement.preparation;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import vision.noesis.annotations.DomainEntity;

/**
 * A complete, self-contained edition of a QDoc, numbered from 1. Carries the
 * workflow status, the content files and the assignments of people.
 */
@DomainEntity
final class Version {

	private final int number;

	private final VersionStatus status;

	private final List<ContentFile> contentFiles;

	private final List<Assignment> assignments;

	private Version(int number, VersionStatus status, List<ContentFile> contentFiles, List<Assignment> assignments) {
		this.number = number;
		this.status = Objects.requireNonNull(status, "status");
		this.contentFiles = List.copyOf(contentFiles);
		this.assignments = List.copyOf(assignments);
	}

	/**
	 * Creates the first version of a new QDoc, with the people named at creation
	 * assigned to it.
	 * @param authors the authors to assign; at least one
	 * @param reviewers the reviewers to assign; may be empty or {@code null}
	 * @param approvers the approvers to assign; may be empty or {@code null}
	 * @return version 1: number 1, status new, one empty content file and one
	 *     assignment per named author, reviewer and approver
	 */
	public static Version createFirst(List<UserId> authors, List<UserId> reviewers, List<UserId> approvers) {
		List<Assignment> assignments = new ArrayList<>();
		assign(assignments, authors, AssignmentRole.AUTHOR);
		assign(assignments, reviewers, AssignmentRole.REVIEWER);
		assign(assignments, approvers, AssignmentRole.APPROVER);
		return new Version(1, VersionStatus.NEW, List.of(ContentFile.empty()), assignments);
	}

	private static void assign(List<Assignment> assignments, List<UserId> users, AssignmentRole role) {
		if (users != null) {
			users.forEach(user -> assignments.add(new Assignment(user, role)));
		}
	}

	int number() {
		return number;
	}

	VersionStatus status() {
		return status;
	}

	List<ContentFile> contentFiles() {
		return contentFiles;
	}

	List<Assignment> assignments() {
		return assignments;
	}

	@Override
	public boolean equals(Object o) {
		return o instanceof Version other && number == other.number;
	}

	@Override
	public int hashCode() {
		return Integer.hashCode(number);
	}

}
