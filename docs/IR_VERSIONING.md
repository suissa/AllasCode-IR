# AllasCode IR identity and versioning

## Stable semantic identity

Every semantic node has a deterministic `id` derived from its semantic kind and `canonicalLabel`. Source formatting, file names, ordering, adapter choice, comments, and provenance metadata must not change the identity of an otherwise equivalent semantic declaration.

The same semantic ID is intended to correlate the same concept across:

- AllasCode IR
- System Knowledge Graph
- vector memory
- Event Store
- benchmark evidence
- causal/temporal knowledge
- provenance
- Canonical Semantic Implementation Registry

## Source provenance is not identity

Two source documents may produce the same semantic node while retaining different provenance records. Provenance is evidence about how a semantic fact entered the IR; it is not part of the node's canonical identity.

## Semantic state

Every declaration carries one of four states:

- `inferred`: extracted without explicit confirmation;
- `suggested`: proposed by the system for developer review;
- `confirmed`: accepted as semantic truth for the specification;
- `rejected`: explicitly declined and retained as provenance/negative elicitation knowledge.

Adapters must never silently promote `inferred` or `suggested` semantics to `confirmed`.

## IR versions

IR versions use `major.minor` semantic versioning at the representation level.

- Minor versions may add optional fields or new compatible semantic types.
- Major versions may change meaning, required structure, identity rules, or reference semantics.
- Generated implementation versions are independent of IR versions.
- AllasDSL versions are independent of IR versions; each DSL version declares the IR versions it can emit.

## Migration rules

A migration must be deterministic and produce a machine-readable report containing:

- source IR version;
- target IR version;
- transformed fields;
- unresolved semantic changes;
- warnings about information loss;
- whether stable semantic IDs were preserved.

A migration must not guess new domain semantics. If a target representation requires information absent in the source, the migrator creates an `unresolved` semantic slot instead.

## Compatibility invariant

```text
EquivalentSemantics(A, B)
=>
CanonicalIdentity(A) == CanonicalIdentity(B)
```

A representation-only migration must preserve semantic IDs. If a semantic meaning changes, a new identity must be produced or an explicit supersession relation must be recorded downstream.

## Partial versus complete IR

Partial IR is a first-class state used by progressive semantic elicitation. It may contain missing concepts and `unresolved` entries while remaining structurally valid.

Complete IR is partial IR that additionally satisfies compilation-readiness rules such as:

- problem and objective are known;
- required Entities, Intents, Behaviors and Flows exist;
- references resolve;
- relevant Invariants, Constraints and Policies are present;
- expected behavior has executable semantic TestContracts;
- no error diagnostics remain;
- no blocking unresolved semantic slots remain.

Structural schema validation and semantic completeness are intentionally separate. The completeness engine determines whether a structurally valid IR is ready for downstream compilation.
