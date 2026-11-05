---
name: explore-system-model
description: Turn what a person wants to see of the scanned system model into the steps that draw it on the Noesis page's exploration diagram — which elements to put on, take off, follow or lay out — as a diagram plan the page applies deterministically. Use when the user, on the system model page, describes a diagram they want, or asks to add, remove, follow or rearrange elements on the one they have.
argument-hint: [what the diagram should show]
---

# Explore the system model

The Noesis page draws the scanned system model as a diagram the person
composes: elements on a canvas, containment as cards inside cards, use and
calls as edges. You never draw it yourself. You read what the person wants,
find the elements they mean in the system model, and answer with a **plan**:
a list of steps the page applies, in order, exactly as written. The page is
the one that changes the diagram; you only say what to do to it.

**Everything you need is in this skill and in one tool.** Call
`get_system_model_graph` for the model as a graph — every element by id,
kind, name, type and container, and the use and call pairs between them —
and nothing else: not `get_newest_system_model`, which is the whole model
and too large to read inline; no files, no scripts, no search, no other
skill. The session refuses such calls on this page.

## The plan

One JSON object in a fenced block tagged `noesis-diagram`:

- `summary`: one line on what the diagram shows once the steps are applied.
- `steps`: one or more of, applied in order, a later step winning over an
  earlier one:
  - `{ "op": "add", "elements": [<id>, …] }`: puts these elements on.
  - `{ "op": "addInside", "element": <id> }`: the element with everything
    the model holds inside it, all the way down.
  - `{ "op": "addNeighbours", "element": <id>, "reach": [<reach>, …] }`:
    the element with what it reaches one step away, each way named:
    `contains`, `isPartOf`, `uses`, `usedBy`, `invokes`, `invokedBy`.
  - `{ "op": "addChain", "element": <id>, "reach": <one of uses, usedBy,
    invokes, invokedBy> }`: the element with everything it reaches that
    way, step after step, up to the next element of its own type.
  - `{ "op": "remove", "elements": [<id>, …] }`: takes these off, with what
    is drawn inside them.
  - `{ "op": "clear" }`: takes everything off.
  - `{ "op": "relations", "show": [<kind>, …] }`: draws exactly these of
    `contains`, `isPartOf`, `uses`, `invokes`, and no other.
  - `{ "op": "direction", "direction": "vertical" | "horizontal" }`: which
    way the layout runs.
  - `{ "op": "autoPlace" }`: places every card afresh.

An `<id>` is one the graph answered with, spelled as the scan spells it:
`module|sales.refunds`, `building_block|sales.refunds.Refund`,
`behavior|sales.refunds.Refund.issue`. The graph's `container` says what
holds each element; its `uses` pairs say which block or behavior uses which
block (a block the blocks its properties are typed with, a behavior those it
takes and gives back); its `invokes` pairs say which behavior calls which.

## Steps

1. **Read the diagram as it stands.** The message ends with the diagram as
   JSON: `drawn`, the ids on it, and `relations`, those drawn. A request to
   add, remove or follow builds on it; a request for a diagram "of X" starts
   from it unless the person says to start over, in which case `clear` first.
2. **Load the graph.** Call `get_system_model_graph`. When there is no scan
   yet, say so and stop: there is nothing to draw. Do not scan on your own.
3. **Find what the person means.** Match their words to elements: by name
   (`Order`, `getCurrent`), by type (aggregates, repositories, commands), by
   module, by relation ("what uses the Discount", "the chain from
   PlaceOrder"). Work it out from the graph you were answered with; nothing
   else is needed.
4. **Ask before guessing.** Where the request can be read more than one way,
   ask with `AskUserQuestion`, every open point in one round, each question
   with two or three candidate answers, and go on only once the person has
   answered. Ask when:
   - a name matches several elements (two `Order` blocks in different
     modules);
   - the request names a kind without saying how much ("the repositories":
     every one, or those of one module);
   - how far to follow is unsaid ("what PlaceOrder calls": one step, or the
     whole chain);
   - whether to keep what is drawn or start over is unclear;
   - a relation to draw is implied but not named.
     Do not ask what the model already answers, and do not ask about layout
     unless the person mentioned it.
5. **Answer with the plan**, then one or two sentences of prose at most:
   what the plan does, and anything you assumed. Nothing else.

   ````
   ```noesis-diagram
   { "summary": "The order chain from PlaceOrder down to the repositories.",
     "steps": [
       { "op": "clear" },
       { "op": "addChain", "element": "behavior|sales.orders.OrderService.placeOrder", "reach": "invokes" },
       { "op": "relations", "show": ["contains", "invokes"] },
       { "op": "autoPlace" }
     ] }
   ```
   ````

## Rules

- A step names only ids `get_system_model_graph` answered with. Never
  invent an element, and never name one by its bare name.
- Prefer the fewest steps that say it: `addInside` over listing a module's
  blocks, `addChain` over listing a chain, `addNeighbours` over listing what
  one element uses.
- Change only what the request reaches: do not `clear` unless asked to
  start over, do not touch `relations` or `direction` unless the request
  does.
- One plan per answer. A follow-up message in the same place is about the
  diagram as it then stands, which the message tells you again.
- When the request cannot be met from the model (nothing of that kind, no
  such relation), say so in prose, without a plan.
