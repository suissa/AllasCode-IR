export type SemanticState = "inferred" | "suggested" | "confirmed" | "rejected";

export type SourceKind =
  | "allasdsl"
  | "spec-kit"
  | "openspec"
  | "custom"
  | "chat"
  | "markdown"
  | "json"
  | "yaml";

export interface Provenance {
  sourceKind: SourceKind;
  sourceRef?: string;
  locator?: string;
  excerpt?: string;
  confidence?: number;
}

export interface SemanticNode {
  id: string;
  canonicalLabel: string;
  name: string;
  description?: string;
  aliases?: string[];
  state: SemanticState;
  provenance: Provenance[];
}

export interface EntityProperty {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

export interface EntityRelation {
  name: string;
  target: string;
  cardinality?: "one" | "zero-or-one" | "many" | "one-or-many";
  description?: string;
}

export interface Entity extends SemanticNode {
  properties: EntityProperty[];
  relations: EntityRelation[];
}

export interface Intent extends SemanticNode {
  entities: string[];
  behaviors: string[];
  flow?: string;
  expectedResult?: string;
}

export interface Behavior extends SemanticNode {
  entity?: string;
  given: string[];
  when: string[];
  then: string[];
  mustNot: string[];
}

export interface FlowStep {
  id: string;
  description: string;
  invokes?: string;
}

export interface Flow extends SemanticNode {
  steps: FlowStep[];
}

export interface RuleNode extends SemanticNode {
  scope?: string;
  expression: string;
}

export type Invariant = RuleNode;
export type Constraint = RuleNode;
export type Policy = RuleNode;

export interface SchemaNode extends SemanticNode {
  definition: unknown;
}

export type TestKind =
  | "behavior"
  | "acceptance"
  | "regression"
  | "invariant"
  | "conformance"
  | "causal-chaos";

export interface TestContract extends SemanticNode {
  kind: TestKind;
  behavior?: string;
  given: string[];
  when: string[];
  then: string[];
  mustNot: string[];
  hidden?: boolean;
}

export interface UnresolvedSemantic {
  id: string;
  question: string;
  relatedTo?: string[];
  reason: string;
  provenance: Provenance[];
}

export interface Diagnostic {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  path?: string;
}

export interface AllasCodeIR {
  irVersion: "0.1";
  system: {
    name: string;
    description?: string;
    problem?: string;
    context?: string;
    objective?: string;
  };
  entities: Entity[];
  intents: Intent[];
  behaviors: Behavior[];
  flows: Flow[];
  policies: Policy[];
  invariants: Invariant[];
  constraints: Constraint[];
  schemas: SchemaNode[];
  tests: TestContract[];
  unresolved: UnresolvedSemantic[];
  diagnostics: Diagnostic[];
}

export function emptyIR(name = "UnnamedSystem"): AllasCodeIR {
  return {
    irVersion: "0.1",
    system: { name },
    entities: [],
    intents: [],
    behaviors: [],
    flows: [],
    policies: [],
    invariants: [],
    constraints: [],
    schemas: [],
    tests: [],
    unresolved: [],
    diagnostics: [],
  };
}
