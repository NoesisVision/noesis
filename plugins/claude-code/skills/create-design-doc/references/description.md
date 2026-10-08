# Writing the design document's description

The description is the design document's overview: the first thing a reader
sees when they open the design, before the tree of what it changes. It is a
short guide to reading the changes in the model, from the general to the
particular: a skeleton the reader hangs their own understanding on while
they walk the elements. It speaks the model's language, names building
blocks and behaviours as the design does, and links them.

Readers learn the domain from the requirements view and the change's
documents; the overview does not teach it again. It says what changes in the
model and which need or requirement each change answers, nothing more.

## Facts only

- Every sentence states something the design itself shows (a module, a
  building block, a behaviour, a rule, an event) or something a source
  states.
- Give a reason only when a source states it, and cite the source: link the
  need (`noesis:need|…`), or name the requirement or decision id the
  document carries (`FR-PRE-009`, "spec, A3"). Without a source, state the
  fact and no reason.
- No rationale, trade-offs or alternatives of your own, no adjectives that
  judge the design, no restating of the documents.

## Order: from the general to the particular

1. **In one or two sentences**, what the change does to the model.
2. **Where it lands**: the modules the design adds or changes, each with
   the need or requirement it serves.
3. **Where to start reading**: the two to five elements the rest hangs on
   (an aggregate, the service that runs the use case, the port to another
   context, the union a variant joins), in the order to read them, one line
   each: what it is in this change and what it answers.
4. **Around them**, in a line or two each: the elements that support the
   core (the value objects, the events, the ports), grouped, not listed
   one by one. A modified element says in a few words what changes in it.
5. **Left for later**, when the sources say so: what is out of scope and
   which use case, change or open issue settles it.

## Shape

- Short: most designs need 15 to 40 lines; never more than about 60. The
  tree and the requirements view carry the detail.
- Markdown: a few `#` headings or bold lead-ins, short lists, no tables. No
  diagrams: the model and architecture views draw the model.
- In the dominant language of the sources, like every other description.

## Links

Link with Markdown links whose target is `noesis:` and an id:

```markdown
[Refund](noesis:building_block|sales.refunds.Refund) records the returned
lines ([Refund single lines](noesis:need|refund-single-lines)).
```

- **Elements:** a module, a building block or a behaviour by its id. The
  label is its name, or `Block.behaviour` for a behaviour. They open in the
  model view. A property, rule or scenario has no id: name it in words beside
  its element's link.
- **Needs:** `noesis:need|` and the need's id, for every need the design
  states. They open in the requirements view.
- Link what the design adds, modifies or removes, or a need it states. Link
  an element of the system model the design leaves unchanged only when the
  overview names it; never an id the design and the model do not have.
- Link each element or need the first time it is named.
