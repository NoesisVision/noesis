package com.example.qdocmanagement.preparation;

import java.util.Objects;

import vision.noesis.annotations.DomainEntity;

/**
 * A rich-text file the authors write; the body of a QDoc version. Each version
 * has at least one. Its editing, change history and comments belong to the
 * Content management subsystem.
 */
@DomainEntity
final class ContentFile {

	private final ContentFileId id;

	private final String text;

	private ContentFile(ContentFileId id, String text) {
		this.id = Objects.requireNonNull(id, "id");
		this.text = Objects.requireNonNull(text, "text");
	}

	static ContentFile empty() {
		return new ContentFile(ContentFileId.newId(), "");
	}

	ContentFileId id() {
		return id;
	}

	String text() {
		return text;
	}

	@Override
	public boolean equals(Object o) {
		return o instanceof ContentFile other && id.equals(other.id);
	}

	@Override
	public int hashCode() {
		return id.hashCode();
	}

}
