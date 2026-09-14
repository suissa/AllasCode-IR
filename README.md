# AllasCode IR

AllasCode IR is the tool-agnostic semantic intermediate representation of AllasCode.

Its purpose is to let developers describe systems in terms of **problem, context, objective, domain semantics, behavior and constraints** while downstream AllasCode components decide implementation details.

```text
Spec Kit ───────────┐
OpenSpec ───────────┤
custom requirements ├──→ AllasCode IR
chat interview ─────┤
markdown spec ──────┤
JSON/YAML ──────────┤
AllasDSL ───────────┘

AllasCode IR
   ↓
Entities
Intents
Behaviors
Flows
Policies
Invariants
Constraints
Schemas
Tests
```

## Design principle

The human reasons at the largest useful abstraction level:

```text
problem
context
objective
business model
constraints
creativity
```

AllasCode decomposes those semantics into the smallest executable units. A developer should not need to choose TypeScript, Go, Rust, Zig, Postgres, Redis, Kafka, Docker, Kubernetes, or any other implementation technology while specifying the problem.

The core rule is:

> AI may propose structure, but inferred semantics never become confirmed semantics without explicit evidence or developer confirmation.

## AllasDSL

`AllasDSL` is the reference human-facing DSL. It is intentionally small and entity-centric.

Core concepts:

```text
Intent
Entity
Behavior
Invariant
Constraint
Policy
Flow
```

See [`docs/ALLASDSL.md`](docs/ALLASDSL.md) and [`examples/clinic.allas`](examples/clinic.allas).

## Stable semantic identity

Every IR node receives:

- a deterministic semantic `id`;
- a `canonicalLabel`;
- provenance;
- semantic state (`inferred`, `suggested`, `confirmed`, `rejected`).

Formatting changes must not change semantic identity. The same IDs are intended to be shared by graph, vector, event, benchmark, provenance, healing and registry stores.

## Behavior-first validation

Behaviors are implementation-independent contracts:

```text
given
when
then
must_not
```

Each Behavior is converted into a semantic `TestContract`. These tests describe behavior, not implementation. Language-specific executable tests are generated later by the testing/healing pipeline.

## Progressive semantic elicitation

AllasCodeForger can build partial IR from an interview. The first questions are intentionally macro-level:

1. Qual problema você quer resolver?
2. Como esse problema deve ser resolvido?
3. Qual é o fluxo principal que resolve esse problema?
4. Quais Entidades são necessárias?

The completeness engine then identifies missing relations, outcomes, Behaviors, Invariants, Constraints, Policies and unresolved references, generating suggestions instead of silently inventing domain facts.

## Input adapters

Implemented adapters:

- AllasDSL
- JSON
- YAML
- Markdown
- Spec Kit-shaped structured input
- OpenSpec-shaped structured input
- custom requirement documents
- structured chat interview input

Every adapter normalizes to the same `AllasCodeIR` structure.

## CLI

Requires Node.js 24+.

```bash
npm install
npm run build
```

Compile AllasDSL to canonical JSON IR:

```bash
npm run cli -- compile examples/clinic.allas
```

Validate schema, diagnostics and semantic completeness:

```bash
npm run cli -- validate examples/clinic.allas
```

Show completeness/suggestions:

```bash
npm run cli -- completeness examples/clinic.allas
```

Materialize the canonical semantic artifact tree:

```bash
npm run cli -- materialize examples/clinic.allas -o generated
```

Generated structure:

```text
generated/
├── entities/
├── intents/
├── behaviors/
├── flows/
├── policies/
├── invariants/
├── constraints/
├── schemas/
├── tests/
└── manifest.yml
```

## Canonical schema

The versioned JSON Schema is available at:

```text
schema/allascode-ir.schema.json
```

IR version `0.1` preserves provenance and unresolved semantics so adapters cannot hide uncertainty.

## Architecture

```text
source
  ↓
adapter
  ↓
semantic normalization
  ↓
AllasCode IR
  ├── schema validation
  ├── reference validation
  ├── completeness analysis
  └── semantic suggestions
  ↓
canonical artifact tree
  ↓
CanonicalResolver / Registry / ArchitectureCompiler
```

This repository stops at semantic IR and implementation-independent artifacts. It does **not** choose or generate final implementation technology.

## Conformance goal

Equivalent semantics expressed through different source formats must converge to equivalent IR. CI contains cross-adapter tests to catch semantic drift, accidental inference and identity instability.

## Status

Reference implementation: `v0.1`.
