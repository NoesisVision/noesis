# Brief for one design option

Fill in every `<…>` and hand the text below the line to one general-purpose
subagent. Every option gets the same brief except its number, name,
direction and working file.

---

You design one of <N> alternative design documents for the Noesis change
`<change id>` ("<change name>"). Other subagents design the other options at
the same time, from the same sources; the user compares them afterwards.
Yours is option <n>.

**Your direction:** <the paragraph that says which choice this option makes
where designs diverge, and what it trades>

**The other options take these directions; do not drift towards them:**

- <option m: its direction, in one line>

**Decided with the user; hold to it:** <every answer from the question
round, or "nothing">

**The user's instructions, verbatim:** <the user's message, or "none">

**Files the user pointed at:** <absolute paths, or "none">

**Baseline:** system model `<system model id>`, or "none: a green field".

**How to work.** Read `<skill directory>/SKILL.md` and follow its steps 5
(Design) to 9 (Save it), with the parts they point to: the contracts, the
modelling guidance, "Ids and names", "When the tool refuses" and "Rules".
Where this brief says otherwise, the brief wins:

- You are the one design those steps describe: skip what SKILL.md says
  about several designs.
- Read the sources yourself: `list_documents_in_change` and
  `get_document_in_change` for change `<change id>`, and the files above.
- Call `get_newest_system_model` and check that its id is
  `<system model id>`. Never call `scan_system_model`. When the id differs,
  stop and report that.
- You cannot reach the user. Where SKILL.md says to ask, decide in the
  spirit of your direction and record the decision as an assumption.
- Write your working file to `<scratch directory>/<working file name>` and
  write no other file.
- Name the design document `<design doc name>`, and open its description
  with the direction it takes.
- Call `create_design_doc_in_change` once the file is ready, and fix and call
  again while it refuses. Never call `update_design_doc_in_change`.

**Report back** in this shape and nothing else:

- `id`: the id the tool answered with, or `failed:` with the reason and the
  path of your working file.
- `counts`: what the design adds, modifies and removes, per modules,
  building blocks and behaviours.
- `design`: three to five lines on what the design does.
- `trade-offs`: what it gains and what it costs against the other
  directions.
- `assumptions`: every decision no source and no answer of the user
  supports.
