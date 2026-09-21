/**
 * Module 27 — KPI / BI lifecycle. Does not post money or replace Module 11 report screens.
 */

export const BI_SCHEMA_LIFECYCLE = "1.0.0";

export const KPI_STATES = ["draft", "testing", "approved", "published", "deprecated", "retired"];

export const KPI_TRANSITIONS = {
  draft: ["testing", "retired"],
  testing: ["approved", "draft", "retired"],
  approved: ["published", "testing", "retired"],
  published: ["deprecated", "retired"],
  deprecated: ["retired"],
  retired: []
};

export function canTransitionKpi(from, to) {
  return (KPI_TRANSITIONS[from] || []).includes(to);
}

export function assertBiLifecycleBoundary() {
  return {
    documentedOnly: true,
    postsCollections: false,
    restHttp: false,
    graphqlHttp: false,
    replacesModule11: false
  };
}
