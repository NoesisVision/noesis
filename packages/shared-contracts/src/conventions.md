# Conventions every knowledge graph file follows

Companion to `locked.ts`. The schemas give the shapes; this is what they
cannot say.

## Where files live

Everything is under `.noesis/` at the repository root. The knowledge graph is
`.noesis/graph/`: one directory per object at every depth, named by the
object's key and holding exactly one `data.json` (decision D2):

- `graph/changes/<change>/` — one change; holds its `data.json` and the
  `conversations/`, `documents/` and `design-docs/` it produced, each an
  object directory `<id>/data.json`.
- `graph/system-model/<id>/` — the implemented model, written by the scanner.
- `graph/wiki/topics/<id>/`, `graph/wiki/decisions/<id>/` — the curated
  knowledge base. `wiki/` groups the two; it is not an object.
- `tmp/<session>/` — scratch space between the agent and the service. Not
  graph content, not versioned.

Under `graph/`, only what the service writes may exist: nothing sits beside a
`data.json`, and a directory without one is not an object. Notes and source
files belong outside `graph/`.

## Names and ids

- An object's directory is its key: the change's slug, the entity's id
  everywhere else. The service names directories; skills never do.
- Ids are opaque strings. Imported sources (conversations, documents) get a
  content hash, so re-importing the same source yields the same id and is a
  duplicate, not a second copy. Everything the graph authors itself (design
  docs, topics, decisions) gets a time-ordered id the service mints — leave the
  id out or send any placeholder, it is replaced.
- Inside a design document, element ids are the author's: short, readable,
  unique across the document, never reused for something else.

## References

A pointer from one object to another is the target's id. A fragment ref into
an imported source also carries `source_sha`, the SHA-256 of the source's JSON
as the import wrote it; a source is never rewritten, so a differing hash
means the ref was made against other content.

## Locked fields

`<field>_locked: true` beside a field means a person edited it. A skill that
regenerates or merges content keeps a locked field exactly as it is and asks
before changing it. Only topic and decision fields carry locks today; design
documents record authorship per element (`author`, `descriptionAuthor`)
instead, and `human` means the same thing: do not rewrite unasked.

## Writing

Skills do not write graph files. They write a working file under
`.noesis/tmp/<session>/`, run the `validate` tool against it until it is
clean, and call the tool that consumes it. The service writes the graph file,
whole and atomically; the graph re-indexes from the file.
