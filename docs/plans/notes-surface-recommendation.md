# Notes Surface Recommendation

## Recommendation

Do not make Notes a first-class Nexus surface right now.

Nexus should keep treating long-form planning and research as file-backed artifacts for now, then revisit a dedicated notes product only when the current artifact workflow becomes a real bottleneck.

## Why

Nexus already has a strong local-file story:

- managers and workers can produce markdown artifacts naturally
- the UI already has artifact discovery and a file viewer
- local editor handoff is cheap because this is a local-first tool for one primary operator

The `middleman` notes branch is interesting, but it is not a small enhancement. It bundles:

- backend CRUD and search semantics
- a dedicated navigation surface
- a rich editor dependency stack
- autosave, folder management, and restore behavior
- prompt and workflow changes that assume Notes is part of the core product

That is a product bet, not a backport. Adopting it now would add a second persistent content model before the artifact model has been pushed to its natural limit.

## What Nexus Should Do Instead

Keep the product centered on chat + artifacts + local files.

When a manager needs a plan, research memo, or working note, the preferred path should be:

1. write markdown to the workspace
2. surface it back through artifact links
3. open and continue editing in the local editor when needed

That keeps the mental model simple:

- chat is for coordination
- artifacts are for outputs
- the filesystem is the persistent working surface

## Smallest Useful Slice If We Revisit This

If Notes becomes painful enough to justify product work, the first slice should be intentionally small:

- file-backed markdown only
- a conventional notes root such as `notes/` or `.nexus/notes/`
- lightweight list/open/create flows in the UI
- reuse the existing artifact panel where possible
- no rich editor rewrite on day one
- no folder tree, drag-and-drop, or search palette until basic usage proves out

The key constraint is to build on the artifact/file model, not beside it.

## Explicit No-Go For Now

Do not port the full `middleman` notes stack now:

- no Lexical editor adoption
- no dedicated notes explorer
- no autosave/search/folder-management project
- no manager prompt contract that assumes Notes is always available

That work only makes sense once Nexus explicitly decides to become a broader research/planning environment rather than primarily a swarm orchestration workspace.
