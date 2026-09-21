/**
 * Scheduler extras. Existing Backup / Cloud Backup / ordered sync stay as they are.
 */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function rowsOrEmpty(rows, empty, render) {
  if (!rows?.length) return `<div class="empty">${empty}</div>`;
  return render(rows);
}

export function renderJobBackupExtras({
  stats = {},
  jobs = [],
  workers = [],
  schedules = [],
  deadLetters = [],
  approvals = [],
  dependencies = [],
  detail = null,
  query = "",
  canView = false,
  canRun = false,
  canRetry = false,
  canReplay = false,
  canApprove = false,
  canSchedule = false
} = {}) {
  if (!canView) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Scheduler dashboard</h2></div>
      <p class="muted">Local and cloud backup above stay as they are. Long-running, scheduled, and retryable work now goes through this engine. It does not post interest, close cash, or change collection math.</p>
      <div class="grid four">
        <div class="stat"><small>Queued</small><strong>${stats.queued || 0}</strong></div>
        <div class="stat"><small>Running</small><strong>${stats.running || 0}</strong></div>
        <div class="stat"><small>Dead letter</small><strong>${stats.dlq || 0}</strong></div>
        <div class="stat"><small>Health</small><strong>${escapeHtml(stats.health || "healthy")} · ${stats.score || 0}</strong></div>
      </div>
      <div class="grid four" style="margin-top:10px">
        <div class="stat"><small>Completed</small><strong>${stats.completed || 0}</strong></div>
        <div class="stat"><small>Failed</small><strong>${stats.failed || 0}</strong></div>
        <div class="stat"><small>Workers</small><strong>${stats.workers || 0}</strong></div>
        <div class="stat"><small>Schedules</small><strong>${stats.schedules || 0}</strong></div>
      </div>
      <div class="row-actions" style="margin-top:12px">
        ${canRun ? `<button class="btn secondary" type="button" id="jobEngineTickBtn">Run scheduler tick</button>` : ""}
        ${canRun ? `<button class="btn ghost" type="button" id="jobPaymentRetryBtn">Enqueue payment retry</button>` : ""}
        ${canRun ? `<button class="btn ghost" type="button" id="jobDocumentQueueBtn">Enqueue document queue</button>` : ""}
      </div>
      <form id="jobSearchForm" class="form-grid" style="margin-top:14px">
        <div class="field"><label>Search jobs</label><input name="q" value="${escapeAttr(query)}" placeholder="Type, correlation, error" /></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Search</button></div>
      </form>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Job explorer</h2></div>
        ${rowsOrEmpty(jobs.slice(-20).reverse(), "No scheduler jobs yet.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Priority</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${rows.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.type)}</td>
                    <td>${escapeHtml(item.priority)}</td>
                    <td>${escapeHtml(item.status)}</td>
                    <td>
                      <button class="btn ghost" type="button" data-job-detail="${escapeAttr(item.id)}">Details</button>
                      ${canRetry && (item.status === "failed" || item.status === "queued") ? `<button class="btn ghost" type="button" data-job-retry="${escapeAttr(item.id)}">Retry</button>` : ""}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Workers</h2></div>
        ${rowsOrEmpty(workers, "No workers registered.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Status</th><th>Heartbeat</th></tr></thead>
              <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(String(item.lastHeartbeatAt || "").slice(11, 19))}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
        <div class="section-title" style="margin-top:16px"><h2>Schedule calendar</h2></div>
        ${rowsOrEmpty(schedules, "No recurring schedules.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Next</th><th>Active</th></tr></thead>
              <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.type)}</td><td>${escapeHtml(String(item.nextRunAt || item.cron || "").slice(0, 16))}</td><td>${item.active ? "Yes" : "No"}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
        ${canSchedule ? `
          <form id="jobScheduleForm" class="form-grid" style="margin-top:12px">
            <div class="field"><label>Job type</label><input name="type" required placeholder="cache_refresh" /></div>
            <div class="field"><label>Frequency</label><select name="frequency"><option>Daily</option><option>Hourly</option><option>Weekly</option><option>One-Time</option></select></div>
            <div class="form-actions full"><button class="btn secondary" type="submit">Add schedule</button></div>
          </form>
        ` : ""}
      </div>
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Dead letter queue</h2></div>
        ${rowsOrEmpty(deadLetters.slice(-12).reverse(), "Dead letter queue is empty.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Reason</th><th></th></tr></thead>
              <tbody>
                ${rows.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.type)}</td>
                    <td>${escapeHtml(item.failureReason || "")}</td>
                    <td>${canReplay ? `<button class="btn warning" type="button" data-job-replay="${escapeAttr(item.jobId)}">Replay</button>` : ""}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `)}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Dependencies</h2></div>
        ${rowsOrEmpty(dependencies.filter((item) => item.dependsOnType).slice(0, 12), "No graph rules.", (rows) => `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Job</th><th>Depends on</th></tr></thead>
              <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.jobType)}</td><td>${escapeHtml(item.dependsOnType)}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        `)}
        ${canApprove ? `
          <div class="section-title" style="margin-top:16px"><h2>Pending job approvals</h2></div>
          ${rowsOrEmpty(approvals.filter((item) => item.status === "pending"), "No pending approvals.", (rows) => `
            <div class="table-wrap">
              <table>
                <thead><tr><th>Action</th><th>Maker</th><th></th></tr></thead>
                <tbody>
                  ${rows.map((item) => `
                    <tr>
                      <td>${escapeHtml(item.action)}</td>
                      <td>${escapeHtml(item.makerId)}</td>
                      <td>
                        <button class="btn ghost" type="button" data-job-approve="${escapeAttr(item.id)}">Approve</button>
                        <button class="btn warning" type="button" data-job-reject="${escapeAttr(item.id)}">Reject</button>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `)}
        ` : ""}
      </div>
    </div>
    ${detail ? `
      <div class="panel" style="margin-top:18px">
        <div class="section-title"><h2>Job details</h2></div>
        <div class="calc-list">
          <div><span>Type</span><strong>${escapeHtml(detail.job.type)}</strong></div>
          <div><span>Status</span><strong>${escapeHtml(detail.job.status)}</strong></div>
          <div><span>Priority</span><strong>${escapeHtml(detail.job.priority)}</strong></div>
          <div><span>Attempts</span><strong>${detail.job.attempts || 0} / ${detail.job.maxAttempts || 0}</strong></div>
          <div><span>Correlation</span><strong>${escapeHtml(detail.job.correlationId || "")}</strong></div>
          <div><span>Error</span><strong>${escapeHtml(detail.job.lastError || "—")}</strong></div>
        </div>
      </div>
    ` : ""}
  `;
}

export function renderJobReportsExtra({ reports = [] } = {}) {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Scheduler reports</h2></div>
      <div class="row-actions">
        ${reports.map((item) => `<button class="btn ghost" type="button" data-job-report="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
  `;
}
