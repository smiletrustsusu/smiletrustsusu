/**
 * Module 29 — Enterprise AI lifecycle catalogs, error codes, and boundary assertions.
 * AI is advisory/probabilistic. Module 24 Rule Engine remains deterministic authority.
 * No REST/GraphQL HTTP server. Does not post collections or auto-approve financial actions.
 */

export const AI_SCHEMA_LIFECYCLE = "1.0.0";
export const AI_PLATFORM_VERSION = "1.0.0";

export const MODEL_STATES = ["draft", "registered", "approved", "deployed", "shadow", "canary", "retired", "rolled_back"];
export const MODEL_TRANSITIONS = {
  draft: ["registered", "retired"],
  registered: ["approved", "retired"],
  approved: ["deployed", "shadow", "canary", "retired"],
  deployed: ["rolled_back", "retired", "canary"],
  shadow: ["deployed", "retired", "rolled_back"],
  canary: ["deployed", "rolled_back", "retired"],
  rolled_back: ["approved", "retired"],
  retired: []
};

export const DATASET_STATES = ["draft", "registered", "approved", "retired"];
export const FEATURE_STATES = ["draft", "registered", "approved", "retired"];
export const DATA_CLASSIFICATIONS = ["Public", "Internal", "Confidential", "Restricted"];
export const RECOMMENDATION_DECISIONS = ["pending", "accepted", "rejected", "overridden"];
export const FRAUD_SEVERITIES = ["low", "medium", "high", "critical"];
export const DRIFT_SEVERITIES = ["info", "warning", "critical"];

export const AI_GOVERNANCE_ROLES = [
  "AI Platform Admin",
  "Chief Data Steward",
  "Data Steward",
  "Data Engineer",
  "ML Engineer",
  "MLOps",
  "AI Security",
  "Compliance",
  "Model Validator",
  "Internal Auditor",
  "Business Owner",
  "Risk Manager"
];

export const AI_ERROR_CODES = {
  "AI-001": "Enterprise AI platform disabled",
  "AI-002": "Unauthorized AI action",
  "AI-003": "Model not found",
  "AI-004": "Model not approved for deployment",
  "AI-005": "Feature not found",
  "AI-006": "Dataset not found",
  "AI-007": "Dataset not approved or checksum invalid",
  "AI-008": "Prediction failed validation",
  "AI-009": "Recommendation cannot mutate ledger or auto-approve loans",
  "AI-010": "Fraud detection input invalid",
  "AI-011": "Risk scoring configuration missing",
  "AI-012": "Forecast horizon invalid",
  "AI-013": "Anomaly detection failed",
  "AI-014": "Training job rejected",
  "AI-015": "Deployment blocked by SoD or approval",
  "AI-016": "Drift event not found",
  "AI-017": "Inference blocked — no production model",
  "AI-018": "Human oversight decision requires justification",
  "AI-019": "Restricted data not authorized for UI",
  "AI-020": "Input validation failed before train/inference",
  "AI-030": "Unknown AI permission",
  "AI-031": "Invalid AI permission scope",
  "AI-032": "Assignment scope not permitted",
  "AI-033": "Assigner role insufficient for Critical permission",
  "AI-034": "Delegation not permitted",
  "AI-035": "Granted scope insufficient",
  "AI-040": "Segregation of duties violation",
  "AI-050": "Feature flag or config rejected"
};

export const AI_ROUTE_CATALOG = [
  { id: "ai.health", method: "GET", path: "/ai/health", versions: ["v1"], action: "Ai.View", scopes: ["ai", "*"], graphql: "aiHealth", required: [], idempotent: false },
  { id: "ai.dashboard", method: "GET", path: "/ai/dashboard", versions: ["v1"], action: "Ai.View", scopes: ["ai", "*"], graphql: "aiDashboard", required: [], idempotent: false },
  { id: "ai.predict", method: "POST", path: "/ai/predict", versions: ["v1"], action: "Ai.Predict", scopes: ["ai", "*"], graphql: "aiPredict", required: ["target"], idempotent: true },
  { id: "ai.fraud.detect", method: "POST", path: "/ai/fraud/detect", versions: ["v1"], action: "Ai.Predict", scopes: ["ai", "*"], graphql: "aiFraudDetect", required: [], idempotent: true },
  { id: "ai.risk.score", method: "POST", path: "/ai/risk/score", versions: ["v1"], action: "Ai.Predict", scopes: ["ai", "*"], graphql: "aiRiskScore", required: ["entityType"], idempotent: true },
  { id: "ai.recommend", method: "POST", path: "/ai/recommend", versions: ["v1"], action: "Ai.Predict", scopes: ["ai", "*"], graphql: "aiRecommend", required: ["kind"], idempotent: true },
  { id: "ai.forecast", method: "POST", path: "/ai/forecast", versions: ["v1"], action: "Ai.Predict", scopes: ["ai", "*"], graphql: "aiForecast", required: ["horizon"], idempotent: true },
  { id: "ai.anomaly.detect", method: "POST", path: "/ai/anomaly/detect", versions: ["v1"], action: "Ai.Predict", scopes: ["ai", "*"], graphql: "aiAnomalyDetect", required: [], idempotent: true },
  { id: "ai.model.list", method: "GET", path: "/ai/models", versions: ["v1"], action: "Ai.View", scopes: ["ai", "*"], graphql: "listAiModels", required: [], idempotent: false },
  { id: "ai.model.deploy", method: "POST", path: "/ai/models/deploy", versions: ["v1"], action: "Ai.Admin", scopes: ["ai", "*"], graphql: "deployAiModel", required: ["modelVersionId"], idempotent: true },
  { id: "ai.feature.list", method: "GET", path: "/ai/features", versions: ["v1"], action: "Ai.View", scopes: ["ai", "*"], graphql: "listAiFeatures", required: [], idempotent: false },
  { id: "ai.dataset.list", method: "GET", path: "/ai/datasets", versions: ["v1"], action: "Ai.View", scopes: ["ai", "*"], graphql: "listAiDatasets", required: [], idempotent: false },
  { id: "ai.governance.dashboard", method: "GET", path: "/ai/governance", versions: ["v1"], action: "Ai.Govern", scopes: ["ai", "*"], graphql: "aiGovernanceDashboard", required: [], idempotent: false },
  { id: "ai.statistics", method: "GET", path: "/ai/statistics", versions: ["v1"], action: "Ai.View", scopes: ["ai", "*"], graphql: "aiStatistics", required: [], idempotent: false }
];

export const SEEDED_MODELS = [
  { code: "MDL-GROWTH-V1", name: "Customer Growth Heuristic", family: "prediction", version: "1.0.0" },
  { code: "MDL-SAVINGS-V1", name: "Savings Trajectory", family: "prediction", version: "1.0.0" },
  { code: "MDL-LOAN-DEMAND-V1", name: "Loan Demand", family: "prediction", version: "1.0.0" },
  { code: "MDL-DEFAULT-V1", name: "Loan Default Risk", family: "risk", version: "1.0.0" },
  { code: "MDL-CASHFLOW-V1", name: "Cash Flow Forecast", family: "forecast", version: "1.0.0" },
  { code: "MDL-FRAUD-V1", name: "Fraud Heuristics", family: "fraud", version: "1.0.0" },
  { code: "MDL-ANOMALY-V1", name: "Anomaly Detector", family: "anomaly", version: "1.0.0" },
  { code: "MDL-PRODUCTIVITY-V1", name: "Collector Productivity", family: "prediction", version: "1.0.0" }
];

export const SEEDED_FEATURES = [
  { code: "FEAT-COLLECTIONS-7D", name: "Collections 7d sum (pesewas)", dtype: "integer" },
  { code: "FEAT-LOAN-UTIL", name: "Loan utilization ratio", dtype: "decimal" },
  { code: "FEAT-ACTIVE-CUSTOMERS", name: "Active customer count", dtype: "integer" },
  { code: "FEAT-PAYMENT-FAIL-RATE", name: "Payment failure rate", dtype: "decimal" },
  { code: "FEAT-WITHDRAWAL-VELOCITY", name: "Withdrawal velocity", dtype: "decimal" },
  { code: "FEAT-BRANCH-VOLUME", name: "Branch collection volume", dtype: "integer" },
  { code: "FEAT-AUTH-FAILS", name: "Auth failure count", dtype: "integer" },
  { code: "FEAT-EXPORT-BURST", name: "Export burst score", dtype: "decimal" }
];

export const SEEDED_DATASETS = [
  { code: "DS-COLLECTIONS-AGG", name: "Collections aggregates", classification: "Internal" },
  { code: "DS-LOAN-PORTFOLIO", name: "Loan portfolio snapshot", classification: "Confidential" },
  { code: "DS-PAYMENT-EVENTS", name: "Payment event aggregates", classification: "Internal" },
  { code: "DS-AUDIT-AUTH", name: "Auth/audit anomaly features", classification: "Confidential" }
];

export function canTransitionModel(from, to) {
  return (MODEL_TRANSITIONS[from] || []).includes(to);
}

export function assertAiLifecycleBoundary() {
  return {
    postsCollections: false,
    changesLoanInterest: false,
    changesCollectionDays: false,
    changesCashierLimit: false,
    autoApprovesLoans: false,
    autoApprovesWithdrawals: false,
    replacesRuleEngine: false,
    ruleEngineAuthoritative: true,
    advisoryOnly: true,
    restHttpServer: false,
    graphqlHttpServer: false,
    postgresSourceOfTruth: false,
    storesMomoPins: false,
    inProcessGatewayOnly: true,
    module: 29
  };
}
