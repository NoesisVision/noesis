---
name: search-knowledge-graph
description: Find what the Noesis knowledge graph already knows — design documents, the system model, imported conversations and documents — and read the files behind the hits. Use when the user asks what was decided, what is known about something, or before designing a change.
---

# Search the knowledge graph

The graph is a cache over the files in `.noesis/`; the search finds ids and
titles, and the files hold the substance.

## Steps

1. Call `search-knowledge-graph` with a short substring of what you are after
   (a noun, a name). It matches titles and summaries case-insensitively and
   answers one line per hit: kind, id, title, and a subtitle.
2. Try two or three different words when the first returns nothing; the
   match is literal, not semantic.
3. Read the file behind a hit with your file tool:
   - a design document: `.noesis/graph/changes/<change>/design-docs/<id>/data.json`
   - a system-model file: `.noesis/graph/system-model/<id>/data.json`
   - a conversation or document: `.noesis/graph/changes/<change>/conversations/<id>/data.json`
     or `documents/<id>/data.json`
     The directory is the id itself.
4. Go to the source when the user asks why something is the way it is. The
   imported files hold the record: a conversation keeps its turns and their
   idea units verbatim, a document keeps its text verbatim. Quote from them
   rather than paraphrasing.
5. Answer from the files, and say which files the answer came from.

## Rules

- Read, do not write. Changing a design document is `update-design-doc`'s job.
- Text marked `author: "human"` in a design document is a person's own words;
  quote it as such.
