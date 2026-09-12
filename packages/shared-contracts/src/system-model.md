# The system model

Companion to `system-model.ts`.

The system model is the implemented model: what the source code contains,
projected into files under `system-model/` by the scanner. It uses the same
structural vocabulary as a design document — bounded contexts, domain modules,
building blocks, behaviours — so a design can be read against what exists, and
a scanned element can be matched to the designed one that introduced it.

- The scanner writes these files. Nobody edits them by hand, and no field is
  locked; a hand edit is overwritten by the next scan.
- Every element carries `source`: the file and line where it was declared,
  relative to the repository root. `null` means the scanner inferred the
  element rather than finding a declaration (a bounded context deduced from a
  package layout, for instance).
- Ids are stable across scans of the same unit, so references to scanned
  elements survive a re-scan. How the scanner derives them (from the
  declaration's qualified name) is its business, not the contract's.
- One file per scanned unit — what a unit is (a package, a service, a
  module) is fixed by the scanner pipeline that produces the files, and can
  differ between languages.

Skills read the system model to ground a design in what exists; they never
write it.
