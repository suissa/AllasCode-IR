# AllasDSL v0.1

AllasDSL is the human-facing semantic language of AllasCode. It describes **what exists, what is intended, what must happen, what must never happen, and what result is expected**. It does not choose implementation language, framework, database, container, scheduler, or deployment technology.

The developer reasons at the largest useful abstraction level: problem, context, objective, business model, restrictions, creativity, and domain flow. AllasCode decomposes those semantics into the smallest executable units.

## Core concepts

AllasDSL v0.1 supports:

- `Entity`
- `Intent`
- `Behavior`
- `Flow`
- `Invariant`
- `Constraint`
- `Policy`

The canonical AllasCode IR additionally materializes `Schema` and implementation-agnostic `TestContract` artifacts.

## Example

```allas
system ClinicScheduling
problem = "Patients need to reserve an available appointment without double booking."
context = "A clinic offers services through multiple professionals."
objective = "A valid reservation produces exactly one scheduled appointment."

entity Patient
  property id: uuid required
  property name: string required
end

entity Professional
  property id: uuid required
  property name: string required
end

entity Appointment
  property id: uuid required
  property startsAt: datetime required
  property status: AppointmentStatus required
  relation patient -> Patient one
  relation professional -> Professional one
  invariant NoDoubleBooking = "A professional cannot have overlapping confirmed appointments"
end

behavior ReserveSlot for Appointment
  given "the requested slot is available"
  when "the scheduling intent is accepted"
  then "exactly one Appointment becomes scheduled"
  must_not "two confirmed appointments overlap for the same professional"
end

flow ScheduleAppointment
  step "validate patient"
  step "validate professional"
  step "check availability" invokes ReserveSlot
  step "reserve slot" invokes ReserveSlot
  step "emit scheduled event"
end

intent ScheduleAppointment
  uses Patient, Professional, Appointment
  behavior ReserveSlot
  flow ScheduleAppointment
  expects "one valid Appointment is scheduled"
end

constraint SchedulingLatency = "p99 completion time must remain within the declared operational envelope"
policy SchedulingAuthorization = "only authorized actors may request scheduling"
```

## Grammar

The reference grammar is intentionally line-oriented so it can be generated reliably by chat systems and reviewed manually.

```ebnf
document        = { statement } ;
statement       = system | metadata | entity | intent | behavior | flow | rule ;
system          = "system" value ;
metadata        = ("problem" | "context" | "objective") "=" value ;
entity          = "entity" identifier newline { property | relation | nestedRule } "end" ;
property        = "property" identifier ":" identifier ["required" | "optional"] ;
relation        = "relation" identifier "->" identifier [cardinality] ;
cardinality     = "one" | "zero-or-one" | "many" | "one-or-many" ;
intent          = "intent" identifier newline { uses | intentBehavior | intentFlow | expects } "end" ;
uses            = "uses" identifier {"," identifier} ;
intentBehavior  = "behavior" identifier {"," identifier} ;
intentFlow      = "flow" identifier ;
expects         = "expects" value ;
behavior        = "behavior" identifier ["for" identifier] newline { behaviorClause } "end" ;
behaviorClause  = ("given" | "when" | "then" | "must_not") value ;
flow            = "flow" identifier newline { flowStep } "end" ;
flowStep        = "step" value ["invokes" identifier] ;
rule            = ruleKind identifier ["for" identifier] "=" value ;
nestedRule      = ruleKind identifier "=" value ;
ruleKind        = "invariant" | "constraint" | "policy" ;
identifier      = ? non-whitespace token ? ;
value           = ? quoted or unquoted text to end of line ? ;
newline         = ? line break ? ;
```

## Semantic rules

1. Semantic declarations are implementation-agnostic.
2. Every emitted IR node receives a stable semantic ID derived from its kind and canonical label.
3. A relation to an undeclared Entity remains unresolved; the compiler does not invent the missing Entity.
4. Intents reference Entities, Behaviors and optionally a Flow.
5. Behaviors describe observable semantics through `given`, `when`, `then`, and `must_not` clauses.
6. Each Behavior produces an implementation-agnostic executable `TestContract` in the IR.
7. Invariants describe conditions that must always hold.
8. Constraints bound the solution space.
9. Policies define authorization/governance rules.
10. Invalid syntax produces diagnostics; the parser never silently repairs semantics.

## Reserved words

`system`, `problem`, `context`, `objective`, `entity`, `property`, `relation`, `intent`, `behavior`, `flow`, `step`, `uses`, `expects`, `given`, `when`, `then`, `must_not`, `invariant`, `constraint`, `policy`, `for`, `invokes`, `end`, `required`, `optional`.

## Versioning

AllasDSL syntax is versioned independently from generated implementations. v0.1 compiles to AllasCode IR `0.1`. A future syntax version must either preserve semantic equivalence or ship an explicit migration. Canonical semantic IDs must not change solely because source formatting changes.
