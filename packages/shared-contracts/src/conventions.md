# Conventions every knowledge graph file follows

Companion to `file-ref.ts` and `locked.ts`. The schemas give the shapes; this
is what they cannot say.

## Where files live

Everything is under `.noesis/` at the repository root, one directory per kind.
The knowledge graph is moving under `.noesis/graph/`, one `<key>/data.json`
per object (decision 76); changes are there already, the other kinds follow:

- `graph/changes/<change>/` — one change; holds its `data.json` and the
  `conversations/`, `documents/` and `design-docs/` it produced, each an
  object directory `<id>/data.json`.
- `system-model/` — the implemented model, written by the scanner.
- `wiki/topics/`, `wiki/decisions/` — the curated knowledge base.
- `tmp/<session>/` — scratch space between the agent and the service. Not
  graph content, not versioned.

Under `graph/`, only what the store writes may exist: an object is a
directory named by its key holding one `data.json`, and nothing sits beside
it. Under the other kind directories, a file is graph content if and only if
it is `.json`, and anything else beside it is ignored.

## Names and ids

- Under `graph/`, an object's directory is its key: the change's slug, the
  entity's id everywhere else. Elsewhere, files are still
  `<slug>-<id-suffix>.json`: the entity's name kebab-cased and capped, then
  the tail of its id. The service names files; skills never do.
- Ids are opaque strings. Imported sources (conversations, documents) get a
  content hash, so re-importing the same source yields the same id and is a
  duplicate, not a second copy. Everything the graph authors itself (design
  docs, topics, decisions) gets a time-ordered id the service mints — leave the
  id out or send any placeholder, it is replaced.
- Inside a design document, element ids are the author's: short, readable,
  unique across the document, never reused for something else.

## References

A pointer from one file to another is a `FileRef`: the target's id plus the
hash of its file when the link was made. A hash that no longer matches the
file on disk means the dependent may be stale; the service reports that, it
does not repair it. Fragment refs into imported sources carry the same idea as
`source_sha`.

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
