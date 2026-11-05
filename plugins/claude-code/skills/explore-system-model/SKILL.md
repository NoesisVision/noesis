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

## Contract

- Plan: `${CLAUDE_PLUGIN_ROOT}/contracts/diagram-plan.schema.json`, a JSON
  Schema. Read it now, not from memory. Its steps are the whole of what you
  can do to the diagram:
  - `add` elements by id; `addInside` an element with everything inside it;
    `addNeighbours` an element with what it reaches one step away, by the
    ways named (`contains`, `isPartOf`, `uses`, `usedBy`, `invokes`,
    `invokedBy`); `addChain` an element with everything it reaches that way,
    step after step, up to the next element of its own type;
  - `remove` elements, `clear` the diagram;
  - `relations` to draw exactly these of `contains`, `isPartOf`, `uses`,
    `invokes`; `direction` of the layout; `autoPlace` every card afresh.
- Baseline: `${CLAUDE_PLUGIN_ROOT}/contracts/system-model.schema.json`, the
  shape `get_newest_system_model` answers with. Its ids are the only ones a
  step may name.

## Steps

1. **Read the diagram as it stands.** The message ends with the diagram as
   JSON: `drawn`, the ids on it, and `relations`, those drawn. A request to
   add, remove or follow builds on it; a request for a diagram "of X" starts
   from it unless the person says to start over, in which case `clear` first.
2. **Load the model.** Call `get_newest_system_model`. When there is no scan
   yet, say so and stop: there is nothing to draw. Do not scan on your own
   here.
3. **Find what the person means.** Match their words to elements: by name
   (`Order`, `getCurrent`), by type (aggregates, repositories, commands), by
   module, by relation ("what uses the Discount", "the chain from
   PlaceOrder"). Ids spell the path: `module|sales.refunds`,
   `building_block|sales.refunds.Refund`,
   `behavior|sales.refunds.Refund.issue`.
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
5. **Answer with the plan**, in one fenced block tagged `noesis-diagram`,
   holding JSON that fits the contract: a one-line `summary` of what the
   diagram will show, and the `steps`. Then one or two sentences of prose at
   most: what the plan does, and anything you assumed. Nothing else.

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

- A step names only ids `get_newest_system_model` answered with. Never
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
