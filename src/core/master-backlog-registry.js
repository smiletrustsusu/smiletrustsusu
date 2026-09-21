/**
 * Master Implementation Backlog Registry (MIB) — single source of truth for
 * implementation work. Traces to Phase 20 EIBPRFBS + Modules 1–30 engines.
 * Does NOT redefine Phase 1–20 specs or replace Module 1–30 runtime engines.
 * Money invariants: pesewas · interest 15 · collection days 31 · cashier 1000.
 */

import { IMPLEMENTATION_WAVES } from "./master-backlog-waves.js";
import { MODULE_BASELINE_ARTIFACTS, PHASE_BASELINE_ARTIFACTS } from "./canonical-baseline-registry.js";
import {
  BACKLOG_STATUSES,
  CANONICAL_BACKLOG_STATUSES,
  COMPLETED_LIKE_STATUSES,
  LEGACY_BACKLOG_STATUSES,
  MIB_STATUS_MIGRATION_NOTE,
  normalizeBacklogStatus,
  toCanonicalStatus
} from "./master-backlog-status.js";
import {
  MIB_WAVE_TO_USER_DELIVERY,
  USER_DELIVERY_WAVES,
  resolveUserDeliveryWave,
  userDeliveryWaveLabel
} from "./master-backlog-delivery-waves.js";
import { AUDIT_GAP_SEED_DEFS, seedAuditGapReconciliation } from "./master-backlog-audit-gaps.js";

export const MIB_VERSION = "1.1.0";
export const MIB_STATUS = "Authoritative";
export const MIB_EFFECTIVE_DATE = "2026-09-17";
export const MIB_DOC = "docs/master-implementation-backlog.md";
export const MIB_CATALOGS = "docs/mib-catalogs.md";
export const PHASE20_BASELINE_DOC = "docs/enterprise-implementation-baseline.md";
export const MIB_AUDIT_RECONCILIATION_DATE = "2026-09-17";

export {
  BACKLOG_STATUSES,
  CANONICAL_BACKLOG_STATUSES,
  COMPLETED_LIKE_STATUSES,
  LEGACY_BACKLOG_STATUSES,
  MIB_STATUS_MIGRATION_NOTE,
  normalizeBacklogStatus,
  toCanonicalStatus,
  USER_DELIVERY_WAVES,
  MIB_WAVE_TO_USER_DELIVERY,
  resolveUserDeliveryWave,
  userDeliveryWaveLabel,
  AUDIT_GAP_SEED_DEFS
};

export const BACKLOG_PRIORITIES = Object.freeze(["Critical", "High", "Medium", "Low"]);
export const BACKLOG_COMPLEXITIES = Object.freeze(["XS", "S", "M", "L", "XL"]);
export const BACKLOG_STORY_POINTS = Object.freeze([1, 2, 3, 5, 8, 13, 21, 34, 55]);
export const BACKLOG_RISK_LEVELS = Object.freeze(["Critical", "High", "Medium", "Low"]);

export const ID_PATTERNS = Object.freeze({
  PRG: /^PRG-[0-9]{4}$/,
  PH: /^PH-[0-9]{3}$/,
  MOD: /^MOD-[0-9]{3}$/,
  EPC: /^EPC-[0-9]{6}$/,
  FEAT: /^FEAT-[0-9]{6}$/,
  USR: /^USR-[0-9]{6}$/,
  TASK: /^TASK-[0-9]{6}$/,
  SUB: /^SUB-[0-9]{6}$/,
  TEST: /^TEST-[0-9]{6}$/,
  BUG: /^BUG-[0-9]{6}$/,
  RISK: /^RISK-[0-9]{6}$/,
  CR: /^CR-[0-9]{6}$/,
  REL: /^REL-[0-9]{6}$/
});

const EMPTY_DEPS = () =>
  Object.freeze({
    prerequisites: Object.freeze([]),
    dependentTasks: Object.freeze([]),
    blockingTasks: Object.freeze([]),
    relatedTasks: Object.freeze([]),
    crossModule: Object.freeze([]),
    crossPhase: Object.freeze([])
  });

const COUNTERS = {
  EPC: 0,
  FEAT: 0,
  USR: 0,
  TASK: 0,
  SUB: 0,
  TEST: 0,
  BUG: 0,
  RISK: 0,
  CR: 0,
  REL: 0
};

function nextId(prefix, width) {
  COUNTERS[prefix] += 1;
  return `${prefix}-${String(COUNTERS[prefix]).padStart(width, "0")}`;
}

function freezeDeep(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const out = { ...entry };
  for (const key of Object.keys(out)) {
    if (Array.isArray(out[key])) out[key] = Object.freeze([...out[key]]);
    else if (out[key] && typeof out[key] === "object" && key === "dependencies") {
      const d = { ...out[key] };
      for (const dk of Object.keys(d)) {
        if (Array.isArray(d[dk])) d[dk] = Object.freeze([...d[dk]]);
      }
      out[key] = Object.freeze(d);
    } else if (out[key] && typeof out[key] === "object") {
      out[key] = Object.freeze({ ...out[key] });
    }
  }
  return Object.freeze(out);
}

function itemTypeFromId(id) {
  if (!id) return null;
  const prefix = String(id).split("-")[0];
  return prefix || null;
}

/**
 * Build a backlog item with the full required field schema.
 * Status is normalized onto the canonical set at write-time.
 */
export function buildBacklogItem(partial) {
  const identifier = partial.identifier;
  if (!identifier) throw new Error("backlog item requires identifier");
  const mibWave = partial.wave ?? null;
  const deliveryWave =
    partial.deliveryWave ?? (mibWave != null ? resolveUserDeliveryWave(mibWave) : null);
  return freezeDeep({
    identifier,
    parentIdentifier: partial.parentIdentifier ?? null,
    module: partial.module ?? null,
    enterprisePhase: partial.enterprisePhase ?? null,
    title: partial.title ?? identifier,
    description: partial.description ?? "",
    businessObjective: partial.businessObjective ?? "",
    businessValue: partial.businessValue ?? "",
    priority: partial.priority ?? "Medium",
    riskLevel: partial.riskLevel ?? "Medium",
    complexity: partial.complexity ?? "M",
    storyPoints: partial.storyPoints ?? 3,
    estimatedHours: partial.estimatedHours ?? 8,
    owner: partial.owner ?? "Platform Administrator",
    team: partial.team ?? "Platform",
    status: normalizeBacklogStatus(partial.status ?? "Planned"),
    dependencies: partial.dependencies
      ? {
          prerequisites: [...(partial.dependencies.prerequisites || [])],
          dependentTasks: [...(partial.dependencies.dependentTasks || [])],
          blockingTasks: [...(partial.dependencies.blockingTasks || [])],
          relatedTasks: [...(partial.dependencies.relatedTasks || [])],
          crossModule: [...(partial.dependencies.crossModule || [])],
          crossPhase: [...(partial.dependencies.crossPhase || [])]
        }
      : EMPTY_DEPS(),
    blockers: [...(partial.blockers || [])],
    acceptanceCriteria: [...(partial.acceptanceCriteria || [])],
    validationRequirements: [...(partial.validationRequirements || [])],
    testCases: [...(partial.testCases || [])],
    uiScreens: [...(partial.uiScreens || [])],
    apis: [...(partial.apis || [])],
    databaseTables: [...(partial.databaseTables || [])],
    databaseViews: [...(partial.databaseViews || [])],
    databaseFunctions: [...(partial.databaseFunctions || [])],
    storedProcedures: [...(partial.storedProcedures || [])],
    reports: [...(partial.reports || [])],
    dashboards: [...(partial.dashboards || [])],
    securityControls: [...(partial.securityControls || [])],
    auditRequirements: [...(partial.auditRequirements || [])],
    offlineSupport: partial.offlineSupport ?? null,
    synchronizationRequirements: partial.synchronizationRequirements ?? null,
    performanceRequirements: partial.performanceRequirements ?? null,
    monitoringRequirements: partial.monitoringRequirements ?? null,
    documentationReferences: [...(partial.documentationReferences || [])],
    relatedEnterprisePhaseReferences: [...(partial.relatedEnterprisePhaseReferences || [])],
    relatedModuleReferences: [...(partial.relatedModuleReferences || [])],
    version: partial.version ?? MIB_VERSION,
    createdDate: partial.createdDate ?? MIB_EFFECTIVE_DATE,
    modifiedDate: partial.modifiedDate ?? MIB_EFFECTIVE_DATE,
    wave: mibWave,
    deliveryWave,
    workCategory: partial.workCategory ?? null,
    auditGapRefs: [...(partial.auditGapRefs || [])],
    notes: partial.notes ?? null
  });
}

/** Wave-01 modules whose Integration & Hardening is delivered by foundation pack. */
const WAVE01_HARDENED_MODULES = Object.freeze(new Set([1, 5, 13, 14, 23, 24, 30]));
/** Wave-02 modules whose Integration & Hardening is delivered by database platform pack. */
const WAVE02_HARDENED_MODULES = Object.freeze(new Set([14, 25, 30]));
/** Wave-03 modules whose Integration & Hardening is delivered by backend API platform pack. */
const WAVE03_HARDENED_MODULES = Object.freeze(new Set([18, 20, 28]));
const MODULE_MATURITY = Object.freeze({
  1: "Completed",
  2: "Completed",
  3: "Completed",
  4: "Completed",
  5: "Completed",
  6: "Completed",
  7: "Completed",
  8: "Completed",
  9: "Completed",
  10: "Completed",
  11: "Completed",
  12: "Completed",
  13: "Completed",
  14: "Completed",
  15: "Completed",
  16: "Completed",
  17: "Completed",
  18: "Completed",
  19: "Completed",
  20: "Completed",
  21: "Completed",
  22: "Completed",
  23: "Completed",
  24: "Completed",
  25: "Completed",
  26: "Completed",
  27: "Completed",
  28: "Completed",
  29: "Completed",
  30: "Completed"
});

const MODULE_EPIC_TEMPLATES = Object.freeze([
  Object.freeze({
    suffix: "Core Capability",
    featureTitles: ["Domain workflows", "Data integrity & money guards"],
    storyKinds: ["USR", "TASK"]
  }),
  Object.freeze({
    suffix: "Integration & Hardening",
    featureTitles: ["Cross-module contracts", "Ops / audit / offline readiness"],
    storyKinds: ["TASK", "USR"]
  })
]);

const WAVE_FEATURE_TEMPLATES = Object.freeze([
  "Scope & architecture alignment",
  "Implementation delivery",
  "Validation & readiness gates"
]);

function modId(n) {
  return `MOD-${String(n).padStart(3, "0")}`;
}

function phId(n) {
  return `PH-${String(n).padStart(3, "0")}`;
}

function ac(text) {
  return text;
}

function seedLeaf(kind, parent, opts) {
  const id = nextId(kind, 6);
  const points = opts.storyPoints ?? (kind === "TASK" ? 5 : 3);
  return buildBacklogItem({
    identifier: id,
    parentIdentifier: parent.identifier,
    module: opts.module ?? parent.module,
    enterprisePhase: opts.enterprisePhase ?? parent.enterprisePhase,
    title: opts.title,
    description: opts.description ?? opts.title,
    businessObjective: opts.businessObjective ?? parent.businessObjective,
    businessValue: opts.businessValue ?? parent.businessValue,
    priority: opts.priority ?? parent.priority,
    riskLevel: opts.riskLevel ?? parent.riskLevel,
    complexity: opts.complexity ?? "S",
    storyPoints: points,
    estimatedHours: opts.estimatedHours ?? points * 2,
    owner: opts.owner ?? parent.owner,
    team: opts.team ?? parent.team,
    status: opts.status ?? "Planned",
    dependencies: opts.dependencies,
    acceptanceCriteria: opts.acceptanceCriteria ?? [
      ac(`${opts.title} meets acceptance for ${parent.identifier}`),
      ac("Money invariants preserved where applicable (pesewas, interest 15, days 31, cashier 1000)")
    ],
    validationRequirements: opts.validationRequirements ?? [`Validate against ${parent.identifier}`],
    testCases: opts.testCases ?? [],
    uiScreens: opts.uiScreens ?? [],
    apis: opts.apis ?? [],
    databaseTables: opts.databaseTables ?? [],
    securityControls: opts.securityControls ?? [],
    auditRequirements: opts.auditRequirements ?? [],
    offlineSupport: opts.offlineSupport ?? parent.offlineSupport,
    synchronizationRequirements: opts.synchronizationRequirements ?? parent.synchronizationRequirements,
    performanceRequirements: opts.performanceRequirements ?? null,
    monitoringRequirements: opts.monitoringRequirements ?? null,
    documentationReferences: opts.documentationReferences ?? parent.documentationReferences,
    relatedEnterprisePhaseReferences: opts.relatedEnterprisePhaseReferences ?? parent.relatedEnterprisePhaseReferences,
    relatedModuleReferences: opts.relatedModuleReferences ?? parent.relatedModuleReferences,
    wave: opts.wave ?? parent.wave,
    deliveryWave: opts.deliveryWave ?? parent.deliveryWave ?? null,
    workCategory: opts.workCategory ?? parent.workCategory ?? null,
    auditGapRefs: opts.auditGapRefs ?? [],
    notes: opts.notes ?? null
  });
}

function buildProgram() {
  return buildBacklogItem({
    identifier: "PRG-0001",
    parentIdentifier: null,
    module: null,
    enterprisePhase: "PH-020",
    title: "SMILE TRUST SUSU MANAGEMENT SYSTEM — Master Implementation Program",
    description:
      "Program-level backlog covering Modules 1–30 and enterprise Phases 1–20 execution, ordered by 20 implementation waves. Spec baseline SoT remains Phase 20 EIBPRFBS.",
    businessObjective: "Deliver a production-ready Susu management platform without redefining published specs or replacing module engines.",
    businessValue: "Single hierarchical SoT for planning, delivery, QA, and release governance.",
    priority: "Critical",
    riskLevel: "High",
    complexity: "XL",
    storyPoints: 55,
    estimatedHours: 0,
    owner: "Governance Board Chair",
    team: "Governance",
    status: "In Progress",
    documentationReferences: [MIB_DOC, MIB_CATALOGS, PHASE20_BASELINE_DOC, "docs/enterprise-master-architecture.md"],
    relatedEnterprisePhaseReferences: ["PH-020"],
    relatedModuleReferences: Array.from({ length: 30 }, (_, i) => modId(i + 1)),
    acceptanceCriteria: [
      "All MOD-001..030 and PH-001..020 covered in backlog",
      "validateMasterBacklog critical findings = 0",
      "Money invariants preserved across delivery"
    ],
    validationRequirements: ["tests/master-backlog-consistency.test.js"],
    wave: null
  });
}

function buildPhases(programId) {
  const phase20 = {
    phaseNumber: 20,
    title: "EIBPRFBS — Enterprise Implementation Baseline",
    primaryDoc: PHASE20_BASELINE_DOC,
    accountableAuthority: "Governance Board Chair"
  };
  const phases = [
    ...PHASE_BASELINE_ARTIFACTS.map((p) => ({
      phaseNumber: p.phaseNumber,
      title: p.title,
      primaryDoc: p.primaryDoc,
      accountableAuthority: p.accountableAuthority
    })),
    phase20
  ];

  return phases.map((p) =>
    buildBacklogItem({
      identifier: phId(p.phaseNumber),
      parentIdentifier: programId,
      module: null,
      enterprisePhase: phId(p.phaseNumber),
      title: `Phase ${p.phaseNumber}: ${p.title}`,
      description: `Backlog anchor tracing to published Phase ${p.phaseNumber} specification — content not redefined.`,
      businessObjective: `Execute and track work aligned to Phase ${p.phaseNumber} without rewriting its catalog.`,
      businessValue: "Traceability from delivery items to enterprise phase baseline.",
      priority: p.phaseNumber >= 16 ? "Critical" : "High",
      riskLevel: "Medium",
      complexity: "L",
      storyPoints: 13,
      estimatedHours: 0,
      owner: p.accountableAuthority,
      team: "Governance",
      status: "Completed",
      documentationReferences: [p.primaryDoc, PHASE20_BASELINE_DOC],
      relatedEnterprisePhaseReferences: [phId(p.phaseNumber), "PH-020"],
      relatedModuleReferences: [],
      acceptanceCriteria: [
        `Phase ${p.phaseNumber} docs remain authoritative`,
        "No silent redefinition of phase catalogs"
      ],
      validationRequirements: ["Phase 20 baseline inventory linkage"],
      notes: "Spec published; delivery tracked via wave/module epics"
    })
  );
}

function buildModules(programId) {
  return MODULE_BASELINE_ARTIFACTS.map((m) => {
    const status = MODULE_MATURITY[m.moduleId] || "Completed";
    const money = m.moneyInvariantGuard === true;
    return buildBacklogItem({
      identifier: modId(m.moduleId),
      parentIdentifier: programId,
      module: modId(m.moduleId),
      enterprisePhase: m.phaseRefs?.length ? phId(m.phaseRefs[0]) : null,
      title: `Module ${m.moduleId}: ${m.title}`,
      description: `Backlog anchor for Module ${m.moduleId}. Runtime engine referenced, not replaced.`,
      businessObjective: `Maintain and harden Module ${m.moduleId} capabilities per published module specs.`,
      businessValue: m.title,
      priority: money || m.moduleId <= 10 ? "Critical" : m.moduleId >= 19 ? "High" : "Medium",
      riskLevel: money ? "High" : "Medium",
      complexity: "L",
      storyPoints: 21,
      estimatedHours: 0,
      owner: m.accountableAuthority,
      team: money ? "Domain" : "Platform",
      status,
      documentationReferences: [m.primaryDoc, PHASE20_BASELINE_DOC].filter(Boolean),
      relatedEnterprisePhaseReferences: (m.phaseRefs || []).map(phId),
      relatedModuleReferences: [modId(m.moduleId)],
      acceptanceCriteria: [
        `Module ${m.moduleId} engine not replaced by backlog work`,
        money
          ? "Pesewas posting; interest 15; collection days 31; cashier float 1000 preserved"
          : "Contracts and audit expectations preserved"
      ],
      validationRequirements: ["Module baseline artifact present in EIBPRFBS"],
      offlineSupport: m.moduleId === 15 ? "Required" : m.moduleId <= 10 ? "Partial" : null,
      synchronizationRequirements: m.moduleId === 15 ? "Offline conflict resolution per module sync spec" : null,
      securityControls: m.moduleId === 1 || m.moduleId === 22 ? ["RBAC", "session"] : [],
      auditRequirements: m.moduleId === 13 ? ["immutable audit trail"] : [],
      notes: status === "Completed" ? "Core capability present in codebase" : "Substantial implementation; gap items remain open"
    });
  });
}

function buildWaveEpics(programId) {
  return IMPLEMENTATION_WAVES.map((w) => {
    const priorWaveEpicHint = w.wave > 1 ? `WAVE-${w.wave - 1}` : null;
    const status =
      w.wave <= 13
        ? "Completed"
        : w.wave <= 17
          ? "In Progress"
          : w.wave === 20
            ? "Planned"
            : "Ready";
    return buildBacklogItem({
      identifier: nextId("EPC", 6),
      parentIdentifier: programId,
      module: w.primaryModules[0] ? modId(w.primaryModules[0]) : null,
      enterprisePhase: w.primaryPhases[0] ? phId(w.primaryPhases[0]) : null,
      title: `Wave ${w.wave}: ${w.title}`,
      description: `Implementation-order stream ${w.wave} (${w.code}). Cross-cutting epic under PRG-0001.`,
      businessObjective: `Complete ${w.title} prerequisites for downstream waves.`,
      businessValue: `Unblocks waves ${Math.min(20, w.wave + 1)}–20 where dependent.`,
      priority: w.priority,
      riskLevel: w.priority === "Critical" ? "High" : "Medium",
      complexity: w.wave <= 6 || w.wave >= 18 ? "L" : "M",
      storyPoints: w.priority === "Critical" ? 13 : 8,
      estimatedHours: 40,
      owner: w.owner,
      team: w.team,
      status,
      dependencies: {
        prerequisites: priorWaveEpicHint ? [] : [],
        dependentTasks: [],
        blockingTasks: [],
        relatedTasks: [],
        crossModule: w.primaryModules.map(modId),
        crossPhase: w.primaryPhases.map(phId)
      },
      acceptanceCriteria: [
        `${w.title} exit criteria met for wave ${w.wave}`,
        "No Next.js/Flutter rewrite; no new HTTP servers; no new top-level nav",
        "Money invariants preserved"
      ],
      validationRequirements: [`Wave ${w.wave} readiness review`],
      documentationReferences: [MIB_DOC, PHASE20_BASELINE_DOC],
      relatedEnterprisePhaseReferences: w.primaryPhases.map(phId),
      relatedModuleReferences: w.primaryModules.map(modId),
      wave: w.wave,
      notes: `Wave code ${w.code}`
    });
  });
}

function buildModuleEpics(modules) {
  const epics = [];
  for (const mod of modules) {
    const n = Number(String(mod.identifier).split("-")[1]);
    const baseStatus = mod.status;
    for (const tmpl of MODULE_EPIC_TEMPLATES) {
      const gapEpic = tmpl.suffix.includes("Hardening");
      epics.push(
        buildBacklogItem({
          identifier: nextId("EPC", 6),
          parentIdentifier: mod.identifier,
          module: mod.identifier,
          enterprisePhase: mod.enterprisePhase,
          title: `${mod.title} — ${tmpl.suffix}`,
          description: `Epic for Module ${n}: ${tmpl.suffix}. Traces to module engine; does not rewrite it.`,
          businessObjective: tmpl.suffix,
          businessValue: mod.businessValue,
          priority: mod.priority,
          riskLevel: mod.riskLevel,
          complexity: "M",
          storyPoints: 8,
          estimatedHours: 24,
          owner: mod.owner,
          team: mod.team,
          status: gapEpic
            ? WAVE01_HARDENED_MODULES.has(n) || WAVE02_HARDENED_MODULES.has(n) || WAVE03_HARDENED_MODULES.has(n)
              ? "Completed"
              : n === 16 || n === 22
                ? "In Progress"
                : "Planned"
            : baseStatus,
          dependencies: {
            prerequisites: [],
            dependentTasks: [],
            blockingTasks: [],
            relatedTasks: [],
            crossModule: [],
            crossPhase: mod.relatedEnterprisePhaseReferences || []
          },
          acceptanceCriteria: [
            `${tmpl.suffix} delivered for ${mod.identifier}`,
            "Module engine remains authoritative for domain math"
          ],
          validationRequirements: [`Module ${n} consistency tests where present`],
          documentationReferences: mod.documentationReferences,
          relatedEnterprisePhaseReferences: mod.relatedEnterprisePhaseReferences,
          relatedModuleReferences: [mod.identifier],
          offlineSupport: mod.offlineSupport,
          synchronizationRequirements: mod.synchronizationRequirements,
          wave: null
        })
      );
    }
  }
  return epics;
}

function buildFeaturesForEpic(epic, titles, statusOverride) {
  return titles.map((title, idx) =>
    buildBacklogItem({
      identifier: nextId("FEAT", 6),
      parentIdentifier: epic.identifier,
      module: epic.module,
      enterprisePhase: epic.enterprisePhase,
      title: `${epic.title.split("—").pop()?.trim() || epic.title}: ${title}`,
      description: `Feature under ${epic.identifier}: ${title}`,
      businessObjective: title,
      businessValue: epic.businessValue,
      priority: epic.priority,
      riskLevel: epic.riskLevel,
      complexity: idx === 0 ? "M" : "S",
      storyPoints: idx === 0 ? 5 : 3,
      estimatedHours: idx === 0 ? 16 : 8,
      owner: epic.owner,
      team: epic.team,
      status: statusOverride ?? (epic.status === "Completed" ? "Completed" : "Planned"),
      dependencies: {
        prerequisites: idx > 0 ? [] : [],
        dependentTasks: [],
        blockingTasks: [],
        relatedTasks: [],
        crossModule: epic.relatedModuleReferences || [],
        crossPhase: epic.relatedEnterprisePhaseReferences || []
      },
      acceptanceCriteria: [`${title} accepted for ${epic.identifier}`],
      validationRequirements: [`Feature review for ${epic.identifier}`],
      documentationReferences: epic.documentationReferences,
      relatedEnterprisePhaseReferences: epic.relatedEnterprisePhaseReferences,
      relatedModuleReferences: epic.relatedModuleReferences,
      offlineSupport: epic.offlineSupport,
      synchronizationRequirements: epic.synchronizationRequirements,
      wave: epic.wave
    })
  );
}

function buildStoriesForFeature(feature, kinds, titles) {
  const out = [];
  titles.forEach((title, i) => {
    const kind = kinds[i % kinds.length];
    const open =
      feature.status === "Completed"
        ? i === titles.length - 1 && kind === "TASK"
          ? "Planned"
          : feature.status
        : feature.status === "In Progress"
          ? i === 0
            ? "In Progress"
            : "Planned"
          : "Planned";
    out.push(
      seedLeaf(kind, feature, {
        title,
        description: `${kind} — ${title}`,
        status: open,
        storyPoints: kind === "TASK" ? 5 : 3,
        complexity: kind === "TASK" ? "M" : "S",
        acceptanceCriteria: [
          `${title} done`,
          "Traceability to parent feature retained",
          "No unauthorized stack rewrite"
        ],
        testCases: kind === "USR" ? [`TC-${feature.identifier}-${i + 1}`] : [],
        apis: feature.module === "MOD-020" ? ["gateway facade"] : [],
        databaseTables: feature.wave === 4 ? ["canonical schema objects"] : []
      })
    );
  });
  return out;
}

function attachWaveFeaturesAndStories(waveEpics) {
  const items = [];
  for (const epic of waveEpics) {
    const features = buildFeaturesForEpic(epic, WAVE_FEATURE_TEMPLATES);
    items.push(...features);
    for (const feat of features) {
      const stories = buildStoriesForFeature(
        feat,
        ["TASK", "USR"],
        [
          `${feat.title} — technical foundation`,
          `${feat.title} — business acceptance path`
        ]
      );
      items.push(...stories);
      // Seed one SUB under first TASK of first feature per wave for depth
      const firstTask = stories.find((s) => s.identifier.startsWith("TASK-"));
      if (firstTask && epic.wave && epic.wave % 4 === 1) {
        items.push(
          seedLeaf("SUB", firstTask, {
            title: `Subtask: checklist for ${firstTask.title}`,
            status: firstTask.status === "Completed" ? firstTask.status : "Planned",
            storyPoints: 1,
            complexity: "XS",
            estimatedHours: 2
          })
        );
      }
    }
  }
  return items;
}

function attachModuleFeaturesAndStories(moduleEpics) {
  const items = [];
  for (const epic of moduleEpics) {
    const tmpl = MODULE_EPIC_TEMPLATES.find((t) => epic.title.includes(t.suffix)) || MODULE_EPIC_TEMPLATES[0];
    const features = buildFeaturesForEpic(epic, tmpl.featureTitles);
    items.push(...features);
    for (let fi = 0; fi < features.length; fi++) {
      const feat = features[fi];
      const storyTitles =
        fi === 0
          ? [`Deliver ${tmpl.featureTitles[0]} for ${epic.module}`, `Verify guards for ${epic.module}`]
          : [`Integrate ${epic.module} contracts`, `Harden ${epic.module} for ops readiness`];
      items.push(...buildStoriesForFeature(feat, tmpl.storyKinds, storyTitles));
    }
  }
  return items;
}

function seedGovernanceExtras(program, waveEpics, modules) {
  const items = [];
  const prodWave = waveEpics.find((e) => e.wave === 20) || program;
  const testWave = waveEpics.find((e) => e.wave === 18) || program;
  const secMod = modules.find((m) => m.identifier === "MOD-022") || modules[0];

  items.push(
    seedLeaf("TEST", testWave, {
      title: "Master backlog consistency suite",
      status: "Completed",
      storyPoints: 3,
      testCases: ["tests/master-backlog-consistency.test.js"],
      acceptanceCriteria: ["validateMasterBacklog critical=0", "MOD/PH coverage asserted"]
    }),
    seedLeaf("TEST", testWave, {
      title: "Money invariant regression pack (pesewas/15/31/1000)",
      status: "Completed",
      storyPoints: 5,
      module: "MOD-006",
      acceptanceCriteria: ["Interest 15, days 31, cashier 1000, pesewas only"]
    }),
    seedLeaf("RISK", prodWave, {
      title: "Risk: production go-live before mandatory RDY checks",
      status: "Planned",
      priority: "Critical",
      riskLevel: "Critical",
      storyPoints: 2,
      acceptanceCriteria: ["Fail-closed readiness enforced per Phase 20"]
    }),
    seedLeaf("RISK", secMod, {
      title: "Risk: RBAC bypass in cross-module contracts",
      status: "Planned",
      priority: "High",
      riskLevel: "High",
      storyPoints: 2
    }),
    seedLeaf("BUG", modules.find((m) => m.identifier === "MOD-016") || modules[0], {
      title: "Track payment gateway edge-case reconciliation gaps",
      status: "Deferred",
      priority: "Medium",
      storyPoints: 5,
      workCategory: "TechDebt",
      notes: "Related to GAP-019; superseded for primary tracking by audit BUG item — kept Deferred to avoid duplicate active work"
    }),
    seedLeaf("CR", prodWave, {
      title: "CR: link MIB registry as Phase 20 execution SoT",
      status: "Ready",
      priority: "High",
      storyPoints: 2,
      documentationReferences: [PHASE20_BASELINE_DOC, MIB_DOC]
    }),
    seedLeaf("REL", prodWave, {
      title: "REL: specification baseline publication (Phase 20)",
      status: "Completed",
      priority: "Critical",
      storyPoints: 8,
      acceptanceCriteria: ["EIBPRFBS published", "Live production not falsely claimed"]
    }),
    seedLeaf("REL", prodWave, {
      title: "REL: production go-live package (executive)",
      status: "Blocked",
      priority: "Critical",
      storyPoints: 13,
      workCategory: "Ops",
      deliveryWave: 10,
      blockers: ["Wave 9 human gates", "Live cutover CO-*", "CERT-001"],
      acceptanceCriteria: ["All mandatory RDY pass or approved exception"],
      notes: "Linked to GAP-001/002/003 via audit reconciliation epic"
    })
  );

  // A few more TEST items across critical money modules
  for (const mid of [6, 7, 8, 10]) {
    const mod = modules.find((m) => m.identifier === modId(mid));
    if (!mod) continue;
    items.push(
      seedLeaf("TEST", mod, {
        title: `Module ${mid} posting / ledger consistency tests`,
        status: "Completed",
        storyPoints: 3,
        module: mod.identifier
      })
    );
  }

  return items;
}

function wireWavePrerequisites(waveEpics) {
  // Mutate dependency lists by rebuilding frozen entries is hard; instead set related via map after.
  // We rebuild with prerequisites pointing at prior wave epic identifiers.
  const byWave = new Map(waveEpics.map((e) => [e.wave, e]));
  return waveEpics.map((e) => {
    const prev = e.wave > 1 ? byWave.get(e.wave - 1) : null;
    return buildBacklogItem({
      ...e,
      dependencies: {
        prerequisites: prev ? [prev.identifier] : [],
        dependentTasks: [],
        blockingTasks: [],
        relatedTasks: [],
        crossModule: [...(e.dependencies?.crossModule || [])],
        crossPhase: [...(e.dependencies?.crossPhase || [])]
      }
    });
  });
}

function assembleRegistry() {
  Object.keys(COUNTERS).forEach((k) => {
    COUNTERS[k] = 0;
  });

  const program = buildProgram();
  const phases = buildPhases(program.identifier);
  const modules = buildModules(program.identifier);
  let waveEpics = buildWaveEpics(program.identifier);
  waveEpics = wireWavePrerequisites(waveEpics);
  const moduleEpics = buildModuleEpics(modules);
  const waveChildren = attachWaveFeaturesAndStories(waveEpics);
  const moduleChildren = attachModuleFeaturesAndStories(moduleEpics);
  const extras = seedGovernanceExtras(program, waveEpics, modules);
  const auditSeed = seedAuditGapReconciliation({
    program,
    waveEpics,
    modules,
    nextId,
    buildBacklogItem,
    seedLeaf
  });

  const all = [
    program,
    ...phases,
    ...modules,
    ...waveEpics,
    ...moduleEpics,
    ...waveChildren,
    ...moduleChildren,
    ...extras,
    ...auditSeed.items
  ];
  return Object.freeze(all.map((x) => freezeDeep(x)));
}

export const BACKLOG_ITEMS = assembleRegistry();

export const PROGRAM = BACKLOG_ITEMS.find((i) => i.identifier === "PRG-0001");

export const BACKLOG_BY_ID = Object.freeze(
  Object.fromEntries(BACKLOG_ITEMS.map((i) => [i.identifier, i]))
);

export function listBacklogItems() {
  return BACKLOG_ITEMS;
}

export function getBacklogItem(id) {
  return BACKLOG_BY_ID[id] || null;
}

export function listByModule(moduleRef) {
  const key = typeof moduleRef === "number" ? modId(moduleRef) : moduleRef;
  return BACKLOG_ITEMS.filter((i) => i.module === key || i.identifier === key);
}

export function listByPhase(phaseRef) {
  const key = typeof phaseRef === "number" ? phId(phaseRef) : phaseRef;
  return BACKLOG_ITEMS.filter((i) => i.enterprisePhase === key || i.identifier === key);
}

export function listByStatus(status) {
  return BACKLOG_ITEMS.filter((i) => i.status === status);
}

export function listByWave(waveNumber) {
  return BACKLOG_ITEMS.filter((i) => i.wave === waveNumber);
}

export function listByDeliveryWave(deliveryWaveNumber) {
  return BACKLOG_ITEMS.filter((i) => i.deliveryWave === deliveryWaveNumber);
}

export function listByWorkCategory(category) {
  return BACKLOG_ITEMS.filter((i) => i.workCategory === category);
}

export function listByType(prefix) {
  return BACKLOG_ITEMS.filter((i) => String(i.identifier).startsWith(`${prefix}-`));
}

export function backlogCountsByType() {
  const counts = {};
  for (const item of BACKLOG_ITEMS) {
    const t = itemTypeFromId(item.identifier);
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}

export function backlogStatusSummary() {
  const completedLike = new Set(COMPLETED_LIKE_STATUSES);
  let completed = 0;
  let open = 0;
  let cancelled = 0;
  const byStatus = {};
  const byCanonical = {};
  for (const item of BACKLOG_ITEMS) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    const canon = toCanonicalStatus(item.status);
    byCanonical[canon] = (byCanonical[canon] || 0) + 1;
    if (item.status === "Cancelled") cancelled += 1;
    else if (completedLike.has(item.status) || canon === "Completed") completed += 1;
    else open += 1;
  }
  return {
    completed,
    released: completed,
    open,
    cancelled,
    total: BACKLOG_ITEMS.length,
    byStatus,
    byCanonical
  };
}

/**
 * Map audit gap IDs to backlog items (primary = first non-Cancelled with auditGapRefs).
 */
export function listAuditGapMappings() {
  const map = {};
  for (const gap of AUDIT_GAP_SEED_DEFS) {
    map[gap.gapId] = [];
  }
  for (const item of BACKLOG_ITEMS) {
    for (const gapId of item.auditGapRefs || []) {
      if (!map[gapId]) map[gapId] = [];
      map[gapId].push({
        identifier: item.identifier,
        title: item.title,
        status: item.status,
        priority: item.priority,
        owner: item.owner,
        deliveryWave: item.deliveryWave,
        workCategory: item.workCategory
      });
    }
  }
  return map;
}

export function validateAuditGapCoverage() {
  const findings = [];
  const mappings = listAuditGapMappings();
  for (let i = 1; i <= 27; i++) {
    const gapId = `GAP-${String(i).padStart(3, "0")}`;
    const items = (mappings[gapId] || []).filter((x) => x.status !== "Cancelled");
    if (items.length === 0) {
      findings.push(critical("MIB-GAP-001", `Audit gap ${gapId} has no active backlog item`));
    } else if (items.length > 1) {
      findings.push(
        warn("MIB-GAP-002", `Audit gap ${gapId} has ${items.length} active backlog items`, {
          identifiers: items.map((x) => x.identifier)
        })
      );
    }
  }
  return findings;
}

function ok(extra = {}) {
  return { ok: true, severity: "info", ...extra };
}

function critical(code, message, extra = {}) {
  return { ok: false, severity: "critical", code, message, ...extra };
}

function warn(code, message, extra = {}) {
  return { ok: true, severity: "warning", code, message, ...extra };
}

export function validateMasterBacklog() {
  const findings = [];
  const ids = new Set();

  for (const item of BACKLOG_ITEMS) {
    if (ids.has(item.identifier)) {
      findings.push(critical("MIB-ID-001", `Duplicate identifier ${item.identifier}`));
    }
    ids.add(item.identifier);

    const prefix = itemTypeFromId(item.identifier);
    const pattern = ID_PATTERNS[prefix];
    if (!pattern || !pattern.test(item.identifier)) {
      findings.push(critical("MIB-ID-002", `Invalid identifier format ${item.identifier}`));
    }

    if (item.identifier !== "PRG-0001") {
      if (!item.parentIdentifier) {
        findings.push(critical("MIB-PAR-001", `Orphan item ${item.identifier} missing parent`));
      } else if (!ids.has(item.parentIdentifier) && !BACKLOG_BY_ID[item.parentIdentifier]) {
        // parent may appear later in iteration — check map
      }
    } else if (item.parentIdentifier != null) {
      findings.push(critical("MIB-PAR-002", "Program must have null parent"));
    }

    if (!BACKLOG_STATUSES.includes(item.status)) {
      findings.push(critical("MIB-ENUM-001", `Invalid status on ${item.identifier}`, { status: item.status }));
    }
    if (!BACKLOG_PRIORITIES.includes(item.priority)) {
      findings.push(critical("MIB-ENUM-002", `Invalid priority on ${item.identifier}`));
    }
    if (!BACKLOG_COMPLEXITIES.includes(item.complexity)) {
      findings.push(critical("MIB-ENUM-003", `Invalid complexity on ${item.identifier}`));
    }
    if (!BACKLOG_STORY_POINTS.includes(item.storyPoints)) {
      findings.push(critical("MIB-ENUM-004", `Invalid storyPoints on ${item.identifier}`));
    }
    if (!BACKLOG_RISK_LEVELS.includes(item.riskLevel)) {
      findings.push(critical("MIB-ENUM-005", `Invalid riskLevel on ${item.identifier}`));
    }

    if (!item.owner || String(item.owner).trim() === "") {
      findings.push(critical("MIB-OWN-001", `Missing owner on ${item.identifier}`));
    }

    const depGroups = item.dependencies || {};
    for (const key of ["prerequisites", "dependentTasks", "blockingTasks", "relatedTasks", "crossModule", "crossPhase"]) {
      const arr = depGroups[key] || [];
      for (const depId of arr) {
        // crossModule/crossPhase may be MOD-/PH- anchors (always in registry)
        if (!BACKLOG_BY_ID[depId]) {
          findings.push(critical("MIB-DEP-001", `Unresolved dependency ${depId} on ${item.identifier}`, { key }));
        }
      }
    }

    const requiredArrays = [
      "blockers",
      "acceptanceCriteria",
      "validationRequirements",
      "testCases",
      "uiScreens",
      "apis",
      "databaseTables",
      "databaseViews",
      "databaseFunctions",
      "storedProcedures",
      "reports",
      "dashboards",
      "securityControls",
      "auditRequirements",
      "documentationReferences",
      "relatedEnterprisePhaseReferences",
      "relatedModuleReferences"
    ];
    for (const field of requiredArrays) {
      if (!Array.isArray(item[field])) {
        findings.push(critical("MIB-SCHEMA-001", `Field ${field} must be array on ${item.identifier}`));
      }
    }
  }

  // Parent integrity (second pass — all IDs known)
  for (const item of BACKLOG_ITEMS) {
    if (item.identifier === "PRG-0001") continue;
    if (!BACKLOG_BY_ID[item.parentIdentifier]) {
      findings.push(critical("MIB-PAR-003", `Parent ${item.parentIdentifier} missing for ${item.identifier}`));
    }
  }

  // Coverage
  for (let i = 1; i <= 30; i++) {
    if (!BACKLOG_BY_ID[modId(i)]) {
      findings.push(critical("MIB-COV-001", `Missing module item ${modId(i)}`));
    }
  }
  for (let i = 1; i <= 20; i++) {
    if (!BACKLOG_BY_ID[phId(i)]) {
      findings.push(critical("MIB-COV-002", `Missing phase item ${phId(i)}`));
    }
  }

  if (!PROGRAM) {
    findings.push(critical("MIB-PRG-001", "PRG-0001 missing"));
  }

  const waveEpicCount = BACKLOG_ITEMS.filter((i) => i.identifier.startsWith("EPC-") && i.wave != null).length;
  if (waveEpicCount !== 20) {
    findings.push(critical("MIB-WAVE-001", `Expected 20 wave epics, found ${waveEpicCount}`));
  }

  // Audit-tagged items must carry a user delivery wave
  for (const item of BACKLOG_ITEMS) {
    if (item.auditGapRefs?.length && item.deliveryWave == null) {
      findings.push(critical("MIB-WAVE-002", `Audit gap item ${item.identifier} missing deliveryWave`));
    }
    if (item.wave != null && item.deliveryWave == null) {
      findings.push(warn("MIB-WAVE-003", `MIB wave item ${item.identifier} missing deliveryWave mapping`));
    }
  }

  findings.push(...validateAuditGapCoverage());

  const criticalFindings = findings.filter((f) => f.severity === "critical");
  if (criticalFindings.length === 0) {
    findings.push(ok({ code: "MIB-OK", message: "Master backlog validation passed" }));
  }

  return Object.freeze({
    ok: criticalFindings.length === 0,
    critical: criticalFindings.length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    findings: Object.freeze(findings),
    counts: backlogCountsByType(),
    statusSummary: backlogStatusSummary(),
    auditGapMappings: listAuditGapMappings()
  });
}

export { itemTypeFromId, modId as moduleIdentifier, phId as phaseIdentifier };
