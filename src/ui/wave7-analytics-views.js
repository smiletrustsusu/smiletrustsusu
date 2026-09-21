/**
 * Wave 7 — Analytics / BI / AI extras under existing Reports and Audit screens.
 * No new top-level navigation. Reuses shared-primitives / Wave 5 lazy panels.
 */

import {
  stSrOnly,
  stPanel,
  stStatGrid,
  stLazyPanel,
  stMuted,
  stAlert,
  stTable,
  stButton,
  stEscape
} from "./shared-primitives.js";

export function renderWave7AnalyticsPanel(model = {}) {
  const smoke = model.smoke || {};
  const gaps = model.gaps || {};
  const exec = model.executive || {};
  const kpis = exec.kpis || model.kpis || {};
  const fraud = model.fraudFindings || [];
  const forecasts = model.forecasts || [];
  const insights = model.insights || [];
  const canView = model.canView !== false;
  const canPredict = Boolean(model.canPredict);
  const canExport = Boolean(model.canExport);
  const canAudit = Boolean(model.canAudit);

  if (!canView) return "";

  const kpiStats = Object.entries(kpis).slice(0, 8).map(([code, value]) => ({
    label: code,
    value: String(value)
  }));

  return `
    <section class="panel wave7-analytics-panel" aria-labelledby="wave7AnalyticsTitle" style="margin-top:18px">
      <h2 id="wave7AnalyticsTitle">Enterprise Analytics &amp; BI (Wave 7)</h2>
      ${stSrOnly("Wave 7 analytics facade. Uses Module 27 KPI formulas and Module 29 advisory AI. No new top-level navigation.")}
      ${stMuted("Shared SPA facade over Reports, Module 27 BI, and Module 29 AI — not a Next.js BI product. AI is advisory only; never auto-approves loans or posts money.")}
      ${stStatGrid([
        { label: "Pilot ready", value: gaps.pilotReady === false ? "No" : "Yes" },
        { label: "Canonical KPIs", value: String(smoke.canonicalKpis || gaps.canonicalKpis || "—") },
        { label: "Fraud rules", value: String(smoke.fraudRules || gaps.fraudRules || "—") },
        { label: "Catalog reports", value: String(smoke.catalogCount || "—") }
      ])}
      <p class="muted" style="margin-top:8px"><strong>Catalog</strong>: EIR alias Accounting Platform → Analytics &amp; BI delivery. Formula SoT: Module 27.</p>
      <div class="row-actions" style="margin-top:12px">
        ${stButton({ label: "Refresh KPIs", action: "wave7-refresh-kpis", variant: "secondary", ariaLabel: "Calculate Wave 7 KPIs via Module 27" })}
        ${canPredict ? stButton({ label: "AI insights", action: "wave7-ai-insights", variant: "ghost", ariaLabel: "Run advisory AI insights" }) : ""}
        ${canAudit || canPredict ? stButton({ label: "Fraud scan", action: "wave7-fraud-scan", variant: "ghost", ariaLabel: "Run Wave 7 fraud detectors" }) : ""}
        ${canPredict ? stButton({ label: "30d forecast", action: "wave7-forecast-30d", variant: "ghost", ariaLabel: "Run advisory 30 day forecast" }) : ""}
        ${canExport ? stButton({ label: "Export executive JSON", action: "wave7-export-exec", variant: "ghost", ariaLabel: "Export executive summary JSON" }) : ""}
      </div>
    </section>

    ${stPanel({
      title: "Executive KPI strip",
      body: kpiStats.length
        ? stStatGrid(kpiStats)
        : stMuted("No KPI values yet — use Refresh KPIs (Module 27 formulas).")
    })}

    ${stLazyPanel({
      id: "wave7-fraud",
      title: "Fraud & anomaly alerts",
      body: fraud.length
        ? stTable({
          columns: [
            { key: "code", label: "Rule" },
            { key: "severity", label: "Severity" },
            { key: "confidence", label: "Confidence" },
            { key: "recommendedAction", label: "Action" }
          ],
          rows: fraud.slice(0, 10).map((f) => ({
            code: f.code,
            severity: f.severityity,
            confidence: Math.round(Number(f.confidence || 0) * 100) + "%",
            recommendedAction: f.recommendedAction || ""
          }))
        })
        : stMuted("No open Wave 7 fraud findings.")
    })}

    ${stLazyPanel({
      id: "wave7-forecast",
      title: "Advisory forecasts",
      body: forecasts.length
        ? `<ul>${forecasts.slice(0, 5).map((f) =>
          `<li>${stEscape(f.horizon)} · ${stEscape(f.method)} · GHS ${stEscape(f.growthGhs)} · ${stEscape(f.cashPesewas)} pesewas <span class="muted">(advisory)</span></li>`
        ).join("")}</ul>`
        : stMuted("No forecasts yet. Methods: moving average / linear (transparent).")
    })}

    ${stLazyPanel({
      id: "wave7-insights",
      title: "AI insight audit (request/response)",
      body: insights.length
        ? `<ul>${insights.slice(0, 6).map((item) =>
          `<li>${stEscape(item.intent || item.request?.intent || "insight")} · ${stEscape(item.requestId || item.request?.id || "")} · advisory</li>`
        ).join("")}</ul>`
        : stMuted("AI requests are audited here. Module 29 governance applies.")
    })}

    ${stAlert({
      tone: "info",
      message: "Exports require Reports permissions; sensitive fields are masked. SUPER_ADMIN_FORBIDDEN still applies."
    })}
  `;
}

export function renderWave7ReportsExtra(model = {}) {
  const catalog = model.catalog || [];
  const regulatory = model.regulatory || [];
  const framework = model.framework || {};
  return `
    <div class="panel wave7-reports-extra" style="margin-top:18px">
      <div class="section-title"><h2>Wave 7 reporting framework</h2></div>
      ${stMuted(`Catalog ${stEscape(framework.catalogCount || catalog.length)} · exports: ${(framework.exportFormats || []).join(", ") || "csv/excel/json/pdf"} · scheduler: Module 11 stubs`)}
      <div class="row-actions" style="margin-top:10px">
        ${catalog.slice(0, 12).map((item) =>
          `<button class="btn ghost" type="button" data-wave7-report="${stEscape(item.id)}" ${item.allowed === false ? "disabled" : ""}>${stEscape(item.name || item.id)}</button>`
        ).join("")}
      </div>
      <div class="section-title" style="margin-top:16px"><h3>Ghana regulatory templates</h3></div>
      <div class="row-actions">
        ${regulatory.map((t) =>
          `<button class="btn ghost" type="button" data-wave7-reg="${stEscape(t.id)}">${stEscape(t.name)}</button>`
        ).join("")}
      </div>
    </div>
  `;
}

export function renderWave7ParityChecklist(rows = []) {
  if (!rows.length) return "";
  return stLazyPanel({
    id: "wave7-parity",
    title: "Wave 7 analytics parity checklist",
    body: stTable({
      columns: [
        { key: "id", label: "ID" },
        { key: "title", label: "Item" },
        { key: "channel", label: "Channels" }
      ],
      rows
    })
  });
}
