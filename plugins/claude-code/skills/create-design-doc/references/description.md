# Writing the design document's description

The description is the design document's overview: the first thing a reader
sees when they open the design, before the tree of what it changes. A design
document is a system of decisions, and the overview is a condensed ADR of
them: what was decided, what drove each decision, what it trades away and
how the decisions hang together. It is not the description of one element,
and none of the rules for an element's description apply to it.

## What goes in

1. **Context**, a few lines: the problem the change solves and the drivers
   that shape the design. Refer to the change's documents and to the
   requirement, rule or decision ids they carry (`FR-PRE-009`, "spec, A3",
   "review notes"); never restate them. The reader opens the documents for
   the business background; here they need only what drives the decisions.
2. **The decisions**, one section each, in the order a reader needs them:
   - **Decision:** what was decided, linking the elements it is about.
   - **Why:** the driver behind it, by reference to the source, or the
     reasoning when no source states it.
   - **Trade-off:** what it costs or rules out, and the alternative that was
     set aside, when there was a real one.

   A decision is a choice a reader could question: where the work lands
   (an existing module or a new one), where an aggregate's boundary runs,
   which building block owns a rule, a new building block or an extended
   one, a direct call or an event, a port and its adapter, what is kept
   stable for existing callers, what is retired. Each modified element
   appears under the decision that changes it, so the reader learns why it
   is in the diff.

3. **How the decisions connect**, when more than two depend on each other:
   which one makes another necessary, and what one decision means for the
   next. A Mermaid diagram helps when the structure or the flow is the
   point, e.g. which module calls which, an event crossing a context
   boundary, the variants behind one type. Draw only what explains a
   decision; the tree already shows the model. Give every diagram an
   `accTitle:` line.
4. **Left out and open**: what the sources ask for that the design
   deliberately does not do, and the questions it leaves open, each in a
   line, with the change or the open issue that will settle it.

Leave out what the tree shows by itself (the list of elements, every
property, rule and scenario), implementation detail that does not change a
decision, and the business background the documents already give.

## Shape

- Markdown. Sections are `#` headings (Context, Decisions, How they
  connect, Left out and open); each decision is a `##` heading naming it.
  The page nests them under its own headings.
- No longer than about 200 lines, diagrams included. A small change may
  need 40; reach for length only when there are that many decisions. Say
  each thing once.
- In the dominant language of the sources, like every other description.

## Links

Name an element by a Markdown link whose target is `noesis:` and its id:

```markdown
[Refund](noesis:building_block|sales.refunds.Refund) owns the refunded lines;
[Refund.issue](noesis:behavior|sales.refunds.Refund.issue) announces them.
```

- The label is the element's name, or `Block.behaviour` for a behaviour.
- Link the elements each decision is about, the first time it names them.
  The reader opens them in the tree from the overview.
- Link an element of the system model that the design leaves unchanged only
  when it explains a decision, e.g. the existing building block a new one
  follows the pattern of. Never an id that neither the design nor the model
  has.
- Link modules, building blocks and behaviours only; a property, rule or
  scenario has no id. Name one in words beside its element's link.
- No links inside a Mermaid diagram; name the elements there in words.
