---
name: search-knowledge-graph
description: Find what the Noesis knowledge graph already knows — wiki topics and decisions, design documents, imported conversations and documents — and read the files behind the hits. Use when the user asks what was decided, what is known about something, or before importing or designing.
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
   - a topic: `.noesis/graph/wiki/topics/<id>/data.json`
   - a decision: `.noesis/graph/wiki/decisions/<id>/data.json`
   - a design document: `.noesis/graph/changes/<change>/design-docs/<id>/data.json`
   - a conversation or document: `.noesis/graph/changes/<change>/conversations/<id>/data.json`
     or `documents/<id>/data.json`
     The directory is the id itself.
4. Follow the references: a topic's `items` point at source fragments
   (`conversation_id` or `document_id` plus indices) that ground it; a
   decision's `supporting_info` does the same. Quote the source when the user
   asks why.
5. Answer from the files, and say which files the answer came from.

## Rules

- Read, do not write. Changing the wiki is the import skills' job; changing a
  design document is `update-design-doc`'s.
- A `*_locked: true` field is a person's own words; quote it as such.
