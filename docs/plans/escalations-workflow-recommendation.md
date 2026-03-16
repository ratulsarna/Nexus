# Escalations Workflow Recommendation

## Recommendation

Yes, Nexus should eventually gain a first-class escalation workflow, but not a broad task-management product.

The right direction is a narrow blocker-and-approval queue for manager-to-user decisions. Do not port a larger generic tasks surface until that smaller workflow proves useful.

## Why

This fits Nexus better than Notes does.

Nexus already has:

- a manager/worker execution model
- moments where a manager needs approval, clarification, or a concrete user decision
- a chat stream that currently carries both normal conversation and blockers

That makes escalations a real product improvement instead of just a nice-to-have. A structured queue would reduce a common failure mode: important asks getting buried in the main chat stream while work continues elsewhere.

## What To Build

The first version should be framed as escalations, not tasks.

An escalation should mean:

- the manager needs something from the user
- the request is important enough to stay visible until resolved
- resolution should be explicit, not inferred from chat history alone

The smallest useful slice is:

1. persisted escalation records with `open` and `resolved` states
2. manager tooling and prompt guidance for opening and resolving escalations
3. pinned open escalations above the composer in chat
4. a lightweight dedicated queue view if the pinned-chat version feels too cramped

That is enough to improve blocker handling without committing Nexus to a full project-management layer.

## What Not To Build Yet

Do not turn this into a generic tasks system in the first pass:

- no assignee/status taxonomy beyond what blocker handling needs
- no broad approval workflow engine
- no standalone task-planning product surface
- no CLI work unless the UI workflow proves valuable first

Nexus should solve "the manager needs an answer from Ratul" before it solves "Nexus has its own task tracker."

## Product Shape

The intended mental model is:

- chat for normal back-and-forth
- escalations for blocked work that needs explicit user action

That separation is small enough to stay coherent and strong enough to improve day-to-day execution.

## Suggested Follow-Up Breakdown

If this direction is accepted, the next implementation project should be split into:

1. backend storage + protocol events for escalation lifecycle
2. manager prompt/tool contract for create/list/resolve escalation
3. chat pinning UI for open escalations
4. optional dedicated queue view only after the pinned-chat flow is working well
