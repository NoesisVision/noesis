---
name: add-document-to-change
description: Add a Markdown file to a Noesis change as a document — the source material a change is informed by, such as a transcript, a spec, a note or a page of research. Use when the user gives a path to a .md file and asks to add, attach or import it into a change.
argument-hint: <path-to-file.md> [change-id]
---

# Add a document to a change

A document is a piece of source material a change is informed by. The user
gives you a Markdown file; you wrap it in a JSON working file whose `content`
is the file's text, verbatim, and hand that file's path to the service. The
service checks the working file against the contract and stores it under the
change by its id: a new id adds a document, an id already in the change
updates that document.

## Contract

- Shape: `${CLAUDE_PLUGIN_ROOT}/contracts/document.schema.json`, a JSON
  Schema. Read it now, not from memory. It is the working file: `id`,
  `title`, `date` and `content`.

## Steps

1. **Take the source file** from the path the user invoked the skill with.
   Ask for it when there is none. Check that the file exists; it does not
   have to be inside the project.
2. **Pick the change.** Call `list_changes`. When the user named a change
   (an id, a name or a tracker key) and exactly one listed change matches,
   use its id. Otherwise ask the user which change the document belongs
   to, offering the listed changes by name, key and id, newest first, plus
   the option of a new change. Do not choose for the user, not even when
   there is only one change or the file's subject seems to fit one. For a
   new change, or when the list is empty, use the `add-change` skill
   first and add the document to the id it returns.
3. **Find the scratch directory.** It is the absolute path named in the
   description of the `path` parameter of `add_document_to_change`, of the
   form `.noesis/tmp/<session>/`. Take it from there, never from memory: it
   changes every session.
4. **Write the working file with the script**, never by hand, so the text is
   copied and not retyped:

   ```
   bun "${CLAUDE_PLUGIN_ROOT}/skills/add-document-to-change/scripts/write-working-file.ts" \
     "<source.md>" "<scratch directory>/<source file name>.json"
   ```

   The script puts the whole file into `content`, takes `title` from the
   first `# ` heading (the file name when there is none), `date` from the
   file's last modification and mints `id` from the title and today's date.
   It prints the id, title and date it chose. Pass `--id <id>` to update a
   document already in the change, with the id it was stored under: an id
   never changes, even when the title does. Pass
   `--title "<title>"` or `--date <YYYY-MM-DD>` to override them: a title
   when the user gave one or the derived one says nothing ("Notes",
   "README"), a date when the text itself states when it was written or
   revised.

5. **Add** with the `add_document_to_change` tool (`change`, the working
   file's `path`).
6. **Report** the document's id and whether the tool created or updated it.
   When it says `Updated` but you meant to add a new document, a document
   with the same title was added the same day and has now been overwritten:
   tell the user straight away.

## When the tool refuses

- **The working file does not fit the contract.** Nothing was written. The
  issue list gives the path of each problem and what is wrong there. Run the
  script again with the corrected `--title` or `--date` and call the tool
  again.
- **There is no such change.** The id did not come from `list_changes`.
  Call it again and ask the user, as in step 2.
- **The file is too large** (the script or the tool says so; the limit is
  4 MiB). Ask the user how to split it into documents of their own.

## Rules

- `content` is the source file, byte for byte. Do not summarise, reformat,
  translate, trim or fix it, and do not strip its front matter or heading.
- Never write under `.noesis/` yourself, except the working file in the
  scratch directory; the tool stores the document.
- One call adds one document. For several files, run the steps once per file.
