# WAVE-08 — Release Certification & Quality Validation

**Status:** Delivered as RC1 validation platform (Phase 16 ETQAVS)  
**Date:** 2026-09-16  
**Wave:** WAVE-08 · Phase 16 quality gates · certifies Waves 1–7  

---

## 1. Architecture decision

Wave 8 is **not** a parallel QA product or Next.js rewrite. It:

- Reuses `npm test` as the suite SoT
- Evaluates Phase 16 gates via `phase16-quality-gates.js`
- Emits machine-readable RC evidence under `docs/release-evidence/` and `artifacts/wave8/`
- Exposes an optional **Audit/Reports** panel (no new top-level nav)

### Catalog mapping

| Field | Value |
|---|---|
| Delivery name | **Release Certification Platform** (`RELEASE_CERTIFICATION`) |
| Historical EIR name | Reporting Platform (`REPORTING_PLATFORM`) |
| Reporting/BI delivery | Completed via Wave 7 analytics facade |
| CERT-001 production promote | **Deferred to WAVE-10** |

**RC1** = pilot / UAT entry gate. **CERT-001** = full production release (Wave 10).

---

## 2. Gap analysis

| ID | Item | Status |
|---|---|---|
| W8-G01 | Cross-wave smoke (1–7) | Closed |
| W8-G02 | Phase 16 gate harness | Closed |
| W8-G03 | Security isolation smoke | Closed |
| W8-G04 | Perf smoke harness (in-process) | Closed |
| W8-G05 | DR/offline smoke | Closed |
| W8-G06 | Accessibility marker smoke | Closed |
| W8-G07 | Defect registry + blockers | Closed |
| W8-G08 | RC evidence JSON | Closed |
| W8-G09 | `validate:rc` script | Closed |
| W8-G10 | Audit/Reports panel | Closed |
| W8-G11 | Docs + roadmap notes | Closed |
| W8-G12 | Live load / real DR drills | Partial |
| W8-G13 | CERT-001 production cert | Deferred |

---

## 3. Key files

| Path | Role |
|---|---|
| `src/core/wave8-release-certification.js` | Browser-safe certifier + evidence builder |
| `scripts/wave8-release-validate.js` | Node CLI: prepare:web → npm test → write evidence |
| `src/ui/wave8-certification-views.js` | Audit/Reports RC panel |
| `docs/wave8-release-certification.md` | This guide |
| `docs/release-evidence/rc1-evidence.json` | Primary RC evidence |
| `artifacts/wave8/rc1-evidence.json` | Artifact copy |
| `tests/wave8-release-certification.test.js` | Wave 8 tests |

---

## 4. RC1 pass criteria

PASS only when:

1. Cross-wave smoke green (Waves 1–7 artifacts present)
2. `npm test` 100% pass rate
3. `prepare:web` succeeded
4. Mandatory Phase 16 gates QG-001 / QG-002 pass (with recorded approvals)
5. `openCritical` defects = 0
6. Security + DR/offline smokes pass
7. Accessibility marker smoke pass

CERT-001 preview is recorded in evidence but is **expected incomplete** at RC1 (missing business acceptance / monitoring / governance).

---

## 5. How to run

```powershell
npm run validate:rc
```

Or stepwise:

```powershell
npm run prepare:web
npm test
npm run validate:rc
```

Exit code **0** = RC PASS; **non-zero** = FAIL (see `blockers` in evidence JSON).

---

## 6. Defect management

`buildDefectRegistry` maps failed checks to `DEF-W8-*` with severity and `releaseBlocker`. Critical open defects always fail RC1 via Phase 16 `defectReleaseAllowed`.

---

## 7. Troubleshooting

| Symptom | Check |
|---|---|
| `cross_wave_smoke_failed` | Missing wave docs/tests (especially Wave 7) |
| `npm_test_not_green` | Fix failing unit tests first |
| `prepare:web` blocker | `scripts/prepare-web.js` / disk permissions |
| UI shows no evidence | Run `validate:rc`, then **Reload RC evidence** on Audit/Reports |
| Expecting CERT-001 | Use Wave 10 production readiness — RC1 is pilot only |

---

## 8. Money / security invariants

Evidence package records: interest **15**, days **31**, cashier GHS **1000**, pesewas, `SUPER_ADMIN_FORBIDDEN` sample. AI remains advisory-only (Wave 7).

---

## 9. Ready for Wave 9?

When `decision: "PASS"` and `readyForWave9: true` in `docs/release-evidence/rc1-evidence.json`.
