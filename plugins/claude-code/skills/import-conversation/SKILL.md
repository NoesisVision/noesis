---
name: import-conversation
description: Import a conversation transcript (meeting notes, chat log, call transcript) into the Noesis knowledge graph — split it into turns and fragments, analyse it into wiki topics and decisions, and write it under a change. Use when the user shares a transcript or asks to import, ingest or capture a conversation.
---

# Import a conversation

The conversation becomes a faithful record under the change, and its meaning
becomes wiki topics and decisions. You produce one JSON payload; the service
validates it, writes the files and re-indexes the graph.

## Contract

- Shape: `${CLAUDE_PLUGIN_ROOT}/contracts/information-sources/model/conversation-analysis.ts`
  (and the files it imports beside it). Read it now, not from memory.

## Steps

1. **Pick the change.** Call `list-changes`. If the user did not say which
   change the conversation belongs to, ask; do not guess.
2. **Look before you create.** Call `search-knowledge-graph` with the main
   subjects of the conversation, then read the matching topic files under
   `.noesis/graph/wiki/topics/`. Reuse an existing topic (`is_new: false`, its id)
   whenever one fits; create a new one only when nothing does.
3. **Split the transcript** into turns and fragments: verbatim text, every
   turn covered, one idea per fragment, at least one category per fragment.
4. **Analyse.** For each topic the conversation speaks to, write the summaries
   as they should read after the import. For an existing topic, read its file
   first: keep every `*_locked` field exactly as it is, and put what you
   learned into the unlocked ones. Record decisions under their topic; leave
   the decision `id` out. Ground every topic in `items` that point at this
   conversation's fragments (use the placeholder `conversation_id` you put in
   the payload; the service replaces it).
5. **Write the working file** to the session scratch directory named in the
   server instructions (`.noesis/tmp/<session>/`), for example
   `.noesis/tmp/<session>/conversation-analysis.json`.
6. **Validate** with `validate` (`contract: "conversation-analysis"`, the
   path). Fix each issue in place and validate again until it reports no
   issues.
7. **Import** with `import-conversation` (`change`, the path). Report to the
   user what it says: the source path, and the topics and decisions created
   or updated.

## Rules

- Never write under `.noesis/` yourself; the tool does.
- A locked field is a person's edit. If what you learned contradicts it, say
  so and ask before touching it; never overwrite it.
- If the tool reports a duplicate, the conversation is already in the graph.
  Tell the user where, and stop.
