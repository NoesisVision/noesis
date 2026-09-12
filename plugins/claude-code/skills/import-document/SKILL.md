---
name: import-document
description: Import a document (spec, RFC, wiki page, PDF text, markdown file) into the Noesis knowledge graph — split it into fragments and sections, analyse it into wiki topics and decisions, and write it under a change. Use when the user shares a document or asks to import, ingest or capture one.
---

# Import a document

The document becomes a faithful record under the change, and its meaning
becomes wiki topics and decisions. You produce one JSON payload; the service
validates it, writes the files and re-indexes the graph.

## Contract

- Shape: `${CLAUDE_PLUGIN_ROOT}/contracts/information-sources/document-analysis.ts`
  (and the files it imports beside it). Read it now, not from memory.
- Meaning: `${CLAUDE_PLUGIN_ROOT}/contracts/information-sources/information-sources.md`
  and `${CLAUDE_PLUGIN_ROOT}/contracts/wiki.md`.
- Conventions: `${CLAUDE_PLUGIN_ROOT}/contracts/conventions.md`.

## Steps

1. **Pick the change.** Call `list-changes`. If the user did not say which
   change the document belongs to, ask; do not guess.
2. **Look before you create.** Call `search-knowledge-graph` with the main
   subjects of the document, then read the matching topic files under
   `.noesis/wiki/topics/`. Reuse an existing topic (`is_new: false`, its id)
   whenever one fits; create a new one only when nothing does.
3. **Split the document** into fragments and a section tree exactly as the
   companion document says: one fragment per block, verbatim text, headings
   as `structural` fragments, `section_path` on every fragment, and a
   `section_tree` whose `fragment_indices` list only the fragments directly
   under each heading.
4. **Analyse.** For each topic the document speaks to, write the summaries as
   they should read after the import. For an existing topic, read its file
   first: keep every `*_locked` field exactly as it is, and put what you
   learned into the unlocked ones. Record decisions under their topic; leave
   the decision `id` out. Ground every topic in `items` that point at this
   document's fragments (use the placeholder `document_id` you put in the
   payload; the service replaces it).
5. **Write the working file** to the session scratch directory named in the
   server instructions (`.noesis/tmp/<session>/`), for example
   `.noesis/tmp/<session>/document-analysis.json`.
6. **Validate** with `validate` (`contract: "document-analysis"`, the path).
   Fix each issue in place and validate again until it reports no issues.
7. **Import** with `import-document` (`change`, the path). Report to the user
   what it says: the source path, and the topics and decisions created or
   updated.

## Rules

- Never write under `.noesis/` yourself; the tool does.
- A locked field is a person's edit. If what you learned contradicts it, say
  so and ask before touching it; never overwrite it.
- If the tool reports a duplicate, the document is already in the graph. Tell
  the user where, and stop.
