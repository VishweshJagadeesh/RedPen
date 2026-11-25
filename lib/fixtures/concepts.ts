/** CBSE Class 8 and 9 mathematics concept tree: chapter → concept → optional subconcept. */

export interface ConceptFixture {
  id: string;
  subject: string;
  gradeLevel: number;
  chapter: string;
  name: string;
  parentId?: string;
  order: number;
}

const M = "Mathematics";
let order = 0;
function c(id: string, gradeLevel: number, chapter: string, name: string, parentId?: string): ConceptFixture {
  return { id, subject: M, gradeLevel, chapter, name, parentId, order: order++ };
}

export const CONCEPTS: ConceptFixture[] = [
  // Class 8
  c("c8-rn-properties", 8, "Rational Numbers", "Properties of rational numbers"),
  c("c8-rn-between", 8, "Rational Numbers", "Rational numbers between two rationals"),
  c("c8-rn-numberline", 8, "Rational Numbers", "Representation on the number line"),
  c("c8-le-transposing", 8, "Linear Equations in One Variable", "Transposing terms"),
  c("c8-le-transposing-const", 8, "Linear Equations in One Variable", "Transposing a constant", "c8-le-transposing"),
  c("c8-le-transposing-var", 8, "Linear Equations in One Variable", "Transposing a variable term", "c8-le-transposing"),
  c("c8-le-bothsides", 8, "Linear Equations in One Variable", "Variables on both sides"),
  c("c8-le-word", 8, "Linear Equations in One Variable", "Word problems"),
  c("c8-sq-properties", 8, "Squares and Square Roots", "Properties of square numbers"),
  c("c8-sq-prime", 8, "Squares and Square Roots", "Square root by prime factorisation"),
  c("c8-sq-longdiv", 8, "Squares and Square Roots", "Square root by long division"),
  c("c8-ae-multiply", 8, "Algebraic Expressions and Identities", "Multiplying polynomials"),
  c("c8-ae-identities", 8, "Algebraic Expressions and Identities", "Standard identities"),
  c("c8-ae-terms", 8, "Algebraic Expressions and Identities", "Like terms and addition"),
  c("c8-me-area", 8, "Mensuration", "Area of trapezium and polygons"),
  c("c8-me-surface", 8, "Mensuration", "Surface area of cube, cuboid and cylinder"),
  c("c8-me-volume", 8, "Mensuration", "Volume of cube, cuboid and cylinder"),
  c("c8-cq-percent", 8, "Comparing Quantities", "Percentage increase and decrease"),
  c("c8-cq-discount", 8, "Comparing Quantities", "Discount and tax"),
  c("c8-cq-ci", 8, "Comparing Quantities", "Compound interest"),
  // Class 9
  c("c9-ns-irrational", 9, "Number Systems", "Irrational numbers"),
  c("c9-ns-rationalise", 9, "Number Systems", "Rationalising the denominator"),
  c("c9-ns-exponents", 9, "Number Systems", "Laws of exponents for real numbers"),
  c("c9-po-zeroes", 9, "Polynomials", "Zeroes of a polynomial"),
  c("c9-po-factor", 9, "Polynomials", "Remainder and factor theorem"),
  c("c9-po-identities", 9, "Polynomials", "Algebraic identities"),
  c("c9-cg-plotting", 9, "Coordinate Geometry", "Plotting points"),
  c("c9-cg-quadrants", 9, "Coordinate Geometry", "Quadrants and axes"),
  c("c9-le2-solutions", 9, "Linear Equations in Two Variables", "Solutions of a linear equation"),
  c("c9-le2-graph", 9, "Linear Equations in Two Variables", "Graph of a linear equation"),
];

export const CONCEPT_BY_ID: Record<string, ConceptFixture> = Object.fromEntries(CONCEPTS.map((x) => [x.id, x]));

/** Short labels for dense views (heatmap headers). Full names stay in tooltips. */
export const CONCEPT_SHORT: Record<string, string> = {
  "c8-rn-properties": "Properties",
  "c8-rn-between": "Between two rationals",
  "c8-rn-numberline": "Number line",
  "c8-le-transposing": "Transposing terms",
  "c8-le-bothsides": "Variables both sides",
  "c8-le-word": "Word problems",
  "c8-sq-properties": "Square properties",
  "c8-sq-prime": "√ by prime factors",
  "c8-sq-longdiv": "√ by long division",
  "c8-ae-multiply": "Multiplying",
  "c8-ae-identities": "Identities",
  "c8-ae-terms": "Like terms",
  "c8-me-area": "Area",
  "c8-me-surface": "Surface area",
  "c8-me-volume": "Volume",
  "c8-cq-percent": "% increase / decrease",
  "c8-cq-discount": "Discount & tax",
  "c8-cq-ci": "Compound interest",
  "c9-ns-irrational": "Irrational numbers",
  "c9-ns-rationalise": "Rationalising",
  "c9-ns-exponents": "Exponent laws",
  "c9-po-zeroes": "Zeroes",
  "c9-po-factor": "Factor theorem",
  "c9-po-identities": "Identities",
  "c9-cg-plotting": "Plotting points",
  "c9-cg-quadrants": "Quadrants",
  "c9-le2-solutions": "Solutions",
  "c9-le2-graph": "Graphs",
};

export function conceptShort(id: string, fallback: string): string {
  return CONCEPT_SHORT[id] ?? fallback;
}

export function conceptName(id: string): string {
  return CONCEPT_BY_ID[id]?.name ?? id;
}

/**
 * Known misconceptions per concept. The grader is asked to pick one of these labels when it fits,
 * so the class view can count them reliably. Keys are stable; labels are what teachers see.
 */
export interface MisconceptionDef {
  key: string;
  label: string;
  labelHi: string;
  mistakeType: "conceptual" | "procedural" | "calculation";
}

export const MISCONCEPTIONS: Record<string, MisconceptionDef[]> = {
  "c8-le-transposing": [
    {
      key: "sign-not-changed",
      label: 'Moves a term across "=" without changing its sign',
      labelHi: '"=" के पार पद ले जाते समय चिह्न नहीं बदलना',
      mistakeType: "conceptual",
    },
    {
      key: "one-side-only",
      label: "Applies an operation to one side only",
      labelHi: "संक्रिया केवल एक पक्ष पर करना",
      mistakeType: "conceptual",
    },
    {
      key: "arithmetic-slip",
      label: "Correct method, arithmetic slip",
      labelHi: "सही विधि, गणना में चूक",
      mistakeType: "calculation",
    },
  ],
  "c8-le-bothsides": [
    { key: "sign-not-changed", label: 'Moves a term across "=" without changing its sign', labelHi: '"=" के पार पद ले जाते समय चिह्न नहीं बदलना', mistakeType: "conceptual" },
    { key: "one-side-only", label: "Applies an operation to one side only", labelHi: "संक्रिया केवल एक पक्ष पर करना", mistakeType: "conceptual" },
    { key: "arithmetic-slip", label: "Correct method, arithmetic slip", labelHi: "सही विधि, गणना में चूक", mistakeType: "calculation" },
  ],
  "c8-le-word": [
    { key: "equation-setup", label: "Sets up the equation incorrectly from the words", labelHi: "शब्दों से समीकरण गलत बनाना", mistakeType: "conceptual" },
    { key: "arithmetic-slip", label: "Correct method, arithmetic slip", labelHi: "सही विधि, गणना में चूक", mistakeType: "calculation" },
  ],
};

export const GENERIC_MISCONCEPTION = {
  calculation: "Correct method, arithmetic slip",
  incomplete: "Stopped before completing the solution",
} as const;

export function misconceptionLabel(conceptId: string, key: string): string {
  return MISCONCEPTIONS[conceptId]?.find((m) => m.key === key)?.label ?? key;
}

export function misconceptionHindi(label: string): string | undefined {
  for (const list of Object.values(MISCONCEPTIONS)) {
    const hit = list.find((m) => m.label === label);
    if (hit) return hit.labelHi;
  }
  return undefined;
}
