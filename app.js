import { App } from "./src/context.js";
import {
  getAppConfig,
  getSyncMode,
  loadAppConfig,
  applyUnifiedCloudDefaults,
  unifiedCloudEnabled,
  persistCloudSettings,
  resolvedLocalBackupUrl,
  resolvedSupabaseKey,
  resolvedSupabaseUrl,
  resolveBusinessId,
  captureLegacySyncKey,
  legacySyncAccessKey
} from "./src/config.js";
import {
  hashPassword,
  legacyHash,
  verifyPassword
} from "./src/password.js";
import { deviceQueueSecret } from "./src/sync/offline-crypto.js";
import { staffCloudLogin, staffCloudActivate, staffMfaEnrollStart, staffMfaEnrollConfirm, hasStaffCloudSession, clearStaffCloudSession } from "./src/sync/staff-session.js";
import {
  portalServerAvailable,
  portalServerLogin,
  portalServerRefresh,
  portalServerChangePin,
  portalServerRequestWithdrawal,
  portalStateFromBundle,
  storedPortalSession,
  clearPortalSession,
  ingestPortalRequests,
  markPortalRequestsIngested
} from "./src/sync/portal-remote.js";
import {
  latestCloudSnapshot as latestRemoteSnapshot,
  pushCloudBackup as pushRemoteBackup,
  replaceFromCloud as replaceFromCloudRemote,
  restoreCloudBackupFromCloud as restoreRemoteBackup,
  startAutoCloudSync as startRemoteAutoSync,
  cloudUploadsPaused,
  CLOUD_BOOTSTRAP_REQUIRED,
  CLOUD_UPDATE_REFUSED,
  CLOUD_UPDATE_CONFLICT
} from "./src/sync/cloud.js";
import {
  createInitialCloudSnapshot,
  deviceStateAfterBootstrap,
  discardVerifiedBootstrap,
  loadVerifiedBootstrap
} from "./src/sync/snapshot-bootstrap.js";
import { canWriteSnapshot } from "./src/sync/collection-submit.js";
import {
  amountInWords,
  buildAccountLedgerTransactions,
  buildCollectorRows,
  buildControlRows,
  renderAccountsSheet,
  renderCollectorSheet,
  renderControlSheet,
  renderLoanAcceptanceForm,
  renderLoanApplicationForm,
  renderWithdrawalForm
} from "./src/ui/form-templates.js";
import {
  canAccessCustomer,
  canApproveReversal,
  canDeleteFinancialRecord,
  canEditFinancialRecord,
  canManageSusuGroups as canManageSusuGroupsPerm,
  canReverseCollection,
  canVerifyHandover,
  canViewAuditReports,
  canWriteFinancialData,
  filterCollectionsForUser,
  filterCustomersForUser,
  isAuditorRole,
  isCollectorScopedRole,
  isReadOnlyRole,
  resolveCollectorForRegistration
} from "./src/core/permissions.js";
import { toPesewas, fromPesewas, formatGhs } from "./src/core/money.js";
import { isValidGhanaPhone, normalizeGhanaPhone, formatGhanaPhoneDisplay } from "./src/core/ghana.js";
import {
  nextSusuGroupCode,
  filterSusuGroupsForUser,
  computeGroupPerformance,
  validateSusuGroupInput,
  upsertMembership,
  activeMemberships,
  CUSTOMER_STATUSES
} from "./src/core/susu-groups.js";
import {
  ensureSavingsProducts,
  personalProducts,
  personalSavingsBalance,
  productPerformance,
  upsertProduct,
  validateProductInput,
  productById,
  COLLECTION_TYPES,
  FREQUENCIES,
  PRODUCT_TYPES
} from "./src/core/savings-products.js";
import {
  personalSavingsSummary,
  isPersonalCustomer
} from "./src/core/personal-savings.js";
import {
  reassignCustomer,
  collectorCanCollectType,
  collectorCanAccessScreenByCapability,
  collectorCapabilityBlockedScreens,
  collectorDoesPersonalSavings,
  collectorDoesSusuGroup,
  updateCollectorCapabilities,
  assignmentHistory
} from "./src/core/collector-assignments.js";
import {
  collectorDashboardMetrics,
  managerDashboardSplit
} from "./src/core/collector-dashboard.js";
import { developerLoginAllowed } from "./src/core/production.js";
import {
  DEFAULT_SUPER_ADMIN,
  DEFAULT_SYSTEM_OWNER,
  SUPER_ADMIN_ID,
  canDeleteUserAccount,
  canDisableUserAccount,
  canEditUserAccount,
  canTransferOwnership,
  displayUserNameForActor,
  ensureDefaultSystemAccounts,
  getUserForActor,
  hasOperationalPrivilege,
  hasUsableLocalLogin,
  isDefaultSystemAccount,
  isLegacyBootstrapHash,
  isProtectedOwnerAccount,
  isReservedDeveloperUsername,
  isSystemDeveloperAccount,
  isSystemOwnerUser,
  listUsersForActor,
  needsForcedPasswordChange,
  canViewStaffLoginPassword,
  staffLoginPasswordDisplay,
  setStaffLoginPasswordHint,
  transferSystemOwnership,
  validateForcedPassword
} from "./src/core/system-accounts.js";
import {
  markSessionStarted,
  clearSession,
  ensureActiveSession
} from "./src/core/session.js";
import {
  buildIdempotencyKey,
  buildReceiptNo,
  isDuplicateIdempotencyKey
} from "./src/core/receipts.js";
import {
  appendLedgerEntry,
  createLedgerEntry,
  mirrorTransactionFromLedger,
  ledgerBalanceForCustomer
} from "./src/core/ledger.js";
import {
  approveReversal,
  createReversalRequest,
  createTransactionReversalRequest
} from "./src/core/reversals.js";
import {
  buildHandoverRecord,
  verifyHandover,
  expectedCashForCollector,
  channelTotalsForCollector,
  handoverExceptions,
  listHandoverReceivers,
  pendingHandoversForReceiver,
  handoverStatusLabel,
  handoverIsConfirmed
} from "./src/core/handover.js";
import { buildExceptionReport, recordException } from "./src/core/exceptions.js";
import { pendingQueueItems } from "./src/sync/offline-queue.js";
import { encryptOfflinePayload, decryptOfflinePayload, wrapQueueEntryForStorage } from "./src/sync/offline-crypto.js";
import { pushCollectionToRelational, pushDeviceToRelational, relationalSyncEnabled, flushRelationalOfflineQueue } from "./src/sync/relational-sync.js";
import { backendTransitionNotice, enforceBackendIdentity, takeQuarantineNotice } from "./src/core/backend-guard.js";
import { adoptCloudVerifiedUser } from "./src/core/cloud-user-adoption.js";
import {
  loadStateFromRelational,
  importSnapshotToRelational,
  postgresSourceEnabled,
  pushStaffAccountToServer
} from "./src/sync/relational-store.js";
import { restoreUsersFromCloud } from "./src/sync/snapshot-security.js";
import {
  supabaseAuthConfigured,
  signInWithPassword,
  signOut as signOutSupabase,
  clearAuthSession
} from "./src/sync/supabase-auth.js";
import {
  beginMfaSetup,
  confirmMfaSetup,
  verifyUserMfa,
  disableUserMfa,
  mfaRequiredForUser,
  serverMfaOfflineGraceOk,
  userMfaEnabled
} from "./src/core/mfa.js";
import { applyMomoWebhookVerification, processMomoCallback } from "./src/core/momo-webhook.js";
import { postDoubleEntry, cashPositionPesewas, markLedgerPairReversed } from "./src/core/double-entry.js";
import { verifyMomoPaymentLocally } from "./src/core/momo.js";
import { productionWarnings, blockFinancialWriteIfUnsafe } from "./src/core/production-guards.js";
import {
  buildDistributionRecord,
  computeCyclePayouts,
  approveDistribution,
  markDistributionPaid,
  canApproveDistribution
} from "./src/core/group-distribution.js";
import {
  roleLabel as agencyRoleLabel,
  canAccessView as roleCanAccessView,
  navItemsForRole,
  staffRoleOptions,
  canManageStaff,
  canManageSettings,
  canApproveFinancial,
  canDisburseFunds
} from "./src/core/roles.js";
import { ensureBranchesFromLocations } from "./src/core/branches.js";
import {
  saveBranch,
  setBranchStatus,
  searchBranches,
  filterBranchesForUser,
  nextBranchCode,
  branchDashboard,
  branchRankings,
  staffForBranch,
  createBranchTransfer,
  applyEntityTransfer,
  bulkTransferCustomers,
  publishAnnouncement,
  acknowledgeAnnouncement,
  addCalendarEvent,
  addBranchDocument,
  exportBranchRows,
  canManageBranches
} from "./src/core/branch-ops.js";
import {
  renderBranchForm,
  renderBranchFilters,
  renderBranchTable,
  renderBranchAnalytics,
  renderBranchDashboard,
  renderBranchPager
} from "./src/ui/branch-views.js";
import { applyAgentProfile, nextAgentCode, capabilitiesFromAuthority, staffAgents } from "./src/core/agents.js";
import {
  applyAgentOps,
  productPermissionFromForm,
  agentCanCollectProduct,
  searchAgents,
  setAgentStatus,
  transferAgentBranch,
  bulkAssignCustomers,
  upsertRoute,
  clockIn,
  clockOut,
  markAttendance,
  requestLeave,
  decideLeave,
  logVisit,
  addAgentNote,
  addAgentDocument,
  agentKpis,
  agentRankings,
  agentWallet,
  agentDeskModel,
  exportAgentRows,
  canManageAgents,
  canApproveAgentExpense
} from "./src/core/agent-ops.js";
import {
  renderAgentOpsFormExtras,
  renderAgentAnalytics,
  renderAgentFilters,
  renderAgentTable,
  renderAgentDesk,
  renderAgentProfile,
  renderRouteForm,
  renderAgentExpenseForm,
  renderAgentPager
} from "./src/ui/agent-views.js";
import {
  COLLECTION_METHODS,
  MISSED_REASONS,
  applyAdjustment,
  collectionAnalytics,
  collectionCustomerCard,
  collectionDesk,
  createAdjustmentRequest,
  customerBalanceBreakdown,
  exportCollectionRows,
  filterCollections,
  fraudAlerts,
  isLargeDeposit,
  logCollectionActivity,
  missedCollectionRows,
  validateBulkDrafts,
  validateCollectionDraft
} from "./src/core/collection-ops.js";
import {
  renderAdjustmentQueue,
  renderAmountKeypad,
  renderBalanceBreakdown,
  renderBulkCollectionForm,
  renderCollectionAnalyticsPanel,
  renderCollectionCustomerCard,
  renderCollectionDesk,
  renderCollectionFilters,
  renderCollectionSwipe,
  renderMissedCollectionTable
} from "./src/ui/collection-views.js";
import { canAction, canApproveAmount, approvalLimitGhs, ACTIONS, defaultActionsForRole, setActionPermission } from "./src/core/rbac.js";
import {
  applyGroupProfile,
  approveShareOut,
  approveWelfarePayout,
  canConductGroupMeetings,
  closeMeeting,
  computeShareOut,
  createShareOut,
  exportGroupRows,
  groupAnalytics,
  groupDashboard,
  logGroupActivity,
  memberGroupCard,
  publishGroupAnnouncement,
  recordShare,
  recordWelfare,
  searchGroups,
  setGroupStatus,
  setMeetingStep,
  setMemberStatus,
  startMeeting,
  transferMember,
  waiveFine,
  GROUP_STATUSES
} from "./src/core/group-ops.js";
import {
  renderGroupAnalyticsPanel,
  renderGroupDashboardCards,
  renderGroupFilters,
  renderGroupFormExtras,
  renderMeetingWizard,
  renderMemberCards,
  renderShareOutPreview
} from "./src/ui/group-views.js";
import {
  transitionLoanStatus,
  applyRepaymentLifecycle,
  advanceLoanStatus,
  allocateRepayment,
  loanAwaitingApproval,
  loanAwaitingDisbursement,
  loanCanApproveNow,
  loanCanRejectNow,
  loanIsEditable,
  loanAcceptsRepayment,
  loanCanBeCancelled,
  loanShowsSchedule
} from "./src/core/loans-workflow.js";
import { applyCustomerKyc, nextCustomerNumber, ensureSavingsAccount, customerSavingsAccounts, addKycDocument } from "./src/core/customer-kyc.js";
import {
  CRM_STATUSES,
  CRM_MESSAGE_TEMPLATES,
  CUSTOMER_DOC_MAX_BYTES,
  CUSTOMER_DOC_TYPES,
  addCustomerNote,
  applyCustomerCrm,
  appendCustomerActivity,
  canChangeCustomerStatus,
  canHardDeleteCustomers,
  customerHasFinancialHistory,
  customerAnalytics,
  customerProfileStats,
  customerTimeline,
  emailLink,
  ensureCustomerNumber,
  exportCustomerRows,
  findDuplicateCustomers,
  membershipCardPayload,
  paginateList,
  parseCustomerImportRows,
  searchCustomersAdvanced,
  setCustomerStatus,
  setKycVerification,
  statementRows,
  whatsappLink
} from "./src/core/customer-crm.js";
import {
  renderCustomerCrmFormExtras,
  renderCustomerAnalyticsPanel,
  renderCustomerProfileExtras,
  renderCustomerFilters,
  renderCustomerBulkBar,
  renderCustomerPager,
  renderMembershipCardHtml,
  statusBadge
} from "./src/ui/customer-views.js";
import {
  bucketCrmWizardSteps,
  closeCustomerRegistrationSession,
  CUSTOMER_CREATE_OPEN_KEY,
  CUSTOMER_REG_DRAFT_KEY,
  customerRegistrationDraftFromFormData,
  defaultBusinessLocationForCollector,
  EDIT_CUSTOMER_ID_KEY,
  isCustomerCreateSessionOpen,
  isSignatureCaptured,
  openCustomerRegistrationSession,
  relationshipOptionsHtml,
  requiredFieldsInStep,
  shouldShowCustomerRegistrationForm,
  shouldShowRegisterAnotherControls,
  validateMemberRegistrationPayload
} from "./src/core/customer-wizard.js";
import { enqueueCustomerRegistrationSms } from "./src/core/customer-registration-notify.js";
import { compressMemberMediaBundle, isStorageQuotaError, reclaimCustomerMediaSpace, shrinkStateMedia } from "./src/core/media-compress.js";
import { districtSelectOptionsHtml } from "./src/core/ghana-geo.js";
import {
  createWithdrawalRequest,
  advanceWithdrawal,
  nextWithdrawalAction,
  canAdvanceWithdrawal
} from "./src/core/withdrawals-workflow.js";
import {
  submitWithdrawalRequest,
  payWithdrawal,
  reverseWithdrawalPayment,
  validateWithdrawalEligibility,
  withdrawalDashboard,
  withdrawalAnalytics,
  detectMaturedAccounts,
  maturityRedemptionPreview,
  applyQueuedWithdrawal,
  exportWithdrawalRows
} from "./src/core/withdrawal-ops.js";
import {
  renderWithdrawalDashboard,
  renderWithdrawalFormExtras,
  renderWithdrawalCustomerPreview,
  renderWithdrawalFilters,
  renderMaturedAccounts,
  renderWithdrawalAnalyticsPanel
} from "./src/ui/withdrawal-views.js";
import { createExpense } from "./src/core/expenses.js";
import { createJournalEntry, ensureChartOfAccounts, isAccountingPeriodClosed } from "./src/core/accounting-reports.js";
import { closeAccountingPeriod } from "./src/core/accounting-ops.js";
import { upsertTaxDefinition } from "./src/core/tax-engine.js";
import {
  reportDashboard,
  runReport,
  runCustomReport,
  saveReportTemplate,
  recordReportHistory,
  scheduleReport,
  runDueSchedules,
  searchRecords as searchReportRecords,
  analyticsSeries,
  exportReportCsv,
  REPORT_CATALOG
} from "./src/core/report-ops.js";
import { renderBiReportsExtra } from "./src/ui/report-views.js";
import { queueNotification, defaultNotificationTemplates, unreadNotifications, markNotificationRead, softDeleteNotification } from "./src/core/notifications.js";
import {
  processNotificationQueue,
  queueBulkNotifications,
  scheduleNotification,
  runDueNotificationSchedules,
  createAnnouncement,
  upsertProvider,
  ensureNotificationProviders
} from "./src/core/notification-ops.js";
import {
  recordAuditEvent,
  ensureAuditState,
  searchAudit,
  auditTimeline,
  verifyAuditIntegrity,
  processAuditOutbox,
  replayDeadLetter as replayAuditDeadLetter,
  archiveExpiredAudit,
  complianceReport,
  complianceCsv,
  saveAuditFilter,
  auditDashboardStats,
  recentFailedLogins,
  mergeAuditImmutable,
  COMPLIANCE_REPORTS
} from "./src/core/audit-ops.js";
import { renderAuditExtras } from "./src/ui/audit-views.js";
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
  failIdempotentRequest,
  ensureIdempotencyState,
  idempotencyMetrics,
  recordDuplicateHit
} from "./src/core/idempotency.js";
import {
  ensureSystemConfig,
  getConfigValue,
  configuredApprovalLimits,
  setParameter,
  setFeatureFlag,
  approveConfigDraft,
  rejectConfigDraft,
  rollbackConfigVersion,
  compareConfigVersions,
  searchConfig,
  updateCompanyProfile,
  addHoliday,
  exportConfig,
  importConfig,
  recordLiveSettingsChange,
  configDashboard,
  FEATURE_FLAG_CATALOG,
  upsertProductDefinition
} from "./src/core/system-config.js";
import { renderSystemConfigExtras } from "./src/ui/system-config-views.js";
import {
  ensureSyncState,
  enqueueSyncItem,
  processSyncQueue,
  canPerformOffline,
  authorizeDevice,
  revokeDevice,
  connectivityStatus,
  retrySyncItem,
  resolveConflict,
  syncDashboard,
  queueViewerRows
} from "./src/core/sync-ops.js";
import {
  ensureWave4SyncState,
  runWave4Sync,
  durableRecover,
  durablePersist,
  resolveCollectorOfflineUx,
  wave4SyncDashboard,
  noteConnectivity,
  evaluateOfflineEscalation,
  evaluateEodDecision,
  evaluateDecisionFlow,
  initCapacitorShell,
  shareReceiptNative,
  getCapacitorRuntime
} from "./src/core/wave4-offline-ops.js";
import { renderOfflineStatusBanner, renderOfflineSyncPlatformPanel, enhanceTopbarNetworkPill } from "./src/ui/offline-status-views.js";
import { renderSyncExtras } from "./src/ui/sync-views.js";
import {
  WAVE5_MODULE_SCREEN_MAP,
  analyzeWave5Gaps,
  buildOpsMonitoringModel,
  portalGlobalSearch,
  portalDashboardKpis,
  assertPortalAction,
  applyPortalAdvancedFilters,
  loadLazyPanelState,
  persistLazyPanelState
} from "./src/core/wave5-admin-portal-ops.js";
import {
  renderOpsMonitoringPanel,
  renderPortalApiKpiStrip,
  renderPortalGlobalSearchPanel,
  renderAdminPortalChecklist,
  renderModuleScreenMap
} from "./src/ui/admin-portal-views.js";
import {
  analyzeWave6Gaps,
  wave6SmokeChecklist,
  WAVE6_PARITY_CHECKLIST,
  initElectronShell,
  getElectronRuntime,
  desktopScreenshotGuidance
} from "./src/core/wave6-windows-exe-ops.js";
import { renderDesktopShellStatus, renderWave6ParityChecklist } from "./src/ui/desktop-shell-views.js";
import {
  desktopPrintHtml,
  desktopExportFile,
  isElectronRuntime
} from "./src/platform/electron-shell.js";
import {
  ensureWave7State,
  wave7SmokeChecklist,
  analyzeWave7Gaps,
  calculateWave7Kpis,
  executiveDashboard,
  routeAiInsight,
  runWave7FraudScan,
  runWave7Forecast,
  exportWave7Report,
  listWave7ReportCatalog,
  reportingFrameworkMeta,
  WAVE7_REGULATORY_TEMPLATES,
  WAVE7_PARITY_CHECKLIST,
  generateRegulatoryReport
} from "./src/core/wave7-analytics-bi-ops.js";
import {
  renderWave7AnalyticsPanel,
  renderWave7ReportsExtra,
  renderWave7ParityChecklist
} from "./src/ui/wave7-analytics-views.js";
import {
  analyzeWave8Gaps,
  wave8SmokeChecklist,
  loadLastRcEvidence,
  WAVE8_PARITY_CHECKLIST
} from "./src/core/wave8-release-certification.js";
import {
  renderWave8CertificationPanel,
  renderWave8ParityChecklist
} from "./src/ui/wave8-certification-views.js";
import {
  analyzeWave9Gaps,
  wave9SmokeChecklist,
  loadLastPilotEvidence,
  WAVE9_PARITY_CHECKLIST
} from "./src/core/wave9-pilot-uat-ops.js";
import {
  renderWave9PilotPanel,
  renderWave9UatTracker,
  renderWave9UatRecorder,
  renderWave9TrainingRecorder,
  renderWave9ReconRecorder,
  renderWave9SecurityRecorder,
  renderWave9ExecutiveRecorder,
  renderWave9Readiness,
  renderWave9Feedback,
  renderWave9GoNoGoSummary,
  renderWave9ParityChecklist
} from "./src/ui/wave9-pilot-views.js";
import {
  getOrCreateRunSheet,
  saveRunSheetToStorage,
  recordScenarioExecution,
  recordHumanGateApproval,
  serializeRunSheet,
  createUatRunSheet,
  mergeRunSheetIntoScenarioRows,
  UAT_HUMAN_CONFIRM_PHRASE
} from "./src/core/wave9-uat-recording.js";
import {
  getOrCreateTrainingRunSheet,
  saveTrainingRunSheetToStorage,
  recordTrackAttendance,
  recordTrackCompetency,
  recordTrackCompletion,
  recordTrainingGateCompletion,
  serializeTrainingRunSheet,
  createTrainingRunSheet,
  TRAINING_HUMAN_CONFIRM_PHRASE
} from "./src/core/wave9-training-recording.js";
import {
  getOrCreateReconRunSheet,
  saveReconRunSheetToStorage,
  recordReconChecklistItem,
  recordReconGateSignOff,
  serializeReconRunSheet,
  createReconRunSheet,
  RECON_HUMAN_CONFIRM_PHRASE
} from "./src/core/wave9-recon-recording.js";
import {
  getOrCreateSecurityRunSheet,
  saveSecurityRunSheetToStorage,
  recordSecurityChecklistItem,
  recordSecurityGateSignOff,
  serializeSecurityRunSheet,
  createSecurityRunSheet,
  SECURITY_HUMAN_CONFIRM_PHRASE
} from "./src/core/wave9-security-recording.js";
import {
  getOrCreateExecutiveRunSheet,
  saveExecutiveRunSheetToStorage,
  recordExecutiveMemoDraft,
  recordExecutiveSponsorDecision,
  syncExecutivePrerequisitesFromStorage,
  serializeExecutiveRunSheet,
  createExecutiveRunSheet,
  EXECUTIVE_HUMAN_CONFIRM_PHRASE
} from "./src/core/wave9-executive-recording.js";
import {
  analyzeWave10Gaps,
  wave10SmokeChecklist,
  loadLastGoliveEvidence,
  WAVE10_PARITY_CHECKLIST
} from "./src/core/wave10-production-golive-ops.js";
import {
  renderWave10GolivePanel,
  renderWave10CutoverChecklist,
  renderWave10HypercareBoard,
  renderWave10ClosureSignoff,
  renderWave10ProdEnv,
  renderWave10ParityChecklist,
  renderOrgBlockedHardStopsPanel
} from "./src/ui/wave10-golive-views.js";
import { listOrgBlockedHardStops } from "./src/core/org-blocked-hard-stops.js";
import {
  ensureIdentifierState,
  identifierDashboard,
  requestDelegation,
  advanceDelegation
} from "./src/core/identifiers.js";
import {
  ensurePaymentState,
  validatePaymentRequest,
  registerBusinessPayment,
  processPaymentCallback,
  processPaymentQueue,
  createRefund,
  createReversal,
  recordSettlement,
  reconcilePayments,
  setPaymentMethodEnabled,
  signPaymentPayload,
  paymentDashboard,
  searchPayments,
  paymentDetail,
  paymentReports
} from "./src/core/payment-ops.js";
import {
  renderPaymentCollectionExtras,
  renderPaymentProviderExtras,
  renderPaymentReportsExtra
} from "./src/ui/payment-views.js";
import {
  ensureDocumentState,
  registerBusinessDocument,
  generateStatement,
  searchDocuments,
  documentDashboard,
  documentDetail,
  verifyDocumentQr,
  documentReports,
  exportDocumentCsv,
  decideReceiptApproval
} from "./src/core/document-ops.js";
import {
  renderDocumentCollectionExtras,
  renderDocumentTemplateExtras,
  renderDocumentReportsExtra
} from "./src/ui/document-views.js";
import {
  ensureJobState,
  enqueueJob,
  tickScheduler,
  scheduleJob,
  replayDeadLetter as replayJobDeadLetter,
  decideJobApproval,
  searchJobs,
  jobDashboard,
  jobDetail,
  jobReports,
  exportJobCsv
} from "./src/core/job-ops.js";
import {
  renderJobBackupExtras,
  renderJobReportsExtra
} from "./src/ui/job-views.js";
import {
  ensureMonitoringState,
  collectHealthSnapshot,
  acknowledgeAlert,
  transitionIncident,
  flushOfflineMonitoringQueue,
  requestRemoteDiagnostics,
  canCollectWithDeviceHealth,
  searchLogs,
  monitoringDashboard,
  businessMetrics,
  monitoringReports,
  exportMonitorCsv,
  capacityForecast
} from "./src/core/monitoring-ops.js";
import {
  renderMonitoringBackupExtras,
  renderMonitoringExecutiveExtras,
  renderMonitoringReportsExtra
} from "./src/ui/monitoring-views.js";
import {
  ensureGatewayState,
  dispatchGatewayRequest,
  registerApiClient,
  rotateApiKey,
  subscribeWebhook,
  generateOpenApiSpec,
  gatewayDashboard,
  gatewayReports,
  exportGatewayCsv
} from "./src/core/api-gateway-ops.js";
import {
  renderGatewayBackupExtras,
  renderGatewayReportsExtra
} from "./src/ui/api-gateway-views.js";
import {
  ensureBackupRecoveryState,
  createBackupSet,
  verifyBackup,
  requestRestore,
  transitionRestore,
  runRecoveryTest,
  backupDashboard,
  backupReports,
  exportBackupCsv
} from "./src/core/backup-recovery-ops.js";
import {
  renderRecoveryBackupExtras,
  renderRecoveryReportsExtra
} from "./src/ui/backup-recovery-views.js";
import {
  ensureSecurityState,
  evaluateRisk,
  openSecurityIncident,
  closeSecurityIncident,
  securityDashboard,
  securityReports,
  exportSecurityCsv
} from "./src/core/security-ops.js";
import { ensureContractState } from "./src/core/module-contracts.js";
import { schemaDashboard } from "./src/core/api-schema.js";
import "./src/core/module-contract-handlers.js";
import {
  renderSecurityAuditExtras,
  renderSecurityReportsExtra
} from "./src/ui/security-views.js";
import {
  ensureWorkflowState,
  startWorkflow,
  completeTask,
  tickWorkflows,
  openCase,
  taskInbox,
  workflowDashboard,
  workflowReports,
  exportWorkflowCsv
} from "./src/core/workflow-ops.js";
import "./src/core/workflow-api.js";
import {
  ensureRuleState,
  evaluateRule,
  simulateRule,
  runRuleTests,
  publishRule,
  ruleDashboard,
  ruleReports,
  exportRuleCsv
} from "./src/core/rule-ops.js";
import "./src/core/rule-api.js";
import {
  renderRuleAuditExtras,
  renderRuleReportsExtra
} from "./src/ui/rule-views.js";
import {
  ensureExchangeState,
  importExchange,
  exportExchange,
  validateImport,
  approveExportJob,
  exchangeDashboard,
  exchangeReports,
  exportExchangeCsv
} from "./src/core/exchange-ops.js";
import "./src/core/exchange-api.js";
import {
  renderExchangeAuditExtras,
  renderExchangeReportsExtra
} from "./src/ui/exchange-views.js";
import {
  ensureRecordsState,
  uploadRecord,
  archiveRecord,
  placeLegalHold,
  searchRecords as searchDigitalRecords,
  recordsDashboard,
  recordsReports,
  exportRecordsCsv,
  indexCustomerKycDocument
} from "./src/core/records-ops.js";
import "./src/core/records-api.js";
import {
  renderRecordsAuditExtras,
  renderRecordsReportsExtra
} from "./src/ui/records-views.js";
import {
  ensureBiState,
  calculateKpi,
  calculateAllKpis,
  publishKpi,
  biDashboard,
  biReports,
  exportBiCsv
} from "./src/core/bi-ops.js";
import "./src/core/bi-api.js";
import {
  renderBiAuditExtras,
  renderBiRegistryReportsExtra
} from "./src/ui/bi-views.js";
import {
  ensureIntegrationState,
  hubDispatch,
  registerWebhook,
  runTransform,
  publishMessage,
  advanceMilestone,
  integrationDashboard,
  integrationReports,
  exportIntegrationCsv
} from "./src/core/integration-ops.js";
import "./src/core/integration-api.js";
import {
  renderIntegrationAuditExtras,
  renderIntegrationReportsExtra
} from "./src/ui/integration-views.js";
import {
  ensureAiState,
  runPrediction,
  detectFraud,
  runForecast,
  generateRecommendations,
  detectDrift,
  aiDashboard,
  aiReports,
  exportAiCsv,
  aiGovernanceView
} from "./src/core/ai-ops.js";
import "./src/core/ai-api.js";
import {
  renderAiAuditExtras,
  renderAiReportsExtra
} from "./src/ui/ai-views.js";
import {
  ensurePlatformState,
  platformOpsDashboard,
  platformReports,
  exportPlatformCsv,
  scheduleMaintenance,
  planDeployment,
  evaluateFeatureFlag,
  DEFAULT_TENANT_ID
} from "./src/core/platform-ops.js";
import "./src/core/platform-api.js";
import {
  renderPlatformAuditExtras,
  renderPlatformReportsExtra
} from "./src/ui/platform-views.js";
import {
  renderWorkflowAuditExtras,
  renderWorkflowReportsExtra
} from "./src/ui/workflow-views.js";
import {
  createGroupMeeting,
  recordAttendance,
  recordMeetingLine,
  finalizeMeetingTotals
} from "./src/core/group-meetings.js";
import { findPortalCustomer, verifyPortalPin, canCustomerRequestWithdrawal, ensureDefaultPortalCredentials, portalPinFromPhone, setPortalPin, portalAccountBalance } from "./src/core/customer-portal.js";
import { qrSvg, barcodeSvg } from "./src/core/receipt-codes.js";
import {
  renderExpenses,
  renderAccounting,
  renderNotifications,
  renderGroupMeetings,
  renderWithdrawalWorkflow,
  renderAgencyReportsExtra,
  renderCustomerPortal,
  renderAgentStaffExtras,
  renderCustomerKycExtras
} from "./src/ui/agency-views.js";
import {
  buildDashboardModel,
  normalizeDashboardPrefs,
  searchCustomers,
  searchGroups as searchDashboardGroups
} from "./src/core/dashboard-analytics.js";
import { renderDashboardHome, renderSearchResults, renderNotificationDrawer } from "./src/ui/dashboard-views.js";

function syncToApp() {
  App.state = state;
  App.sessionUserId = sessionUserId;
  App.activeView = activeView;
  App.syncTimer = syncTimer;
  App.syncBusy = syncBusy;
  App.gatewayTimer = gatewayTimer;
  App.autoSyncTimer = autoSyncTimer;
  App.localSavePending = localSavePending;
  App.lastAndroidRefreshAt = lastAndroidRefreshAt;
}

function syncFromApp() {
  state = App.state;
  sessionUserId = App.sessionUserId;
  activeView = App.activeView;
  syncTimer = App.syncTimer;
  syncBusy = App.syncBusy;
  gatewayTimer = App.gatewayTimer;
  autoSyncTimer = App.autoSyncTimer;
  localSavePending = App.localSavePending;
  lastAndroidRefreshAt = App.lastAndroidRefreshAt;
}

const STORE_KEY = "smile_trust_susu_v1";
const LEGACY_ANDROID_STORE_KEY = "smile_trust_susu_android_v1";
const SYNC_URL_KEY = "smile_trust_susu_sync_url";
const SEED_LOADED_KEY = "smile_trust_susu_seed_loaded_v1";
const REMEMBER_LOGIN_KEY = "smile_trust_susu_remembered_login";
const CANCEL_PENDING_MESSAGES_KEY = "smile_trust_susu_cancel_pending_messages_v1";
const ANDROID_CLOUD_PRIMARY_KEY = "smile_trust_susu_android_cloud_primary_v1";
const SESSION_USER_KEY = "smile_trust_session_user";
const APP_VERSION = "3.2.0";
const CLOUD_SNAPSHOT_TABLE = "smile_trust_cloud_snapshots";
const PAYMENT_METHODS = COLLECTION_METHODS;
const VISIT_OUTCOMES = ["Paid", "Part-paid", "Promise to Pay", "Not Available", "Disputed", ...MISSED_REASONS];
const COLLECTOR_PERMISSION_SCREENS = [
  ["dashboard", "Dashboard"],
  ["customers", "Customers"],
  ["collections", "Collections"],
  ["susuGroups", "Susu Groups"],
  ["meetings", "Group Meetings"],
  ["withdrawals", "Withdrawals"],
  ["loans", "Loans"],
  ["loanRepayments", "Loan Repayments"],
  ["interestPayments", "Interest Payments"],
  ["messages", "Messages"],
  ["reports", "Reports"],
  ["logs", "Collector's Sheet"],
  ["closing", "Daily Closing"],
  ["handover", "Cash Handover"],
  ["backup", "Backup & Restore"],
  ["agents", "My Desk"]
];
const PORTAL_CUSTOMER_KEY = "smile_trust_portal_customer";
let syncTimer = null;
let syncBusy = false;
let gatewayTimer = null;
let autoSyncTimer = null;
let localSavePending = false;
let lastAndroidRefreshAt = 0;
let collectionWriteOptions = {};

const defaultState = {
  settings: {
    collectionDays: 31,
    loanInterest: 15,
    businessName: "Smile Trust Business Control and Collection System",
    currency: "GHS",
    theme: "emerald",
    colorMode: "light",
    cloudUrl: "",
    cloudKey: "",
    localBackupUrl: "",
    syncToken: "",
    businessId: "",
    cloudMode: "auto",
    lastReceiptSequence: 0,
    allowDeveloperLogin: false,
    assistantCanVerifyHandover: false,
    assistantCanApproveReversals: false,
    productionMode: false,
    relationalSync: false,
    postgresSourceOfTruth: false,
    unifiedCloud: false,
    supabaseAuthEnabled: false,
    momoWebhookSecret: "",
    encryptOfflineQueue: true,
    sessionTimeoutMinutes: 480,
    withdrawalApprovalRequired: true,
    fiscalYearStart: "01-01",
    fiscalYearEnd: "12-31",
    locale: "en-GH",
    timezone: "Africa/Accra"
  },
  groups: [],
  branches: [],
  users: [
    {
      id: "u-owner",
      name: DEFAULT_SYSTEM_OWNER.name,
      username: DEFAULT_SYSTEM_OWNER.username,
      passwordHash: "",
      role: "SystemOwner",
      systemOwner: true,
      undeletable: true,
      mustChangePassword: true,
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "u-developer",
      name: DEFAULT_SUPER_ADMIN.name,
      username: DEFAULT_SUPER_ADMIN.username,
      passwordHash: "",
      role: "KBA",
      systemOwner: false,
      mustChangePassword: true,
      active: true,
      createdAt: new Date().toISOString()
    }
  ],
  customers: [],
  collections: [],
  loans: [],
  transactions: [],
  messages: [],
  closings: [],
  deletedUsers: [],
  deletedRecords: [],
  audit: [],
  ledgerEntries: [],
  reversals: [],
  handovers: [],
  exceptions: [],
  offlineQueue: [],
  devices: [],
  susuGroups: [],
  groupDistributions: [],
  savingsProducts: [],
  collectorAssignments: [],
  expenses: [],
  withdrawalRequests: [],
  savingsAccounts: [],
  notifications: [],
  notificationTemplates: {},
  groupMeetings: [],
  journalEntries: [],
  chartOfAccounts: [],
  agentRoutes: [],
  agentAttendance: [],
  agentLeave: [],
  agentVisits: [],
  branchTransfers: [],
  branchAnnouncements: [],
  branchCalendar: [],
  collectionAdjustments: [],
  collectionActivityLogs: [],
  collectionTargets: [],
  groupLeadershipHistory: [],
  groupFines: [],
  groupWelfare: [],
  groupShares: [],
  groupShareOuts: [],
  groupAnnouncements: [],
  groupActivityLogs: [],
  withdrawalActivityLogs: [],
  accountClosures: [],
  taxDefinitions: [],
  taxConfigHistory: [],
  accountingPeriods: [],
  reportTemplates: [],
  scheduledReports: [],
  reportHistory: [],
  reportExports: [],
  reportActivityLogs: [],
  savedFilters: [],
  reportFavorites: [],
  notificationPreferences: [],
  notificationProviders: [],
  scheduledNotifications: [],
  announcements: [],
  deliveryAttempts: [],
  notificationActivityLogs: [],
  auditOutbox: [],
  auditArchives: [],
  auditIntegrityChecks: [],
  auditActivityLogs: [],
  auditRetentionPolicies: [],
  savedAuditFilters: [],
  auditAlerts: [],
  auditExports: [],
  idempotencyKeys: [],
  idempotencyActivityLogs: [],
  idempotencyArchives: [],
  companyProfile: {},
  parameterValues: [],
  featureFlags: [],
  configurationVersions: [],
  configurationChanges: [],
  configurationDrafts: [],
  businessCalendars: [],
  backupPolicies: [],
  syncPolicies: [],
  productDefinitions: [],
  configActivityLogs: [],
  syncSessions: [],
  syncConflicts: [],
  syncResolutions: [],
  localReceipts: [],
  syncCheckpoints: [],
  syncActivityLogs: [],
  syncVersions: [],
  deviceAuthorizations: [],
  offlineConfiguration: [],
  syncMeta: {},
  aggregateVersions: [],
  aggregateLocks: [],
  identifierSequences: {},
  identifierRegistry: [],
  identifierActivityLogs: [],
  identifierDelegations: [],
  identifierDelegationReviews: [],
  externalReferences: [],
  paymentTransactions: [],
  paymentMethods: [],
  paymentProviders: [],
  providerCredentials: [],
  paymentCallbacks: [],
  paymentReconciliation: [],
  settlements: [],
  paymentRefunds: [],
  paymentReversals: [],
  paymentQueue: [],
  paymentAttempts: [],
  providerHealth: [],
  paymentLimits: [],
  paymentActivityLogs: [],
  paymentBlacklist: [],
  paymentStatusHistory: [],
  paymentStageLocks: [],
  paymentOwnershipEvents: [],
  paymentWorkflowEvents: [],
  paymentOwnerHealth: [],
  documents: [],
  documentTemplates: [],
  templateVersions: [],
  documentVersions: [],
  documentMetadata: [],
  documentSignatures: [],
  documentQrCodes: [],
  documentDelivery: [],
  documentStorage: [],
  documentCategories: [],
  documentActivityLogs: [],
  documentJobs: [],
  offlineReceipts: [],
  receiptReconciliation: [],
  receiptMappingHistory: [],
  receiptApprovals: [],
  documentStatusHistory: [],
  receiptOutcomeHistory: [],
  backgroundJobs: [],
  jobDefinitions: [],
  jobSchedules: [],
  jobQueue: [],
  jobAttempts: [],
  jobDependencies: [],
  workerNodes: [],
  workerHeartbeats: [],
  deadLetterQueue: [],
  jobActivityLogs: [],
  schedulerConfiguration: [],
  jobLocks: [],
  jobApprovals: [],
  jobStatusHistory: [],
  monitoringServices: [],
  healthChecks: [],
  healthScores: [],
  monitoringMetrics: [],
  monitoringAlerts: [],
  alertRules: [],
  alertHistory: [],
  incidents: [],
  incidentEvents: [],
  traces: [],
  traceSpans: [],
  logEntries: [],
  diagnostics: [],
  capacityStatistics: [],
  monitoringActivityLogs: [],
  androidDevices: [],
  deviceHealthSnapshots: [],
  deviceConnectivityHistory: [],
  offlineHealthEvents: [],
  deviceStorageMetrics: [],
  synchronizationMetrics: [],
  deviceSecurityEvents: [],
  applicationCrashReports: [],
  offlineMonitoringQueue: [],
  deviceAlerts: [],
  apiClients: [],
  apiKeys: [],
  apiTokens: [],
  apiVersions: [],
  apiRequests: [],
  apiRateLimits: [],
  apiRateWindows: [],
  webhookSubscriptions: [],
  webhookDeliveries: [],
  apiUsageStatistics: [],
  apiAuditLogs: [],
  integrationPartners: [],
  gatewayActivityLogs: [],
  backupJobs: [],
  backupSets: [],
  backupFiles: [],
  backupVerifications: [],
  restoreRequests: [],
  restoreOperations: [],
  disasterRecoverySites: [],
  recoveryTests: [],
  backupRetentionPolicies: [],
  backupStorage: [],
  recoveryActivityLogs: [],
  continuityPlans: [],
  androidOfflineBackups: [],
  riskScores: [],
  securityIncidents: [],
  fraudCases: [],
  threatSignals: [],
  securityInvestigations: [],
  securityActivityLogs: [],
  domainEvents: [],
  contractInvocations: [],
  contractVersions: []
};

migrateUnifiedLocalStorage();
let state = normalizeState(loadState());
let sessionUserId = sessionStorage.getItem(SESSION_USER_KEY) || rememberedUserId();
let activeView = "dashboard";
let dashClockTimer = null;
let dashRefreshTimer = null;

const app = document.querySelector("#app");

function migrateUnifiedLocalStorage() {
  const legacyData = localStorage.getItem(LEGACY_ANDROID_STORE_KEY);
  if (!legacyData) return;
  try {
    const currentRaw = localStorage.getItem(STORE_KEY);
    const legacy = JSON.parse(legacyData);
    if (currentRaw) {
      const merged = mergeStates(JSON.parse(currentRaw), legacy);
      localStorage.setItem(STORE_KEY, JSON.stringify(merged));
    } else {
      localStorage.setItem(STORE_KEY, legacyData);
    }
    localStorage.removeItem(LEGACY_ANDROID_STORE_KEY);
  } catch {
    if (!localStorage.getItem(STORE_KEY)) {
      localStorage.setItem(STORE_KEY, legacyData);
    }
  }
}

function loadState() {
  const saved = localStorage.getItem(STORE_KEY);
  if (!saved) return structuredClone(defaultState);
  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

function rememberedUserId() {
  return null;
}

function rememberedLogin() {
  try {
    return JSON.parse(localStorage.getItem(REMEMBER_LOGIN_KEY) || "null");
  } catch {
    return null;
  }
}

async function findLoginUser(username, password) {
  const user = state.users.find((item) => item.username?.toLowerCase() === username && item.active && !item.pending);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  if (user.role === "Developer" && !developerLoginAllowed(state)) return null;
  if (isLegacyBootstrapHash(user.passwordHash)) {
    if (isDefaultSystemAccount(user)) user.mustChangePassword = true;
    user.passwordHash = await hashPassword(password);
    user.updatedAt = new Date().toISOString();
    saveState();
  }
  return user;
}

function normalizeState(data) {
  const normalized = { ...structuredClone(defaultState), ...data };
  normalized.groups = normalized.groups || [];
  normalized.audit = normalized.audit || [];
  normalized.closings = normalized.closings || [];
  normalized.ledgerEntries = normalized.ledgerEntries || [];
  normalized.reversals = normalized.reversals || [];
  normalized.handovers = normalized.handovers || [];
  normalized.exceptions = normalized.exceptions || [];
  normalized.offlineQueue = normalized.offlineQueue || [];
  normalized.devices = normalized.devices || [];
  normalized.groupDistributions = normalized.groupDistributions || [];
  normalized.susuGroups = (normalized.susuGroups || []).map((group) => ({
    memberships: [],
    walletPesewas: 0,
    contributionFrequency: "Daily",
    cycleLength: 31,
    active: true,
    ...group,
    walletPesewas: Number(group.walletPesewas ?? toPesewas(group.wallet || 0))
  }));
  ensureSavingsProducts(normalized);
  ensureChartOfAccounts(normalized);
  ensureBranchesFromLocations(normalized, uid);
  if (!normalized.notificationTemplates || !Object.keys(normalized.notificationTemplates).length) {
    normalized.notificationTemplates = defaultNotificationTemplates();
  }
  normalized.collectorAssignments = normalized.collectorAssignments || [];
  normalized.expenses = normalized.expenses || [];
  normalized.withdrawalRequests = normalized.withdrawalRequests || [];
  normalized.savingsAccounts = normalized.savingsAccounts || [];
  normalized.notifications = normalized.notifications || [];
  normalized.groupMeetings = normalized.groupMeetings || [];
  normalized.journalEntries = normalized.journalEntries || [];
  normalized.agentRoutes = normalized.agentRoutes || [];
  normalized.agentAttendance = normalized.agentAttendance || [];
  normalized.agentLeave = normalized.agentLeave || [];
  normalized.agentVisits = normalized.agentVisits || [];
  normalized.branchTransfers = normalized.branchTransfers || [];
  normalized.branchAnnouncements = normalized.branchAnnouncements || [];
  normalized.branchCalendar = normalized.branchCalendar || [];
  normalized.collectionAdjustments = normalized.collectionAdjustments || [];
  normalized.collectionActivityLogs = normalized.collectionActivityLogs || [];
  normalized.collectionTargets = normalized.collectionTargets || [];
  normalized.groupLeadershipHistory = normalized.groupLeadershipHistory || [];
  normalized.groupFines = normalized.groupFines || [];
  normalized.groupWelfare = normalized.groupWelfare || [];
  normalized.groupShares = normalized.groupShares || [];
  normalized.groupShareOuts = normalized.groupShareOuts || [];
  normalized.groupAnnouncements = normalized.groupAnnouncements || [];
  normalized.groupActivityLogs = normalized.groupActivityLogs || [];
  normalized.withdrawalActivityLogs = normalized.withdrawalActivityLogs || [];
  normalized.accountClosures = normalized.accountClosures || [];
  normalized.taxDefinitions = normalized.taxDefinitions || [];
  normalized.taxConfigHistory = normalized.taxConfigHistory || [];
  normalized.accountingPeriods = normalized.accountingPeriods || [];
  normalized.reportTemplates = normalized.reportTemplates || [];
  normalized.scheduledReports = normalized.scheduledReports || [];
  normalized.reportHistory = normalized.reportHistory || [];
  normalized.reportExports = normalized.reportExports || [];
  normalized.reportActivityLogs = normalized.reportActivityLogs || [];
  normalized.savedFilters = normalized.savedFilters || [];
  normalized.reportFavorites = normalized.reportFavorites || [];
  normalized.notificationPreferences = normalized.notificationPreferences || [];
  normalized.notificationProviders = normalized.notificationProviders || [];
  normalized.scheduledNotifications = normalized.scheduledNotifications || [];
  normalized.announcements = normalized.announcements || [];
  normalized.deliveryAttempts = normalized.deliveryAttempts || [];
  normalized.notificationActivityLogs = normalized.notificationActivityLogs || [];
  ensureAuditState(normalized);
  ensureIdempotencyState(normalized);
  ensureSystemConfig(normalized);
  ensureSyncState(normalized);
  ensureIdentifierState(normalized);
  ensurePaymentState(normalized);
  ensureJobState(normalized);
  ensureMonitoringState(normalized);
  ensureGatewayState(normalized);
  ensureBackupRecoveryState(normalized);
  ensureSecurityState(normalized);
  ensureContractState(normalized);
  ensureWorkflowState(normalized);
  ensureRuleState(normalized);
  ensureExchangeState(normalized);
  ensureRecordsState(normalized);
  ensureBiState(normalized);
  ensureIntegrationState(normalized);
  ensureAiState(normalized);
  ensurePlatformState(normalized);
  normalized.branches = normalized.branches || [];
  normalized.deletedUsers = normalized.deletedUsers || [];
  normalized.deletedRecords = normalized.deletedRecords || [];
  normalized.settings = { ...structuredClone(defaultState.settings), ...(normalized.settings || {}) };
  normalized.settings.cloudUrl = normalized.settings.cloudUrl || localStorage.getItem(SYNC_URL_KEY) || resolvedSupabaseUrl(normalized);
  normalized.settings.cloudKey = normalized.settings.cloudKey || localStorage.getItem("smile_trust_susu_cloud_key") || resolvedSupabaseKey(normalized);
  normalized.settings.localBackupUrl = normalized.settings.localBackupUrl || resolvedLocalBackupUrl(normalized);
  normalized.settings.businessId = resolveBusinessId(normalized);
  if (!/Electron/i.test(navigator.userAgent) && /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(normalized.settings.cloudUrl || "")) {
    normalized.settings.cloudUrl = localStorage.getItem(SYNC_URL_KEY) || "";
  }
  normalized.customers = (normalized.customers || []).map((customer) => {
    const group = (normalized.groups || []).find((item) => item.id === customer.groupId);
    const defaultProductId = normalized.savingsProducts?.find((p) => p.code === "PERS-DAILY")?.id || "";
    return {
      nhis: "",
      ghanaCard: "",
      sittingsPaid: 0,
      collectorId: customer.collectorId || group?.collectorId || "",
      memberStatus: customer.memberStatus || (customer.active === false ? "Closed" : "Active"),
      savingsProductId: customer.savingsProductId || defaultProductId,
      accountType: customer.accountType || "personal",
      customerNumber: customer.customerNumber || "",
      beneficiaries: customer.beneficiaries || [],
      kycDocuments: customer.kycDocuments || [],
      ...customer
    };
  });
  normalized.collections = (normalized.collections || []).map((collection) => ({
    groupId: normalized.customers.find((customer) => customer.id === collection.customerId)?.groupId || "",
    contributionNo: "",
    sittingsPaid: Number(collection.sittingsPaid || collection.contributionNo || 0),
    amountPesewas: Number(collection.amountPesewas ?? toPesewas(collection.amount)),
    susuGroupId: collection.susuGroupId || "",
    ...collection
  }));
  normalized.loans = (normalized.loans || []).map((loan) => ({
    groupId: normalized.customers.find((customer) => customer.id === loan.customerId)?.groupId || "",
    interestMonths: Number(loan.interestMonths || 1),
    ...loan
  })).map((loan) => ({
    ...loan,
    interestSchedule: loan.interestSchedule?.length
      ? loan.interestSchedule
      : buildInterestSchedule(loan.date || today(), loan.principal || 0, loan.interest || 0, loan.interestMonths || 1)
  }));
  normalized.messages = normalized.messages || [];
  ensureSystemAccounts(normalized);
  normalized.users = normalized.users.map((user) => {
    if (user.password && !user.passwordHash) user.passwordHash = legacyHash(user.password);
    delete user.password;
    return user;
  });
  normalized.transactions = normalized.transactions || [];
  normalized.loans = (normalized.loans || []).map((loan) => ({
    ...loan,
    status: loan.status || (() => {
      const hasDisbursement = normalized.transactions.some((tx) => tx.ref === loan.id && tx.type === "Loan Disbursement");
      if (loan.amountPaid >= loan.totalDue) return "Completed";
      if (hasDisbursement) return "Active";
      return "Pending";
    })()
  }));
  normalized.users = applyUserTombstones(normalized.users, normalized.deletedUsers);
  normalized.groups = applyRecordTombstones(normalized.groups, normalized.deletedRecords, "groups");
  normalized.customers = applyRecordTombstones(normalized.customers, normalized.deletedRecords, "customers");
  normalized.collections = applyRecordTombstones(normalized.collections, normalized.deletedRecords, "collections");
  normalized.loans = applyRecordTombstones(normalized.loans, normalized.deletedRecords, "loans");
  normalized.transactions = applyRecordTombstones(normalized.transactions || [], normalized.deletedRecords, "transactions");
  normalized.messages = applyRecordTombstones(normalized.messages || [], normalized.deletedRecords, "messages");
  normalized.susuGroups = applyRecordTombstones(normalized.susuGroups, normalized.deletedRecords, "susuGroups");
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(normalized));
  } catch (error) {
    // Callers persist again after shrinking media; a full quota must not discard merged data.
    if (!isStorageQuotaError(error)) throw error;
  }
  return normalized;
}

async function persistStateWithMediaShrink({ keepCustomerId = "" } = {}) {
  await shrinkStateMedia(state);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    reclaimCustomerMediaSpace(state, { keepCustomerId });
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }
}

function saveState(options = {}) {
  state.updatedAt = new Date().toISOString();
  const write = () => localStorage.setItem(STORE_KEY, JSON.stringify(state));
  try {
    write();
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    const keepCustomerId = options.keepCustomerId || "";
    persistStateWithMediaShrink({ keepCustomerId }).catch(() => {
      toast("Could not save on this device. Tap Sync now so your changes reach the cloud.");
    });
  }
  localSavePending = true;
  queueCloudBackup();
}

function signOutCurrentUser() {
  logAudit("Logout", `${currentUser()?.username || ""} signed out`);
  clearSession();
  void signOutSupabase(state);
  clearAuthSession();
  clearSensitiveOfflineCache();
  sessionUserId = null;
  mobileMoreOpen = false;
  mobileDrawerOpen = false;
  render();
}

function confirmSignOutAllowed() {
  // Collectors / phone: skip backup nag so Sign out is one tap.
  if (isCollector() || isMobileLayout()) return true;
  if (backupDoneToday()) return true;
  return confirm("No backup has been recorded today. Sign out anyway?");
}

function defaultCloudUrl() {
  if (/Electron/i.test(navigator.userAgent)) return "http://localhost:8787";
  return "";
}

function isAndroidRuntime() {
  return /Android/i.test(navigator.userAgent);
}

let mobileMoreOpen = false;
let mobileDrawerOpen = false;

function isMobileLayout() {
  if (typeof window === "undefined") return false;
  return isAndroidRuntime() || window.matchMedia("(max-width: 768px)").matches;
}

function useCollectorBottomNav() {
  return isCollector() && isMobileLayout();
}

function useMobileDrawerNav() {
  return isMobileLayout() && !useCollectorBottomNav() && !!currentUser();
}

function mobileNavIcon(name) {
  const icons = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" fill="currentColor"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0Z" fill="currentColor"/></svg>',
    cash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v10H3Zm2 2v6h14V9Zm2 2h2v2H7Zm4 0h6v2h-6Z" fill="currentColor"/></svg>',
    groups: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM2 19a6 6 0 0 1 12 0Zm8 0a6 6 0 0 1 12 0Z" fill="currentColor"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v2H4Zm0 5h16v2H4Zm0 5h16v2H4Z" fill="currentColor"/></svg>'
  };
  return icons[name] || icons.menu;
}

function collectorMobilePrimaryNav(user = currentUser()) {
  const items = [
    ["dashboard", "Home", "home"],
    ["customers", "Customers", "users"],
    ["collections", "Collect", "cash"],
    ["susuGroups", "Groups", "groups"],
    ["more", "More", "menu"]
  ];
  return items.filter(([key]) => {
    if (key === "more") return true;
    return collectorScreenAllowed(user, key);
  });
}

function collectorMobileMoreItems(user = currentUser()) {
  const primary = new Set(["dashboard", "customers", "collections", "susuGroups"]);
  return collectorNavItems(user).filter(([key]) => !primary.has(key));
}

function afterCollectionSaved(collection, customer) {
  logCollectionActivity(state, {
    action: Number(collection.amount || 0) > 0 ? "Collected" : "Missed",
    collectionId: collection.id,
    detail: `${customer.name} · ${collection.receiptNo || collection.paymentNo || ""}`,
    userId: currentUser()?.id || "",
    uid
  });
  if (Number(collection.amount || 0) > 0) {
    registerBusinessPayment(state, {
      paymentType: collection.susuGroupId ? "group_contribution" : "savings_deposit",
      paymentMethod: collection.paymentMethod || "Cash",
      amount: collection.amount,
      customerId: collection.customerId,
      branchId: collection.branchId || "",
      groupId: collection.groupId || "",
      businessType: "collection",
      businessId: collection.id,
      paymentReference: collection.paymentReference || "",
      date: collection.date,
      customerName: customer.name,
      accountingAlreadyPosted: true,
      idempotencyKey: `pay:collection:${collection.id}`
    }, currentUser(), uid);
    const wallet = /momo|mobile money|telecel|airteltigo/i.test(collection.paymentMethod || "");
    registerBusinessDocument(state, {
      type: wallet ? "mobile_money_receipt" : (collection.susuGroupId ? "savings_collection_receipt" : "savings_collection_receipt"),
      receiptNo: collection.receiptNo,
      temporaryReceiptNo: collection.temporaryReceiptNo || "",
      offline: Boolean(collection.offline || collection.temporaryReceiptNo),
      paymentMethod: collection.paymentMethod || "Cash",
      amount: collection.amount,
      customerId: collection.customerId,
      customerName: customer.name,
      agentId: collection.collectorId || currentUser()?.id || "",
      agentName: currentUser()?.name || "",
      branchId: collection.branchId || "",
      deviceId: collection.deviceId || "",
      businessType: "collection",
      businessId: collection.id,
      transactionId: collection.id,
      localTransactionId: collection.id,
      accountingAlreadyPosted: true,
      date: collection.date,
      idempotencyKey: `doc:collection:${collection.id}`
    }, currentUser(), uid);
  }
  const product = productById(state.savingsProducts, collection.savingsProductId);
  if (Number(collection.amount || 0) > 0 && isLargeDeposit(collection.amount, product)) {
    queueNotification(state, {
      event: "large_deposit_alert",
      channel: "In-App",
      customerId: customer.id,
      userId: currentUser()?.id || "",
      vars: { name: customer.name, amount: Number(collection.amount).toFixed(2), receiptNo: collection.receiptNo },
      uid,
      idempotencyKey: `${collection.id}:large_deposit_alert`
    });
  }
  if (Number(collection.amount || 0) <= 0) {
    queueNotification(state, {
      event: "missed_contribution",
      channel: "In-App",
      customerId: customer.id,
      vars: { name: customer.name, date: collection.date },
      uid,
      idempotencyKey: `${collection.id}:missed_contribution`
    });
  }
  const desk = collectionDesk(state, currentUser()?.id, { date: today() });
  if (Number(collection.amount || 0) > 0 && desk.progressPercent >= 100) {
    queueNotification(state, {
      event: "target_achieved",
      channel: "In-App",
      userId: currentUser()?.id || "",
      vars: { agentName: currentUser()?.name || "Agent" },
      uid,
      idempotencyKey: `${currentUser()?.id || "agent"}:${today()}:target_achieved`
    });
  }
  if (Number(collection.amount || 0) > 0) {
    queueNotification(state, {
      event: "receipt_generated",
      channel: "In-App",
      customerId: customer.id,
      vars: { name: customer.name, amount: Number(collection.amount).toFixed(2), receiptNo: collection.receiptNo },
      uid,
      idempotencyKey: `${collection.id}:receipt_generated`
    });
  }
  saveState();
}

function rememberCollectionSuccess(collection, customer) {
  if (!isMobileLayout()) return;
  sessionStorage.setItem("mobile_collection_success", JSON.stringify({
    receiptNo: collection.receiptNo || collection.paymentNo,
    amount: collection.amount,
    customerName: customer.name,
    paymentMethod: collection.paymentMethod,
    at: Date.now()
  }));
}

function renderMobileCollectionSuccess() {
  const raw = sessionStorage.getItem("mobile_collection_success");
  if (!raw) return "";
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return "";
  }
  if (Date.now() - (data.at || 0) > 300000) {
    sessionStorage.removeItem("mobile_collection_success");
    return "";
  }
  return `
    <div class="mobile-success-card panel" id="mobileCollectionSuccess">
      <div class="mobile-success-icon" aria-hidden="true">✓</div>
      <h2>Payment recorded</h2>
      <p class="mobile-success-amount">${money(data.amount)}</p>
      <p class="muted">${escapeHtml(data.customerName)}</p>
      <p class="muted">Receipt <strong>${escapeHtml(data.receiptNo)}</strong> · ${escapeHtml(data.paymentMethod || "Cash")}</p>
      <div class="form-actions">
        <button class="btn secondary" type="button" id="dismissCollectionSuccess">Collect another</button>
        <button class="btn ghost" type="button" id="mobileShareCollectionSuccess">Share</button>
        <button class="btn" type="button" data-view-jump="handover">Handover</button>
      </div>
    </div>
  `;
}

function renderMobileSyncBanner() {
  if (!isMobileLayout()) return "";
  ensureWave4SyncState(state);
  noteConnectivity(state, { online: navigator.onLine });
  const ux = resolveCollectorOfflineUx(state, {
    online: navigator.onLine,
    synchronizing: state.syncMeta?.status === "synchronizing",
    failed: state.syncMeta?.status === "synchronization_failed"
  });
  const banner = renderOfflineStatusBanner(ux);
  return banner ? banner.replace("wave4-offline-banner", "wave4-offline-banner mobile-only") : "";
}

function renderMobileBottomNav() {
  if (!useCollectorBottomNav()) return "";
  const items = collectorMobilePrimaryNav();
  return `
    <nav class="mobile-bottom-nav" aria-label="Primary navigation">
      ${items.map(([key, label, icon]) => `
        <button type="button" class="${activeView === key || (key === "more" && mobileMoreOpen) ? "active" : ""}" data-mobile-nav="${key}" aria-label="${escapeHtml(label)}">
          ${mobileNavIcon(icon)}
          <span>${escapeHtml(label)}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderMobileMoreSheet() {
  if (!useCollectorBottomNav()) return "";
  const moreItems = collectorMobileMoreItems();
  return `
    <div class="mobile-more-sheet ${mobileMoreOpen ? "open" : ""}" id="mobileMoreSheet" role="dialog" aria-modal="true" aria-label="More options">
      <div class="mobile-more-backdrop" data-close-more></div>
      <div class="mobile-more-panel panel">
        <div class="section-title">
          <h2>More</h2>
          <button class="btn ghost" type="button" data-close-more>Close</button>
        </div>
        <div class="mobile-more-grid">
          ${moreItems.map(([key, label]) => `
            <button type="button" class="mobile-more-item" data-view="${key}">${escapeHtml(label)}</button>
          `).join("")}
        </div>
        ${renderMobileAppearanceControls()}
        <div class="mobile-more-footer">
          <div class="sync-status-line">
            ${(() => { const _ux = resolveCollectorOfflineUx(state, { online: navigator.onLine, synchronizing: state.syncMeta?.status === "synchronizing", failed: state.syncMeta?.status === "synchronization_failed" }); return enhanceTopbarNetworkPill(_ux); })()}
            Sync: ${state.settings.lastSyncedAt ? escapeHtml(new Date(state.settings.lastSyncedAt).toLocaleString()) : "Never"}
          </div>
          <button class="btn ghost" type="button" id="mobileSyncNowBtn">Sync now</button>
          <button class="btn danger" type="button" id="mobileLogoutBtn">Sign out</button>
        </div>
      </div>
    </div>
  `;
}

function renderMobileCustomerCards(customers, pendingIds = new Set()) {
  if (!customers.length) return `<div class="empty">No customers yet.</div>`;
  return `
    <div class="mobile-card-list">
      ${customers.map((c) => {
        const personalBal = personalSavingsBalance(c.id, { collections: state.collections, transactions: state.transactions });
        return `
          <article class="mobile-data-card clickable-card" data-row-member-detail="${c.id}">
            <div class="mobile-data-card-head">
              <div>
                <button type="button" class="link-btn" data-member-detail="${c.id}"><strong>${escapeHtml(c.name)}</strong></button>
                <div class="muted">${escapeHtml(c.customerNumber || c.accountNo)} · ${escapeHtml(c.phone || "")}</div>
                ${pendingIds.has(c.id) ? `<span class="pill warn">Pending sync</span>` : ""}
              </div>
              ${statusBadge(c)}
            </div>
            <div class="mobile-data-card-meta">
              <div class="mobile-data-card-row"><span>Agent</span><span>${escapeHtml(state.users.find((user) => user.id === c.collectorId)?.name || "-")}</span></div>
              <div class="mobile-data-card-row"><span>Location</span><span>${escapeHtml(groupName(c.groupId))}</span></div>
              <div class="mobile-data-card-row"><span>Balance</span><strong>${money(customerBalance(c.id))}</strong></div>
              <div class="mobile-data-card-row"><span>Personal</span><span>${money(personalBal)}</span></div>
              <div class="mobile-data-card-row"><span>${customerHasSusuAccount(c) ? "Sittings" : "Savings"}</span><span>${memberProgress(c.id)}</span></div>
            </div>
            <div class="mobile-data-card-actions">
              <button class="btn secondary" data-edit-customer="${c.id}">Edit</button>
              <button class="btn" data-member-detail="${c.id}">Details</button>
              <button class="btn ghost" data-view-jump="collections" data-collect-for="${c.id}">Collect</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderMobileCollectionCards(collections) {
  if (!collections.length) return `<div class="empty">No collections recorded yet.</div>`;
  return `
    <div class="mobile-card-list">
      ${collections.slice().reverse().map((item) => {
        const customer = state.customers.find((entry) => entry.id === item.customerId);
        const status = collectionVerificationStatus(item);
        return `
          <article class="mobile-data-card">
            <div class="mobile-data-card-head">
              <div>
                <strong>${escapeHtml(customerName(item.customerId))}</strong>
                <div class="muted">${item.date} · ${escapeHtml(item.paymentNo || item.id)}</div>
              </div>
              <strong>${money(item.amount)}</strong>
            </div>
            <div class="mobile-data-card-meta">
              <div class="mobile-data-card-row"><span>Account</span><span>${escapeHtml(customer?.accountNo || "")}</span></div>
              <div class="mobile-data-card-row"><span>Method</span><span>${escapeHtml(collectionPaymentMethod(item))}</span></div>
              <div class="mobile-data-card-row"><span>Status</span><span class="pill ${status === "Verified" ? "" : "warn"}">${escapeHtml(status)}</span></div>
              <div class="mobile-data-card-row"><span>Officer</span><span>${escapeHtml(userName(item.userId))}</span></div>
            </div>
            <div class="row-actions" style="margin-top:8px">
              ${item.receiptNo || item.paymentNo ? `<button class="btn secondary" data-reprint-collection="${item.id}">Reprint</button>` : ""}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function mobileTableWrap(cardsHtml, tableHtml) {
  if (isMobileLayout()) {
    return `<div class="table-wrap has-mobile-cards">${cardsHtml}</div>`;
  }
  return tableHtml;
}

function renderMobileLoanCards(loans = visibleLoans()) {
  if (!loans.length) return `<div class="empty">No loans created yet.</div>`;
  return `
    <div class="mobile-card-list">
      ${loans.slice().reverse().map((loan) => `
        <article class="mobile-data-card">
          <div class="mobile-data-card-head">
            <div>
              <strong>${escapeHtml(customerName(loan.customerId))}</strong>
              <div class="muted">${loan.date} · ${escapeHtml(groupName(loan.groupId))}</div>
            </div>
            <span class="pill ${loanStatusClass(loan.status)}">${escapeHtml(loan.status)}</span>
          </div>
          <div class="mobile-data-card-meta">
            <div class="mobile-data-card-row"><span>Principal</span><strong>${money(loan.principal)}</strong></div>
            <div class="mobile-data-card-row"><span>Total due</span><span>${money(loan.totalDue)}</span></div>
            <div class="mobile-data-card-row"><span>Paid</span><span>${money(loan.amountPaid)}</span></div>
            <div class="mobile-data-card-row"><span>Balance</span><strong>${money(Math.max(0, loan.totalDue - loan.amountPaid))}</strong></div>
          </div>
          <div class="mobile-data-card-actions">
            <button class="btn secondary" data-print-loan-app="${loan.id}">Application</button>
            ${loanCanApproveNow(loan.status) && canApproveLoans() ? `<button class="btn" data-approve-loan="${loan.id}">Approve</button>` : ""}
            ${loanAwaitingDisbursement(loan.status) && canDisburseLoans() ? `<button class="btn warning" data-disburse-loan="${loan.id}">Disburse</button>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderMobileHandoverCards(rows = (state.handovers || []).slice().reverse()) {
  if (!rows.length) return `<div class="empty">No handovers yet.</div>`;
  return `
    <div class="mobile-card-list">
      ${rows.map((row) => `
        <article class="mobile-data-card">
          <div class="mobile-data-card-head">
            <div>
              <strong>${escapeHtml(userName(row.collectorId))}</strong>
              <div class="muted">${row.date} · to ${escapeHtml(row.receiverName || userName(row.receiverId) || "—")}</div>
            </div>
            <span class="pill ${handoverIsConfirmed(row) ? "" : "warn"}">${escapeHtml(handoverStatusLabel(row.status))}</span>
          </div>
          <div class="mobile-data-card-meta">
            <div class="mobile-data-card-row"><span>Expected</span><span>${money(row.expectedCash)}</span></div>
            <div class="mobile-data-card-row"><span>Declared</span><span>${money(row.declaredCash)}</span></div>
            <div class="mobile-data-card-row"><span>Counted</span><span>${money(row.countedCash ?? 0)}</span></div>
            <div class="mobile-data-card-row"><span>MoMo</span><span>${money(row.momoTotal || 0)}</span></div>
          </div>
          ${canVerifyHandover(currentUser(), row, state) && row.status === "Submitted" ? `
            <div class="mobile-data-card-actions">
              <button class="btn collector-action-btn" type="button" data-focus-handover="${row.id}">Confirm received</button>
            </div>
          ` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function renderMobileTransactionCards(transactions) {
  if (!transactions.length) return `<div class="empty">No transactions yet.</div>`;
  return `
    <div class="mobile-card-list">
      ${transactions.map((tx) => `
        <article class="mobile-data-card">
          <div class="mobile-data-card-head">
            <div>
              <strong>${escapeHtml(customerName(tx.customerId))}</strong>
              <div class="muted">${tx.date} · ${escapeHtml(tx.type)}</div>
            </div>
            <strong>${money(tx.amount)}</strong>
          </div>
          <div class="mobile-data-card-meta">
            <div class="mobile-data-card-row"><span>Officer</span><span>${escapeHtml(userName(tx.userId))}</span></div>
          </div>
          <div class="mobile-data-card-actions">
            <button class="btn secondary" data-receipt="${tx.id}">Print</button>
            <button class="btn" data-share-receipt="${tx.id}">Share</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderMobileArrearsCards(rows = arrearsRows()) {
  if (!rows.length) return `<div class="empty">No customers are behind on contributions.</div>`;
  return `
    <div class="mobile-card-list">
      ${rows.map((row) => `
        <article class="mobile-data-card clickable-card" data-row-member-detail="${row.customerId}">
          <div class="mobile-data-card-head">
            <div>
              <button type="button" class="link-btn" data-member-detail="${row.customerId}"><strong>${escapeHtml(row.member)}</strong></button>
              <div class="muted">${escapeHtml(row.group)} · ${escapeHtml(row.phone || "")}</div>
            </div>
            <strong class="text-danger">${money(row.amountRemaining)}</strong>
          </div>
          <div class="mobile-data-card-meta">
            <div class="mobile-data-card-row"><span>Sittings</span><span>${row.paid} / ${row.target}</span></div>
            <div class="mobile-data-card-row"><span>Outstanding sittings</span><span>${row.remaining}</span></div>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderMobileDailyMoneyLogCards(rows) {
  if (!rows.length) return `<div class="empty">No money received yet.</div>`;
  return `
    <div class="mobile-card-list">
      ${rows.map((row) => `
        <article class="mobile-data-card">
          <div class="mobile-data-card-head">
            <strong>${row.date}</strong>
            <strong>${money(row.totalReceived)}</strong>
          </div>
          <div class="mobile-data-card-meta">
            <div class="mobile-data-card-row"><span>Contributions</span><span>${money(row.contributions)}</span></div>
            <div class="mobile-data-card-row"><span>Loan repaid</span><span>${money(row.loanRepaid)}</span></div>
            <div class="mobile-data-card-row"><span>Interest paid</span><span>${money(row.interestPaid)}</span></div>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderMobileAuditCards(rows = visibleAudit().slice().reverse()) {
  if (!rows.length) return `<div class="empty">No audit activity yet.</div>`;
  return `
    <div class="mobile-card-list">
      ${rows.map((row) => `
        <article class="mobile-data-card">
          <div class="mobile-data-card-head">
            <div>
              <strong>${escapeHtml(row.action)}</strong>
              <div class="muted">${row.date} · ${escapeHtml(userName(row.userId))}</div>
            </div>
          </div>
          <p class="muted" style="margin:0;font-size:0.875rem">${escapeHtml(row.details || "")}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderMobileDailyInputLogCards(rows) {
  if (!rows.length) return `<div class="empty">No inputs recorded for this date.</div>`;
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return `
    <div class="mobile-card-list">
      ${rows.map((row) => `
        <article class="mobile-data-card">
          <div class="mobile-data-card-head">
            <div>
              <strong>${escapeHtml(row.member)}</strong>
              <div class="muted">${escapeHtml(row.time)} · ${escapeHtml(row.type)}</div>
            </div>
            <strong>${money(row.amount)}</strong>
          </div>
          <div class="mobile-data-card-meta">
            <div class="mobile-data-card-row"><span>Location</span><span>${escapeHtml(row.group)}</span></div>
            <div class="mobile-data-card-row"><span>Officer</span><span>${escapeHtml(row.officer)}</span></div>
          </div>
        </article>
      `).join("")}
      <article class="mobile-data-card mobile-total-card">
        <div class="mobile-data-card-row"><span>Total received</span><strong>${money(total)}</strong></div>
      </article>
    </div>
  `;
}

function buildCollectionShareText(data) {
  return [
    "Smile Trust - Payment Receipt",
    `Customer: ${data.customerName || ""}`,
    `Amount: ${money(data.amount)}`,
    `Receipt: ${data.receiptNo || ""}`,
    `Method: ${data.paymentMethod || "Cash"}`,
    `Date: ${today()}`
  ].join("\n");
}

function buildTransactionShareText(tx) {
  return [
    "Smile Trust - Receipt",
    `Type: ${tx.type}`,
    `Customer: ${customerName(tx.customerId)}`,
    `Amount: ${money(tx.amount)}`,
    `Date: ${tx.date}`,
    `Officer: ${userName(tx.userId)}`
  ].join("\n");
}

async function shareText(title, text) {
  if (window.KbaShareGateway?.shareText) {
    const result = window.KbaShareGateway.shareText(title || "Smile Trust", text || "");
    if (result === "OK") {
      toast("Shared");
      return true;
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: title || "Smile Trust", text: text || "" });
      return true;
    } catch (error) {
      if (error?.name === "AbortError") return false;
    }
  }
  try {
    await navigator.clipboard.writeText(text || "");
    toast("Copied to clipboard");
    return true;
  } catch {
    toast("Sharing is not available on this device");
    return false;
  }
}

function shareReceipt(transactionId) {
  const tx = state.transactions.find((item) => item.id === transactionId);
  if (!tx) return;
  const text = buildTransactionShareText(tx);
  void (async () => {
    const native = await shareReceiptNative({ title: `Smile Trust ${tx.type}`, text });
    if (native.ok) {
      toast("Shared");
      return;
    }
    await shareText(`Smile Trust ${tx.type}`, text);
  })();
}

let mobileKeyboardBound = false;

function initMobileKeyboardGuard() {
  if (!isMobileLayout() || mobileKeyboardBound) return;
  mobileKeyboardBound = true;
  const update = () => {
    const keyboardOpen = window.visualViewport
      ? window.visualViewport.height < window.innerHeight * 0.78
      : false;
    document.body.classList.toggle("keyboard-open", keyboardOpen);
    if (keyboardOpen && window.visualViewport) {
      document.documentElement.style.setProperty(
        "--keyboard-offset",
        `${Math.max(0, window.innerHeight - window.visualViewport.height - (window.visualViewport.offsetTop || 0))}px`
      );
    } else {
      document.documentElement.style.setProperty("--keyboard-offset", "0px");
    }
  };
  window.visualViewport?.addEventListener("resize", update);
  window.visualViewport?.addEventListener("scroll", update);
  document.addEventListener("focusin", update);
  document.addEventListener("focusout", () => setTimeout(update, 120));
  update();
}

function renderMobileAppearanceControls() {
  return `
    <div class="mobile-appearance panel-inset">
      <div class="section-title"><h3>Appearance</h3></div>
      <div class="field">
        <label for="mobileColorModeSelect">Color mode</label>
        <select id="mobileColorModeSelect" aria-label="Color mode">
          <option value="light" ${(state.settings.colorMode || "light") === "light" ? "selected" : ""}>Light</option>
          <option value="dark" ${state.settings.colorMode === "dark" ? "selected" : ""}>Dark</option>
        </select>
      </div>
      <div class="field">
        <label for="mobileThemeSelect">Theme</label>
        <select id="mobileThemeSelect" aria-label="Theme">
          <option value="emerald" ${state.settings.theme === "emerald" ? "selected" : ""}>Emerald</option>
          <option value="royal" ${state.settings.theme === "royal" ? "selected" : ""}>Royal</option>
          <option value="slate" ${state.settings.theme === "slate" ? "selected" : ""}>Slate</option>
          <option value="sunrise" ${state.settings.theme === "sunrise" ? "selected" : ""}>Sunrise</option>
          <option value="forest" ${state.settings.theme === "forest" ? "selected" : ""}>Forest</option>
          <option value="wine" ${state.settings.theme === "wine" ? "selected" : ""}>Wine</option>
          <option value="mono" ${state.settings.theme === "mono" ? "selected" : ""}>Mono</option>
          <option value="ocean" ${state.settings.theme === "ocean" ? "selected" : ""}>Ocean</option>
        </select>
      </div>
    </div>
  `;
}

function attachMobileNavHandlers() {
  document.querySelectorAll("[data-mobile-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.mobileNav;
      if (key === "more") {
        mobileMoreOpen = !mobileMoreOpen;
        render();
        return;
      }
      mobileMoreOpen = false;
      resetCustomersUiForNavigation(key);
      activeView = key;
      render();
    });
  });
  document.querySelectorAll("[data-close-more]").forEach((button) => {
    button.addEventListener("click", () => {
      mobileMoreOpen = false;
      render();
    });
  });
  document.querySelector("#mobileSyncNowBtn")?.addEventListener("click", syncNow);
  document.querySelector("#mobileLogoutBtn")?.addEventListener("click", () => {
    if (!confirmSignOutAllowed()) return;
    signOutCurrentUser();
  });
  document.querySelector("#mobileColorModeSelect")?.addEventListener("change", (event) => {
    state.settings.colorMode = event.target.value;
    saveState();
    render();
  });
  document.querySelector("#mobileThemeSelect")?.addEventListener("change", (event) => {
    state.settings.theme = event.target.value;
    saveState();
    render();
  });
  document.querySelector("#mobileShareCollectionSuccess")?.addEventListener("click", () => {
    const raw = sessionStorage.getItem("mobile_collection_success");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      void shareText(`Smile Trust receipt ${data.receiptNo}`, buildCollectionShareText(data));
    } catch {
      toast("Could not share receipt");
    }
  });
  initMobileKeyboardGuard();
  document.querySelector("#mobileMenuBtn")?.addEventListener("click", () => {
    mobileDrawerOpen = !mobileDrawerOpen;
    document.querySelector(".sidebar")?.classList.toggle("open", mobileDrawerOpen);
    document.querySelector(".mobile-drawer-backdrop")?.classList.toggle("open", mobileDrawerOpen);
  });
  document.querySelector(".mobile-drawer-backdrop")?.addEventListener("click", () => {
    mobileDrawerOpen = false;
    document.querySelector(".sidebar")?.classList.remove("open");
    document.querySelector(".mobile-drawer-backdrop")?.classList.remove("open");
  });
  document.querySelector("#dismissCollectionSuccess")?.addEventListener("click", () => {
    sessionStorage.removeItem("mobile_collection_success");
    render();
  });
  document.querySelectorAll("[data-collect-for]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("prefill_collection_customer", button.dataset.collectFor);
      activeView = "collections";
      render();
    });
  });
}

function isFormInteractionActive() {
  const element = document.activeElement;
  return Boolean(
    document.querySelector("form:focus-within") ||
    (element && ["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName))
  );
}

function hasBusinessData(data = state) {
  return Boolean(
    (data.groups || []).length ||
    (data.customers || []).length ||
    (data.collections || []).length ||
    (data.loans || []).length ||
    (data.transactions || []).length ||
    (data.users || []).some((user) => user.role !== "KBA")
  );
}

function mergeStates(localData, remoteData) {
  const local = normalizeStateForMerge(localData);
  const remote = normalizeStateForMerge(remoteData);
  const localIsNewer = Date.parse(local.updatedAt || 0) >= Date.parse(remote.updatedAt || 0);
  const deletedUsers = mergeById(local.deletedUsers, remote.deletedUsers);
  const deletedRecords = mergeById(local.deletedRecords, remote.deletedRecords);
  return {
    ...structuredClone(defaultState),
    ...remote,
    ...local,
    settings: { ...remote.settings, ...local.settings },
    companyProfile: { ...(remote.companyProfile || {}), ...(local.companyProfile || {}) },
    syncMeta: { ...(remote.syncMeta || {}), ...(local.syncMeta || {}) },
    configVersionNumber: Math.max(Number(local.configVersionNumber || 0), Number(remote.configVersionNumber || 0)),
    groups: applyRecordTombstones(mergeById(local.groups, remote.groups), deletedRecords, "groups"),
    deletedUsers,
    deletedRecords,
    users: applyUserTombstones(mergeUsers(local.users, remote.users), deletedUsers),
    customers: applyRecordTombstones(mergeById(local.customers, remote.customers), deletedRecords, "customers"),
    collections: applyRecordTombstones(mergeById(local.collections, remote.collections), deletedRecords, "collections"),
    loans: applyRecordTombstones(mergeById(local.loans, remote.loans), deletedRecords, "loans"),
    transactions: applyRecordTombstones(mergeById(local.transactions, remote.transactions), deletedRecords, "transactions"),
    messages: applyRecordTombstones(mergeById(local.messages, remote.messages), deletedRecords, "messages"),
    audit: mergeAuditImmutable(local.audit, remote.audit),
    closings: mergeById(local.closings, remote.closings),
    ledgerEntries: mergeById(local.ledgerEntries || [], remote.ledgerEntries || []),
    reversals: mergeById(local.reversals || [], remote.reversals || []),
    handovers: mergeById(local.handovers || [], remote.handovers || []),
    exceptions: mergeById(local.exceptions || [], remote.exceptions || []),
    offlineQueue: mergeById(local.offlineQueue || [], remote.offlineQueue || []),
    devices: mergeById(local.devices || [], remote.devices || []),
    susuGroups: applyRecordTombstones(mergeById(local.susuGroups || [], remote.susuGroups || []), deletedRecords, "susuGroups"),
    groupDistributions: mergeById(local.groupDistributions || [], remote.groupDistributions || []),
    savingsProducts: mergeById(local.savingsProducts || [], remote.savingsProducts || []),
    collectorAssignments: mergeById(local.collectorAssignments || [], remote.collectorAssignments || []),
    branches: mergeById(local.branches || [], remote.branches || []),
    expenses: mergeById(local.expenses || [], remote.expenses || []),
    withdrawalRequests: mergeById(local.withdrawalRequests || [], remote.withdrawalRequests || []),
    savingsAccounts: mergeById(local.savingsAccounts || [], remote.savingsAccounts || []),
    notifications: mergeById(local.notifications || [], remote.notifications || []),
    groupMeetings: mergeById(local.groupMeetings || [], remote.groupMeetings || []),
    journalEntries: mergeById(local.journalEntries || [], remote.journalEntries || []),
    agentRoutes: mergeById(local.agentRoutes || [], remote.agentRoutes || []),
    agentAttendance: mergeById(local.agentAttendance || [], remote.agentAttendance || []),
    agentLeave: mergeById(local.agentLeave || [], remote.agentLeave || []),
    agentVisits: mergeById(local.agentVisits || [], remote.agentVisits || []),
    branchTransfers: mergeById(local.branchTransfers || [], remote.branchTransfers || []),
    branchAnnouncements: mergeById(local.branchAnnouncements || [], remote.branchAnnouncements || []),
    branchCalendar: mergeById(local.branchCalendar || [], remote.branchCalendar || []),
    collectionAdjustments: mergeById(local.collectionAdjustments || [], remote.collectionAdjustments || []),
    collectionActivityLogs: mergeById(local.collectionActivityLogs || [], remote.collectionActivityLogs || []),
    collectionTargets: mergeById(local.collectionTargets || [], remote.collectionTargets || []),
    groupLeadershipHistory: mergeById(local.groupLeadershipHistory || [], remote.groupLeadershipHistory || []),
    groupFines: mergeById(local.groupFines || [], remote.groupFines || []),
    groupWelfare: mergeById(local.groupWelfare || [], remote.groupWelfare || []),
    groupShares: mergeById(local.groupShares || [], remote.groupShares || []),
    groupShareOuts: mergeById(local.groupShareOuts || [], remote.groupShareOuts || []),
    groupAnnouncements: mergeById(local.groupAnnouncements || [], remote.groupAnnouncements || []),
    groupActivityLogs: mergeById(local.groupActivityLogs || [], remote.groupActivityLogs || []),
    withdrawalActivityLogs: mergeById(local.withdrawalActivityLogs || [], remote.withdrawalActivityLogs || []),
    accountClosures: mergeById(local.accountClosures || [], remote.accountClosures || []),
    taxDefinitions: mergeById(local.taxDefinitions || [], remote.taxDefinitions || []),
    taxConfigHistory: mergeById(local.taxConfigHistory || [], remote.taxConfigHistory || []),
    accountingPeriods: mergeById(local.accountingPeriods || [], remote.accountingPeriods || []),
    reportTemplates: mergeById(local.reportTemplates || [], remote.reportTemplates || []),
    scheduledReports: mergeById(local.scheduledReports || [], remote.scheduledReports || []),
    reportHistory: mergeById(local.reportHistory || [], remote.reportHistory || []),
    reportExports: mergeById(local.reportExports || [], remote.reportExports || []),
    reportActivityLogs: mergeById(local.reportActivityLogs || [], remote.reportActivityLogs || []),
    savedFilters: mergeById(local.savedFilters || [], remote.savedFilters || []),
    reportFavorites: mergeById(local.reportFavorites || [], remote.reportFavorites || []),
    notificationPreferences: mergeById(local.notificationPreferences || [], remote.notificationPreferences || []),
    notificationProviders: mergeById(local.notificationProviders || [], remote.notificationProviders || []),
    scheduledNotifications: mergeById(local.scheduledNotifications || [], remote.scheduledNotifications || []),
    announcements: mergeById(local.announcements || [], remote.announcements || []),
    deliveryAttempts: mergeById(local.deliveryAttempts || [], remote.deliveryAttempts || []),
    notificationActivityLogs: mergeById(local.notificationActivityLogs || [], remote.notificationActivityLogs || []),
    auditOutbox: mergeById(local.auditOutbox || [], remote.auditOutbox || []),
    auditArchives: mergeAuditImmutable(local.auditArchives || [], remote.auditArchives || []),
    auditIntegrityChecks: mergeById(local.auditIntegrityChecks || [], remote.auditIntegrityChecks || []),
    auditActivityLogs: mergeById(local.auditActivityLogs || [], remote.auditActivityLogs || []),
    auditRetentionPolicies: mergeById(local.auditRetentionPolicies || [], remote.auditRetentionPolicies || []),
    savedAuditFilters: mergeById(local.savedAuditFilters || [], remote.savedAuditFilters || []),
    auditAlerts: mergeById(local.auditAlerts || [], remote.auditAlerts || []),
    auditExports: mergeById(local.auditExports || [], remote.auditExports || []),
    idempotencyKeys: mergeById(local.idempotencyKeys || [], remote.idempotencyKeys || []),
    idempotencyActivityLogs: mergeById(local.idempotencyActivityLogs || [], remote.idempotencyActivityLogs || []),
    idempotencyArchives: mergeById(local.idempotencyArchives || [], remote.idempotencyArchives || []),
    parameterValues: mergeById(local.parameterValues || [], remote.parameterValues || []),
    featureFlags: mergeById(local.featureFlags || [], remote.featureFlags || []),
    configurationVersions: mergeById(local.configurationVersions || [], remote.configurationVersions || []),
    configurationChanges: mergeById(local.configurationChanges || [], remote.configurationChanges || []),
    configurationDrafts: mergeById(local.configurationDrafts || [], remote.configurationDrafts || []),
    businessCalendars: mergeById(local.businessCalendars || [], remote.businessCalendars || []),
    backupPolicies: mergeById(local.backupPolicies || [], remote.backupPolicies || []),
    syncPolicies: mergeById(local.syncPolicies || [], remote.syncPolicies || []),
    productDefinitions: mergeById(local.productDefinitions || [], remote.productDefinitions || []),
    configActivityLogs: mergeById(local.configActivityLogs || [], remote.configActivityLogs || []),
    syncSessions: mergeById(local.syncSessions || [], remote.syncSessions || []),
    syncConflicts: mergeById(local.syncConflicts || [], remote.syncConflicts || []),
    syncResolutions: mergeById(local.syncResolutions || [], remote.syncResolutions || []),
    localReceipts: mergeById(local.localReceipts || [], remote.localReceipts || []),
    syncCheckpoints: mergeById(local.syncCheckpoints || [], remote.syncCheckpoints || []),
    syncActivityLogs: mergeById(local.syncActivityLogs || [], remote.syncActivityLogs || []),
    syncVersions: mergeById(local.syncVersions || [], remote.syncVersions || []),
    deviceAuthorizations: mergeById(local.deviceAuthorizations || [], remote.deviceAuthorizations || []),
    offlineConfiguration: mergeById(local.offlineConfiguration || [], remote.offlineConfiguration || []),
    aggregateVersions: mergeById(local.aggregateVersions || [], remote.aggregateVersions || []),
    aggregateLocks: mergeById(local.aggregateLocks || [], remote.aggregateLocks || []),
    identifierRegistry: mergeById(local.identifierRegistry || [], remote.identifierRegistry || []),
    identifierActivityLogs: mergeById(local.identifierActivityLogs || [], remote.identifierActivityLogs || []),
    identifierDelegations: mergeById(local.identifierDelegations || [], remote.identifierDelegations || []),
    identifierDelegationReviews: mergeById(local.identifierDelegationReviews || [], remote.identifierDelegationReviews || []),
    externalReferences: mergeById(local.externalReferences || [], remote.externalReferences || []),
    paymentTransactions: mergeById(local.paymentTransactions || [], remote.paymentTransactions || []),
    paymentMethods: mergeById(local.paymentMethods || [], remote.paymentMethods || []),
    paymentProviders: mergeById(local.paymentProviders || [], remote.paymentProviders || []),
    providerCredentials: mergeById(local.providerCredentials || [], remote.providerCredentials || []),
    paymentCallbacks: mergeById(local.paymentCallbacks || [], remote.paymentCallbacks || []),
    paymentReconciliation: mergeById(local.paymentReconciliation || [], remote.paymentReconciliation || []),
    settlements: mergeById(local.settlements || [], remote.settlements || []),
    paymentRefunds: mergeById(local.paymentRefunds || [], remote.paymentRefunds || []),
    paymentReversals: mergeById(local.paymentReversals || [], remote.paymentReversals || []),
    paymentQueue: mergeById(local.paymentQueue || [], remote.paymentQueue || []),
    paymentAttempts: mergeById(local.paymentAttempts || [], remote.paymentAttempts || []),
    providerHealth: mergeById(local.providerHealth || [], remote.providerHealth || []),
    paymentLimits: mergeById(local.paymentLimits || [], remote.paymentLimits || []),
    paymentActivityLogs: mergeById(local.paymentActivityLogs || [], remote.paymentActivityLogs || []),
    paymentBlacklist: mergeById(local.paymentBlacklist || [], remote.paymentBlacklist || []),
    paymentStatusHistory: mergeById(local.paymentStatusHistory || [], remote.paymentStatusHistory || []),
    paymentStageLocks: mergeById(local.paymentStageLocks || [], remote.paymentStageLocks || []),
    paymentOwnershipEvents: mergeById(local.paymentOwnershipEvents || [], remote.paymentOwnershipEvents || []),
    paymentWorkflowEvents: mergeById(local.paymentWorkflowEvents || [], remote.paymentWorkflowEvents || []),
    paymentOwnerHealth: mergeById(local.paymentOwnerHealth || [], remote.paymentOwnerHealth || []),
    documents: mergeById(local.documents || [], remote.documents || []),
    documentTemplates: mergeById(local.documentTemplates || [], remote.documentTemplates || []),
    templateVersions: mergeById(local.templateVersions || [], remote.templateVersions || []),
    documentVersions: mergeById(local.documentVersions || [], remote.documentVersions || []),
    documentMetadata: mergeById(local.documentMetadata || [], remote.documentMetadata || []),
    documentSignatures: mergeById(local.documentSignatures || [], remote.documentSignatures || []),
    documentQrCodes: mergeById(local.documentQrCodes || [], remote.documentQrCodes || []),
    documentDelivery: mergeById(local.documentDelivery || [], remote.documentDelivery || []),
    documentStorage: mergeById(local.documentStorage || [], remote.documentStorage || []),
    documentCategories: mergeById(local.documentCategories || [], remote.documentCategories || []),
    documentActivityLogs: mergeById(local.documentActivityLogs || [], remote.documentActivityLogs || []),
    documentJobs: mergeById(local.documentJobs || [], remote.documentJobs || []),
    offlineReceipts: mergeById(local.offlineReceipts || [], remote.offlineReceipts || []),
    receiptReconciliation: mergeById(local.receiptReconciliation || [], remote.receiptReconciliation || []),
    receiptMappingHistory: mergeById(local.receiptMappingHistory || [], remote.receiptMappingHistory || []),
    receiptApprovals: mergeById(local.receiptApprovals || [], remote.receiptApprovals || []),
    documentStatusHistory: mergeById(local.documentStatusHistory || [], remote.documentStatusHistory || []),
    receiptOutcomeHistory: mergeById(local.receiptOutcomeHistory || [], remote.receiptOutcomeHistory || []),
    backgroundJobs: mergeById(local.backgroundJobs || [], remote.backgroundJobs || []),
    jobDefinitions: mergeById(local.jobDefinitions || [], remote.jobDefinitions || []),
    jobSchedules: mergeById(local.jobSchedules || [], remote.jobSchedules || []),
    jobQueue: mergeById(local.jobQueue || [], remote.jobQueue || []),
    jobAttempts: mergeById(local.jobAttempts || [], remote.jobAttempts || []),
    jobDependencies: mergeById(local.jobDependencies || [], remote.jobDependencies || []),
    workerNodes: mergeById(local.workerNodes || [], remote.workerNodes || []),
    workerHeartbeats: mergeById(local.workerHeartbeats || [], remote.workerHeartbeats || []),
    deadLetterQueue: mergeById(local.deadLetterQueue || [], remote.deadLetterQueue || []),
    jobActivityLogs: mergeById(local.jobActivityLogs || [], remote.jobActivityLogs || []),
    schedulerConfiguration: mergeById(local.schedulerConfiguration || [], remote.schedulerConfiguration || []),
    jobLocks: mergeById(local.jobLocks || [], remote.jobLocks || []),
    jobApprovals: mergeById(local.jobApprovals || [], remote.jobApprovals || []),
    jobStatusHistory: mergeById(local.jobStatusHistory || [], remote.jobStatusHistory || []),
    monitoringServices: mergeById(local.monitoringServices || [], remote.monitoringServices || []),
    healthChecks: mergeById(local.healthChecks || [], remote.healthChecks || []),
    healthScores: mergeById(local.healthScores || [], remote.healthScores || []),
    monitoringMetrics: mergeById(local.monitoringMetrics || [], remote.monitoringMetrics || []),
    monitoringAlerts: mergeById(local.monitoringAlerts || [], remote.monitoringAlerts || []),
    alertRules: mergeById(local.alertRules || [], remote.alertRules || []),
    alertHistory: mergeById(local.alertHistory || [], remote.alertHistory || []),
    incidents: mergeById(local.incidents || [], remote.incidents || []),
    incidentEvents: mergeById(local.incidentEvents || [], remote.incidentEvents || []),
    traces: mergeById(local.traces || [], remote.traces || []),
    traceSpans: mergeById(local.traceSpans || [], remote.traceSpans || []),
    logEntries: mergeById(local.logEntries || [], remote.logEntries || []),
    diagnostics: mergeById(local.diagnostics || [], remote.diagnostics || []),
    capacityStatistics: mergeById(local.capacityStatistics || [], remote.capacityStatistics || []),
    monitoringActivityLogs: mergeById(local.monitoringActivityLogs || [], remote.monitoringActivityLogs || []),
    androidDevices: mergeById(local.androidDevices || [], remote.androidDevices || []),
    deviceHealthSnapshots: mergeById(local.deviceHealthSnapshots || [], remote.deviceHealthSnapshots || []),
    deviceConnectivityHistory: mergeById(local.deviceConnectivityHistory || [], remote.deviceConnectivityHistory || []),
    offlineHealthEvents: mergeById(local.offlineHealthEvents || [], remote.offlineHealthEvents || []),
    deviceStorageMetrics: mergeById(local.deviceStorageMetrics || [], remote.deviceStorageMetrics || []),
    synchronizationMetrics: mergeById(local.synchronizationMetrics || [], remote.synchronizationMetrics || []),
    deviceSecurityEvents: mergeById(local.deviceSecurityEvents || [], remote.deviceSecurityEvents || []),
    applicationCrashReports: mergeById(local.applicationCrashReports || [], remote.applicationCrashReports || []),
    offlineMonitoringQueue: mergeById(local.offlineMonitoringQueue || [], remote.offlineMonitoringQueue || []),
    deviceAlerts: mergeById(local.deviceAlerts || [], remote.deviceAlerts || []),
    apiClients: mergeById(local.apiClients || [], remote.apiClients || []),
    apiKeys: mergeById(local.apiKeys || [], remote.apiKeys || []),
    apiTokens: mergeById(local.apiTokens || [], remote.apiTokens || []),
    apiVersions: mergeById(local.apiVersions || [], remote.apiVersions || []),
    apiRequests: mergeById(local.apiRequests || [], remote.apiRequests || []),
    apiRateLimits: mergeById(local.apiRateLimits || [], remote.apiRateLimits || []),
    apiRateWindows: mergeById(local.apiRateWindows || [], remote.apiRateWindows || []),
    webhookSubscriptions: mergeById(local.webhookSubscriptions || [], remote.webhookSubscriptions || []),
    webhookDeliveries: mergeById(local.webhookDeliveries || [], remote.webhookDeliveries || []),
    apiUsageStatistics: mergeById(local.apiUsageStatistics || [], remote.apiUsageStatistics || []),
    apiAuditLogs: mergeById(local.apiAuditLogs || [], remote.apiAuditLogs || []),
    integrationPartners: mergeById(local.integrationPartners || [], remote.integrationPartners || []),
    gatewayActivityLogs: mergeById(local.gatewayActivityLogs || [], remote.gatewayActivityLogs || []),
    backupJobs: mergeById(local.backupJobs || [], remote.backupJobs || []),
    backupSets: mergeById(local.backupSets || [], remote.backupSets || []),
    backupFiles: mergeById(local.backupFiles || [], remote.backupFiles || []),
    backupVerifications: mergeById(local.backupVerifications || [], remote.backupVerifications || []),
    restoreRequests: mergeById(local.restoreRequests || [], remote.restoreRequests || []),
    restoreOperations: mergeById(local.restoreOperations || [], remote.restoreOperations || []),
    disasterRecoverySites: mergeById(local.disasterRecoverySites || [], remote.disasterRecoverySites || []),
    recoveryTests: mergeById(local.recoveryTests || [], remote.recoveryTests || []),
    backupRetentionPolicies: mergeById(local.backupRetentionPolicies || [], remote.backupRetentionPolicies || []),
    backupStorage: mergeById(local.backupStorage || [], remote.backupStorage || []),
    recoveryActivityLogs: mergeById(local.recoveryActivityLogs || [], remote.recoveryActivityLogs || []),
    continuityPlans: mergeById(local.continuityPlans || [], remote.continuityPlans || []),
    androidOfflineBackups: mergeById(local.androidOfflineBackups || [], remote.androidOfflineBackups || []),
    riskScores: mergeById(local.riskScores || [], remote.riskScores || []),
    securityIncidents: mergeById(local.securityIncidents || [], remote.securityIncidents || []),
    fraudCases: mergeById(local.fraudCases || [], remote.fraudCases || []),
    threatSignals: mergeById(local.threatSignals || [], remote.threatSignals || []),
    securityInvestigations: mergeById(local.securityInvestigations || [], remote.securityInvestigations || []),
    securityActivityLogs: mergeById(local.securityActivityLogs || [], remote.securityActivityLogs || []),
    domainEvents: mergeById(local.domainEvents || [], remote.domainEvents || []),
    contractInvocations: mergeById(local.contractInvocations || [], remote.contractInvocations || []),
    contractVersions: mergeById(local.contractVersions || [], remote.contractVersions || []),
    identifierSequences: { ...(remote.identifierSequences || {}), ...(local.identifierSequences || {}) },
    updatedAt: new Date(Math.max(Date.parse(local.updatedAt || 0), Date.parse(remote.updatedAt || 0), Date.now())).toISOString(),
    lastMergedAt: new Date().toISOString(),
    mergeSource: localIsNewer ? "local-first" : "cloud-first"
  };
}

function normalizeStateForMerge(data) {
  const normalized = { ...structuredClone(defaultState), ...(data || {}) };
  normalized.settings = { ...structuredClone(defaultState.settings), ...(normalized.settings || {}) };
  ["groups", "users", "customers", "collections", "loans", "transactions", "messages", "audit", "closings", "deletedUsers", "deletedRecords", "susuGroups", "groupDistributions", "savingsProducts", "collectorAssignments", "branches", "expenses", "withdrawalRequests", "savingsAccounts", "notifications", "groupMeetings", "journalEntries", "agentRoutes", "agentAttendance", "agentLeave", "agentVisits", "branchTransfers", "branchAnnouncements", "branchCalendar", "collectionAdjustments", "collectionActivityLogs", "collectionTargets", "groupLeadershipHistory", "groupFines", "groupWelfare", "groupShares", "groupShareOuts", "groupAnnouncements", "groupActivityLogs", "withdrawalActivityLogs", "accountClosures", "taxDefinitions", "taxConfigHistory", "accountingPeriods", "reportTemplates", "scheduledReports", "reportHistory", "reportExports", "reportActivityLogs", "savedFilters", "reportFavorites", "notificationPreferences", "notificationProviders", "scheduledNotifications", "announcements", "deliveryAttempts", "notificationActivityLogs", "auditOutbox", "auditArchives", "auditIntegrityChecks", "auditActivityLogs", "auditRetentionPolicies", "savedAuditFilters", "auditAlerts", "auditExports", "idempotencyKeys", "idempotencyActivityLogs", "idempotencyArchives", "parameterValues", "featureFlags", "configurationVersions", "configurationChanges", "configurationDrafts", "businessCalendars", "backupPolicies", "syncPolicies", "productDefinitions", "configActivityLogs", "syncSessions", "syncConflicts", "syncResolutions", "localReceipts", "syncCheckpoints", "syncActivityLogs", "syncVersions", "deviceAuthorizations", "offlineConfiguration", "aggregateVersions", "aggregateLocks", "identifierRegistry", "identifierActivityLogs", "identifierDelegations", "identifierDelegationReviews", "externalReferences", "paymentTransactions", "paymentMethods", "paymentProviders", "providerCredentials", "paymentCallbacks", "paymentReconciliation", "settlements", "paymentRefunds", "paymentReversals", "paymentQueue", "paymentAttempts", "providerHealth", "paymentLimits", "paymentActivityLogs", "paymentBlacklist", "paymentStatusHistory", "paymentStageLocks", "paymentOwnershipEvents", "paymentWorkflowEvents", "paymentOwnerHealth", "documents", "documentTemplates", "templateVersions", "documentVersions", "documentMetadata", "documentSignatures", "documentQrCodes", "documentDelivery", "documentStorage", "documentCategories", "documentActivityLogs", "documentJobs", "offlineReceipts", "receiptReconciliation", "receiptMappingHistory", "receiptApprovals", "documentStatusHistory", "receiptOutcomeHistory", "backgroundJobs", "jobDefinitions", "jobSchedules", "jobQueue", "jobAttempts", "jobDependencies", "workerNodes", "workerHeartbeats", "deadLetterQueue", "jobActivityLogs", "schedulerConfiguration", "jobLocks", "jobApprovals", "jobStatusHistory", "monitoringServices", "healthChecks", "healthScores", "monitoringMetrics", "monitoringAlerts", "alertRules", "alertHistory", "incidents", "incidentEvents", "traces", "traceSpans", "logEntries", "diagnostics", "capacityStatistics", "monitoringActivityLogs", "androidDevices", "deviceHealthSnapshots", "deviceConnectivityHistory", "offlineHealthEvents", "deviceStorageMetrics", "synchronizationMetrics", "deviceSecurityEvents", "applicationCrashReports", "offlineMonitoringQueue", "deviceAlerts", "apiClients", "apiKeys", "apiTokens", "apiVersions", "apiRequests", "apiRateLimits", "apiRateWindows", "webhookSubscriptions", "webhookDeliveries", "apiUsageStatistics", "apiAuditLogs", "integrationPartners", "gatewayActivityLogs", "backupJobs", "backupSets", "backupFiles", "backupVerifications", "restoreRequests", "restoreOperations", "disasterRecoverySites", "recoveryTests", "backupRetentionPolicies", "backupStorage", "recoveryActivityLogs", "continuityPlans", "androidOfflineBackups", "riskScores", "securityIncidents", "fraudCases", "threatSignals", "securityInvestigations", "securityActivityLogs", "domainEvents", "contractInvocations", "contractVersions"].forEach((key) => {
    normalized[key] = normalized[key] || [];
  });
  return normalized;
}

function applyUserTombstones(users = [], tombstones = []) {
  return users.filter((user) => {
    if (user.id === "u-owner" || user.id === "u-developer" || user.id === SUPER_ADMIN_ID) return true;
    // Privileged roles only ignore name-based tombstones; deleting that exact account must stick.
    const privileged = user.role === "SystemOwner" || user.role === "KBA" || user.role === "Developer" || user.systemOwner;
    const userTime = Date.parse(user.updatedAt || user.createdAt || 0);
    const tombstone = tombstones.find((item) => {
      const sameId = item.userId && item.userId === user.id;
      const sameName = item.username && String(item.username).toLowerCase() === String(user.username || "").toLowerCase();
      return privileged ? sameId : sameId || sameName;
    });
    if (!tombstone) return true;
    const deletedTime = Date.parse(tombstone.deletedAt || tombstone.createdAt || 0);
    return userTime > deletedTime;
  });
}

function applyRecordTombstones(rows = [], tombstones = [], collectionName) {
  const deletes = tombstones.filter((item) => item.collection === collectionName);
  if (!deletes.length) return rows;
  return rows.filter((row) => {
    const tombstone = deletes.find((item) => item.recordId === row.id);
    if (!tombstone) return true;
    const rowTime = Date.parse(row.updatedAt || row.createdAt || row.date || 0);
    const deletedTime = Date.parse(tombstone.deletedAt || tombstone.createdAt || 0);
    return rowTime > deletedTime;
  });
}

function mergeUsers(localUsers = [], remoteUsers = []) {
  const merged = new Map();
  [...remoteUsers, ...localUsers].forEach((user) => {
    if (!user) return;
    const key = user.username ? `username:${String(user.username).toLowerCase()}` : `id:${user.id}`;
    const existing = merged.get(key);
    merged.set(key, chooseUserRecord(existing, user));
  });
  return Array.from(merged.values());
}

function chooseUserRecord(a, b) {
  if (!a) return b;
  const aReady = Boolean(a.active && !a.pending);
  const bReady = Boolean(b.active && !b.pending);
  const aPending = Boolean(a.pending);
  const bPending = Boolean(b.pending);
  let picked;
  if (aReady && bPending) picked = { ...b, ...a, active: true, pending: false };
  else if (bReady && aPending) picked = { ...a, ...b, active: true, pending: false };
  else picked = chooseNewerRecord(a, b);
  if (validPasswordHash(a?.passwordHash) && !validPasswordHash(picked?.passwordHash)) picked.passwordHash = a.passwordHash;
  if (validPasswordHash(b?.passwordHash) && !validPasswordHash(picked?.passwordHash)) picked.passwordHash = b.passwordHash;
  return picked;
}

function mergeById(localRows = [], remoteRows = []) {
  const merged = new Map();
  [...remoteRows, ...localRows].forEach((row) => {
    if (!row) return;
    const id = row.id || row.ref || `${row.date || ""}-${row.action || row.type || ""}-${row.customerId || ""}-${row.createdAt || ""}`;
    const existing = merged.get(id);
    merged.set(id, chooseNewerRecord(existing, row));
  });
  return Array.from(merged.values());
}

function chooseNewerRecord(a, b) {
  if (!a) return b;
  const aTime = Date.parse(a.updatedAt || a.createdAt || a.date || 0);
  const bTime = Date.parse(b.updatedAt || b.createdAt || b.date || 0);
  return bTime >= aTime ? { ...a, ...b } : { ...b, ...a };
}

function cloudUrl() {
  return resolvedSupabaseUrl(state);
}

function setCloudUrl(value) {
  const clean = String(value || "").trim().replace(/\/$/, "");
  state.settings.cloudUrl = clean;
  if (clean) localStorage.setItem(SYNC_URL_KEY, clean);
  else localStorage.removeItem(SYNC_URL_KEY);
}

function cloudKey() {
  return resolvedSupabaseKey(state);
}

function businessId() {
  return resolveBusinessId(state);
}

function localBackupUrl() {
  return resolvedLocalBackupUrl(state);
}

function setCloudKey(value) {
  const clean = String(value || "").trim();
  state.settings.cloudKey = clean;
  if (clean) localStorage.setItem("smile_trust_susu_cloud_key", clean);
  else localStorage.removeItem("smile_trust_susu_cloud_key");
}

function queueCloudBackup() {
  clearTimeout(syncTimer);
  if (cloudUploadsPaused()) return;
  syncTimer = setTimeout(() => pushCloudBackup(true), 3500);
}

async function hashPasswordForUser(value) {
  return hashPassword(value);
}

function togglePassword(button) {
  const input = document.querySelector(`#${button.dataset.togglePassword}`);
  if (!input) return;
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  button.textContent = isHidden ? "Hide" : "Show";
}

function money(amount) {
  return `${state.settings.currency} ${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function deviceFingerprint() {
  const key = "smile_trust_device_fp";
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, fp);
  }
  return fp;
}

function registerCurrentDevice(userId) {
  const fp = deviceFingerprint();
  state.devices = state.devices || [];
  let device = state.devices.find((item) => item.fingerprint === fp);
  if (!device) {
    device = {
      id: uid("device"),
      userId,
      fingerprint: fp,
      label: /Android/i.test(navigator.userAgent) ? "Android device" : (/Electron/i.test(navigator.userAgent) ? "Desktop" : "Browser"),
      active: true,
      localSequence: 0,
      registeredAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    };
    state.devices.push(device);
  } else {
    if (!device.active) {
      toast("This device has been disabled. Contact the Manager.");
      clearSession();
      sessionUserId = null;
      return null;
    }
    device.userId = userId;
    device.lastSeenAt = new Date().toISOString();
    device.localSequence = Number(device.localSequence || 0);
  }
  authorizeDevice(state, device, { id: userId }, uid);
  saveState();
  void pushDeviceToRelational(state, device);
  return device;
}

/** Per-device queue key first; the legacy business key only decrypts items queued before the change. */
function offlineQueueSecrets() {
  return [deviceQueueSecret(), legacySyncAccessKey(), state.settings.syncAccessKey].filter(Boolean);
}

async function enqueueOfflineCollection(collection, idempotencyKey) {
  let payload = collection;
  if (state.settings.encryptOfflineQueue !== false) {
    const encrypted = await encryptOfflinePayload(collection, {
      secret: offlineQueueSecrets(),
      fingerprint: deviceFingerprint()
    });
    payload = encrypted.encrypted ? encrypted.payload : collection;
  }
  const device = (state.devices || []).find((item) => item.fingerprint === deviceFingerprint());
  return enqueueSyncItem(state, {
    id: uid("queue"),
    kind: "collection",
    idempotencyKey,
    payload,
    encrypted: state.settings.encryptOfflineQueue !== false,
    deviceId: device?.id || deviceFingerprint(),
    agentId: collection.userId || collection.collectorId || "",
    branchId: collection.branchId || collection.groupId || "",
    businessDate: collection.date || "",
    correlationId: collection.id
  }, uid);
}

function applyQueuedCollection(entry) {
  const collection = entry.payload;
  if (!collection?.id) return false;
  if (state.collections.some((item) => item.id === collection.id)) return true;
  if ((state.collections || []).some((item) => String(item.idempotencyKey || "").toLowerCase() === String(collection.idempotencyKey || "").toLowerCase())) {
    return true;
  }
  state.collections.push(collection);
  if (Number(collection.amount) > 0) {
    postDoubleEntry(state, {
      id: uid("led"),
      entryType: "Susu Deposit",
      customerId: collection.customerId,
      groupId: collection.groupId,
      collectorId: collection.collectorId,
      amount: collection.amount,
      direction: "credit",
      referenceId: collection.id,
      referenceType: "collection",
      receiptNo: collection.receiptNo,
      paymentMethod: collection.paymentMethod,
      paymentReference: collection.paymentReference,
      createdBy: collection.userId,
      clientCreatedAt: collection.createdAt
    }, uid);
  }
  return true;
}

function applyQueuedMeeting(entry) {
  const meeting = entry.payload;
  if (!meeting?.id) return false;
  state.groupMeetings = state.groupMeetings || [];
  if (state.groupMeetings.some((item) => item.id === meeting.id)) return true;
  state.groupMeetings.push(meeting);
  return true;
}

async function flushOfflineQueueNow() {
  ensureWave4SyncState(state);
  const secret = offlineQueueSecrets();
  const fingerprint = deviceFingerprint();
  const deviceId = (state.devices || []).find((item) => item.fingerprint === fingerprint)?.id || "";
  const pending = pendingQueueItems(state);
  for (const entry of pending) {
    if (entry.encrypted) {
      try {
        entry.payload = await decryptOfflinePayload(entry, {
          secret,
          fingerprint
        });
      } catch (error) {
        entry.lastError = error.message || "Decrypt failed";
      }
    }
  }
  const pass = await runWave4Sync(state, {
    mode: "manual",
    online: navigator.onLine,
    deviceId,
    user: currentUser(),
    uid,
    secret,
    fingerprint,
    applyFn: (entry) => {
      if (entry.lastError) return false;
      if (entry.kind === "meeting") return applyQueuedMeeting(entry);
      if (entry.kind === "withdrawal") return applyQueuedWithdrawal(state, entry, uid);
      if (entry.kind === "customer") return true;
      return applyQueuedCollection(entry);
    }
  });
  const results = pass.results || [];
  if (results.length) {
    queueNotification(state, {
      event: "sync_complete",
      channel: "In-App",
      userId: currentUser()?.id || "",
      vars: {},
      uid
    });
  }
  saveState();
  for (const entry of (state.offlineQueue || []).filter((item) => item.status === "applied" && item.kind === "collection")) {
    if (entry.payload?.receiptNo) await pushCollectionToRelational(state, entry.payload);
  }
  return results;
}

function toggleDeviceActive(deviceId, active) {
  if (!isKBA()) {
    toast("Only the Manager can manage devices");
    return;
  }
  const device = (state.devices || []).find((item) => item.id === deviceId);
  if (!device) return;
  device.active = active;
  device.updatedAt = new Date().toISOString();
  if (active) authorizeDevice(state, device, currentUser(), uid);
  else revokeDevice(state, device.id, currentUser(), uid);
  saveState();
  void pushDeviceToRelational(state, device);
  logAudit(active ? "Device enabled" : "Device disabled", `${device.label || device.fingerprint} · ${userName(device.userId)}`);
  toast(active ? "Device enabled" : "Device disabled");
  render();
}

function requestTransactionReversal(transactionId) {
  const transaction = state.transactions.find((item) => item.id === transactionId);
  if (!transaction || transaction.reversed) {
    toast("Transaction not found or already reversed");
    return;
  }
  if (!canRequestCollectionReversal()) {
    toast("Only Manager or Assistant Manager can request reversals");
    return;
  }
  const customer = state.customers.find((item) => item.id === transaction.customerId);
  if (!customer || !visibleGroupIds().includes(customer.groupId)) return;
  const reason = prompt(`Enter reason for reversing this ${transaction.type}:`);
  if (!reason || !String(reason).trim()) {
    toast("A reason is required for reversals");
    return;
  }
  const reversal = createTransactionReversalRequest(state, {
    id: uid("rev"),
    transaction,
    reason: String(reason).trim(),
    requestedBy: currentUser().id,
    customerId: transaction.customerId,
    groupId: customer.groupId,
    collectorId: customer.collectorId || currentUser().id
  });
  recordException(state, {
    id: uid("ex"),
    type: "reversal_requested",
    severity: "warn",
    referenceId: reversal.id,
    referenceType: "reversal",
    collectorId: reversal.collectorId,
    reason: reversal.reason
  });
  if (canApproveReversal(currentUser(), reversal, state) && isKBA()) {
    const result = approveReversal(state, reversal.id, currentUser(), uid);
    if (result.ok) {
      saveState();
      pushCloudBackup(false);
      logAudit("Transaction reversed", `${transaction.type} · ${money(transaction.amount)} · ${reversal.reason}`);
      toast("Transaction reversed with audit trail");
      render();
      return;
    }
  }
  saveState();
  pushCloudBackup(false);
  logAudit("Reversal requested", `${transaction.type} · ${money(transaction.amount)}`);
  toast("Reversal requested. Manager approval required.");
  render();
}

function clearSensitiveOfflineCache() {
  sessionStorage.removeItem("edit_customer_id");
  sessionStorage.removeItem("edit_collection_id");
  sessionStorage.removeItem("edit_loan_id");
  sessionStorage.removeItem("edit_user_id");
  sessionStorage.removeItem("permissions_user_id");
  try {
    closeCustomerRegistrationSession(sessionStorage, localStorage);
  } catch { /* ignore */ }
  resetMemberRegistrationHardware();
}

function resetCustomersUiForNavigation(nextView = "") {
  const leavingCustomers = activeView === "customers" || activeView === "memberDetail";
  const stayingOnCustomers = nextView === "customers" || nextView === "memberDetail";
  if (leavingCustomers && !stayingOnCustomers) {
    closeCustomerRegistrationSession(sessionStorage, localStorage);
    resetMemberRegistrationHardware();
  }
  if (nextView === "customers" && activeView !== "customers") {
    // Opening Customers after login / other screens: always land on the member list.
    closeCustomerRegistrationSession(sessionStorage, localStorage);
    resetMemberRegistrationHardware();
  }
}

function currentUser() {
  return state.users.find((user) => user.id === sessionUserId);
}

function isKBA() {
  return hasOperationalPrivilege(currentUser());
}

function isDeveloper() {
  return currentUser()?.role === "Developer";
}

function isSystemOwner() {
  return isSystemOwnerUser(currentUser());
}

function isSystemUser(user) {
  return isDefaultSystemAccount(user) || isProtectedOwnerAccount(user);
}

function canAccessSystemSettings() {
  return isKBA() || isDeveloper();
}

function roleIs(...roles) {
  return roles.includes(currentUser()?.role);
}

function isAdmin() {
  return roleIs("Admin");
}

function isCollector() {
  return roleIs("Collector");
}

function isAuditor() {
  return isAuditorRole(currentUser());
}

function isReadOnlyUser() {
  return isReadOnlyRole(currentUser());
}

function canManageSusuGroups() {
  return (canManageSusuGroupsPerm(currentUser()) || canAction(currentUser(), "Group.Create") || canAction(currentUser(), "Group.Edit")) && !isReadOnlyUser();
}

function canViewMembers() {
  return isAuditor() || canManageMembers();
}

function canManageMembers() {
  if (isReadOnlyUser()) return false;
  if (isKBA() || isAdmin()) return true;
  if (isCollector()) return collectorCanAccessScreen("customers");
  return false;
}

function canManageCollections() {
  if (isReadOnlyUser()) return false;
  if (isCollector()) return collectorCanAccessScreen("collections") && canAction(currentUser(), "Savings.Collect");
  if (canAction(currentUser(), "Savings.Collect")) return true;
  if (isKBA() || isAdmin()) return true;
  return false;
}

function canManageWithdrawals() {
  if (isKBA() || isAdmin()) return true;
  if (isCollector()) return collectorCanAccessScreen("withdrawals");
  return false;
}

function canManageLoans() {
  if (isKBA() || isAdmin()) return true;
  if (isCollector()) return collectorCanAccessScreen("loans");
  return false;
}

function canDeleteLoans() {
  return isKBA() || roleIs("Admin");
}

function canApproveLoans() {
  return canApproveFinancial(currentUser()) && canAction(currentUser(), "Loan.Approve");
}

function canRejectLoans() {
  return canApproveLoans() || canAction(currentUser(), "Loan.Reject");
}

function canDisburseLoans() {
  return canDisburseFunds(currentUser());
}

function currentDeviceLabel() {
  if (typeof navigator === "undefined") return "";
  if (/Electron/i.test(navigator.userAgent)) return "Windows EXE";
  if (/Android/i.test(navigator.userAgent)) return "Android APK";
  return "Web";
}

function loanTransitionOptions(extra = {}) {
  const user = currentUser();
  return {
    userId: user?.id || "",
    role: user?.role || "",
    branchId: user?.branchId || "",
    device: currentDeviceLabel(),
    canApprove: canApproveLoans(),
    canDisburse: canDisburseLoans(),
    approvalLimit: approvalLimitGhs(user, configuredApprovalLimits(state)),
    requireDocuments: false,
    requireMakerChecker: false,
    ...extra
  };
}

function applyLoanTransition(loan, nextStatus, extra = {}) {
  const previous = loan.status;
  const result = transitionLoanStatus(loan, nextStatus, loanTransitionOptions(extra));
  if (result.error) {
    logAudit(
      "Loan status rejected",
      `${customerName(loan.customerId)} · ${loan.id} · ${previous} → ${nextStatus} · ${result.error}`
    );
    return result;
  }
  const entry = result.transition;
  if (entry) {
    logAudit(
      "Loan status changed",
      `${customerName(loan.customerId)} · ${loan.id} · ${entry.previousStatus} → ${entry.newStatus}${entry.reason ? ` · ${entry.reason}` : ""}`
    );
  }
  return result;
}

function canViewCashReports() {
  if (isKBA() || isAdmin()) return true;
  if (isCollector()) return collectorCanAccessScreen("reports");
  return false;
}

function canSaveClosing() {
  if (isKBA() || isAdmin()) return true;
  if (isCollector()) return collectorCanAccessScreen("closing");
  return false;
}

function canManageUsers() {
  return isKBA();
}

function canManagePermissions() {
  return isKBA();
}

function defaultCollectorScreenPermissions() {
  return Object.fromEntries(COLLECTOR_PERMISSION_SCREENS.map(([key]) => [key, true]));
}

function getCollectorScreenPermissions(user) {
  if (!user || user.role !== "Collector") return defaultCollectorScreenPermissions();
  return { ...defaultCollectorScreenPermissions(), ...(user.screenPermissions || {}) };
}

function collectorScreenAllowed(user, screenKey) {
  if (!user || user.role !== "Collector") return true;
  if (!collectorCanAccessScreenByCapability(user, screenKey)) return false;
  return getCollectorScreenPermissions(user)[screenKey] !== false;
}

function canAccessView(view, user = currentUser()) {
  if (!user) return false;
  if (user.role === "Collector") {
    if (view === "permissions") return false;
    if (view === "memberDetail") return collectorScreenAllowed(user, "customers");
    if (view === "groupDetail") return false;
    if (view === "dashboard") return collectorScreenAllowed(user, "dashboard");
    if (view === "agentDetail") return collectorScreenAllowed(user, "agents");
    if (view === "branchDetail") return false;
    return collectorScreenAllowed(user, view);
  }
  return roleCanAccessView(user, view);
}

function collectorCanAccessScreen(screenKey, user = currentUser()) {
  return collectorScreenAllowed(user, screenKey);
}

function collectorSelect(name, selectedId = "") {
  const collectors = state.users.filter((user) => user.role === "Collector" && user.active);
  if (!collectors.length) return `<select name="${name}" required><option value="">No collectors yet</option></select>`;
  return `<select name="${name}" id="permissionsCollectorSelect" required>${collectors.map((user) => `<option value="${user.id}" ${user.id === selectedId ? "selected" : ""}>${escapeHtml(user.name)} · ${escapeHtml(groupName(user.groupId) || "Unassigned")}</option>`).join("")}</select>`;
}

function countCollectorAllowedScreens(user) {
  const allowed = COLLECTOR_PERMISSION_SCREENS.filter(([key]) => collectorScreenAllowed(user, key)).length;
  return { allowed, denied: COLLECTOR_PERMISSION_SCREENS.length - allowed };
}

function collectorNavItems(user = currentUser()) {
  const items = navItemsForRole("Collector").filter(([key]) => key !== "users" && key !== "permissions" && key !== "settings");
  return items.filter(([key]) => collectorScreenAllowed(user, key));
}

function ensureActiveViewAllowed() {
  if (!canAccessView(activeView)) {
    const user = currentUser();
    const nav = isCollector()
      ? collectorNavItems()
      : (user ? navItemsForRole(user.role) : []);
    activeView = nav[0]?.[0] || "dashboard";
  }
}

function canDeleteCollections() {
  return false;
}

function canRequestCollectionReversal() {
  return canReverseCollection(currentUser());
}

function canVerifyPayments() {
  return canApproveFinancial(currentUser()) || roleIs("Cashier") || roleIs("Admin") || isKBA();
}

function canAccessApprovals() {
  return canApproveFinancial(currentUser()) || isKBA() || isAdmin();
}

function roleLabel(role) {
  return agencyRoleLabel(role);
}

function staffIdentityInitials(name = "") {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";
}

function renderStaffIdentityAvatar(user, { className = "staff-identity-photo" } = {}) {
  if (!user) return "";
  if (user.passportPhoto) {
    return `<img class="${className}" src="${escapeAttr(user.passportPhoto)}" alt="" />`;
  }
  return `<div class="${className} placeholder" aria-hidden="true">${escapeHtml(staffIdentityInitials(user.name))}</div>`;
}

function staffIdentityCredentials(user) {
  if (!user) return [];
  const phone = formatGhanaPhoneDisplay(user.phone) || user.phone || "";
  const location = isKBA()
    ? `${state.groups.length} location(s)`
    : (groupName(user.groupId) || primaryGroup()?.name || user.requestedGroupName || "");
  const code = collectorCodeForGroup(user.groupId);
  return [
    `@${user.username}`,
    phone ? `Tel: ${phone}` : "",
    user.ghanaCard ? `Ghana Card: ${user.ghanaCard}` : "",
    location || "",
    code ? `Code: ${code.toUpperCase()}` : ""
  ].filter(Boolean);
}

function renderStaffIdentityBanner(user) {
  if (!user) return "";
  const credentials = staffIdentityCredentials(user);
  return `
    <div class="staff-identity-bar" aria-label="Signed in as ${escapeAttr(user.name)}">
      ${renderStaffIdentityAvatar(user)}
      <div class="staff-identity-details">
        <strong>${escapeHtml(user.name)}</strong>
        <div class="staff-identity-line">${escapeHtml(roleLabel(user.role))}</div>
        <div class="staff-identity-meta">${credentials.map((item) => escapeHtml(item)).join(" · ")}</div>
      </div>
    </div>
  `;
}

function paymentMethodSelect(name, selected = "Cash") {
  return `<select name="${name}" required>${PAYMENT_METHODS.map((method) => `<option value="${method}" ${method === selected ? "selected" : ""}>${method}</option>`).join("")}</select>`;
}

function visitOutcomeSelect(name, selected = "Paid") {
  return `<select name="${name}" required>${VISIT_OUTCOMES.map((outcome) => `<option value="${outcome}" ${outcome === selected ? "selected" : ""}>${outcome}</option>`).join("")}</select>`;
}

function collectionPaymentMethod(item) {
  return item?.paymentMethod || "Cash";
}

function collectionVerificationStatus(item) {
  if (!item) return "Verified";
  if (item.verificationStatus) return item.verificationStatus;
  return collectionPaymentMethod(item) === "Cash" ? "Verified" : "Pending Verification";
}

function pendingVerificationCollections() {
  return visibleCollections().filter((item) => collectionVerificationStatus(item) === "Pending Verification");
}

function paymentChannelTotals(date = today()) {
  const totals = Object.fromEntries(PAYMENT_METHODS.map((method) => [method, 0]));
  visibleCollections()
    .filter((item) => item.date === date && Number(item.amount || 0) > 0)
    .forEach((item) => {
      const method = collectionPaymentMethod(item);
      totals[method] = (totals[method] || 0) + Number(item.amount || 0);
    });
  return totals;
}

function todayCollectionTotal(date = today()) {
  return visibleCollections()
    .filter((item) => item.date === date)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function resolveVerificationStatus(paymentMethod, paymentReference, excludeId = "") {
  if (paymentMethod === "Cash") return "Verified";
  const reference = String(paymentReference || "").trim();
  if (!reference) return "Pending Verification";
  const duplicate = state.collections.some((item) =>
    item.id !== excludeId
    && collectionPaymentMethod(item) === paymentMethod
    && String(item.paymentReference || "").trim().toLowerCase() === reference.toLowerCase()
  );
  return duplicate ? "Duplicate Reference" : "Pending Verification";
}

function hiddenTargetContributions(value) {
  return `<input type="hidden" name="targetContributions" value="${Number(value) || 31}" />`;
}

function canAdmin() {
  return isAdmin();
}

function findUserIdByName(name) {
  const target = String(name || "").trim().toLowerCase();
  if (!target) return "";
  return state.users.find((user) => user.active && String(user.name || "").trim().toLowerCase() === target)?.id || "";
}

function syncGroupStaffIds(group) {
  if (!group) return;
  const collector = state.users.find((user) => user.active && user.role === "Collector" && user.groupId === group.id);
  if (collector) group.collectorId = collector.id;
}

function linkUserToGroupStaff(user) {
  if (!user?.groupId) return;
  const group = groupById(user.groupId);
  if (!group) return;
  if (user.role === "Admin") group.adminId = user.id;
  if (user.role === "Collector") group.collectorId = user.id;
  syncGroupStaffIds(group);
}

const DEFAULT_ACCOUNT_START = 13000001;
const ACCOUNT_SEQUENCE_PAD = 6;

function normalizeCollectorCode(code) {
  return String(code || "").trim().toLowerCase();
}

function collectorCodeForGroup(groupId) {
  return normalizeCollectorCode(groupById(groupId)?.collectorCode || "");
}

function parseAccountSequence(accountNo, collectorCode = "") {
  const normalized = String(accountNo || "").trim().toLowerCase();
  const code = normalizeCollectorCode(collectorCode);
  if (code) {
    if (!normalized.startsWith(code)) return NaN;
    const suffix = normalized.slice(code.length);
    if (!/^\d+$/.test(suffix)) return NaN;
    return Number(suffix);
  }
  const match = normalized.match(/^c(\d+)$/i);
  return match ? Number(match[1]) : NaN;
}

function formatAccountNo(collectorCode, sequence) {
  const code = normalizeCollectorCode(collectorCode);
  if (!code) {
    const next = Number(sequence) || DEFAULT_ACCOUNT_START;
    return `c${next}`;
  }
  return `${code}${String(sequence).padStart(ACCOUNT_SEQUENCE_PAD, "0")}`;
}

function nextAccountNo(groupId = "") {
  const collectorCode = collectorCodeForGroup(groupId);
  const scope = groupId
    ? state.customers.filter((customer) => customer.groupId === groupId)
    : state.customers;
  const numbers = scope
    .map((customer) => parseAccountSequence(customer.accountNo, collectorCode))
    .filter((value) => Number.isFinite(value));
  if (collectorCode) {
    const nextSeq = numbers.length ? Math.max(...numbers) + 1 : 1;
    return formatAccountNo(collectorCode, nextSeq);
  }
  const next = numbers.length ? Math.max(...numbers) + 1 : DEFAULT_ACCOUNT_START;
  return `c${next}`;
}

function isValidAccountNo(accountNo, groupId = "") {
  const normalized = String(accountNo || "").trim().toLowerCase();
  if (!normalized) return false;
  const collectorCode = collectorCodeForGroup(groupId);
  if (collectorCode) {
    if (!normalized.startsWith(collectorCode)) return false;
    const suffix = normalized.slice(collectorCode.length);
    return /^\d+$/.test(suffix) && Number(suffix) >= 1;
  }
  return /^c\d+$/i.test(normalized);
}

function isValidCollectorCode(code) {
  return /^[a-z][a-z0-9]*$/i.test(String(code || "").trim());
}

function collectorCodeInUse(code, exceptGroupId = "") {
  const normalized = normalizeCollectorCode(code);
  if (!normalized) return false;
  return state.groups.some((group) => group.id !== exceptGroupId && normalizeCollectorCode(group.collectorCode) === normalized);
}

function memberAccountField(editing, groupId) {
  if (editing) {
    return `<div class="field"><label>Account Number</label><input readonly value="${escapeAttr(editing.accountNo || "")}" /></div>`;
  }
  const collectorCode = collectorCodeForGroup(groupId);
  if (!collectorCode) {
    return `<div class="field"><label>Account Number</label><input readonly value="" /><div class="muted warn">This location has no collector code yet. Ask the manager to set one on the collector account.</div></div>`;
  }
  const hasSequence = state.customers.some((customer) => customer.groupId === groupId && Number.isFinite(parseAccountSequence(customer.accountNo, collectorCode)));
  const next = nextAccountNo(groupId);
  const example = `${collectorCode}${String(2).padStart(ACCOUNT_SEQUENCE_PAD, "0")}`;
  if (!hasSequence) {
    return `<div class="field"><label>Account Number</label><input name="accountNo" value="${escapeAttr(next)}" required /><div class="muted">Set the first account for this collector (${collectorCode}). The next member will auto-generate in order (e.g. ${escapeHtml(next)}, ${escapeHtml(example)}).</div></div>`;
  }
  return `<div class="field"><label>Account Number</label><input id="memberAccountNo" readonly value="${escapeAttr(next)}" /></div>`;
}

function refreshMemberAccountPreview(groupId) {
  const input = document.querySelector("#memberAccountNo");
  if (!input || !groupId) return;
  input.value = nextAccountNo(groupId);
}

function validPasswordHash(hash) {
  return Boolean(hash && hash !== "[protected]" && !hash.startsWith("["));
}

function ensureSystemAccounts(normalized) {
  normalized.users = normalized.users || [];
  normalized.audit = normalized.audit || [];

  normalized.users.forEach((user) => {
    if (["Input Officer", "Money Keeper", "Money Counter"].includes(user.role)) {
      user.role = "Collector";
      user.updatedAt = new Date().toISOString();
    }
    if (!validPasswordHash(user.passwordHash) && user.password) {
      user.passwordHash = legacyHash(user.password);
    }
    delete user.password;
  });

  const result = ensureDefaultSystemAccounts(normalized, { now: new Date().toISOString() });

  normalized.users = normalized.users.filter((user, index, all) => {
    if (user.role === "Developer" && !developerLoginAllowed(normalized) && !isDefaultSystemAccount(user)) return false;
    if (user.id === "u-owner") return all.findIndex((item) => item.id === "u-owner") === index;
    if (user.id === "u-developer" || user.id === SUPER_ADMIN_ID) {
      return all.findIndex((item) => item.id === user.id) === index;
    }
    return true;
  });

  return result;
}

function recordSystemAccountAudit(action, details, userId = "") {
  recordAuditEvent(state, {
    action,
    details,
    userId,
    groupIds: [],
    category: "user",
    guarantee: "G1"
  }, uid);
}

function applyOwnerLoginDefaults() {
  const result = ensureSystemAccounts(state);
  (result?.created || []).forEach((account) => {
    recordSystemAccountAudit("Default system account created", `${account.username} · ${account.role === "SystemOwner" ? "System Owner" : "Super Administrator"}`);
  });
}

function userLinkedToGroup(user, group) {
  if (!user || !group) return false;
  if (user.groupId && user.groupId === group.id) return true;
  if (group.adminId === user.id) return true;
  if (group.collectorId === user.id) return true;
  return false;
}

function visibleGroups() {
  if (isKBA()) return state.groups;
  const user = currentUser();
  if (!user) return [];
  if (isCollector() || isCollectorScopedRole(user)) {
    return state.groups.filter((group) =>
      group.collectorId === user.id
      || (user.groupId && group.id === user.groupId)
      || (user.branchId && (group.id === user.branchId || group.branchId === user.branchId))
    );
  }
  if (user.role === "Admin") {
    return state.groups.filter((group) => userLinkedToGroup(user, group));
  }
  return state.groups.filter((group) => group.collectorId === user.id);
}

function visibleGroupIds() {
  return visibleGroups().map((group) => group.id);
}

function visibleCustomers() {
  return filterCustomersForUser(state.customers, currentUser(), { groupIds: visibleGroupIds() });
}

function visibleCollections() {
  const user = currentUser();
  const groups = visibleGroupIds();
  let collections = filterCollectionsForUser(state.collections || [], user, {
    customers: state.customers || [],
    groupIds: isKBA() || isAuditor() ? [] : groups
  });
  if (isCollector()) {
    if (!collectorDoesSusuGroup(user)) {
      collections = collections.filter((item) => !item.susuGroupId && item.collectionType !== COLLECTION_TYPES.SUSU_GROUP);
    }
    if (!collectorDoesPersonalSavings(user)) {
      collections = collections.filter((item) => item.susuGroupId || item.collectionType === COLLECTION_TYPES.SUSU_GROUP);
    }
  }
  return collections;
}

function visibleSusuGroups() {
  if (isCollector() && !collectorDoesSusuGroup(currentUser())) return [];
  return filterSusuGroupsForUser(state.susuGroups || [], currentUser(), { branchIds: visibleGroupIds() });
}

function susuGroupById(id) {
  return (state.susuGroups || []).find((group) => group.id === id);
}

function visibleLoans() {
  const groups = visibleGroupIds();
  if (isKBA()) return state.loans;
  let loans = state.loans.filter((loan) => groups.includes(loan.groupId));
  if (isCollector()) {
    const customerIds = new Set(visibleCustomers().map((customer) => customer.id));
    loans = loans.filter((loan) => customerIds.has(loan.customerId));
  }
  return loans;
}

function visibleTransactions() {
  const customerIds = visibleCustomers().map((customer) => customer.id);
  if (isKBA()) return state.transactions;
  return state.transactions.filter((tx) => customerIds.includes(tx.customerId));
}

function visibleMessages() {
  const customerIds = visibleCustomers().map((customer) => customer.id);
  if (isKBA()) return state.messages;
  return state.messages.filter((message) => customerIds.includes(message.customerId));
}

function isUnsentMessage(message) {
  return ["Ready to send", "Queued for phone", "Waiting for SMS permission"].includes(message?.status);
}

function primaryGroup() {
  return visibleGroups()[0];
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2400);
}

function resolvedColorMode() {
  const mode = state.settings.colorMode || "light";
  if (mode !== "auto") return mode;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function render() {
  syncToApp();
  const colorMode = resolvedColorMode();
  const collectorMode = isCollector() ? " collector-mode" : "";
  const mobileLayout = isMobileLayout() ? " layout-mobile" : "";
  const bottomNav = useCollectorBottomNav() ? " has-bottom-nav" : "";
  document.body.className = `theme-${state.settings.theme || "emerald"} color-mode-${colorMode}${collectorMode}${mobileLayout}${bottomNav}`;
  const root = document.querySelector("#app") || app;
  if (root) root.dataset.ready = "true";
  if (sessionUserId && !ensureActiveSession(() => {
    sessionUserId = null;
    toast("Session expired. Please sign in again.");
  }, state.settings)) {
    renderLogin();
    return;
  }
  if (!currentUser()) {
    const serverPortal = storedPortalView();
    if (serverPortal) {
      renderPortalShell(serverPortal.customer, serverPortal.view);
      return;
    }
    const portalId = sessionStorage.getItem(PORTAL_CUSTOMER_KEY);
    if (portalId) {
      const customer = state.customers.find((item) => item.id === portalId);
      if (customer) {
        renderPortalShell(customer);
        return;
      }
      sessionStorage.removeItem(PORTAL_CUSTOMER_KEY);
    }
    if (needsFirstRunOwnerSetup()) {
      renderFirstRunOwnerSetup();
      return;
    }
    renderLogin();
    return;
  }
  if (needsForcedPasswordChange(currentUser())) {
    renderForcedPasswordChange();
    return;
  }
  ensureActiveViewAllowed();
  renderApp();
}

function renderLogin() {
  const remembered = rememberedLogin();
  const unified = unifiedCloudEnabled(state, getAppConfig());
  app.innerHTML = `
    <main class="auth auth-android">
      <div class="auth-bg" aria-hidden="true"></div>
      <section class="auth-hero">
        <div class="brand-logo-full"><img src="assets/smile-trust-logo.png" alt="SMILE TRUST SUSU MANAGEMENT SYSTEM" /></div>
        <h1>SMILE TRUST SUSU MANAGEMENT SYSTEM</h1>
        <p>Secure staff access for collections, savings, loans, and branch operations - built for Android phones and tablets.</p>
      </section>
      <section class="login-panel">
        <div class="login-brand">
          <div class="brand-logo-full"><img src="assets/smile-trust-logo.png" alt="SMILE TRUST SUSU MANAGEMENT SYSTEM" /></div>
          <h1>SMILE TRUST SUSU MANAGEMENT SYSTEM</h1>
        </div>
        <div class="auth-tabs">
          <button class="active" type="button" data-auth-tab="login">Staff</button>
          <button type="button" data-auth-tab="portal">Member</button>
          <button type="button" data-auth-tab="create">Create</button>
        </div>
        <div data-auth-panel="login">
          <h2>Secure Login</h2>
          <p class="muted">Enter your staff username and password.</p>
          ${backendTransitionBannerHtml()}
          ${hasUsableLocalLogin(state.users) ? "" : `<div class="notice">This device has no staff accounts yet. Connect to the internet and sign in with your staff username and password.</div>`}
        <form id="loginForm">
          <div class="field">
            <label for="username">Username</label>
            <input id="username" value="${escapeAttr(remembered?.username || "")}" required autocomplete="username" autocapitalize="none" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <div class="password-row">
              <input id="password" type="password" required autocomplete="current-password" />
              <button class="btn ghost password-toggle" type="button" data-toggle-password="password" aria-label="Show password">Show</button>
            </div>
          </div>
          <label class="check-row"><input id="rememberMe" type="checkbox" ${remembered ? "checked" : ""} /> Remember Me</label>
          <details class="mfa-login-details">
            <summary>MFA code</summary>
            <div class="field"><label for="mfaCode">Authenticator code</label><input id="mfaCode" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="6-digit code if enabled" autocomplete="one-time-code" /></div>
          </details>
          <div class="form-actions" style="margin-top:18px">
            <button class="btn secure-login" type="submit">Secure Login</button>
          </div>
          <div id="loginError"></div>
        </form>
        <details class="activation-details">
          <summary>First sign-in with an activation code</summary>
          <p class="muted">For existing staff accounts that have never had a password. Ask your administrator for a one-time activation code, then choose your own password.</p>
          <form id="activationForm">
            <div class="field"><label for="activationUsername">Username</label><input id="activationUsername" required autocomplete="username" autocapitalize="none" /></div>
            <div class="field"><label for="activationCode">Activation code</label><input id="activationCode" required autocapitalize="characters" autocomplete="one-time-code" placeholder="XXXX-XXXX-XXXX" /></div>
            <div class="field"><label for="activationPassword">New password</label><input id="activationPassword" type="password" minlength="8" required autocomplete="new-password" /></div>
            <div class="field"><label for="activationConfirm">Confirm password</label><input id="activationConfirm" type="password" minlength="8" required autocomplete="new-password" /></div>
            <div class="field"><label for="activationMfa">Authenticator code (only if MFA is already set up)</label><input id="activationMfa" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" /></div>
            <div class="form-actions"><button class="btn secondary" type="submit">Activate and sign in</button></div>
            <div id="activationError"></div>
          </form>
        </details>
        </div>
        <div data-auth-panel="portal" style="display:none">
          <h2>Member portal</h2>
          <p class="muted">Sign in with your <strong>account number</strong> and <strong>PIN</strong>. Default PIN = last 4 digits of your phone (example: phone 0241234567 → PIN 4567).</p>
          <form id="portalLoginForm">
            <div class="field"><label>Account number or phone</label><input id="portalAccountNo" required autocomplete="username" autocapitalize="none" placeholder="c13000001 or 0241234567" /></div>
            <div class="field"><label>PIN</label><input id="portalPin" type="password" required inputmode="numeric" maxlength="6" placeholder="Last 4 of phone" /></div>
            <div class="form-actions" style="margin-top:18px"><button class="btn" type="submit">Open portal</button></div>
            <div id="portalLoginError"></div>
          </form>
        </div>
        <div class="request-panel">
          <div>
            <h2>Create admin request</h2>
            <p class="muted">Submit your details and location name. The owner will review, create or assign the location, and activate the account.</p>
          </div>
          <form id="adminRequestForm" class="form-grid" novalidate>
            <div class="field"><label>Full Name</label><input name="name" required /></div>
            <div class="field"><label>Username</label><input name="username" required /></div>
            <div class="field"><label>Location Name</label><input name="groupName" required /></div>
            <div class="field"><label>Password</label><div class="password-row"><input id="requestPassword" name="password" type="password" required /><button class="btn ghost password-toggle" type="button" data-toggle-password="requestPassword">Show</button></div></div>
            <div class="form-actions full"><button class="btn secondary" type="submit">Request admin access</button></div>
            <div id="requestNotice" class="full"></div>
          </form>
        </div>
        <details class="cloud-login-details">
          <summary>${unified ? "Business database sync" : "Cloud data"}</summary>
          <div class="cloud-login">
            <p class="muted">${unified
              ? "Desktop and phone share the same Supabase database. Sync now if records look outdated."
              : "Restore the latest online susu records before login."}</p>
            <div class="form-actions">
              <button class="btn" id="loginRestoreSync" type="button">${unified ? "Sync now" : "Restore cloud data"}</button>
              ${unified ? "" : `<button class="btn secondary" id="loginReplaceSync" type="button">Replace device data</button>`}
            </div>
            <div id="loginSyncNotice"></div>
          </div>
        </details>
        <p class="auth-version">Version ${APP_VERSION}</p>
      </section>
    </main>
  `;

  document.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.querySelector("#username").value.trim().toLowerCase();
    const password = document.querySelector("#password").value;
    const enteredMfaCode = document.querySelector("#mfaCode")?.value?.trim() || "";
    let user = await findLoginUser(username, password);
    let cloudLogin = null;
    if (!user) {
      document.querySelector("#loginError").innerHTML = `<div class="notice">Checking your account online...</div>`;
      cloudLogin = await staffCloudLogin(state, { username, password, mfaCode: enteredMfaCode });
      if (!cloudLogin.denied) {
        try {
          await loadUnifiedBusinessData();
          user = await findLoginUser(username, password);
          if (!user && cloudLogin.ok) user = await adoptCloudSignIn(username, password, cloudLogin.appUser);
        } catch {
          // Keep the normal invalid message below.
        }
      }
      if (!user) {
        recordAuditEvent(state, {
          action: "Login Failure",
          details: `Invalid login for ${username}`,
          username,
          category: "authentication",
          eventType: "Login Failure",
          result: "Failure",
          guarantee: "G1",
          deviceId: deviceFingerprint(),
          applicationVersion: APP_VERSION
        }, uid);
        if (recentFailedLogins(state, username) >= 5) {
          recordAuditEvent(state, {
            action: "Multiple Failed Logins",
            details: username,
            username,
            category: "security",
            eventType: "Multiple Failed Logins",
            severity: "High",
            guarantee: "G1"
          }, uid);
        }
        saveState();
        const cloudMessage = cloudLogin?.ok
          ? "You signed in online, but this device could not load your account yet. Tap Sync now, then try again."
          : cloudLogin?.mfaRequired || cloudLogin?.mfaEnrollmentRequired || cloudLogin?.status === 429 ? cloudLogin.error : "";
        document.querySelector("#loginError").innerHTML = `<div class="notice">${escapeHtml(cloudMessage || "Invalid login or inactive account.")}</div>`;
        if (cloudLogin?.mfaEnrollmentRequired) showServerMfaEnrollment(username);
        return;
      }
    }
    const mfaCode = enteredMfaCode;
    const gate = await privilegedSignInGate(user, { username, password, mfaCode, cloudLogin });
    if (!gate.ok) {
      recordAuditEvent(state, {
        action: "Login Failure",
        details: `Server MFA verification required for ${user.username}`,
        userId: user.id,
        username: user.username,
        category: "authentication",
        eventType: "Login Failure",
        result: "Failure",
        guarantee: "G1"
      }, uid);
      saveState();
      document.querySelector("#loginError").innerHTML = `<div class="notice">${escapeHtml(gate.error || "Invalid login or inactive account.")}</div>`;
      if (gate.enrollment) showServerMfaEnrollment(username);
      return;
    }
    cloudLogin = gate.cloudLogin;
    const mfaResult = gate.serverVerified ? { ok: true } : await verifyUserMfa(user, mfaCode);
    if (!mfaResult.ok) {
      recordAuditEvent(state, {
        action: "Login Failure",
        details: `MFA failed for ${user.username}`,
        userId: user.id,
        username: user.username,
        category: "authentication",
        eventType: "Login Failure",
        result: "Failure",
        guarantee: "G1"
      }, uid);
      saveState();
      document.querySelector("#loginError").innerHTML = `<div class="notice">${escapeHtml(mfaResult.error)}</div>`;
      return;
    }
    if (supabaseAuthConfigured(state) && user.authEmail) {
      try {
        await signInWithPassword(state, user.authEmail, password);
      } catch (error) {
        document.querySelector("#loginError").innerHTML = `<div class="notice">Supabase auth failed: ${escapeHtml(error.message)}</div>`;
        return;
      }
    }
    if (!cloudLogin?.ok && portalServerAvailable(state) && !hasStaffCloudSession(user.id)) {
      // Signed in offline-capable; also obtain this user's cloud session so sync is authorized.
      void staffCloudLogin(state, { username, password, mfaCode }).then((result) => {
        if (result.ok) queueCloudBackup();
      });
    }
    sessionUserId = user.id;
    sessionStorage.setItem(SESSION_USER_KEY, user.id);
    markSessionStarted();
    registerCurrentDevice(user.id);
    logAudit("Login Success", `${user.username} signed in`, {
      user,
      entityType: "user",
      entityId: user.id,
      entityName: user.name
    });
    if (document.querySelector("#rememberMe")?.checked) {
      localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({
        userId: user.id,
        username: user.username
      }));
    } else {
      localStorage.removeItem(REMEMBER_LOGIN_KEY);
    }
    activeView = "dashboard";
    try {
      closeCustomerRegistrationSession(sessionStorage, localStorage);
      resetMemberRegistrationHardware();
    } catch { /* ignore */ }
    render();
  });
  document.querySelector("#adminRequestForm").addEventListener("submit", handleAdminRequest);
  document.querySelector("#portalLoginForm")?.addEventListener("submit", handlePortalLogin);
  document.querySelector("#activationForm")?.addEventListener("submit", handleStaffActivation);
  document.querySelector("#loginRestoreSync")?.addEventListener("click", connectLoginSync);
  document.querySelector("#loginReplaceSync")?.addEventListener("click", replaceLoginSync);
  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => togglePassword(button));
  });
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.authTab;
      document.querySelectorAll("[data-auth-tab]").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelector('[data-auth-panel="login"]').style.display = mode === "login" ? "block" : "none";
      const portalPanel = document.querySelector('[data-auth-panel="portal"]');
      if (portalPanel) portalPanel.style.display = mode === "portal" ? "block" : "none";
      document.querySelector(".request-panel").style.display = mode === "create" ? "block" : "none";
    });
  });
}

function backendTransitionBannerHtml() {
  const notice = backendTransitionNotice(localStorage);
  if (!notice) return "";
  const previous = notice.from?.host
    ? ` Data from the previous server (${escapeHtml(notice.from.host)}) is kept on this device only and will not be uploaded.`
    : "";
  return `<div class="notice" data-backend-transition>This device is connected to ${escapeHtml(notice.to.host)} (business ${escapeHtml(notice.to.businessId || "not set")}). Cloud sync starts only after a staff member signs in online.${previous}</div>`;
}

/** Staff identity, role and active status live in app_users on the server; the device copy follows it. */
function mirrorStaffAccount(user) {
  if (!portalServerAvailable(state) || !hasStaffCloudSession()) return;
  void pushStaffAccountToServer(state, user).then((result) => {
    if (!result.ok && !result.skipped) toast(`Saved on this device, but the server did not update ${user.username}: ${result.error}`);
  });
}

const SERVER_MFA_VERIFIED_KEY = "smile-trust-server-mfa-verified";

function serverMfaMarkers() {
  try {
    return JSON.parse(localStorage.getItem(SERVER_MFA_VERIFIED_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function markServerMfaVerified(userId) {
  const markers = serverMfaMarkers();
  markers[userId] = new Date().toISOString();
  localStorage.setItem(SERVER_MFA_VERIFIED_KEY, JSON.stringify(markers));
}

/**
 * Privileged roles never sign in on a password alone when a server is configured: staff-login
 * checks the server-held authenticator. Offline, a recent server-verified sign-in on this device
 * is required (SERVER_MFA_OFFLINE_GRACE_MS).
 */
async function privilegedSignInGate(user, { username, password, mfaCode, cloudLogin }) {
  if (!mfaRequiredForUser(user) || !portalServerAvailable(state)) return { ok: true, cloudLogin };
  const result = cloudLogin?.ok ? cloudLogin : await staffCloudLogin(state, { username, password, mfaCode });
  if (result.ok) {
    markServerMfaVerified(user.id);
    return { ok: true, cloudLogin: result, serverVerified: true };
  }
  if (result.offline || result.unavailable) {
    if (serverMfaOfflineGraceOk(serverMfaMarkers(), user.id)) return { ok: true, cloudLogin: result };
    return { ok: false, error: "Connect to the internet so the server can verify your two-factor sign-in." };
  }
  return { ok: false, error: result.error, enrollment: Boolean(result.mfaEnrollmentRequired) };
}

/** Server-side authenticator setup for privileged roles; the secret is shown once and never stored here. */
function showServerMfaEnrollment(username) {
  const box = document.querySelector("#loginError");
  if (!box) return;
  box.insertAdjacentHTML("beforeend", `
    <div class="notice" id="serverMfaEnroll">
      <p>Your role needs an authenticator app (for example Google Authenticator or Microsoft Authenticator).</p>
      <button class="btn secondary" type="button" id="serverMfaStart">Set up authenticator</button>
      <div id="serverMfaSetup" hidden>
        <p>Add this key to your authenticator app, then enter the 6-digit code it shows.</p>
        <p><code id="serverMfaSecret"></code></p>
        <label>Authenticator code <input id="serverMfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label>
        <button class="btn" type="button" id="serverMfaConfirm">Confirm</button>
      </div>
      <div id="serverMfaStatus"></div>
    </div>`);
  const status = (message) => {
    document.querySelector("#serverMfaStatus").innerHTML = `<p>${escapeHtml(message)}</p>`;
  };
  const password = () => document.querySelector("#password")?.value || "";
  document.querySelector("#serverMfaStart").addEventListener("click", async () => {
    status("Starting setup online...");
    const started = await staffMfaEnrollStart(state, { username, password: password() });
    if (!started.enrollmentPending) {
      status(started.offline ? "Connect to the internet to set up your authenticator." : started.error || "Setup could not start.");
      return;
    }
    document.querySelector("#serverMfaSecret").textContent = started.secret.replace(/(.{4})/g, "$1 ").trim();
    document.querySelector("#serverMfaSetup").hidden = false;
    status("");
  });
  document.querySelector("#serverMfaConfirm").addEventListener("click", async () => {
    const confirmed = await staffMfaEnrollConfirm(state, { username, password: password(), mfaCode: document.querySelector("#serverMfaCode").value });
    if (!confirmed.ok) {
      status(confirmed.error || "Invalid code.");
      return;
    }
    document.querySelector("#serverMfaSecret").textContent = "";
    document.querySelector("#serverMfaSetup").hidden = true;
    recordAuditEvent(state, {
      action: "MFA Enrolled",
      details: `${username} confirmed a server-side authenticator`,
      username,
      category: "authentication",
      eventType: "MFA Enrolled",
      result: "Success"
    }, uid);
    saveState();
    status("Authenticator set up. Wait for the next code, enter it in the MFA field and sign in.");
  });
}

/** The server has verified this username and password; bind the device's copy to that identity. */
async function adoptCloudSignIn(username, password, appUser) {
  const result = adoptCloudVerifiedUser(state.users, appUser, {
    username,
    passwordHash: await hashPasswordForUser(password),
    now: new Date().toISOString()
  });
  if (!result.ok) return null;
  state.users = result.users;
  saveState();
  return result.user;
}

async function handleStaffActivation(event) {
  event.preventDefault();
  const box = document.querySelector("#activationError");
  const show = (message) => {
    if (box) box.innerHTML = `<div class="notice">${escapeHtml(message)}</div>`;
  };
  const username = document.querySelector("#activationUsername").value.trim().toLowerCase();
  const activationCode = document.querySelector("#activationCode").value.trim();
  const newPassword = document.querySelector("#activationPassword").value;
  const mfaCode = document.querySelector("#activationMfa")?.value?.trim() || "";
  if (newPassword !== document.querySelector("#activationConfirm").value) {
    show("Passwords do not match.");
    return;
  }
  const invalid = validateForcedPassword(newPassword, "", undefined, {
    minLength: getConfigValue(state, "security.passwordMinLength")
  });
  if (invalid) {
    show(invalid);
    return;
  }
  show("Activating your account online...");
  const result = await staffCloudActivate(state, { username, activationCode, newPassword, mfaCode });
  if (result.mfaEnrollmentRequired) {
    show("Your password is saved. Your role also needs an authenticator app before you can sign in.");
    document.querySelector("#username").value = username;
    document.querySelector("#password").value = newPassword;
    showServerMfaEnrollment(username);
    return;
  }
  if (!result.ok) {
    if (result.offline) show("Connect to the internet to activate your account.");
    else if (result.unavailable) show("Account activation is not available on this server yet.");
    else show(result.error || "Activation failed.");
    return;
  }
  try {
    await loadUnifiedBusinessData();
  } catch {
    // Adoption below reports if the account could not be loaded.
  }
  const user = await adoptCloudSignIn(username, newPassword, result.appUser);
  if (!user) {
    show("Your account is activated, but this device could not load it yet. Tap Sync now, then sign in with your new password.");
    return;
  }
  recordAuditEvent(state, {
    action: "Staff Account Activated",
    details: `${user.username} chose a password with a one-time activation code`,
    userId: user.id,
    username: user.username,
    category: "authentication",
    eventType: "Account Activated",
    result: "Success"
  }, uid);
  saveState();
  document.querySelector("#username").value = username;
  document.querySelector("#password").value = newPassword;
  const mfaInput = document.querySelector("#mfaCode");
  if (mfaInput) mfaInput.value = mfaCode;
  document.querySelector("#loginForm").requestSubmit();
}

function needsFirstRunOwnerSetup() {
  return !hasUsableLocalLogin(state.users) && getSyncMode(state) === "none";
}

function renderFirstRunOwnerSetup() {
  app.innerHTML = `
    <main class="auth auth-android">
      <div class="auth-bg" aria-hidden="true"></div>
      <section class="login-panel forced-password-panel">
        <div class="login-brand">
          <div class="brand-logo-full"><img src="assets/smile-trust-logo.png" alt="SMILE TRUST SUSU MANAGEMENT SYSTEM" /></div>
          <h1>SMILE TRUST SUSU MANAGEMENT SYSTEM</h1>
        </div>
        <h2>Set up the owner account</h2>
        <p class="muted">This device has no staff accounts yet. Choose a password for the system owner (${escapeHtml(DEFAULT_SYSTEM_OWNER.username)}). To join an existing business instead, configure the cloud connection and sign in online.</p>
        <form id="ownerSetupForm">
          <div class="field">
            <label for="ownerSetupPassword">Owner password</label>
            <div class="password-row">
              <input id="ownerSetupPassword" name="newPassword" type="password" minlength="8" required autocomplete="new-password" />
              <button class="btn ghost password-toggle" type="button" data-toggle-password="ownerSetupPassword">Show</button>
            </div>
          </div>
          <div class="field">
            <label for="ownerSetupConfirm">Confirm password</label>
            <div class="password-row">
              <input id="ownerSetupConfirm" name="confirmPassword" type="password" minlength="8" required autocomplete="new-password" />
              <button class="btn ghost password-toggle" type="button" data-toggle-password="ownerSetupConfirm">Show</button>
            </div>
          </div>
          <div class="form-actions" style="margin-top:18px">
            <button class="btn secure-login" type="submit">Create owner account</button>
          </div>
          <div id="ownerSetupError"></div>
        </form>
        <p class="auth-version">Version ${APP_VERSION}</p>
      </section>
    </main>
  `;
  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => togglePassword(button));
  });
  document.querySelector("#ownerSetupForm")?.addEventListener("submit", handleFirstRunOwnerSetup);
}

async function handleFirstRunOwnerSetup(event) {
  event.preventDefault();
  const errorBox = document.querySelector("#ownerSetupError");
  if (!needsFirstRunOwnerSetup()) {
    render();
    return;
  }
  const owner = state.users.find((user) => isSystemOwnerUser(user));
  if (!owner) return;
  const data = formData(event.target);
  if (data.newPassword !== data.confirmPassword) {
    if (errorBox) errorBox.innerHTML = `<div class="notice">Passwords do not match.</div>`;
    return;
  }
  const invalid = validateForcedPassword(data.newPassword, "", undefined, {
    minLength: getConfigValue(state, "security.passwordMinLength")
  });
  if (invalid) {
    if (errorBox) errorBox.innerHTML = `<div class="notice">${escapeHtml(invalid)}</div>`;
    return;
  }
  owner.passwordHash = await hashPasswordForUser(data.newPassword);
  owner.active = true;
  owner.mustChangePassword = false;
  owner.passwordChangedAt = new Date().toISOString();
  owner.updatedAt = owner.passwordChangedAt;
  logAudit("Owner account created", `${owner.username} · first-run setup`);
  saveState();
  toast(`Owner account ready. Sign in as ${owner.username}.`);
  render();
}

function renderForcedPasswordChange() {
  const user = currentUser();
  app.innerHTML = `
    <main class="auth auth-android">
      <div class="auth-bg" aria-hidden="true"></div>
      <section class="login-panel forced-password-panel">
        <div class="login-brand">
          <div class="brand-logo-full"><img src="assets/smile-trust-logo.png" alt="SMILE TRUST SUSU MANAGEMENT SYSTEM" /></div>
          <h1>SMILE TRUST SUSU MANAGEMENT SYSTEM</h1>
        </div>
        <h2>Change your password</h2>
        <p class="muted">For security, ${escapeHtml(user?.username || "this account")} must set a new password before continuing. Default system passwords cannot be kept.</p>
        <form id="forcedPasswordForm">
          <div class="field">
            <label for="forcedCurrentPassword">Current password</label>
            <div class="password-row">
              <input id="forcedCurrentPassword" name="currentPassword" type="password" required autocomplete="current-password" />
              <button class="btn ghost password-toggle" type="button" data-toggle-password="forcedCurrentPassword">Show</button>
            </div>
          </div>
          <div class="field">
            <label for="forcedNewPassword">New password</label>
            <div class="password-row">
              <input id="forcedNewPassword" name="newPassword" type="password" minlength="8" required autocomplete="new-password" />
              <button class="btn ghost password-toggle" type="button" data-toggle-password="forcedNewPassword">Show</button>
            </div>
          </div>
          <div class="field">
            <label for="forcedConfirmPassword">Confirm new password</label>
            <div class="password-row">
              <input id="forcedConfirmPassword" name="confirmPassword" type="password" minlength="8" required autocomplete="new-password" />
              <button class="btn ghost password-toggle" type="button" data-toggle-password="forcedConfirmPassword">Show</button>
            </div>
          </div>
          <div class="form-actions" style="margin-top:18px">
            <button class="btn secure-login" type="submit">Save new password</button>
            <button class="btn secondary" type="button" id="forcedPasswordSignOut">Sign out</button>
          </div>
          <div id="forcedPasswordError"></div>
        </form>
        <p class="auth-version">Version ${APP_VERSION}</p>
      </section>
    </main>
  `;
  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => togglePassword(button));
  });
  document.querySelector("#forcedPasswordSignOut")?.addEventListener("click", () => {
    clearSession();
    void signOutSupabase(state);
    clearAuthSession();
    clearSensitiveOfflineCache();
    sessionUserId = null;
    render();
  });
  document.querySelector("#forcedPasswordForm")?.addEventListener("submit", handleForcedPasswordChange);
}

async function handleForcedPasswordChange(event) {
  event.preventDefault();
  const user = currentUser();
  const errorBox = document.querySelector("#forcedPasswordError");
  if (!user) return;
  const data = formData(event.target);
  if (data.newPassword !== data.confirmPassword) {
    if (errorBox) errorBox.innerHTML = `<div class="notice">New passwords do not match.</div>`;
    return;
  }
  if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
    if (errorBox) errorBox.innerHTML = `<div class="notice">Current password is incorrect.</div>`;
    return;
  }
  const invalid = validateForcedPassword(data.newPassword, data.currentPassword, undefined, {
    minLength: getConfigValue(state, "security.passwordMinLength")
  });
  if (invalid) {
    if (errorBox) errorBox.innerHTML = `<div class="notice">${escapeHtml(invalid)}</div>`;
    return;
  }
  user.passwordHash = await hashPasswordForUser(data.newPassword);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date().toISOString();
  user.updatedAt = user.passwordChangedAt;
  delete user.password;
  logAudit("Password changed", `${user.username} · first-login password change`);
  saveState();
  pushCloudBackup(false);
  toast("Password updated. Welcome.");
  render();
}

function renderApp() {
  const user = currentUser();
  const nav = isCollector()
    ? collectorNavItems()
    : navItemsForRole(user.role).map(([key, label]) => (
      key === "groups" ? ["groups", isKBA() ? "Branches / Locations" : "My Branch"] : [key, label]
    ));
  const groupLabel = isKBA() ? `${state.groups.length} susu location(s)` : (primaryGroup()?.name || "No location assigned");
  const workspaceLabel = isKBA()
    ? state.settings.businessName
    : isDeveloper()
      ? "Developer Console"
      : isCollector()
        ? (primaryGroup()?.name || "Collector")
        : (primaryGroup()?.name || "No location assigned");

  app.innerHTML = `
    <div class="app">
      <div class="mobile-drawer-backdrop ${mobileDrawerOpen ? "open" : ""}" aria-hidden="true"></div>
      <aside class="sidebar ${useMobileDrawerNav() ? "mobile-drawer" : ""} ${mobileDrawerOpen ? "open" : ""}">
        <div class="side-brand">
          <div class="brand-mark"><img src="assets/smile-trust-mark.svg" alt="Smile Trust" onerror="this.src='assets/smile-trust-icon.png'" /></div>
          <div>
            <strong>Smile Trust</strong>
            <span>${escapeHtml(workspaceLabel)}</span>
          </div>
        </div>
        <nav class="nav">
          ${nav.map(([key, label]) => `<button class="${activeView === key ? "active" : ""}" data-view="${key}">${label}</button>`).join("")}
        </nav>
        <div class="user-box">
          <div class="user-box-profile">
            ${renderStaffIdentityAvatar(user, { className: "user-box-photo" })}
            <div>
              <strong>${escapeHtml(user.name)}</strong>
              <span>${escapeHtml(roleLabel(user.role))}</span>
            </div>
          </div>
          <button class="btn secondary" id="logoutBtn">Sign out</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar dash-topbar">
          <div class="topbar-identity">
            ${useMobileDrawerNav() ? `<button class="btn ghost mobile-inline" type="button" id="mobileMenuBtn" aria-label="Open menu">☰</button>` : ""}
            <div class="brand-mark topbar-logo"><img src="assets/smile-trust-mark.svg" alt="Smile Trust" onerror="this.src='assets/smile-trust-icon.png'" /></div>
            <div>
              <strong>${escapeHtml(state.settings.businessName || "SMILE TRUST SUSU MANAGEMENT SYSTEM")}</strong>
              <div class="muted">${escapeHtml(user.name)} · ${escapeHtml(roleLabel(user.role))} · ${escapeHtml(groupLabel)}</div>
              <div class="muted">${today()} · <span id="topbarClock">${escapeHtml(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</span></div>
            </div>
          </div>
          <div class="row-actions">
            <button class="btn secondary" type="button" id="topbarLogoutBtn">Sign out</button>
            <span class="pill ${navigator.onLine && state.syncMeta?.status !== "synchronization_failed" ? "" : "bad"}">${state.syncMeta?.status === "synchronizing" ? "Syncing" : (navigator.onLine ? "Online" : "Offline")}</span>
            <span class="muted desktop-only">Sync: ${state.settings.lastSyncedAt ? escapeHtml(new Date(state.settings.lastSyncedAt).toLocaleString()) : "Never"}</span>
            <button class="btn ghost dash-bell" id="dashNotifyBtn" type="button" aria-label="Notifications">🔔${unreadNotifications(state).length ? `<span class="dash-bell-count">${unreadNotifications(state).length}</span>` : ""}</button>
            <div class="dash-profile" id="dashProfileMenu">
              <button class="btn ghost" type="button" id="dashProfileBtn" aria-label="User profile">${escapeHtml((user.name || "?").slice(0, 1).toUpperCase())}</button>
              <div class="dash-profile-sheet" hidden>
                <p><strong>${escapeHtml(user.name)}</strong><br /><span class="muted">${escapeHtml(roleLabel(user.role))}</span></p>
                ${canAccessSystemSettings() ? `<button class="btn ghost" type="button" data-view="settings">Settings</button>` : ""}
                <button class="btn secondary" type="button" id="dashProfileLogout">Sign out</button>
              </div>
            </div>
            <button class="btn ghost" id="syncNowBtn">Sync now</button>
            <select class="desktop-only" id="colorModeSelect" aria-label="Color mode">
              <option value="light" ${(state.settings.colorMode || "light") === "light" ? "selected" : ""}>Light</option>
              <option value="dark" ${state.settings.colorMode === "dark" ? "selected" : ""}>Dark</option>
              <option value="auto" ${state.settings.colorMode === "auto" ? "selected" : ""}>Auto</option>
            </select>
            <select class="desktop-only" id="themeSelect" aria-label="Theme">
              <option value="emerald" ${state.settings.theme === "emerald" ? "selected" : ""}>Emerald</option>
              <option value="royal" ${state.settings.theme === "royal" ? "selected" : ""}>Royal</option>
              <option value="slate" ${state.settings.theme === "slate" ? "selected" : ""}>Slate</option>
              <option value="sunrise" ${state.settings.theme === "sunrise" ? "selected" : ""}>Sunrise</option>
              <option value="forest" ${state.settings.theme === "forest" ? "selected" : ""}>Forest</option>
              <option value="wine" ${state.settings.theme === "wine" ? "selected" : ""}>Wine</option>
              <option value="mono" ${state.settings.theme === "mono" ? "selected" : ""}>Mono</option>
              <option value="ocean" ${state.settings.theme === "ocean" ? "selected" : ""}>Ocean</option>
            </select>
          </div>
        </header>
        <section class="content">${renderStaffIdentityBanner(user)}${renderMobileSyncBanner()}${renderView()}</section>
      </main>
    </div>
    ${renderMobileBottomNav()}
    ${renderMobileMoreSheet()}
    ${canAccessView("collections") && activeView !== "customers" ? `<button class="dash-fab" type="button" data-view-jump="collections" aria-label="Collect savings">＋</button>` : ""}
    <div class="dash-notify-drawer" id="dashNotifyDrawer" hidden>
      <div class="section-title"><h2>Notifications</h2><button class="btn ghost" type="button" data-view-jump="notifications">View all</button></div>
      <div id="dashNotifyList">${renderNotificationDrawer((state.notifications || []).filter((item) => !item.deleted).slice().reverse())}</div>
    </div>
  `;

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      mobileMoreOpen = false;
      mobileDrawerOpen = false;
      const nextView = button.dataset.view;
      resetCustomersUiForNavigation(nextView);
      activeView = nextView;
      render();
    });
  });
  document.querySelector("#logoutBtn").addEventListener("click", () => {
    if (!confirmSignOutAllowed()) return;
    signOutCurrentUser();
  });
  document.querySelector("#topbarLogoutBtn")?.addEventListener("click", () => {
    if (!confirmSignOutAllowed()) return;
    signOutCurrentUser();
  });
  document.querySelector("#syncNowBtn").addEventListener("click", syncNow);
  document.querySelector("#colorModeSelect")?.addEventListener("change", (event) => {
    state.settings.colorMode = event.target.value;
    saveState();
    logAudit("Color mode changed", event.target.value);
    render();
  });
  document.querySelector("#themeSelect")?.addEventListener("change", (event) => {
    state.settings.theme = event.target.value;
    saveState();
    logAudit("Theme changed", event.target.value);
    render();
  });
  attachMobileNavHandlers();
  attachHandlers();
  attachDashboardChrome();
  if (activeView === "dashboard") attachDashboardHandlers();
  applyPendingPanelFocus();
}

/** Expand + scroll to a Wave lazy panel requested via data-panel-focus (org-blocked HG links). */
function applyPendingPanelFocus() {
  const panelId = sessionStorage.getItem("panel_focus") || "";
  if (!panelId) return;
  sessionStorage.removeItem("panel_focus");
  const panel = document.querySelector(`[data-lazy-panel="${panelId}"]`);
  if (!panel) return;
  if (panel.tagName === "DETAILS") panel.open = true;
  try {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    panel.scrollIntoView();
  }
  const summary = panel.querySelector("summary");
  if (summary && typeof summary.focus === "function") {
    try {
      summary.focus({ preventScroll: true });
    } catch {
      summary.focus();
    }
  }
}

function titleFor(view) {
  return {
    dashboard: "Overview",
    approvals: "Approvals",
    groups: "Branches / Locations",
    susuGroups: "Susu Groups",
    customers: "Customers",
    collections: "Collections",
    withdrawals: "Withdrawals",
    loans: "Loans",
    loanRepayments: "Loan Repayments",
    interestPayments: "Interest Payments",
    messages: "Customer Messages",
    imports: "Import Uploads",
    reports: "Reports",
    logs: "Collector's Sheet",
    closing: "Daily Closing",
    handover: "Cash Handover",
    backup: "Backup & Restore",
    groupDetail: "Location Details",
    branchDetail: "Branch Dashboard",
    savingsProducts: "Savings Products",
    memberDetail: "Customer Details",
    settings: "System Settings",
    users: "Staff & Collectors",
    permissions: "Role Permissions",
    audit: "Audit Trail & Exceptions",
    expenses: "Expenses",
    accounting: "Accounting",
    notifications: "Notifications",
    meetings: "Group Meetings",
    agents: "Agents / Collectors"
  }[view];
}

function renderView() {
  if (!canAccessView(activeView)) {
    return `<div class="notice">You do not have permission to open this screen. Contact your manager.</div>`;
  }
  const renderer = {
    dashboard: renderDashboard,
    approvals: renderApprovals,
    groups: renderGroups,
    branchDetail: renderBranchDetail,
    savingsProducts: renderSavingsProducts,
    susuGroups: renderSusuGroups,
    customers: renderCustomers,
    collections: renderCollections,
    withdrawals: renderWithdrawals,
    loans: renderLoans,
    loanRepayments: renderLoanRepayments,
    interestPayments: renderInterestPayments,
    messages: renderMessages,
    imports: renderImports,
    reports: renderReports,
    logs: renderLogs,
    closing: renderDailyClosing,
    handover: renderHandover,
    backup: renderBackup,
    groupDetail: renderGroupDetail,
    memberDetail: renderMemberDetail,
    settings: renderSettings,
    users: renderUsers,
    agents: renderAgents,
    agentDetail: renderAgentDetail,
    permissions: renderPermissions,
    audit: renderAudit,
    expenses: renderExpenses,
    accounting: renderAccounting,
    notifications: renderNotifications,
    meetings: renderGroupMeetings
  }[activeView];
  if (typeof renderer !== "function") return `<div class="notice">Screen not found.</div>`;
  try {
    return renderer();
  } catch (error) {
    console.error(`Screen render failed (${activeView}):`, error);
    return `<div class="notice">This screen could not be opened. ${escapeHtml(error?.message || "Unexpected error")}. Try Sync now, then open it again.</div>`;
  }
}

function metrics() {
  const deposits = sumTransactions("Susu Deposit");
  const repayments = sumTransactions("Loan Repayment");
  const interestPaid = sumTransactions("Interest Payment");
  const withdrawals = sumTransactions("Withdrawal");
  const disbursed = visibleLoans().reduce((sum, loan) => sum + Number(loan.principal || 0), 0);
  const outstanding = visibleLoans().reduce((sum, loan) => sum + Math.max(0, loan.totalDue - loan.amountPaid), 0);
  const expected = visibleExpectedContribution();
  const remaining = Math.max(0, expected - deposits);
  const keeperBalance = deposits + repayments + interestPaid - withdrawals - disbursed;
  return { deposits, repayments, interestPaid, withdrawals, disbursed, outstanding, expected, remaining, keeperBalance };
}

function sumTransactions(type) {
  return visibleTransactions().filter((tx) => tx.type === type).reduce((sum, tx) => sum + Number(tx.amount), 0);
}

function visibleExpectedContribution() {
  return visibleCustomers().reduce((sum, customer) => {
    const group = groupById(customer.groupId);
    const target = group?.targetContributions || state.settings.collectionDays;
    return sum + perSittingAmount(customer) * target;
  }, 0);
}

function shiftDate(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function todayWithdrawalTotal(date = today()) {
  return visibleTransactions()
    .filter((tx) => tx.date === date && tx.type === "Withdrawal")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

function dashboardDailyTrend(days = 7) {
  return Array.from({ length: days }, (_, index) => {
    const date = shiftDate(today(), index - (days - 1));
    return {
      date,
      label: formatShortDate(date),
      collections: todayCollectionTotal(date),
      withdrawals: todayWithdrawalTotal(date)
    };
  });
}

function collectionsByCollector(limit = 6) {
  const totals = new Map();
  visibleCollections().forEach((item) => {
    const collectorId = item.userId || groupById(item.groupId)?.collectorId || "";
    const name = userName(collectorId) || groupName(item.groupId) || "Unassigned";
    totals.set(name, (totals.get(name) || 0) + Number(item.amount || 0));
  });
  return [...totals.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function customerStatusBreakdown() {
  const customers = visibleCustomers();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const cutoff = shiftDate(today(), -30);
  let active = 0;
  let dormant = 0;
  let newMonth = 0;
  let inactive = 0;
  customers.forEach((customer) => {
    if (!customer.active) {
      inactive += 1;
      return;
    }
    if (new Date(customer.createdAt || 0) >= monthStart) newMonth += 1;
    const recentTx = visibleTransactions().some((tx) =>
      tx.customerId === customer.id
      && tx.date >= cutoff
      && ["Susu Deposit", "Withdrawal", "Loan Repayment", "Interest Payment"].includes(tx.type)
    );
    if (recentTx || customerBalance(customer.id) > 0) active += 1;
    else dormant += 1;
  });
  return { active, dormant, newMonth, inactive, total: customers.length || 1 };
}

function pendingApprovalsCount() {
  return pendingApprovalLoans().length + pendingVerificationCollections().length + (isKBA() ? pendingApprovalUsers().length : 0);
}

function targetAchievementPercent() {
  const expected = visibleExpectedContribution();
  if (!expected) return 0;
  return Math.min(100, Math.round((sumTransactions("Susu Deposit") / expected) * 100));
}

function totalSusuBalance() {
  return visibleCustomers().reduce((sum, customer) => sum + customerBalance(customer.id), 0);
}

function customersTransactedToday() {
  const date = today();
  const ids = new Set();
  visibleCollections().filter((item) => item.date === date).forEach((item) => ids.add(item.customerId));
  visibleTransactions().filter((tx) => tx.date === date).forEach((tx) => ids.add(tx.customerId));
  return ids.size;
}

function businessDayStatus() {
  const groups = visibleGroupIds();
  if (!groups.length) return "OPEN";
  const closedGroups = new Set(visibleClosings().filter((item) => item.date === today()).map((item) => item.groupId));
  return groups.every((groupId) => closedGroups.has(groupId)) ? "CLOSED" : "OPEN";
}

function dashboardAlerts() {
  const alerts = [];
  const pendingPayments = pendingVerificationCollections();
  if (pendingPayments.length) {
    alerts.push({
      level: "danger",
      title: "Pending Verification",
      text: `${pendingPayments.length} electronic payment(s) need verification.`,
      action: "approvals"
    });
  }
  const behind = arrearsRows();
  if (behind.length) {
    alerts.push({
      level: behind.length >= 5 ? "danger" : "warn",
      title: "Customers Behind",
      text: `${behind.length} customer(s) have outstanding contributions.`,
      action: "reports"
    });
  }
  pendingApprovalLoans().slice(0, 2).forEach((loan) => {
    alerts.push({
      level: "warn",
      title: "Loan Pending Approval",
      text: `${customerName(loan.customerId)} · ${money(loan.principal)}`,
      action: "approvals"
    });
  });
  if (isKBA() && pendingApprovalUsers().length) {
    alerts.push({
      level: "warn",
      title: "Staff Requests",
      text: `${pendingApprovalUsers().length} staff request(s) waiting for activation.`,
      action: "approvals"
    });
  }
  if (isKBA() && !backupDoneToday()) {
    alerts.push({
      level: "warn",
      title: "Backup Reminder",
      text: "No backup has been recorded today.",
      action: "backup"
    });
  }
  return alerts.slice(0, 6);
}

function renderKpiCard(label, value, tone = "brand", meta = "", jump = "", navFilter = "") {
  const jumpAttrs = jump
    ? ` class="kpi-card kpi-${tone} kpi-clickable" role="button" tabindex="0" data-view-jump="${jump}"${navFilter ? ` data-nav-filter="${navFilter}"` : ""}`
    : ` class="kpi-card kpi-${tone}"`;
  return `
    <div${jumpAttrs}>
      <div class="kpi-icon" aria-hidden="true"></div>
      <small>${escapeHtml(label)}</small>
      <strong>${value}</strong>
      ${meta ? `<span>${escapeHtml(meta)}</span>` : ""}
    </div>
  `;
}

function navFilterLabel(filter = "") {
  if (filter === "behind") return "Customers behind on contributions";
  if (filter === "active") return "Active customers";
  if (filter === "personal") return "Personal savings customers";
  if (filter === "susu") return "Susu group members";
  return "";
}

function applyCustomerNavFilter(customers, filter = "") {
  if (!filter) return customers;
  if (filter === "active") return customers.filter((customer) => customer.active);
  if (filter === "behind") {
    const behindIds = new Set(arrearsRows().map((row) => row.customerId));
    return customers.filter((customer) => behindIds.has(customer.id));
  }
  if (filter === "personal") return customers.filter((customer) => customerHasPersonalAccount(customer));
  if (filter === "susu") return customers.filter((customer) => customerHasSusuAccount(customer));
  return customers;
}

function customerHasSusuAccount(customer) {
  if (!customer) return false;
  const type = customer.accountType || "personal";
  return type === "susu_group" || type === "both";
}

function customerHasPersonalAccount(customer) {
  if (!customer) return false;
  const type = customer.accountType || "personal";
  return type === "personal" || type === "both";
}

function shouldCountSittings(customer, collectionType, susuGroupId = "") {
  if (!customerHasSusuAccount(customer)) return false;
  if (customer.accountType === "personal") return false;
  if (customer.accountType === "both" && collectionType !== COLLECTION_TYPES.SUSU_GROUP && !susuGroupId) return false;
  return true;
}

function renderTrendLineChart(rows) {
  if (!rows.length) return `<div class="empty">No trend data yet.</div>`;
  const width = 620;
  const height = 240;
  const pad = { top: 24, right: 20, bottom: 40, left: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxVal = Math.max(1, ...rows.flatMap((row) => [row.collections, row.withdrawals]));
  const point = (index, value) => ({
    x: pad.left + (rows.length === 1 ? innerW / 2 : (index / (rows.length - 1)) * innerW),
    y: pad.top + innerH - (Number(value) / maxVal) * innerH
  });
  const pathFor = (key) => rows.map((row, index) => {
    const { x, y } = point(index, row[key]);
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join("");
  const totalCollections = rows.reduce((sum, row) => sum + row.collections, 0);
  const totalWithdrawals = rows.reduce((sum, row) => sum + row.withdrawals, 0);
  const axisLabel = (amount) => Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `
    <div class="section-title"><h2>Collections vs Withdrawals</h2><span class="muted">Last ${rows.length} days</span></div>
    <svg class="dash-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Collections versus withdrawals trend">
      ${[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = pad.top + innerH - ratio * innerH;
        return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" class="dash-grid-line"></line>
                <text x="${pad.left - 8}" y="${y + 4}" class="dash-axis-label" text-anchor="end">${axisLabel(maxVal * ratio)}</text>`;
      }).join("")}
      ${rows.map((row, index) => {
        const { x } = point(index, 0);
        return `<text x="${x}" y="${height - 12}" class="dash-axis-label" text-anchor="middle">${escapeHtml(row.label)}</text>`;
      }).join("")}
      <path d="${pathFor("collections")}" class="dash-line collections"></path>
      <path d="${pathFor("withdrawals")}" class="dash-line withdrawals"></path>
      ${rows.map((row, index) => {
        const c = point(index, row.collections);
        const w = point(index, row.withdrawals);
        return `<circle cx="${c.x}" cy="${c.y}" r="3.5" class="dash-dot collections"></circle>
                <circle cx="${w.x}" cy="${w.y}" r="3.5" class="dash-dot withdrawals"></circle>`;
      }).join("")}
    </svg>
    <div class="dash-legend">
      <span><i class="dot collections"></i> Collections</span>
      <span><i class="dot withdrawals"></i> Withdrawals</span>
    </div>
    <div class="dash-chart-foot">
      <div><small>Total Collections</small><strong>${money(totalCollections)}</strong></div>
      <div><small>Total Withdrawals</small><strong>${money(totalWithdrawals)}</strong></div>
      <div><small>Net Collections</small><strong>${money(totalCollections - totalWithdrawals)}</strong></div>
    </div>
  `;
}

function renderCollectorBarChart(rows) {
  if (!rows.length) return `<div class="empty">No collector collections yet.</div>`;
  const max = Math.max(...rows.map((row) => row.amount), 1);
  return `
    <div class="section-title"><h2>Collections by Collector</h2></div>
    <div class="dash-bar-chart">
      ${rows.map((row) => `
        <div class="dash-bar-row">
          <div class="dash-bar-label" title="${escapeAttr(row.name)}">${escapeHtml(row.name)}</div>
          <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${((row.amount / max) * 100).toFixed(1)}%"></div></div>
          <div class="dash-bar-value">${money(row.amount)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderDashboardAlertsPanel(alerts) {
  return `
    <div class="section-title"><h2>Alerts</h2></div>
    ${alerts.length ? `
      <div class="dash-alert-list">
        ${alerts.map((alert) => `
          <div class="dash-alert dash-alert-${alert.level}">
            <strong>${escapeHtml(alert.title)}</strong>
            <p>${escapeHtml(alert.text)}</p>
            ${alert.action ? `<button class="btn ghost" type="button" data-view-jump="${alert.action}">View</button>` : ""}
          </div>
        `).join("")}
      </div>
    ` : `<div class="empty good">No urgent alerts right now.</div>`}
  `;
}

function renderCustomerStatusPanel(breakdown) {
  const { active, dormant, newMonth, inactive, total } = breakdown;
  const pct = (value) => (total ? Math.round((value / total) * 1000) / 10 : 0);
  const slices = [
    { value: pct(active), color: "#16715f" },
    { value: pct(dormant), color: "#c08a20" },
    { value: pct(newMonth), color: "#2d6ea3" },
    { value: pct(inactive), color: "#b93a32" }
  ].filter((slice) => slice.value > 0);
  let cursor = 0;
  const gradient = slices.length
    ? `conic-gradient(${slices.map((slice) => {
        const stop = `${slice.color} ${cursor}% ${cursor + slice.value}%`;
        cursor += slice.value;
        return stop;
      }).join(", ")})`
    : "conic-gradient(#dfe7e4 0 100%)";
  return `
    <div class="section-title"><h2>Customer Status</h2></div>
    <div class="dash-status-layout">
      <div class="dash-donut" style="background:${gradient}">
        <div class="dash-donut-hole">
          <strong>${total}</strong>
          <small>Total</small>
        </div>
      </div>
      <div class="dash-status-list">
        <div><span class="status-dot active"></span> Active <strong>${active}</strong> <em>${pct(active)}%</em></div>
        <div><span class="status-dot dormant"></span> Dormant <strong>${dormant}</strong> <em>${pct(dormant)}%</em></div>
        <div><span class="status-dot new"></span> New (This Month) <strong>${newMonth}</strong> <em>${pct(newMonth)}%</em></div>
        <div><span class="status-dot inactive"></span> Inactive <strong>${inactive}</strong> <em>${pct(inactive)}%</em></div>
      </div>
    </div>
  `;
}

function renderDashboardSummaryPanel() {
  const customers = visibleCustomers();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const newCustomers = customers.filter((customer) => new Date(customer.createdAt || 0) >= monthStart).length;
  const transacted = customersTransactedToday();
  return `
    <div class="section-title"><h2>Today's Summary</h2></div>
    <div class="calc-list">
      <div><span>New Customers (This Month)</span><strong>${newCustomers}</strong></div>
      <div><span>Customers Transacted Today</span><strong>${transacted}</strong></div>
      <div><span>Active Customers</span><strong>${customers.filter((customer) => customer.active).length}</strong></div>
      <div><span>Branches / Locations</span><strong>${visibleGroups().filter((group) => group.active).length}</strong></div>
      <div><span>Last Updated</span><strong>${new Date().toLocaleString()}</strong></div>
    </div>
    <div class="muted dash-footnote">All amounts are in ${escapeHtml(state.settings.currency)} unless otherwise stated.</div>
  `;
}

function renderManagerProductSplit() {
  const split = managerDashboardSplit(state, { date: today() });
  return `
    <div class="grid two" style="margin-bottom:18px">
      <div class="panel product-split-card personal">
        <div class="section-title"><h2>Personal Savings Today</h2></div>
        <div class="split-amount">${money(split.personalToday)}</div>
        <p class="muted">Individual daily, weekly, and flexible savings - separate from group susu pools.</p>
      </div>
      <div class="panel product-split-card group">
        <div class="section-title"><h2>Group Susu Today</h2></div>
        <div class="split-amount">${money(split.groupToday)}</div>
        <p class="muted">Contributions linked to susu groups and member sitting records.</p>
      </div>
    </div>
    <div class="panel channel-split-bar" style="margin-bottom:18px">
      <div class="section-title"><h2>Cash vs MoMo (Today)</h2></div>
      <div class="channel-bars">
        <div class="channel-bar cash" style="flex:${Math.max(1, split.cashToday)}"><span>Cash ${money(split.cashToday)}</span></div>
        <div class="channel-bar momo" style="flex:${Math.max(1, split.momoToday)}"><span>MoMo ${money(split.momoToday)}</span></div>
      </div>
    </div>
  `;
}

function renderCollectorTodayPanel() {
  const user = currentUser();
  const metrics = collectorDashboardMetrics(user.id, state, { date: today() });
  const missed = metrics.missed.slice(0, 6);
  const showPersonal = !isCollector() || collectorDoesPersonalSavings(user);
  const showGroup = !isCollector() || collectorDoesSusuGroup(user);
  return `
    <div class="grid two" style="margin-bottom:18px">
      <div class="panel">
        <div class="section-title"><h2>Today's Assignment</h2></div>
        <div class="calc-list">
          ${showPersonal ? `<div class="calc-row-link" role="button" tabindex="0" data-view-jump="customers" data-nav-filter="personal"><span>Personal savers</span><strong>${metrics.personalMembers}</strong></div>` : ""}
          ${showGroup ? `<div class="calc-row-link" role="button" tabindex="0" data-view-jump="susuGroups"><span>Susu groups</span><strong>${metrics.assignedGroups}</strong></div>` : ""}
          ${showPersonal ? `<div class="calc-row-link" role="button" tabindex="0" data-view-jump="collections"><span>Expected personal</span><strong>${money(metrics.expectedPersonal)}</strong></div>` : ""}
          ${showGroup ? `<div class="calc-row-link" role="button" tabindex="0" data-view-jump="susuGroups"><span>Expected group</span><strong>${money(metrics.expectedGroup)}</strong></div>` : ""}
        </div>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Missed / Overdue</h2></div>
        ${missed.length ? `
          <ul class="missed-list">
            ${missed.map((item) => item.customer
              ? `<li><button type="button" class="link-btn" data-member-detail="${item.customer.id}"><strong>${escapeHtml(item.customer.name)}</strong></button> · ${escapeHtml(item.reason)}</li>`
              : `<li><button type="button" class="link-btn" data-view-jump="susuGroups"><strong>${escapeHtml(item.group?.name || "Group")}</strong></button> · ${escapeHtml(item.reason)}</li>`
            ).join("")}
          </ul>
        ` : `<div class="empty good">No missed collections flagged for today.</div>`}
      </div>
    </div>
  `;
}

function currentDashboardModel() {
  const user = currentUser() || {};
  return buildDashboardModel({
    state,
    user,
    date: today(),
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    appVersion: APP_VERSION,
    scoped: {
      customers: visibleCustomers(),
      collections: visibleCollections(),
      loans: visibleLoans(),
      transactions: visibleTransactions(),
      withdrawals: (state.withdrawalRequests || []).filter((item) => !visibleCustomers().length || visibleCustomers().some((customer) => customer.id === item.customerId)),
      expenses: (state.expenses || []).filter((item) => isKBA() || !item.groupId || visibleGroupIds().includes(item.groupId)),
      groups: visibleGroups(),
      susuGroups: visibleSusuGroups(),
      users: state.users || [],
      meetings: state.groupMeetings || []
    }
  });
}

function renderDashboard() {
  const user = currentUser();
  const branchLabel = isKBA()
    ? `${visibleGroups().filter((group) => group.active).length} branch(es) · ${visibleCustomers().length} customers`
    : `${primaryGroup()?.name || "No branch assigned"}${collectorCodeForGroup(primaryGroup()?.id) ? ` · ${collectorCodeForGroup(primaryGroup()?.id).toUpperCase()}` : ""}`;
  const dashboardName = isSystemOwner()
    ? "System Owner Dashboard"
    : isKBA()
      ? "Super Administrator Dashboard"
      : isAdmin()
        ? "Branch Manager Dashboard"
        : isCollector()
          ? "Agent Dashboard"
          : roleIs("Accountant")
            ? "Accountant Dashboard"
            : roleIs("CustomerService")
              ? "Customer Service Dashboard"
              : "Dashboard";
  const dashboardHint = isCollector()
    ? "Today's assigned customers, collections, target, and offline sync."
    : "Role-based business overview. Cards and widgets open the matching module.";
  const model = currentDashboardModel();
  return `
    ${isCollector() ? renderCollectorQuickPanel() : ""}
    ${renderDashboardHome(model, {
      title: dashboardName,
      hint: dashboardHint,
      branchLabel,
      clock: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    })}
    ${isCollector() ? renderCollectorTodayPanel() : ""}
    ${renderPendingVerificationPanel()}
    ${renderOwnerApprovalsPanel()}
    ${!isCollector() && !roleIs("Accountant") ? renderAgencyReportsExtra() : ""}
    ${renderMonitoringExecutiveBlock()}
  `;
}

function attachDashboardChrome() {
  const tick = () => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    document.querySelectorAll("#topbarClock, #dashClock").forEach((node) => { node.textContent = now; });
  };
  if (dashClockTimer) clearInterval(dashClockTimer);
  dashClockTimer = setInterval(tick, 30000);
  document.querySelector("#dashNotifyBtn")?.addEventListener("click", () => {
    const drawer = document.querySelector("#dashNotifyDrawer");
    if (drawer) drawer.hidden = !drawer.hidden;
  });
  document.querySelector("#dashProfileBtn")?.addEventListener("click", () => {
    const sheet = document.querySelector(".dash-profile-sheet");
    if (sheet) sheet.hidden = !sheet.hidden;
  });
  document.querySelector("#dashProfileLogout")?.addEventListener("click", () => {
    if (!confirmSignOutAllowed()) return;
    signOutCurrentUser();
  });
  document.querySelectorAll("[data-note-read]").forEach((button) => {
    button.addEventListener("click", () => {
      const note = (state.notifications || []).find((item) => item.id === button.dataset.noteRead);
      if (note) markNotificationRead(note);
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-note-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const note = (state.notifications || []).find((item) => item.id === button.dataset.noteDelete);
      if (note) softDeleteNotification(note);
      saveState();
      render();
    });
  });
}

function attachDashboardHandlers() {
  const user = currentUser();
  if (!user) return;
  const runSearch = () => {
    const customerQuery = document.querySelector("#dashCustomerQuery")?.value || "";
    const groupQuery = document.querySelector("#dashGroupQuery")?.value || "";
    const box = document.querySelector("#dashSearchResults");
    if (!box) return;
    box.innerHTML = renderSearchResults({
      customers: searchCustomers(visibleCustomers(), customerQuery),
      groups: searchDashboardGroups(visibleSusuGroups(), groupQuery)
    });
    box.querySelectorAll("[data-open-customer]").forEach((button) => {
      button.addEventListener("click", () => {
        sessionStorage.setItem("detail_customer_id", button.dataset.openCustomer);
        activeView = "memberDetail";
        render();
      });
    });
    box.querySelectorAll("[data-view-jump]").forEach((button) => {
      button.addEventListener("click", () => {
        activeView = button.dataset.viewJump;
        render();
      });
    });
  };
  document.querySelector("#dashCustomerQuery")?.addEventListener("input", runSearch);
  document.querySelector("#dashGroupQuery")?.addEventListener("input", runSearch);
  document.querySelector("#dashSyncNow")?.addEventListener("click", () => {
    if (typeof syncNow === "function") syncNow();
  });
  document.querySelectorAll("[data-dash-widget]").forEach((input) => {
    input.addEventListener("change", () => {
      const prefs = normalizeDashboardPrefs(user);
      const hidden = new Set(prefs.hiddenWidgets);
      if (input.checked) hidden.delete(input.dataset.dashWidget);
      else hidden.add(input.dataset.dashWidget);
      user.dashboardPrefs = { ...prefs, hiddenWidgets: [...hidden] };
      saveState();
      render();
    });
  });
  const home = document.querySelector("#dashHome");
  if (home && isMobileLayout()) {
    let startY = 0;
    home.addEventListener("touchstart", (event) => { startY = event.touches[0]?.clientY || 0; }, { passive: true });
    home.addEventListener("touchend", (event) => {
      const endY = event.changedTouches[0]?.clientY || 0;
      if (home.scrollTop <= 0 && endY - startY > 70) render();
    }, { passive: true });
  }
  const prefs = normalizeDashboardPrefs(user);
  if (dashRefreshTimer) clearInterval(dashRefreshTimer);
  dashRefreshTimer = setInterval(() => {
    if (activeView === "dashboard" && currentUser() && (typeof navigator === "undefined" || navigator.onLine)) {
      render();
    }
  }, prefs.refreshSeconds * 1000);
}

function renderPendingVerificationPanel() {
  if (!canVerifyPayments()) return "";
  const pending = pendingVerificationCollections().slice(0, 8);
  if (!pending.length) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Payments Pending Verification</h2><button class="btn ghost" data-view-jump="approvals">Open approvals</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Customer</th><th>Amount</th><th>Method</th><th>Reference</th><th>Collector</th></tr></thead>
          <tbody>
            ${pending.map((item) => `
              <tr>
                <td>${item.date}</td>
                <td>${escapeHtml(customerName(item.customerId))}</td>
                <td>${money(item.amount)}</td>
                <td>${escapeHtml(collectionPaymentMethod(item))}</td>
                <td>${escapeHtml(item.paymentReference || "")}</td>
                <td>${escapeHtml(userName(item.userId))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function pendingApprovalLoans() {
  return visibleLoans().filter((loan) => loanAwaitingApproval(loan.status));
}

function pendingApprovalUsers() {
  return state.users.filter((user) => user.pending && !isSystemUser(user));
}

function renderOwnerApprovalsPanel() {
  if (!canAccessApprovals()) return "";
  const pendingLoans = pendingApprovalLoans();
  const pendingUsers = pendingApprovalUsers();
  const pendingPayments = pendingVerificationCollections();
  if (!pendingLoans.length && !pendingUsers.length && !pendingPayments.length) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Pending Approvals</h2><button class="btn ghost" data-view-jump="approvals">Open approvals</button></div>
      ${pendingLoans.length ? `<div class="notice warn">${pendingLoans.length} loan application(s) waiting for approval.</div>` : ""}
      ${pendingUsers.length && isKBA() ? `<div class="notice warn">${pendingUsers.length} staff request(s) waiting for activation.</div>` : ""}
      ${pendingPayments.length ? `<div class="notice warn">${pendingPayments.length} electronic payment(s) waiting for verification.</div>` : ""}
    </div>
  `;
}

function renderApprovals() {
  if (!canAccessApprovals()) return `<div class="notice">Only Manager or Assistant Manager can manage approvals.</div>`;
  const pendingLoans = pendingApprovalLoans();
  const pendingUsers = pendingApprovalUsers();
  const pendingPayments = pendingVerificationCollections();
  const pendingReversals = (state.reversals || []).filter((item) => item.status === "Pending");
  const approvedLoans = visibleLoans().filter((loan) => loanAwaitingDisbursement(loan.status));
  return `
    ${pendingReversals.length ? `
    <div class="panel" style="margin-bottom:18px">
      <div class="section-title"><h2>Pending Reversals</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Customer</th><th>Amount</th><th>Reason</th><th>Requested by</th><th></th></tr></thead>
          <tbody>
            ${pendingReversals.map((item) => `
              <tr>
                <td>${item.createdAt?.slice(0, 10) || ""}</td>
                <td>${escapeHtml(item.originalEntryType || item.kind || "Collection")}</td>
                <td>${escapeHtml(customerName(item.customerId))}</td>
                <td>${money(item.originalAmount)}</td>
                <td>${escapeHtml(item.reason)}</td>
                <td>${escapeHtml(userName(item.requestedBy))}</td>
                <td><button class="btn" data-approve-reversal="${item.id}">Approve</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>` : ""}
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Electronic Payments Pending Verification</h2></div>
        ${pendingPayments.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Customer</th><th>Amount</th><th>Method</th><th>Reference</th><th>Collector</th><th></th></tr></thead>
              <tbody>
                ${pendingPayments.map((item) => `
                  <tr>
                    <td>${item.date}</td>
                    <td>${escapeHtml(customerName(item.customerId))}</td>
                    <td>${money(item.amount)}</td>
                    <td>${escapeHtml(collectionPaymentMethod(item))}</td>
                    <td>${escapeHtml(item.paymentReference || "")}</td>
                    <td>${escapeHtml(userName(item.userId))}</td>
                    <td><button class="btn" data-verify-payment="${item.id}">Verify</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">No electronic payments waiting for verification.</div>`}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Loan Applications</h2></div>
        ${pendingLoans.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Customer</th><th>Location</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                ${pendingLoans.map((loan) => `
                  <tr>
                    <td>${loan.requestDate || loan.date || ""}</td>
                    <td>${escapeHtml(customerName(loan.customerId))}</td>
                    <td>${escapeHtml(groupName(loan.groupId))}</td>
                    <td>${money(loan.principal)}</td>
                    <td>
                      <div class="row-actions">
                        ${loanCanApproveNow(loan.status) && (isKBA() || isAdmin() || canApproveLoans()) ? `<button class="btn" data-approve-loan="${loan.id}">Approve</button>` : ""}
                        <button class="btn secondary" data-view-jump="loans">Review</button>
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">No loan applications waiting for approval.</div>`}
      </div>
    </div>
    ${isKBA() ? `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Staff Requests</h2></div>
      ${pendingUsers.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Requested Location</th><th></th></tr></thead>
            <tbody>
              ${pendingUsers.map((user) => `
                <tr>
                  <td>${escapeHtml(user.name)}</td>
                  <td>${escapeHtml(user.username)}</td>
                  <td>${escapeHtml(user.requestedGroupName || groupName(user.groupId) || "")}</td>
                  <td><button class="btn" data-toggle-user="${user.id}">Activate</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">No staff requests waiting for activation.</div>`}
    </div>` : ""}
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Approved Loans Ready To Disburse</h2></div>
      ${approvedLoans.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Location</th><th>Amount</th><th>Approved</th><th></th></tr></thead>
            <tbody>
              ${approvedLoans.map((loan) => `
                <tr>
                  <td>${escapeHtml(customerName(loan.customerId))}</td>
                  <td>${escapeHtml(groupName(loan.groupId))}</td>
                  <td>${money(loan.principal)}</td>
                  <td>${loan.approvedAt ? loan.approvedAt.slice(0, 10) : ""}</td>
                  <td><button class="btn warning" data-disburse-loan="${loan.id}">Disburse</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">No approved loans waiting for disbursement.</div>`}
    </div>
  `;
}

function canUseBranchModule(user = currentUser()) {
  if (!user || isCollector()) return false;
  return canManageBranches(user) || isKBA() || isAuditor() || roleIs("ManagingDirector") || roleIs("OperationsManager") || roleIs("Accountant");
}

function visibleBranches() {
  ensureBranchesFromLocations(state, uid);
  return filterBranchesForUser(state.branches || [], currentUser());
}

function renderGroups() {
  if (sessionStorage.getItem("edit_group_id") && isKBA()) return renderKbaGroups();
  if (canUseBranchModule()) return renderBranchManagement();
  if (isKBA()) return renderKbaGroups();
  return renderAdminGroupSetup();
}

function renderBranchManagement() {
  const editing = (state.branches || []).find((item) => item.id === sessionStorage.getItem("edit_branch_id"));
  const branches = visibleBranches();
  const rankings = branchRankings(branches, state, { date: today() });
  const staff = state.users.filter((user) => user.active && !["Customer", "Developer"].includes(user.role));
  return `
    ${renderBranchAnalytics(rankings, {
      count: branches.length,
      active: branches.filter((item) => item.status === "Active" || (item.active !== false && !item.status)).length,
      today: rankings.reduce((sum, row) => sum + Number(row.collected || 0), 0),
      monthly: rankings.reduce((sum, row) => sum + Number(row.monthly || 0), 0)
    })}
    ${canManageBranches(currentUser()) ? `
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>${editing ? "Edit Branch" : "Register Branch"}</h2>
        ${editing ? `<button class="btn ghost" id="cancelBranchEdit" type="button">Cancel</button>` : ""}
      </div>
      ${renderBranchForm(editing || { code: nextBranchCode(state.branches) }, staff)}
    </div>` : ""}
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Branches</h2>
        ${renderBranchFilters()}
      </div>
      <div id="branchTable">${renderFilteredBranchTable(branches)}</div>
    </div>
    ${isKBA() ? `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Collection Locations</h2><button class="btn ghost" data-export="groups">Export locations</button></div>
      ${renderGroupsTable()}
    </div>` : ""}
    ${canManageBranches(currentUser()) ? `<button class="dash-fab" type="button" id="branchFab" aria-label="New branch">+</button>` : ""}
  `;
}

function renderFilteredBranchTable(branches) {
  const query = document.querySelector("#branchSearch")?.value || sessionStorage.getItem("branch_search") || "";
  const status = document.querySelector("#branchStatusFilter")?.value || "";
  const type = document.querySelector("#branchTypeFilter")?.value || "";
  let filtered = searchBranches(branches, query);
  if (status) filtered = filtered.filter((item) => (item.status || "Active") === status);
  if (type) filtered = filtered.filter((item) => item.branchType === type);
  const page = Number(sessionStorage.getItem("branch_page") || 1);
  const paged = paginateList(filtered, page, 30);
  sessionStorage.setItem("branch_page", String(paged.page));
  return `${renderBranchTable(paged.items, {
    dash: (branch) => branchDashboard(branch, state, { date: today() }),
    managerName: (branch) => userName(branch.managerId)
  })}${renderBranchPager(paged)}`;
}

function renderBranchDetail() {
  const branch = (state.branches || []).find((item) => item.id === sessionStorage.getItem("detail_branch_id"));
  if (!branch || !visibleBranches().some((item) => item.id === branch.id)) {
    return `<div class="notice">Branch not found or not in your scope.</div>`;
  }
  const locationIds = new Set([branch.locationGroupId, ...(state.groups || []).filter((group) => group.branchId === branch.id).map((group) => group.id)].filter(Boolean));
  const customers = state.customers.filter((item) => locationIds.has(item.groupId) || item.branchId === branch.id);
  return renderBranchDashboard(branch, branchDashboard(branch, state, { date: today() }), {
    staff: staffForBranch(state.users, branch, state.groups),
    customers,
    groups: (state.susuGroups || []).filter((item) => item.branchId === branch.id || locationIds.has(item.branchId)),
    announcements: (state.branchAnnouncements || []).filter((item) => !item.branchId || item.branchId === branch.id).slice().reverse(),
    calendar: (state.branchCalendar || []).filter((item) => !item.branchId || item.branchId === branch.id).slice().reverse(),
    transfers: (state.branchTransfers || []).filter((item) => item.fromBranchId === branch.id || item.toBranchId === branch.id).slice().reverse(),
    canManage: canManageBranches(currentUser()),
    rankings: branchRankings(visibleBranches(), state, { date: today() })
  });
}

function susuGroupCollectorSelect(name, selectedId = "", branchId = "") {
  const collectors = state.users.filter((user) => user.role === "Collector" && user.active);
  const filtered = branchId
    ? collectors.filter((user) => user.groupId === branchId)
    : collectors;
  const list = filtered.length ? filtered : collectors;
  if (!list.length) return `<select name="${name}" required><option value="">No collectors yet</option></select>`;
  return `<select name="${name}" required>${list.map((user) => `<option value="${user.id}" ${user.id === selectedId ? "selected" : ""}>${escapeHtml(user.name)} · ${escapeHtml(collectorCodeForGroup(user.groupId) || "-")}</option>`).join("")}</select>`;
}

function susuGroupSelect(name, selectedId = "", { includeBlank = true } = {}) {
  const groups = visibleSusuGroups();
  const blank = includeBlank ? `<option value="">Individual only (no group)</option>` : "";
  return `<select name="${name}">${blank}${groups.map((group) => `<option value="${group.id}" ${group.id === selectedId ? "selected" : ""}>${escapeHtml(group.code)} · ${escapeHtml(group.name)}</option>`).join("")}</select>`;
}

function renderSusuGroups() {
  const groups = visibleSusuGroups();
  const editingId = sessionStorage.getItem("edit_susu_group_id");
  const editing = groups.find((group) => group.id === editingId) || (canManageSusuGroups() ? state.susuGroups.find((group) => group.id === editingId) : null);
  const detailId = sessionStorage.getItem("susu_group_detail_id");
  if (detailId) {
    const group = groups.find((item) => item.id === detailId) || (isKBA() || isAuditor() ? susuGroupById(detailId) : null);
    if (group) return renderSusuGroupDetail(group);
  }
  const canEdit = canManageSusuGroups() && !isReadOnlyUser();
  return `
    ${canEdit ? `
    <div class="panel">
      <div class="section-title">
        <h2>${editing ? "Edit Susu Group" : "Create Susu Group"}</h2>
        ${editing ? `<button class="btn ghost" id="cancelSusuGroupEdit" type="button">Cancel</button>` : ""}
      </div>
      <form id="susuGroupForm" class="form-grid">
        ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ""}
        <div class="field"><label>Group Code</label><input name="code" value="${escapeAttr(editing?.code || nextSusuGroupCode(state.susuGroups))}" ${editing ? "readonly" : ""} required /></div>
        <div class="field"><label>Group Name</label><input name="name" value="${escapeAttr(editing?.name || "")}" required /></div>
        <div class="field"><label>Branch / Location</label>${groupSelect("branchId", editing?.branchId || primaryGroup()?.id || "", true)}</div>
        <div class="field"><label>Assigned Collector</label>${susuGroupCollectorSelect("collectorId", editing?.collectorId || "", editing?.branchId || "")}</div>
        <div class="field"><label>Contribution Amount (GHS)</label><input name="contributionAmount" type="number" min="0.01" step="0.01" value="${editing?.contributionAmount ?? ""}" required /></div>
        <div class="field"><label>Frequency</label>
          <select name="contributionFrequency">
            ${["Daily", "Weekly", "Monthly"].map((freq) => `<option value="${freq}" ${(editing?.contributionFrequency || "Daily") === freq ? "selected" : ""}>${freq}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Meeting / Collection Day</label><input name="meetingDay" value="${escapeAttr(editing?.meetingDay || "")}" placeholder="e.g. Monday" /></div>
        <div class="field"><label>Cycle Length (days)</label><input name="cycleLength" type="number" min="1" value="${editing?.cycleLength || 31}" required /></div>
        <div class="field"><label>Start Date</label><input name="startDate" type="date" value="${editing?.startDate || ""}" /></div>
        <div class="field"><label>Group Leader</label><input name="leaderName" value="${escapeAttr(editing?.leaderName || "")}" /></div>
        <div class="field"><label>Secretary</label><input name="secretaryName" value="${escapeAttr(editing?.secretaryName || "")}" /></div>
        ${renderGroupFormExtras(editing || {})}
        <div class="field full"><label>Rules / Notes</label><textarea name="rules">${escapeHtml(editing?.rules || "")}</textarea></div>
        <div class="form-actions full"><button class="btn" type="submit">${editing ? "Save group" : "Create group"}</button></div>
      </form>
    </div>` : `<div class="notice">${isReadOnlyUser() ? "Read-only view. Contact the Manager to change susu groups." : "Only Manager or Assistant Manager can create susu groups."}</div>`}
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Susu Groups</h2>
        <div class="row-actions">
          <span class="muted">${groups.length} group(s)</span>
          <button class="btn ghost" type="button" id="exportGroupsBtn">Export CSV</button>
        </div>
      </div>
      ${renderGroupFilters(state.users.filter((user) => ["Collector", "FieldSupervisor", "GroupCoordinator"].includes(user.role)), visibleGroups())}
      <div id="susuGroupTable">${renderSusuGroupTable(groups, canEdit)}</div>
    </div>
    ${!isCollector() ? renderGroupAnalyticsPanel(groupAnalytics(groups, { collections: visibleCollections(), customers: visibleCustomers(), loans: visibleLoans(), meetings: state.groupMeetings || [] })) : ""}
  `;
}

function renderSusuGroupTable(groups, canEdit = canManageSusuGroups()) {
  if (!groups.length) return `<div class="empty">No susu groups yet.${canEdit ? " Create one above." : ""}</div>`;
  return `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Status</th><th>Branch</th><th>Collector</th><th>Contribution</th><th>Members</th><th>Today</th><th></th></tr></thead>
            <tbody>
              ${groups.map((group) => {
                const perf = computeGroupPerformance(group, { collections: visibleCollections(), date: today() });
                return `
                  <tr>
                    <td>${escapeHtml(group.code)}</td>
                    <td>${escapeHtml(group.name)}</td>
                    <td>${escapeHtml(group.groupType || "-")}</td>
                    <td><span class="pill">${escapeHtml(group.status || "Active")}</span></td>
                    <td>${escapeHtml(groupName(group.branchId))}</td>
                    <td>${escapeHtml(userName(group.collectorId))}</td>
                    <td>${money(group.contributionAmount || 0)} / ${escapeHtml(group.contributionFrequency || "Daily")}</td>
                    <td>${activeMemberships(group).length}</td>
                    <td>${money(perf.actual)} <span class="muted">(${perf.paidMembers}/${perf.activeMembers} paid)</span></td>
                    <td>
                      <div class="row-actions">
                        <button class="btn secondary" data-susu-group-detail="${group.id}">View</button>
                        ${canEdit ? `<button class="btn ghost" data-edit-susu-group="${group.id}">Edit</button>` : ""}
                      </div>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
  `;
}

function renderSusuGroupDetail(group) {
  applyGroupProfile(group, group);
  const dash = groupDashboard(group, {
    collections: visibleCollections(),
    customers: visibleCustomers(),
    loans: visibleLoans(),
    meetings: state.groupMeetings || [],
    welfare: state.groupWelfare || [],
    fines: state.groupFines || [],
    shares: state.groupShares || [],
    date: today()
  });
  const members = group.memberships || [];
  const canEdit = canManageSusuGroups() && !isReadOnlyUser();
  const canMeet = canConductGroupMeetings(currentUser()) && !isReadOnlyUser();
  const wizardId = sessionStorage.getItem("meeting_wizard_id");
  const meeting = (state.groupMeetings || []).find((item) => item.id === wizardId && item.susuGroupId === group.id);
  const cards = members.map((membership) => memberGroupCard(membership, state.customers.find((item) => item.id === membership.customerId), {
    collections: visibleCollections(),
    loans: visibleLoans(),
    meetings: (state.groupMeetings || []).filter((item) => item.susuGroupId === group.id),
    fines: state.groupFines || [],
    groupId: group.id
  }));
  const sharePreview = computeShareOut(group, {
    customers: visibleCustomers(),
    collections: visibleCollections(),
    loans: visibleLoans(),
    fines: state.groupFines || [],
    shares: state.groupShares || []
  });
  const online = typeof navigator === "undefined" || navigator.onLine;
  return `
    ${renderGroupDashboardCards(dash, online)}
    <div class="panel">
      <div class="section-title">
        <h2>${escapeHtml(group.code)} · ${escapeHtml(group.name)}</h2>
        <div class="row-actions">
          ${canMeet ? `<button class="btn" type="button" id="startGroupMeeting">Start Meeting</button>` : ""}
          <button class="btn ghost" id="backSusuGroups" type="button">Back to groups</button>
        </div>
      </div>
      <div class="kpi-grid compact">
        ${renderKpiCard("Active Members", String(dash.activeMembers), "blue")}
        ${renderKpiCard("Paid Today", String(dash.paidMembers), "brand")}
        ${renderKpiCard("Missed Today", String(dash.missedMembers), dash.missedMembers ? "danger" : "brand")}
        ${renderKpiCard("Collected Today", money(dash.actual), "gold")}
      </div>
    </div>
    ${meeting && canMeet ? renderMeetingWizard(group, meeting, activeMemberships(group), state.customers) : ""}
    ${canEdit ? `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Add Member</h2></div>
      <form id="susuGroupMemberForm" class="form-grid">
        <input type="hidden" name="susuGroupId" value="${group.id}" />
        <div class="field full"><label>Customer</label>${customerSelect("customerId")}</div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Add to group</button></div>
      </form>
    </div>` : ""}
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Members</h2></div>
      ${renderMemberCards(cards)}
      ${members.length ? `
          <div class="table-wrap" style="margin-top:12px">
            <table>
              <thead><tr><th>Account</th><th>Name</th><th>Status</th><th>Today</th><th></th></tr></thead>
              <tbody>
                ${members.map((membership) => {
                  const customer = state.customers.find((item) => item.id === membership.customerId);
                  const paid = visibleCollections().some((item) => item.susuGroupId === group.id && item.customerId === membership.customerId && item.date === today() && Number(item.amount) > 0 && !item.reversed);
                  return `
                    <tr>
                      <td>${escapeHtml(customer?.accountNo || "")}</td>
                      <td>${escapeHtml(customer?.name || "")}</td>
                      <td>${escapeHtml(membership.status)}</td>
                      <td><span class="pill ${paid ? "" : "warn"}">${paid ? "Paid" : "Not paid"}</span></td>
                      <td>${canEdit ? `
                        <div class="row-actions">
                          <button class="btn ghost" data-member-status="${membership.customerId}" data-member-next="${membership.status === "Active" ? "Suspended" : "Active"}">${membership.status === "Active" ? "Suspend" : "Reactivate"}</button>
                          <button class="btn ghost" data-member-transfer="${membership.customerId}">Transfer</button>
                        </div>` : ""}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">No members in this group yet.</div>`}
    </div>
    <div class="grid two" style="margin-top:18px">
      <div class="panel">
        <div class="section-title"><h2>Group Details</h2></div>
        <div class="calc-list">
          <div><span>Type / status</span><strong>${escapeHtml(group.groupType || "-")} · ${escapeHtml(group.status || "Active")}</strong></div>
          <div><span>Branch</span><strong>${escapeHtml(groupName(group.branchId))}</strong></div>
          <div><span>Collector</span><strong>${escapeHtml(userName(group.collectorId))}</strong></div>
          <div><span>Leader</span><strong>${escapeHtml(group.leaderName || "-")}</strong></div>
          <div><span>Secretary</span><strong>${escapeHtml(group.secretaryName || "-")}</strong></div>
          <div><span>Treasurer</span><strong>${escapeHtml(group.treasurerName || "-")}</strong></div>
          <div><span>Venue / time</span><strong>${escapeHtml(group.meetingVenue || "-")} · ${escapeHtml(group.meetingTime || "-")}</strong></div>
          <div><span>Contribution</span><strong>${money(group.contributionAmount || 0)} / ${escapeHtml(group.contributionFrequency || "Daily")}</strong></div>
          <div><span>Meeting day</span><strong>${escapeHtml(group.meetingDay || "-")}</strong></div>
          <div><span>Cycle</span><strong>${group.cycleLength || 31} days</strong></div>
        </div>
        ${canEdit ? `
          <form id="groupStatusForm" class="form-grid" style="margin-top:12px">
            <input type="hidden" name="susuGroupId" value="${group.id}" />
            <div class="field"><label>Change status</label>
              <select name="status">${GROUP_STATUSES.map((status) => `<option value="${status}" ${status === (group.status || "Active") ? "selected" : ""}>${status}</option>`).join("")}</select>
            </div>
            <div class="form-actions"><button class="btn secondary" type="submit">Update status</button></div>
          </form>` : ""}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Welfare & Shares</h2></div>
        ${canEdit ? `
        <form id="groupWelfareForm" class="form-grid">
          <input type="hidden" name="susuGroupId" value="${group.id}" />
          <div class="field"><label>Member</label>${customerSelect("customerId")}</div>
          <div class="field"><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" required /></div>
          <div class="field"><label>Type</label><select name="type"><option>Contribution</option><option>Funeral Support</option><option>Medical Support</option><option>Emergency Assistance</option><option>Withdrawal</option></select></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Record welfare</button></div>
        </form>
        <form id="groupShareForm" class="form-grid" style="margin-top:12px">
          <input type="hidden" name="susuGroupId" value="${group.id}" />
          <div class="field"><label>Member</label>${customerSelect("customerId")}</div>
          <div class="field"><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" required /></div>
          <div class="field"><label>Type</label><select name="type"><option>Purchase</option><option>Transfer</option><option>Redemption</option><option>Dividend</option></select></div>
          <div class="form-actions full"><button class="btn secondary" type="submit">Record share</button></div>
        </form>` : `<p class="muted">Welfare ${money(dash.welfareBalance)} · Shares ${money(dash.shareCapital)}</p>`}
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Share-out preview</h2>
        ${canEdit ? `<button class="btn" type="button" id="createShareOutBtn">Create share-out request</button>` : ""}
      </div>
      ${renderShareOutPreview(sharePreview)}
    </div>
    ${canEdit ? renderGroupDistributionPanel(group) : ""}
    ${renderGroupDistributionHistory(group)}
    ${canMeet && !meeting ? `<button class="dash-fab collector-action-btn" id="startGroupMeetingFab" type="button">Start Meeting</button>` : ""}
  `;
}

function renderGroupDistributionPanel(group) {
  const cycleLabel = sessionStorage.getItem("distribution_cycle_label") || `${group.code}-${today().slice(0, 7)}`;
  const preview = computeCyclePayouts(group, {
    customers: visibleCustomers(),
    collections: visibleCollections(),
    loans: visibleLoans()
  });
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>End-of-cycle distribution</h2></div>
      <form id="distributionForm" class="form-grid">
        <input type="hidden" name="susuGroupId" value="${group.id}" />
        <div class="field"><label>Cycle label</label><input name="cycleLabel" value="${escapeAttr(cycleLabel)}" required /></div>
        <div class="field"><label>Estimated payout</label><input readonly value="${money(preview.total)}" /></div>
        <div class="form-actions full"><button class="btn" type="submit">Create distribution request</button></div>
      </form>
      <div class="table-wrap" style="margin-top:12px">
        <table>
          <thead><tr><th>Member</th><th>Contributed</th><th>Loan bal.</th><th>Net payout</th></tr></thead>
          <tbody>
            ${preview.memberLines.map((line) => `
              <tr>
                <td>${escapeHtml(line.customerName)}</td>
                <td>${money(fromPesewas(line.contributedPesewas))}</td>
                <td>${money(fromPesewas(line.loanBalancePesewas))}</td>
                <td>${money(fromPesewas(line.payoutPesewas))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderGroupDistributionHistory(group) {
  const rows = (state.groupDistributions || []).filter((item) => item.susuGroupId === group.id).slice().reverse();
  if (!rows.length) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Distribution history</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Cycle</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rows.map((item) => `
              <tr>
                <td>${escapeHtml(item.cycleLabel)}</td>
                <td>${money(item.total)}</td>
                <td><span class="pill ${item.status === "Paid" ? "" : "warn"}">${escapeHtml(item.status)}</span></td>
                <td>
                  ${item.status === "Pending" && canApproveDistribution(currentUser()) ? `<button class="btn" data-approve-distribution="${item.id}">Approve</button>` : ""}
                  ${item.status === "Approved" && isKBA() ? `<button class="btn secondary" data-pay-distribution="${item.id}">Mark paid</button>` : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function handleCreateDistribution(event) {
  event.preventDefault();
  if (!canManageSusuGroups() || isReadOnlyUser()) return;
  const data = formData(event.target);
  const group = susuGroupById(data.susuGroupId);
  if (!group) return;
  const preview = computeCyclePayouts(group, {
    customers: visibleCustomers(),
    collections: visibleCollections(),
    loans: visibleLoans()
  });
  const distribution = buildDistributionRecord({
    id: uid("dist"),
    susuGroupId: group.id,
    cycleLabel: data.cycleLabel,
    createdBy: currentUser().id,
    members: preview.memberLines,
    totalPesewas: preview.totalPesewas
  });
  state.groupDistributions = state.groupDistributions || [];
  state.groupDistributions.push(distribution);
  sessionStorage.setItem("distribution_cycle_label", data.cycleLabel);
  saveState();
  logAudit("Group distribution created", `${group.code} · ${data.cycleLabel} · ${money(preview.total)}`);
  toast("Distribution request created - awaiting approval");
  render();
}

function approveDistributionById(distributionId) {
  const distribution = (state.groupDistributions || []).find((item) => item.id === distributionId);
  if (!distribution) return;
  const result = approveDistribution(distribution, currentUser());
  if (!result.ok) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Group distribution approved", distribution.cycleLabel);
  toast("Distribution approved");
  render();
}

function payDistributionById(distributionId) {
  if (!isKBA()) {
    toast("Only the Manager can mark distributions as paid");
    return;
  }
  const distribution = (state.groupDistributions || []).find((item) => item.id === distributionId);
  if (!distribution) return;
  const result = markDistributionPaid(distribution, currentUser());
  if (!result.ok) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Group distribution paid", distribution.cycleLabel);
  toast("Distribution marked as paid");
  render();
}

function approveReversalById(reversalId) {
  const result = approveReversal(state, reversalId, currentUser(), uid);
  if (!result.ok) {
    toast(result.error);
    return;
  }
  saveState();
  pushCloudBackup(false);
  logAudit("Reversal approved", reversalId);
  toast("Reversal approved");
  render();
}

function renderAudit() {
  if (!canViewAuditReports(currentUser())) {
    return `<div class="notice">You do not have permission to view the audit trail.</div>`;
  }
  const auditRows = (state.audit || []).slice().reverse().slice(0, 200);
  const exceptionRows = (state.exceptions || []).slice().reverse().slice(0, 100);
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Audit Log</h2><button class="btn ghost" data-export="audit">Export CSV</button></div>
        ${auditRows.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Action</th><th>Details</th><th>User</th></tr></thead>
              <tbody>
                ${auditRows.map((row) => `
                  <tr>
                    <td>${escapeHtml(new Date(row.at || row.createdAt || 0).toLocaleString())}</td>
                    <td>${escapeHtml(row.action || "")}</td>
                    <td>${escapeHtml(row.detail || row.details || "")}</td>
                    <td>${escapeHtml(userName(row.userId) || row.user || "System")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">No audit entries yet.</div>`}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Exceptions & Alerts</h2></div>
        ${exceptionRows.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Summary</th><th>Status</th></tr></thead>
              <tbody>
                ${exceptionRows.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.date || row.createdAt?.slice(0, 10) || "")}</td>
                    <td>${escapeHtml(row.type || row.kind || "")}</td>
                    <td>${escapeHtml(row.summary || row.message || "")}</td>
                    <td>${escapeHtml(row.status || "Open")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty good">No open exceptions recorded.</div>`}
      </div>
    </div>
    ${renderAuditInvestigationExtras()}
    ${renderSecurityEngineExtras()}
    ${renderWorkflowEngineExtras()}
    ${renderRuleEngineExtras()}
    ${renderExchangeEngineExtras()}
    ${renderRecordsEngineExtras()}
    ${renderEnterpriseBiExtras()}
    ${renderIntegrationHubExtras()}
    ${renderEnterpriseAiExtras()}
    ${renderPlatformAdminExtras()}
    ${renderWave5AdminPortalExtras()}
    ${renderWave7AnalyticsExtras()}
    ${renderWave8CertificationExtras()}
    ${renderWave9PilotExtras()}
    ${renderWave10GoliveExtras()}
  `;
}

function renderAuditInvestigationExtras() {
  const user = currentUser();
  let filters = {};
  try {
    filters = JSON.parse(sessionStorage.getItem("audit_search") || "{}");
  } catch {
    filters = {};
  }
  const searchRows = searchAudit(state, filters);
  const timelineRows = filters.entityId
    ? auditTimeline(state, filters.entityType || "customer", filters.entityId)
    : [];
  return renderAuditExtras({
    stats: { ...auditDashboardStats(state), idempotency: { ...idempotencyMetrics(state), pendingOutbox: (state.auditOutbox || []).filter((row) => row.status === "pending" || row.status === "retry").length } },
    searchRows,
    timelineRows,
    filters,
    savedFilters: state.savedAuditFilters || [],
    reports: COMPLIANCE_REPORTS,
    outbox: state.auditOutbox || [],
    canExport: canAction(user, "Audit.Export"),
    canIntegrity: canAction(user, "Audit.Integrity"),
    canArchive: canAction(user, "Audit.Archive")
  });
}

function renderCollectorQuickPanel() {
  if (!isCollector()) return "";
  const user = currentUser();
  const metrics = collectorDashboardMetrics(user.id, state, { date: today() });
  const customerCount = metrics.assignedCustomers;
  const groupCount = metrics.assignedGroups;
  const showGroups = collectorDoesSusuGroup(user);
  return `
    <div class="collector-quick panel">
      <div class="collector-quick-progress calc-row-link" role="button" tabindex="0" data-view-jump="collections">
        <div class="progress-ring" style="--progress:${metrics.progressPercent}">
          <span>${metrics.progressPercent}%</span>
        </div>
        <div class="collector-quick-total">
          <small>Today's collections</small>
          <strong>${money(metrics.collectionsToday)}</strong>
          <div class="muted">Target ${money(metrics.expectedTotal)}</div>
        </div>
      </div>
      <div class="collector-quick-stats">
        <div class="calc-row-link" role="button" tabindex="0" data-view-jump="collections"><small>Cash</small><strong>${money(metrics.cashToday)}</strong></div>
        <div class="calc-row-link" role="button" tabindex="0" data-view-jump="collections"><small>MoMo</small><strong>${money(metrics.momoToday)}</strong></div>
        <div class="calc-row-link" role="button" tabindex="0" data-view-jump="customers" data-nav-filter="behind"><small>Missed</small><strong class="${metrics.missedCount ? "text-danger" : ""}">${metrics.missedCount}</strong></div>
        <div class="calc-row-link" role="button" tabindex="0" data-view-jump="handover"><small>Handover</small><strong>${escapeHtml(metrics.handoverStatus)}</strong></div>
      </div>
      <div class="collector-quick-actions">
        <button class="collector-action-btn" type="button" data-view-jump="collections">Collect Payment</button>
        <button class="collector-action-btn secondary" type="button" data-view-jump="customers">Find Customer</button>
        <button class="collector-action-btn secondary" type="button" data-view-jump="handover">Cash Handover</button>
        ${showGroups ? `<button class="collector-action-btn ghost" type="button" data-view-jump="susuGroups">My Groups (${groupCount})</button>` : ""}
      </div>
      <div class="collector-quick-meta muted">
        ${customerCount} assigned customers · Expected cash ${money(metrics.expectedCash)}
        ${!navigator.onLine ? " · <span class='pill bad'>Offline - queue active</span>" : ""}
      </div>
    </div>
  `;
}

function handleSusuGroup(event) {
  event.preventDefault();
  if (!canManageSusuGroups() || isReadOnlyUser()) {
    toast("You do not have permission to manage susu groups");
    return;
  }
  const data = formData(event.target);
  const error = validateSusuGroupInput({
    name: data.name,
    branchId: data.branchId,
    collectorId: data.collectorId,
    contributionAmount: data.contributionAmount
  });
  if (error) {
    toast(error);
    return;
  }
  const contributionAmount = Number(data.contributionAmount);
  const payload = {
    code: String(data.code || "").trim().toUpperCase(),
    name: String(data.name || "").trim(),
    branchId: data.branchId,
    collectorId: data.collectorId,
    contributionAmount,
    contributionFrequency: data.contributionFrequency || "Daily",
    meetingDay: data.meetingDay || "",
    cycleLength: Number(data.cycleLength || 31),
    startDate: data.startDate || "",
    leaderName: data.leaderName || "",
    secretaryName: data.secretaryName || "",
    rules: data.rules || "",
    groupType: data.groupType || "Weekly Group",
    status: data.status || "Active",
    supervisorName: data.supervisorName || "",
    meetingTime: data.meetingTime || "",
    meetingVenue: data.meetingVenue || "",
    collectionFrequency: data.collectionFrequency || data.contributionFrequency || "Weekly",
    financialYearStart: data.financialYearStart || "",
    financialYearEnd: data.financialYearEnd || "",
    treasurerName: data.treasurerName || "",
    viceChairpersonName: data.viceChairpersonName || "",
    committeeMembers: data.committeeMembers || "",
    active: true,
    updatedAt: new Date().toISOString()
  };
  if (data.id) {
    const group = state.susuGroups.find((item) => item.id === data.id);
    if (!group) return;
    Object.assign(group, payload, { walletPesewas: group.walletPesewas || 0, memberships: group.memberships || [] });
    applyGroupProfile(group, payload);
    sessionStorage.removeItem("edit_susu_group_id");
    saveState();
    logGroupActivity(state, { action: "Group updated", susuGroupId: group.id, detail: group.name, userId: currentUser()?.id || "", uid });
    logAudit("Susu group updated", `${group.code} · ${group.name}`);
    toast("Susu group saved");
    render();
    return;
  }
  if (state.susuGroups.some((item) => String(item.code || "").toLowerCase() === payload.code.toLowerCase())) {
    toast("Group code already exists");
    return;
  }
  const created = {
    id: uid("sg"),
    memberships: [],
    walletPesewas: 0,
    createdAt: new Date().toISOString(),
    ...payload
  };
  applyGroupProfile(created, payload);
  state.susuGroups.push(created);
  saveState();
  logGroupActivity(state, { action: "Group created", susuGroupId: created.id, detail: created.name, userId: currentUser()?.id || "", uid });
  logAudit("Susu group created", `${payload.code} · ${payload.name}`);
  toast("Susu group created");
  render();
}

function handleSusuGroupMember(event) {
  event.preventDefault();
  if (!canManageSusuGroups() || isReadOnlyUser()) return;
  const data = formData(event.target);
  const group = susuGroupById(data.susuGroupId);
  const customer = state.customers.find((item) => item.id === data.customerId);
  if (!group || !customer) return;
  if (!canAccessCustomer(customer, currentUser(), { groupIds: visibleGroupIds() })) {
    toast("This customer is not in your scope");
    return;
  }
  upsertMembership(group, customer.id, "Active");
  saveState();
  logGroupActivity(state, { action: "Member added", susuGroupId: group.id, detail: customer.name, userId: currentUser()?.id || "", uid });
  logAudit("Group member added", `${group.code} · ${customer.name}`);
  toast(`${customer.name} added to ${group.name}`);
  render();
}

function handleGroupMemberStatus(customerId, nextStatus) {
  const group = susuGroupById(sessionStorage.getItem("susu_group_detail_id"));
  if (!group || !canManageSusuGroups()) return;
  const result = setMemberStatus(group, customerId, nextStatus);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Group member status", `${group.code} · ${customerName(customerId)} · ${nextStatus}`);
  toast("Member status updated");
  render();
}

function handleGroupMemberTransfer(customerId) {
  const fromGroup = susuGroupById(sessionStorage.getItem("susu_group_detail_id"));
  if (!fromGroup || !canManageSusuGroups()) return;
  const others = visibleSusuGroups().filter((item) => item.id !== fromGroup.id);
  if (!others.length) {
    toast("No other group available");
    return;
  }
  const code = prompt(`Transfer to group code (${others.map((item) => item.code).join(", ")})`);
  const toGroup = others.find((item) => String(item.code).toLowerCase() === String(code || "").trim().toLowerCase());
  const result = transferMember(fromGroup, toGroup, customerId);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Group member transferred", `${fromGroup.code} → ${toGroup.code} · ${customerName(customerId)}`);
  toast("Member transferred");
  render();
}

function renderKbaGroups() {
  const editing = state.groups.find((group) => group.id === sessionStorage.getItem("edit_group_id"));
  if (editing) {
    return `
      <div class="panel">
        <div class="section-title">
          <h2>Edit Location</h2>
          <button class="btn ghost" id="cancelGroupEdit" type="button">Cancel</button>
        </div>
        <form id="groupForm" class="form-grid">
          <input type="hidden" name="id" value="${editing.id}" />
          <div class="field"><label>Location Name</label><input name="name" value="${escapeAttr(editing.name || "")}" required /></div>
          <div class="field"><label>Collector</label><input readonly value="${escapeAttr(userName(editing.collectorId) || "Not assigned")}" /></div>
          <div class="field full"><label>Note</label><textarea name="note">${escapeHtml(editing.note || "")}</textarea></div>
          <div class="form-actions full"><button class="btn" type="submit">Save location</button></div>
        </form>
      </div>
    `;
  }
  return `
    <div class="panel">
      <div class="notice good">Create a collector and susu location together from <strong>Users</strong>.</div>
      <div class="section-title"><h2>Susu Locations</h2><button class="btn ghost" data-export="groups">Export CSV</button></div>
      ${renderGroupsTable()}
    </div>
  `;
}

function renderAdminGroupSetup() {
  const group = primaryGroup();
  if (!group) return `
    <div class="panel">
      <div class="section-title"><h2>Create My Susu Location</h2></div>
      <form id="groupForm" class="form-grid">
        <div class="field"><label>Location Name</label><input name="name" value="${escapeAttr(currentUser()?.requestedGroupName || "")}" required /></div>
        <div class="field"><label>Contribution Every</label><input name="intervalDays" type="number" min="1" value="1" required /></div>
        ${hiddenTargetContributions(31)}
        <div class="field"><label>Default Amount</label><input name="defaultAmount" type="number" min="0" step="0.01" value="0" required /></div>
        <div class="field"><label>Loan Interest %</label><input name="interest" type="number" min="0" step="0.01" value="${state.settings.loanInterest}" required /></div>
        <div class="field full"><label>Arrangement Note</label><textarea name="note"></textarea></div>
        <div class="form-actions full"><button class="btn" type="submit">Create location</button></div>
      </form>
    </div>
  `;
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>${escapeHtml(group.name)}</h2></div>
        <form id="groupForm" class="form-grid">
          <input type="hidden" name="id" value="${group.id}" />
          <div class="field"><label>Contribution Every</label><input name="intervalDays" type="number" min="1" value="${group.intervalDays || 7}" required /></div>
          ${hiddenTargetContributions(group.targetContributions || 31)}
          <div class="field"><label>Default Amount</label><input name="defaultAmount" type="number" min="0" step="0.01" value="${group.defaultAmount || 0}" required /></div>
          <div class="field"><label>Loan Interest %</label><input name="interest" type="number" min="0" step="0.01" value="${group.interest ?? state.settings.loanInterest}" required /></div>
          <div class="field full"><label>Arrangement Note</label><textarea name="note">${escapeHtml(group.note || "")}</textarea></div>
          <div class="form-actions full"><button class="btn" type="submit">Save location setup</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Automatic Calculation</h2></div>
        <div class="calc-list">
          <div><span>Members</span><strong>${groupSummary(group.id).members}</strong></div>
          <div><span>Total contributed</span><strong>${money(groupSummary(group.id).contributed)}</strong></div>
          <div><span>Expected at break</span><strong>${money(groupSummary(group.id).expected)}</strong></div>
          <div><span>Input admin</span><strong>${escapeHtml(userName(group.adminId))}</strong></div>
        </div>
      </div>
    </div>
  `;
}

function renderGroupsTable() {
  const groups = visibleGroups();
  if (!groups.length) return `<div class="empty">No susu locations yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Location</th><th>Collector</th><th>Operation</th><th>Members</th><th>Total Contributed</th><th>Expected At Break</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${groups.map((group) => {
            const summary = groupSummary(group.id);
            return `
              <tr>
                <td><strong>${escapeHtml(group.name)}</strong><br><span class="muted">${escapeHtml(group.note || "")}</span></td>
                <td>${escapeHtml(userName(group.collectorId) || "Not assigned")}</td>
                <td>Every ${group.intervalDays} day(s)<br>${group.interest}% loan interest</td>
                <td>${summary.members}</td>
                <td>${money(summary.contributed)}</td>
                <td>${money(summary.expected)}</td>
                <td><span class="pill ${group.active ? "" : "bad"}">${group.active ? "Active" : "Closed"}</span></td>
                <td>${isKBA() ? `
                  <div class="row-actions">
                    <button class="btn secondary" data-group-detail="${group.id}">Details</button>
                    <button class="btn secondary" data-edit-group="${group.id}">Edit</button>
                    <button class="btn secondary" data-toggle-group="${group.id}">${group.active ? "Close" : "Reopen"}</button>
                    <button class="btn danger" data-delete-group="${group.id}">Delete</button>
                  </div>
                ` : ""}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function readImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    if (file.size > 2_500_000) {
      reject(new Error("Photo is too large. Use an image under 2.5 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read passport picture"));
    reader.readAsDataURL(file);
  });
}

function renderPassportPhotoField({ scope = "member", photoSrc = "", required = false } = {}) {
  const hasPhoto = Boolean(photoSrc);
  return `
    <div class="field full passport-photo-field" data-passport-scope="${escapeAttr(scope)}">
      <label>Passport Picture</label>
      <div class="passport-photo-actions">
        <button type="button" class="btn secondary" data-passport-camera="${escapeAttr(scope)}">Take photo</button>
        <button type="button" class="btn ghost" data-passport-upload="${escapeAttr(scope)}">Upload image</button>
      </div>
      <input id="${scope}PassportPhotoInput" class="passport-file-input" name="passportPhoto" type="file" accept="image/*" capture="user" tabindex="-1" aria-hidden="true" />
      <input type="hidden" id="${scope}PassportPhotoData" name="passportPhotoData" value="" />
      ${hasPhoto ? `<input type="hidden" name="existingPassportPhoto" value="${escapeAttr(photoSrc)}" />` : ""}
      <div id="${scope}PassportCameraPanel" class="passport-camera-panel" hidden>
        <video id="${scope}PassportCameraVideo" autoplay playsinline muted></video>
        <div class="row-actions" style="margin-top:10px">
          <button type="button" class="btn" data-passport-snap="${escapeAttr(scope)}">Capture</button>
          <button type="button" class="btn ghost" data-passport-camera-close="${escapeAttr(scope)}">Cancel</button>
        </div>
      </div>
      <img id="${scope}PassportPhotoPreview" class="passport-preview" src="${escapeAttr(photoSrc)}" alt="Passport preview" style="${hasPhoto ? "" : "display:none"}" />
      <div class="muted">${required ? "Take or upload a clear passport-size photo." : "Take or upload a new photo to replace the current one."}</div>
    </div>
  `;
}

const passportCameraStreams = new Map();

function stopPassportCamera(scope) {
  const stream = passportCameraStreams.get(scope);
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    passportCameraStreams.delete(scope);
  }
  const panel = document.querySelector(`#${scope}PassportCameraPanel`);
  const video = document.querySelector(`#${scope}PassportCameraVideo`);
  if (panel) panel.hidden = true;
  if (video) video.srcObject = null;
}

function setPassportPhotoPreview(scope, src) {
  const preview = document.querySelector(`#${scope}PassportPhotoPreview`);
  const dataInput = document.querySelector(`#${scope}PassportPhotoData`);
  if (!src) return;
  if (preview) {
    preview.src = src;
    preview.style.display = "block";
  }
  if (dataInput) dataInput.value = src;
}

function attachPassportPhotoHandlers(scope = "member") {
  const root = document.querySelector(`[data-passport-scope="${scope}"]`);
  if (!root || root.dataset.passportHandlersBound === "1") return;
  root.dataset.passportHandlersBound = "1";
  const input = document.querySelector(`#${scope}PassportPhotoInput`);
  const panel = document.querySelector(`#${scope}PassportCameraPanel`);
  const video = document.querySelector(`#${scope}PassportCameraVideo`);

  document.querySelector(`[data-passport-upload="${scope}"]`)?.addEventListener("click", () => input?.click());

  document.querySelector(`[data-passport-camera="${scope}"]`)?.addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      input?.click();
      return;
    }
    try {
      stopPassportCamera(scope);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" } },
        audio: false
      });
      passportCameraStreams.set(scope, stream);
      if (video) video.srcObject = stream;
      if (panel) panel.hidden = false;
    } catch {
      toast("Camera unavailable. Choose Upload image or allow camera access.");
      input?.click();
    }
  });

  document.querySelector(`[data-passport-camera-close="${scope}"]`)?.addEventListener("click", () => stopPassportCamera(scope));

  document.querySelector(`[data-passport-snap="${scope}"]`)?.addEventListener("click", () => {
    if (!video?.videoWidth) {
      toast("Camera is not ready yet");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setPassportPhotoPreview(scope, canvas.toDataURL("image/jpeg", 0.85));
    stopPassportCamera(scope);
    toast("Photo captured");
  });

  input?.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      setPassportPhotoPreview(scope, await readImageDataUrl(file));
    } catch (error) {
      toast(error.message || "Could not load photo");
    }
  });
}

async function resolvePassportPhotoFromForm(form, { existingFieldName = "existingPassportPhoto" } = {}) {
  const dataUrl = String(form.querySelector('[name="passportPhotoData"]')?.value || "").trim();
  if (dataUrl) return dataUrl;
  const file = form.querySelector('input[name="passportPhoto"]')?.files?.[0];
  if (file) return readImageDataUrl(file);
  return String(form.querySelector(`[name="${existingFieldName}"]`)?.value || "").trim();
}

function assignStaffProfileFields(user, { phone = "", ghanaCard = "", passportPhoto = "" } = {}) {
  if (!user) return;
  user.phone = phone;
  user.ghanaCard = ghanaCard;
  if (passportPhoto) user.passportPhoto = passportPhoto;
}

function savingsProductSelect(name, selectedId = "", { personalOnly = true } = {}) {
  const list = personalOnly ? personalProducts(state.savingsProducts) : (state.savingsProducts || []).filter((p) => p.active !== false);
  if (!list.length) return `<select name="${name}"><option value="">No products configured</option></select>`;
  return `<select name="${name}" required>${list.map((product) => `<option value="${product.id}" ${product.id === selectedId ? "selected" : ""}>${escapeHtml(product.name)} · ${escapeHtml(product.frequency)}</option>`).join("")}</select>`;
}

function savingsProductName(productId) {
  return productById(state.savingsProducts, productId)?.name || "-";
}

function renderSavingsProducts() {
  if (!canAccessView("savingsProducts")) return `<div class="notice">Only the Manager or Assistant Manager can configure savings products.</div>`;
  ensureSavingsProducts(state);
  const editingId = sessionStorage.getItem("edit_savings_product_id");
  const editing = state.savingsProducts.find((item) => item.id === editingId) || null;
  const products = state.savingsProducts || [];
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title">
          <h2>${editing ? "Edit Savings Product" : "Create Savings Product"}</h2>
          ${editing ? `<button class="btn ghost" id="cancelProductEdit" type="button">Cancel</button>` : ""}
        </div>
        <form id="savingsProductForm" class="form-grid">
          ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ""}
          <div class="field"><label>Product Name</label><input name="name" value="${escapeAttr(editing?.name || "")}" required /></div>
          <div class="field"><label>Product Code</label><input name="code" value="${escapeAttr(editing?.code || "")}" ${editing ? "readonly" : "required"} placeholder="e.g. PERS-DAILY" /></div>
          <div class="field"><label>Product Type</label>
            <select name="type">
              <option value="${PRODUCT_TYPES.PERSONAL_DAILY}" ${editing?.type === PRODUCT_TYPES.PERSONAL_DAILY ? "selected" : ""}>Daily personal</option>
              <option value="${PRODUCT_TYPES.PERSONAL_WEEKLY}" ${editing?.type === PRODUCT_TYPES.PERSONAL_WEEKLY ? "selected" : ""}>Weekly personal</option>
              <option value="${PRODUCT_TYPES.PERSONAL_FLEXIBLE}" ${editing?.type === PRODUCT_TYPES.PERSONAL_FLEXIBLE ? "selected" : ""}>Flexible personal</option>
              <option value="${PRODUCT_TYPES.TARGET_SAVINGS}" ${editing?.type === PRODUCT_TYPES.TARGET_SAVINGS ? "selected" : ""}>Target / fixed savings</option>
              <option value="${PRODUCT_TYPES.GROUP_SUSU}" ${editing?.type === PRODUCT_TYPES.GROUP_SUSU ? "selected" : ""}>Group susu</option>
            </select>
          </div>
          <div class="field"><label>Collection Type</label>
            <select name="collectionType">
              <option value="${COLLECTION_TYPES.PERSONAL}" ${(editing?.collectionType || COLLECTION_TYPES.PERSONAL) === COLLECTION_TYPES.PERSONAL ? "selected" : ""}>Personal everyday savings</option>
              <option value="${COLLECTION_TYPES.SUSU_GROUP}" ${editing?.collectionType === COLLECTION_TYPES.SUSU_GROUP ? "selected" : ""}>Group susu savings</option>
            </select>
          </div>
          <div class="field"><label>Contribution Frequency</label>
            <select name="frequency">${FREQUENCIES.map((f) => `<option ${(editing?.frequency || "Daily") === f ? "selected" : ""}>${f}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Minimum Amount (${state.settings.currency})</label><input name="minAmount" type="number" min="0" step="0.01" value="${fromPesewas(editing?.minAmountPesewas || 100)}" required /></div>
          <div class="field"><label>Default Amount (${state.settings.currency})</label><input name="defaultAmount" type="number" min="0" step="0.01" value="${fromPesewas(editing?.defaultAmountPesewas || 0)}" /></div>
          <div class="field"><label>Fee (${state.settings.currency})</label><input name="fee" type="number" min="0" step="0.01" value="${fromPesewas(editing?.feePesewas || 0)}" /></div>
          <div class="field"><label>Interest Rate %</label><input name="interestRate" type="number" min="0" step="0.01" value="${editing?.interestRate || 0}" /></div>
          <div class="field"><label>Target Amount (${state.settings.currency})</label><input name="targetAmount" type="number" min="0" step="0.01" value="${fromPesewas(editing?.targetAmountPesewas || 0)}" placeholder="For target/fixed savings" /></div>
          <div class="field"><label><input type="checkbox" name="lockUntilTarget" ${editing?.lockUntilTarget ? "checked" : ""} /> Lock withdrawals until target reached</label></div>
          <div class="field full"><label>Withdrawal Rules</label><input name="withdrawalRule" value="${escapeAttr(editing?.withdrawalRule || "")}" placeholder="e.g. Manager approval with ID verification" /></div>
          <div class="field full"><label>Missed Payment Handling</label><input name="missedPaymentRule" value="${escapeAttr(editing?.missedPaymentRule || "")}" /></div>
          <div class="field full"><label>Approval Rules</label><input name="approvalRule" value="${escapeAttr(editing?.approvalRule || "")}" /></div>
          <div class="field"><label><input type="checkbox" name="active" ${editing?.active !== false ? "checked" : ""} /> Active</label></div>
          <div class="form-actions full"><button class="btn" type="submit">${editing ? "Save product" : "Create product"}</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Product Guide</h2></div>
        <div class="product-guide">
          <div class="product-guide-card">
            <span class="product-icon group">G</span>
            <div><strong>Group Susu Savings</strong><p class="muted">Rotating group contributions with cycle, meetings, and end-of-cycle distribution.</p></div>
          </div>
          <div class="product-guide-card">
            <span class="product-icon personal">P</span>
            <div><strong>Personal Everyday Savings</strong><p class="muted">Individual daily, weekly, or flexible savings - no group membership required.</p></div>
          </div>
        </div>
        <p class="muted">Group susu and personal savings are tracked separately. Personal balances never mix with group pool funds.</p>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Configured Products</h2></div>
      <div class="product-grid">
        ${products.map((product) => {
          const perf = productPerformance(product, { collections: state.collections, customers: state.customers, date: today() });
          return `
            <div class="product-card ${product.collectionType === COLLECTION_TYPES.SUSU_GROUP ? "group" : "personal"}">
              <div class="product-card-head">
                <span class="product-badge">${escapeHtml(product.code)}</span>
                <span class="pill ${product.active !== false ? "" : "bad"}">${product.active !== false ? "Active" : "Inactive"}</span>
              </div>
              <h3>${escapeHtml(product.name)}</h3>
              <p class="muted">${escapeHtml(product.frequency)} · Min ${money(fromPesewas(product.minAmountPesewas))}</p>
              <div class="product-stats">
                <div><small>Members</small><strong>${perf.members}</strong></div>
                <div><small>Today</small><strong>${money(perf.actual)}</strong></div>
                <div><small>Missed</small><strong>${perf.missedMembers}</strong></div>
              </div>
              <button class="btn secondary" type="button" data-edit-product="${product.id}">Edit</button>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function handleSavingsProduct(event) {
  event.preventDefault();
  if (!canAccessView("savingsProducts")) {
    toast("You do not have permission to manage savings products");
    return;
  }
  const data = formData(event.target);
  const error = validateProductInput(data);
  if (error) {
    toast(error);
    return;
  }
  ensureSavingsProducts(state);
  const result = upsertProduct(state.savingsProducts, {
    id: data.id,
    name: data.name,
    code: data.code,
    type: data.type,
    collectionType: data.collectionType,
    frequency: data.frequency,
    minAmount: data.minAmount,
    defaultAmount: data.defaultAmount,
    fee: data.fee,
    interestRate: data.interestRate,
    targetAmount: data.targetAmount,
    lockUntilTarget: Boolean(data.lockUntilTarget),
    withdrawalRule: data.withdrawalRule,
    missedPaymentRule: data.missedPaymentRule,
    approvalRule: data.approvalRule,
    active: Boolean(data.active)
  }, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  sessionStorage.removeItem("edit_savings_product_id");
  saveState();
  logAudit("Savings product saved", result.product.name);
  toast("Savings product saved");
  render();
}

function memberAccountTypeField(editing, user = currentUser()) {
  const accountType = editing?.accountType || "personal";
  if (user?.role === "Collector") {
    if (!collectorDoesSusuGroup(user)) {
      return `<input type="hidden" name="accountType" id="memberAccountTypeSelect" value="personal" />`;
    }
    if (!collectorDoesPersonalSavings(user)) {
      const forced = accountType === "both" ? "both" : "susu_group";
      return `<input type="hidden" name="accountType" id="memberAccountTypeSelect" value="${forced}" />`;
    }
  }
  return `
    <div class="field"><label>Account Type</label>
      <select name="accountType" id="memberAccountTypeSelect">
        <option value="personal" ${accountType === "personal" ? "selected" : ""}>Personal savings only</option>
        <option value="both" ${accountType === "both" ? "selected" : ""}>Personal + susu group member</option>
        <option value="susu_group" ${accountType === "susu_group" ? "selected" : ""}>Susu group only</option>
      </select>
    </div>`;
}

function memberFormFields(editing, groupField, defaultGroupId) {
  const photoSrc = editing?.passportPhoto || "";
  const group = groupById(defaultGroupId);
  const user = currentUser();
  const showPersonal = !isCollector() || collectorDoesPersonalSavings(user);
  const showSusu = !isCollector() || collectorDoesSusuGroup(user);
  const businessLocationDefault = defaultBusinessLocationForCollector({
    editingBusinessLocation: editing?.businessLocation || "",
    isCollector: isCollector() && !isKBA(),
    groupName: groupName(defaultGroupId),
    branchName: group?.name || ""
  });
  return `
    <div class="section-title full"><h3>Personal details</h3></div>
    ${memberAccountField(editing, defaultGroupId)}
    <div class="field"><label>Full Name</label><input name="name" value="${escapeAttr(editing?.name || "")}" required /></div>
    <div class="field"><label>Phone</label><input name="phone" value="${escapeAttr(editing?.phone || "")}" placeholder="024 123 4567" required /></div>
    <div class="field"><label>Member Status</label>
      <select name="memberStatus" ${canChangeCustomerStatus(user) ? "" : "disabled"}>
        ${CRM_STATUSES.map((status) => `<option value="${status}" ${(editing?.memberStatus || "Active") === status ? "selected" : ""}>${status}</option>`).join("")}
      </select>
    </div>
    <div class="field"><label>Ghana Card</label><input name="ghanaCard" value="${escapeAttr(editing?.ghanaCard || "")}" placeholder="GHA-XXXXXXXXX-X" required /></div>
    <div class="field"><label>Gender</label><select name="gender">${["", "Male", "Female"].map((option) => `<option value="${option}" ${(editing?.gender || "") === option ? "selected" : ""}>${option || "Select gender (optional)"}</option>`).join("")}</select></div>
    <div class="field"><label>Marital Status</label><select name="maritalStatus">${["", "Single", "Married", "Divorced", "Widowed"].map((option) => `<option value="${option}" ${(editing?.maritalStatus || "") === option ? "selected" : ""}>${option || "Select status (optional)"}</option>`).join("")}</select></div>
    <div class="field"><label>Nationality</label><input name="nationality" value="${escapeAttr(editing?.nationality || "Ghanaian")}" /></div>
    <div class="field"><label>Business Type</label><input name="businessType" value="${escapeAttr(editing?.businessType || "")}" /></div>
    <div class="field full"><label>Home Address</label><textarea name="homeAddress">${escapeHtml(editing?.homeAddress || editing?.address || "")}</textarea></div>
    <div class="field full"><label>Location of Business</label><input name="businessLocation" value="${escapeAttr(businessLocationDefault)}" required ${isCollector() && !isKBA() && businessLocationDefault ? "readonly" : ""} /></div>
    <div class="section-title full"><h3>Next of kin</h3></div>
    <div class="field"><label>Next of Kin</label><input name="nextOfKin" value="${escapeAttr(editing?.nextOfKin || "")}" required /></div>
    <div class="field"><label>Next of Kin Relationship</label>
      <select name="nextOfKinRelationship">
        ${relationshipOptionsHtml(editing?.nextOfKinRelationship || "", escapeAttr)}
      </select>
    </div>
    <div class="field"><label>Next of Kin Phone</label><input name="nextOfKinPhone" value="${escapeAttr(editing?.nextOfKinPhone || "")}" placeholder="024 123 4567" /></div>
    <div class="field full"><label>Next of Kin Address</label><input name="nextOfKinAddress" value="${escapeAttr(editing?.nextOfKinAddress || "")}" /></div>
    <div class="field"><label>Next of Kin Occupation</label><input name="nextOfKinOccupation" value="${escapeAttr(editing?.nextOfKinOccupation || "")}" /></div>
    ${renderCustomerKycExtras(editing)}
    ${renderCustomerCrmFormExtras(editing)}
    <div class="section-title full"><h3>Account &amp; photo</h3></div>
    <div class="field"><label>Susu Location</label>${groupField}</div>
    ${memberAccountTypeField(editing, user)}
    ${showPersonal ? `
    <div id="personalSavingsFields">
      <div class="section-title full"><h3>Personal Savings Account</h3></div>
      <div class="field full"><label>Savings Product</label>${savingsProductSelect("savingsProductId", editing?.savingsProductId || state.savingsProducts?.find((p) => p.code === "PERS-DAILY")?.id || "")}</div>
    </div>` : ""}
    ${showSusu ? `
    <div id="susuAccountFields">
      <div class="section-title full"><h3>Susu Account</h3></div>
      <div class="field"><label>Number of sittings</label><input name="collectionDays" type="number" min="1" value="${editing?.collectionDays ?? group?.targetContributions ?? state.settings.collectionDays ?? 31}" /></div>
      <div class="field"><label>Default contribution amount (${state.settings.currency})</label><input name="dailyAmount" type="number" min="0" step="0.01" value="${editing?.dailyAmount ?? group?.defaultAmount ?? 0}" /></div>
    </div>` : ""}
    <div class="field full">
      ${renderPassportPhotoField({ scope: "member", photoSrc, required: !editing })}
    </div>
  `;
}

function syncMemberAccountTypeFields() {
  const accountType = document.querySelector("#memberAccountTypeSelect")?.value || "personal";
  const personalFields = document.querySelector("#personalSavingsFields");
  const susuFields = document.querySelector("#susuAccountFields");
  const showPersonal = accountType === "personal" || accountType === "both";
  const showSusu = accountType === "susu_group" || accountType === "both";
  if (personalFields) personalFields.style.display = showPersonal ? "" : "none";
  if (susuFields) susuFields.style.display = showSusu ? "" : "none";
  susuFields?.querySelectorAll("input").forEach((input) => {
    // Soft registration path: susu sitting/amount stay optional defaults
    input.required = false;
    if (!showSusu && input.name === "dailyAmount") input.value = "0";
    if (!showSusu && input.name === "collectionDays") input.value = String(state.settings.collectionDays || 31);
  });
  personalFields?.querySelector('select[name="savingsProductId"]')?.toggleAttribute("required", false);
}

function renderCustomers() {
  if (!canViewMembers()) return `<div class="notice">You do not have permission to view members.</div>`;
  if (!primaryGroup() && !isKBA() && !isAuditor()) return `<div class="notice">No susu location has been assigned yet. The owner must assign you to a location first.</div>`;
  const navFilter = sessionStorage.getItem("nav_filter") || "";
  const customers = applyCustomerNavFilter(visibleCustomers(), navFilter);
  const readOnly = isReadOnlyUser();
  const editing = !readOnly ? state.customers.find((customer) => customer.id === sessionStorage.getItem(EDIT_CUSTOMER_ID_KEY) && (isKBA() || visibleGroupIds().includes(customer.groupId))) : null;
  const createOpen = isCustomerCreateSessionOpen(sessionStorage);
  const showRegForm = shouldShowCustomerRegistrationForm({
    readOnly,
    isMobile: isMobileLayout(),
    editing: Boolean(editing),
    createOpen
  });
  const defaultGroupId = editing?.groupId || primaryGroup()?.id || visibleGroups()[0]?.id || "";
  const groupField = isCollector() && !isKBA() && visibleGroups().length === 1
    ? `<input readonly value="${escapeAttr(groupName(defaultGroupId))}" /><input type="hidden" name="groupId" value="${escapeAttr(defaultGroupId)}" />`
    : groupSelect("groupId", defaultGroupId);
  const activeCount = customers.filter((c) => c.active).length;
  const totalBalance = customers.reduce((sum, customer) => sum + customerBalance(customer.id), 0);
  const showRegAnother = shouldShowRegisterAnotherControls({
    readOnly,
    isMobile: isMobileLayout(),
    showRegForm,
    canRegister: canManageMembers()
  });
  const showRegFab = showRegAnother && isMobileLayout();
  return `
    ${showRegForm ? `
    <div class="grid two customers-reg-grid">
      <div class="panel member-reg-panel">
        <div class="section-title">
          <h2>${editing ? "Edit Member" : "Member Registration Form"}</h2>
          ${editing || (isMobileLayout() && createOpen) ? `<button class="btn ghost" id="cancelCustomerEdit" type="button">Cancel</button>` : ""}
        </div>
        ${isCollector() && !isKBA() ? `<div class="notice good">Register ${collectorDoesSusuGroup(currentUser()) && !collectorDoesPersonalSavings(currentUser()) ? "susu group" : collectorDoesPersonalSavings(currentUser()) && !collectorDoesSusuGroup(currentUser()) ? "personal savings" : "new"} members for ${escapeHtml(groupName(defaultGroupId))}.</div>` : ""}
        ${isKBA() ? `<div class="notice good">Owner view: register and manage members across all susu locations.</div>` : ""}
        <form id="customerForm" class="form-grid crm-wizard" novalidate>
          ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ""}
          ${memberFormFields(editing, groupField, defaultGroupId)}
          <div class="form-actions full"><button class="btn" type="submit">${editing ? "Save member" : "Register member"}</button></div>
        </form>
      </div>
      <div class="panel member-summary-panel">
        <div class="section-title"><h2>Member Summary</h2></div>
        <table>
          <tr><td>Registered members</td><td><strong>${activeCount}</strong></td></tr>
          <tr><td>Total susu balance</td><td><strong>${money(totalBalance)}</strong></td></tr>
          <tr><td>Location</td><td><strong>${escapeHtml(groupName(defaultGroupId))}</strong></td></tr>
        </table>
      </div>
    </div>` : ""}
    ${!isCollector() ? renderCustomerAnalyticsPanel(customerAnalytics(customers, {
      collections: visibleCollections(),
      users: state.users,
      groups: visibleGroups(),
      products: state.savingsProducts || []
    })) : ""}
    <div class="panel members-list-panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Members${isMobileLayout() && !readOnly ? ` <span class="pill">${activeCount} registered</span>` : ""}</h2>
        <div class="row-actions">
          ${showRegAnother ? `<button class="btn collector-action-btn" id="openCustomerCreateBtn" type="button">Register</button>` : ""}
          ${navFilter ? `<span class="pill">${escapeHtml(navFilterLabel(navFilter))}</span><button class="btn ghost" type="button" data-clear-nav-filter>Clear filter</button>` : ""}
          <input id="customerSearch" class="${isMobileLayout() ? "mobile-search-bar" : ""}" placeholder="Name, number, phone, Ghana Card, account, branch, agent" />
          ${!isCollector() ? renderCustomerFilters(state.users.filter((user) => user.role === "Collector"), visibleGroups()) : ""}
        </div>
      </div>
      ${!isCollector() ? renderCustomerBulkBar(state.users.filter((user) => user.role === "Collector"), visibleGroups(), canHardDeleteCustomers(currentUser())) : ""}
      <div id="customerTable">${renderCustomerTable(customers)}</div>
    </div>
    ${showRegFab ? `<button class="dash-fab collector-action-btn" id="openCustomerCreateFab" type="button" aria-label="Register member">+</button>` : ""}
  `;
}

function renderCustomerTable(customers) {
  if (!customers.length) return `<div class="empty">No customers match this search.</div>`;
  const page = Number(sessionStorage.getItem("customer_page") || 1);
  const paged = paginateList(customers, page, 50);
  sessionStorage.setItem("customer_page", String(paged.page));
  const pendingIds = new Set((state.offlineQueue || []).filter((item) => item.kind === "customer" && item.status === "pending").map((item) => item.payload?.id));
  if (isMobileLayout()) {
    return `<div class="table-wrap has-mobile-cards">${renderMobileCustomerCards(paged.items, pendingIds)}${renderCustomerPager(paged)}</div>`;
  }
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th></th><th>Photo</th><th>Number</th><th>Member</th><th>Phone</th><th>Agent</th><th>Branch</th><th>Product</th><th>Balance</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${paged.items.map((c) => {
            const personalBal = personalSavingsBalance(c.id, { collections: state.collections, transactions: state.transactions });
            return `
            <tr class="clickable-row" data-row-member-detail="${c.id}">
              <td><input type="checkbox" data-select-customer="${c.id}" /></td>
              <td>${c.passportPhoto ? `<img class="passport-preview table-thumb" src="${escapeAttr(c.passportPhoto)}" alt="" />` : "-"}</td>
              <td>${escapeHtml(c.customerNumber || c.accountNo)}${pendingIds.has(c.id) ? `<br><span class="pill warn">Pending sync</span>` : ""}</td>
              <td><button type="button" class="link-btn" data-member-detail="${c.id}"><strong>${escapeHtml(c.name)}</strong></button><br><span class="muted">${escapeHtml(c.accountNo)}</span></td>
              <td>${escapeHtml(c.phone)}</td>
              <td>${escapeHtml(state.users.find((user) => user.id === c.collectorId)?.name || "-")}</td>
              <td>${escapeHtml(groupName(c.groupId))}</td>
              <td><span class="pill">${escapeHtml(savingsProductName(c.savingsProductId))}</span></td>
              <td>${money(customerBalance(c.id) || personalBal)}</td>
              <td>${statusBadge(c)}</td>
      <td>
        <div class="row-actions">
          <button class="btn secondary" data-edit-customer="${c.id}">Edit</button>
          <button class="btn secondary" data-member-detail="${c.id}">Details</button>
          <button class="btn secondary" data-print-statement="${c.id}">Accounts Sheet</button>
          ${canManageUsers() ? `<button class="btn ghost" data-reassign-customer="${c.id}">Reassign</button>` : ""}
          <button class="btn secondary" data-toggle-customer="${c.id}">${c.active ? "Suspend" : "Reactivate"}</button>
                  <button class="btn danger" data-delete-customer="${c.id}">${canHardDeleteCustomers(currentUser()) ? "Delete" : "Close"}</button>
                </div>
              </td>
            </tr>
          `;
          }).join("")}
        </tbody>
      </table>
    </div>
    ${renderCustomerPager(paged)}
  `;
}

function assignedCollectionQueue() {
  const user = currentUser();
  return visibleCustomers().filter((item) => {
    if (item.active === false) return false;
    if (isCollector() && item.collectorId && item.collectorId !== user?.id) return false;
    return item.accountType !== "susu_group";
  });
}

function collectionCardForCustomer(customer) {
  if (!customer) return null;
  return collectionCustomerCard(customer, {
    collections: state.collections,
    transactions: state.transactions,
    products: state.savingsProducts,
    users: state.users,
    date: today()
  });
}

function renderCollections() {
  if (!canManageCollections() && !isAuditor()) return `<div class="notice">You do not have permission to record collections.</div>`;
  if (!primaryGroup() && !isKBA() && !isAuditor()) return `<div class="notice">No susu location has been assigned to this admin yet.</div>`;
  const readOnly = isReadOnlyUser();
  const user = currentUser();
  const personalOnly = isCollector() && collectorDoesPersonalSavings(user) && !collectorDoesSusuGroup(user);
  const editing = !readOnly ? state.collections.find((item) => item.id === sessionStorage.getItem("edit_collection_id") && visibleGroupIds().includes(item.groupId)) : null;
  const prefillId = sessionStorage.getItem("prefill_collection_customer");
  const queue = assignedCollectionQueue();
  const selectedCustomer = visibleCustomers().find((customer) => customer.id === editing?.customerId)
    || visibleCustomers().find((customer) => customer.id === prefillId)
    || queue.find((customer) => customer.active)
    || visibleCustomers().find((customer) => customer.active);
  if (prefillId) sessionStorage.removeItem("prefill_collection_customer");
  const defaultCollectionAmount = selectedCustomer ? perSittingAmount(selectedCustomer) : "";
  const mobile = isMobileLayout();
  const formTitle = editing
    ? (personalOnly ? "Edit Personal Savings Collection" : "Edit Susu Collection")
    : (personalOnly ? "Record Personal Savings" : "Record Susu Collection");
  const desk = collectionDesk(state, user?.id, { date: today() });
  const card = collectionCardForCustomer(selectedCustomer);
  const queueIndex = queue.findIndex((item) => item.id === selectedCustomer?.id);
  const breakdown = selectedCustomer
    ? customerBalanceBreakdown(selectedCustomer.id, {
      collections: state.collections,
      transactions: state.transactions,
      product: productById(state.savingsProducts, selectedCustomer.savingsProductId)
    })
    : null;
  const pendingCustomers = queue
    .map((item) => collectionCardForCustomer(item))
    .filter((item) => item && item.status !== "Collected");
  const showBulk = sessionStorage.getItem("collection_bulk") === "1";
  const analytics = collectionAnalytics(visibleCollections(), {
    customers: state.customers,
    users: state.users,
    products: state.savingsProducts,
    groups: state.groups
  });
  const missed = missedCollectionRows(visibleCollections(), state.customers);
  const pendingAdjustments = (state.collectionAdjustments || []).filter((item) => item.status === "Pending");
  return `
    ${renderMobileCollectionSuccess()}
    ${renderCollectionDesk(desk)}
    ${!isCollector() && fraudAlerts(visibleCollections()).length ? `<div class="notice warn">${fraudAlerts(visibleCollections()).length} collection alert(s): large deposits or same-day duplicates.</div>` : ""}
    ${readOnly ? "" : `
    <div class="grid two">
      <div class="panel collection-panel-mobile">
        <div class="section-title">
          <h2>${formTitle}</h2>
          <div class="row-actions">
            <button class="btn ghost" type="button" id="toggleBulkCollection">${showBulk ? "Single collect" : "Bulk mode"}</button>
            ${editing ? `<button class="btn ghost" id="cancelCollectionEdit" type="button">Cancel</button>` : ""}
          </div>
        </div>
        ${showBulk ? renderBulkCollectionForm(pendingCustomers) : `
        <form id="collectionForm" class="form-grid collection-form-mobile">
          ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ""}
          <div class="field full"><label>Search Customer</label><input id="collectionMemberSearch" placeholder="Name, phone, or account number" autocomplete="off" /></div>
          ${renderCollectionSwipe(queueIndex > 0, queueIndex >= 0 && queueIndex < queue.length - 1)}
          <div class="field"><label>Account Number</label><input id="collectionAccountNo" readonly value="${escapeAttr(selectedCustomer?.accountNo || selectedCustomer?.customerNumber || "")}" /></div>
          <div class="field"><label>Customer</label>${customerSelect("customerId", editing?.customerId || selectedCustomer?.id || "")}</div>
          <div class="field"><label>Amount</label><input name="amount" type="number" min="0" step="0.01" inputmode="decimal" value="${editing?.amount || defaultCollectionAmount}" required /></div>
          <div class="field full">${renderAmountKeypad()}</div>
          <div class="field"><label>Payment Method</label>${paymentMethodSelect("paymentMethod", editing?.paymentMethod || "Cash")}</div>
          <div class="field full payment-ref-field"><label>Payment Reference</label><input name="paymentReference" value="${escapeAttr(editing?.paymentReference || "")}" placeholder="Required for MoMo, bank, POS or cheque" /></div>
          <div class="field"><label>Visit / missed reason</label>${visitOutcomeSelect("visitOutcome", editing?.visitOutcome || "Paid")}</div>
          <div class="field"><label>Date</label><input name="date" type="date" value="${editing?.date || today()}" required /></div>
          ${personalOnly ? "" : `<div class="field full desktop-only"><label>Susu Group (optional)</label>${susuGroupSelect("susuGroupId", editing?.susuGroupId || "")}</div>`}
          <div class="field full"><label>Remarks</label><textarea name="note">${escapeHtml(editing?.note || "")}</textarea></div>
          <div class="field"><label>Customer confirmation</label><label class="check-row"><input type="checkbox" name="customerConfirmed" /> Customer confirmed</label></div>
          <div class="field"><label>Signature (optional)</label><input name="signature" placeholder="Customer initials or name" /></div>
          <div class="field desktop-only"><label>Capture GPS</label><label class="check-row"><input type="checkbox" name="captureGps" ${editing?.gpsLat ? "checked" : ""} /> Save collection location</label></div>
          <input type="hidden" name="gpsLat" value="${escapeAttr(editing?.gpsLat || "")}" />
          <input type="hidden" name="gpsLng" value="${escapeAttr(editing?.gpsLng || "")}" />
          <div class="form-actions full ${mobile ? "collection-sticky-actions" : ""}"><button class="btn collector-action-btn" type="submit">${editing ? "Save collection" : "Collect & issue receipt"}</button></div>
        </form>`}
      </div>
      <div class="panel">
        <div class="section-title"><h2>Customer Collection</h2></div>
        <div id="collectionCustomerCard">${renderCollectionCustomerCard(card)}</div>
        ${renderBalanceBreakdown(breakdown)}
        <p class="muted">Every payment receives a unique receipt. Cash is verified immediately. Mobile money, bank, POS and cheque stay pending until a manager verifies them.</p>
      </div>
    </div>`}
    ${canApproveFinancial(user) ? renderAdjustmentQueue(pendingAdjustments) : ""}
    ${!isCollector() ? renderCollectionAnalyticsPanel(analytics) : ""}
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Missed Collections</h2></div>
      ${renderMissedCollectionTable(missed.slice(-20).reverse())}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Collection History</h2>
        <div class="row-actions">
          <input id="collectionSearch" placeholder="Search member, receipt, or date" />
          <button class="btn ghost" data-export="collections">Export CSV</button>
          <button class="btn ghost" type="button" id="exportCollectionExcel">Excel / CSV</button>
        </div>
      </div>
      ${renderCollectionFilters(state.users.filter((item) => ["Collector", "FieldSupervisor", "GroupCoordinator"].includes(item.role)), visibleGroups(), personalProducts(state.savingsProducts))}
      <div id="collectionTable">${renderCollectionsTable(visibleCollections())}</div>
    </div>
    ${mobile && !readOnly && !showBulk ? `<button class="dash-fab collector-action-btn" id="quickCollectFab" type="button">Collect</button>` : ""}
    ${renderPaymentEngineExtras()}
    ${renderDocumentEngineExtras()}
  `;
}

function renderWithdrawals() {
  if (!canManageWithdrawals()) return `<div class="notice">You do not have permission to record withdrawals.</div>`;
  if (!primaryGroup() && !isKBA()) return `<div class="notice">No susu location has been assigned yet.</div>`;
  const rows = visibleTransactions().filter((tx) => tx.type === "Withdrawal").slice().reverse();
  const visibleRequests = (state.withdrawalRequests || []).filter((item) => !item.groupId || visibleGroupIds().includes(item.groupId) || isKBA());
  const dash = withdrawalDashboard(visibleRequests, visibleTransactions(), {
    date: today(),
    groupIds: visibleGroupIds(),
    ledgerState: state
  });
  const matured = detectMaturedAccounts(state.savingsAccounts || [], state.savingsProducts || [], { asOfDate: today() })
    .map((account) => ({
      ...account,
      preview: maturityRedemptionPreview(account, productById(state.savingsProducts, account.productId) || {})
    }));
  const analytics = withdrawalAnalytics(visibleRequests, visibleTransactions());
  return `
    ${renderWithdrawalDashboard(dash, matured.length)}
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Smile Trust Withdrawal Form</h2></div>
        <form id="withdrawForm" class="form-grid">
          <div class="field"><label>Date</label><input name="date" type="date" value="${today()}" required /></div>
          <div class="field full"><label>Member</label>${customerSelect("customerId")}</div>
          ${renderWithdrawalFormExtras({ balance: 0, held: 0 })}
          <div class="field"><label>Amount in figures</label><input id="withdrawAmount" name="amount" type="number" min="0" step="0.01" required /></div>
          <div class="field full"><label>Amount in words</label><input id="withdrawAmountWords" readonly placeholder="Filled automatically from amount" /></div>
          <div class="field full"><label>Reason / Details</label><textarea name="note"></textarea></div>
          <div id="withdrawalCustomerPreviewSlot" class="field full"></div>
          <div class="form-actions full">
            <button class="btn warning" type="submit">Record withdrawal</button>
            <button class="btn secondary" type="button" id="requestWithdrawBtn">Submit for approval</button>
            <button class="btn secondary" type="button" id="printWithdrawBlankBtn">Print blank form</button>
          </div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Withdrawal Summary</h2></div>
        <div class="calc-list">
          <div><span>Total withdrawn</span><strong>${money(rows.reduce((sum, tx) => sum + Number(tx.amount || 0), 0))}</strong></div>
          <div><span>Withdrawal records</span><strong>${rows.length}</strong></div>
        </div>
      </div>
    </div>
    ${renderMaturedAccounts(matured)}
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Withdrawal Records</h2><button class="btn ghost" type="button" id="exportWithdrawalRows">Export CSV</button></div>
      ${renderWithdrawalFilters(state.users.filter((item) => item.active !== false), visibleGroups())}
      ${rows.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Member</th><th>Amount</th><th>Officer</th><th>Note</th></tr></thead>
            <tbody>
              ${rows.map((tx) => `
                <tr>
                  <td>${tx.date}</td>
                  <td>${escapeHtml(customerName(tx.customerId))}</td>
                  <td>${money(tx.amount)}</td>
                  <td>${escapeHtml(userName(tx.userId))}</td>
                  <td>${escapeHtml(tx.note || "")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">No withdrawals recorded yet.</div>`}
    </div>
    ${renderWithdrawalWorkflow()}
    ${renderWithdrawalAnalyticsPanel(analytics)}
  `;
}

function renderCollectionsTable(collections = visibleCollections()) {
  if (!collections.length) return `<div class="empty">No collections recorded yet.</div>`;
  if (isMobileLayout()) {
    return `<div class="table-wrap has-mobile-cards">${renderMobileCollectionCards(collections)}</div>`;
  }
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Payment ID</th><th>Location</th><th>Account</th><th>Customer</th><th>Amount</th><th>Method</th><th>Status</th><th>Officer</th><th>Note</th><th>SMS</th><th></th></tr></thead>
        <tbody>
          ${collections.slice().reverse().map((item) => {
            const customer = state.customers.find((entry) => entry.id === item.customerId);
            const status = collectionVerificationStatus(item);
            return `
            <tr>
              <td>${item.date}</td>
              <td>${escapeHtml(item.paymentNo || item.id)}</td>
              <td>${escapeHtml(groupName(item.groupId))}</td>
              <td>${escapeHtml(customer?.accountNo || "")}</td>
              <td>${escapeHtml(customerName(item.customerId))}</td>
              <td>${money(item.amount)}</td>
              <td>${escapeHtml(collectionPaymentMethod(item))}</td>
              <td><span class="pill ${status === "Verified" ? "" : "warn"}">${escapeHtml(status)}</span></td>
              <td>${escapeHtml(userName(item.userId))}</td>
              <td>${escapeHtml(item.note || "")}</td>
              <td>${Number(item.amount || 0) > 0 ? `<button class="btn secondary" data-send-collection-sms="${item.id}">Send SMS</button>` : ""}</td>
              <td><div class="row-actions">
                ${canVerifyPayments() && status === "Pending Verification" ? `<button class="btn" data-verify-payment="${item.id}">Verify</button>` : ""}
                ${item.receiptNo || item.paymentNo ? `<button class="btn secondary" data-reprint-collection="${item.id}">Reprint</button>` : ""}
                ${canApproveFinancial(currentUser()) && !item.reversed ? `<button class="btn ghost" data-adjust-collection="${item.id}">Adjust</button>` : ""}
                ${canRequestCollectionReversal() && !item.reversed ? `<button class="btn danger" data-reverse-collection="${item.id}">Reverse</button>` : ""}
                ${item.reversed ? `<span class="pill bad">Reversed</span>` : ""}
              </div></td>
            </tr>
          `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderLoans() {
  if (!primaryGroup() && !isKBA()) return `<div class="notice">No susu location has been assigned to this admin yet.</div>`;
  const editing = state.loans.find((loan) => loan.id === sessionStorage.getItem("edit_loan_id") && visibleGroupIds().includes(loan.groupId));
  const selectedCustomer = state.customers.find((customer) => customer.id === (editing?.customerId || ""));
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title">
          <h2>${editing ? "Edit Loan Application" : "Smile Trust Loan Application Form"}</h2>
          ${editing ? `<button class="btn ghost" id="cancelLoanEdit" type="button">Cancel</button>` : ""}
        </div>
        <form id="loanForm" class="form-grid">
          ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ""}
          <div class="field full"><label>Applicant</label>${customerSelect("customerId", editing?.customerId)}</div>
          <div class="field"><label>Account Number</label><input id="loanAccountNo" readonly value="${escapeAttr(selectedCustomer?.accountNo || "")}" /></div>
          <div class="field"><label>Ghana Card</label><input id="loanGhanaCard" readonly value="${escapeAttr(selectedCustomer?.ghanaCard || "")}" /></div>
          <div class="field"><label>Tel. Number(s)</label><input id="loanPhone" readonly value="${escapeAttr(selectedCustomer?.phone || "")}" /></div>
          <div class="field full"><label>Residential Address</label><input id="loanAddress" readonly value="${escapeAttr(selectedCustomer?.homeAddress || selectedCustomer?.address || "")}" /></div>
          <div class="field"><label>Loan Amount in Figures</label><input id="loanPrincipal" name="principal" type="number" min="0" step="0.01" value="${editing?.principal || ""}" required /></div>
          <div class="field full"><label>Loan Amount in Words</label><input id="loanAmountWords" readonly value="${editing?.principal ? amountInWords(editing.principal) : ""}" /></div>
          <div class="field full"><label>Purpose of Loan</label><textarea name="purpose">${escapeHtml(editing?.purpose || "")}</textarea></div>
          <div class="field"><label>Repayment Period (months)</label><input name="interestMonths" type="number" min="1" value="${editing?.interestMonths || 6}" required /></div>
          <div class="field"><label>Request Date</label><input name="requestDate" type="date" value="${editing?.requestDate || editing?.date || today()}" required /></div>
          <div class="field"><label>Interest %</label><input name="interest" type="number" min="0" step="0.01" value="${editing?.interest ?? state.settings.loanInterest}" required /></div>
          <div class="field"><label>Loan Date</label><input name="date" type="date" value="${editing?.date || today()}" required /></div>
          <div class="field full"><label>Guarantor Name</label><input name="guarantorName" value="${escapeAttr(editing?.guarantorName || "")}" /></div>
          <div class="field"><label>Guarantor Ghana Card</label><input name="guarantorGhanaCard" value="${escapeAttr(editing?.guarantorGhanaCard || "")}" /></div>
          <div class="field"><label>Guarantor Account No.</label><input name="guarantorAccountNo" value="${escapeAttr(editing?.guarantorAccountNo || "")}" /></div>
          <div class="field"><label>Guarantor Tel.</label><input name="guarantorPhone" value="${escapeAttr(editing?.guarantorPhone || "")}" /></div>
          <div class="field full"><label>Collector's Recommendation</label><textarea name="collectorRecommendation">${escapeHtml(editing?.collectorRecommendation || "")}</textarea></div>
          <div class="field full"><label>Managing's Recommendation</label><textarea name="managerRecommendation">${escapeHtml(editing?.managerRecommendation || "")}</textarea></div>
          <div class="form-actions full"><button class="btn" type="submit">${editing ? "Save application" : "Submit application"}</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Loan Summary</h2></div>
        <div class="calc-list">
          <div><span>Total loan given</span><strong>${money(visibleLoans().reduce((sum, loan) => sum + Number(loan.principal || 0), 0))}</strong></div>
          <div><span>Loan repaid</span><strong>${money(sumTransactions("Loan Repayment"))}</strong></div>
          <div><span>Interest paid</span><strong>${money(sumTransactions("Interest Payment"))}</strong></div>
          <div><span>Outstanding loans</span><strong>${money(visibleLoans().reduce((sum, loan) => sum + Math.max(0, loan.totalDue - loan.amountPaid), 0))}</strong></div>
        </div>
        <div class="row-actions" style="margin-top:16px">
          <button class="btn secondary" data-view-jump="loanRepayments">Loan Repayments</button>
          <button class="btn secondary" data-view-jump="interestPayments">Interest Payments</button>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Loans</h2><button class="btn ghost" data-export="loans">Export CSV</button></div>
      ${renderLoansTable()}
    </div>
  `;
}

function loanStatusClass(status) {
  if (status === "Completed" || status === "Settled") return "";
  if (["Pending", "Draft", "Submitted", "Under Review", "Pending Approval", "Verified"].includes(status)) return "warn";
  if (["Rejected", "Cancelled", "Defaulted", "Written Off"].includes(status)) return "bad";
  if (status === "Approved" || status === "Ready for Disbursement") return "blue";
  return "blue";
}

function renderLoansTable() {
  if (!visibleLoans().length) return `<div class="empty">No loans created yet.</div>`;
  const tableHtml = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Location</th><th>Customer</th><th>Principal</th><th>Monthly Interest</th><th>Interest Schedule</th><th>Total Due</th><th>Paid</th><th>Balance</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${visibleLoans().slice().reverse().map((loan) => `
            <tr>
              <td>${loan.date}</td>
              <td>${escapeHtml(groupName(loan.groupId))}</td>
              <td>${escapeHtml(customerName(loan.customerId))}<br><span class="muted">${escapeHtml(loan.purpose || "")}</span></td>
              <td>${money(loan.principal)}</td>
              <td>${loan.interest}%<br><span class="muted">${money(monthlyInterestAmount(loan))}</span></td>
              <td>${loanShowsSchedule(loan.status) ? renderInterestSchedule(loan) : `<span class="muted">After disbursement</span>`}</td>
              <td>${money(loan.totalDue)}</td>
              <td>${money(loan.amountPaid)}</td>
              <td>${money(Math.max(0, loan.totalDue - loan.amountPaid))}</td>
              <td><span class="pill ${loanStatusClass(loan.status)}">${loan.status}</span></td>
              <td>
                <div class="row-actions">
                  <button class="btn secondary" data-print-loan-app="${loan.id}">Application</button>
                  ${!loanAwaitingApproval(loan.status) && loan.status !== "Draft" ? `<button class="btn secondary" data-print-loan-accept="${loan.id}">Acceptance</button>` : ""}
                  ${loanCanApproveNow(loan.status) && canApproveLoans() ? `<button class="btn" data-approve-loan="${loan.id}">Approve</button>` : ""}
                  ${loanCanRejectNow(loan.status) && canRejectLoans() ? `<button class="btn secondary" data-reject-loan="${loan.id}">Reject</button>` : ""}
                  ${loanAwaitingDisbursement(loan.status) && canDisburseLoans() ? `<button class="btn warning" data-disburse-loan="${loan.id}">Disburse</button>` : ""}
                  ${loan.status === "Active" || loan.status === "Restructured" ? `<button class="btn secondary" data-send-loan-sms="${loan.id}">Send SMS</button>` : ""}
                  ${canManageLoans() && loanIsEditable(loan.status) ? `<button class="btn secondary" data-edit-loan="${loan.id}">Edit</button>` : ""}
                  ${canManageLoans() && loanCanBeCancelled(loan.status) ? `<button class="btn ghost" data-cancel-loan="${loan.id}">Cancel</button>` : ""}
                  ${canDeleteLoans() ? `<button class="btn danger" data-delete-loan="${loan.id}">Delete</button>` : ""}
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  return mobileTableWrap(renderMobileLoanCards(), tableHtml);
}

function renderLoanRepayments() {
  if (!primaryGroup() && !isKBA()) return `<div class="notice">No susu location has been assigned to this admin yet.</div>`;
  const editing = state.transactions.find((tx) => tx.id === sessionStorage.getItem("edit_repayment_id") && tx.type === "Loan Repayment" && visibleTransactions().includes(tx));
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title">
          <h2>${editing ? "Edit Loan Repayment" : "Record Loan Repayment"}</h2>
          ${editing ? `<button class="btn ghost" id="cancelRepaymentEdit" type="button">Cancel</button>` : ""}
        </div>
        <form id="repaymentForm" class="form-grid">
          ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ""}
          <div class="field full"><label>Loan</label>${loanSelect("loanId", editing?.ref)}</div>
          <div class="field"><label>Amount</label><input name="amount" type="number" min="0" step="0.01" value="${editing?.amount || ""}" required /></div>
          <div class="field"><label>Date</label><input name="date" type="date" value="${editing?.date || today()}" required /></div>
          <div class="field full"><label>Note</label><textarea name="note">${escapeHtml(editing?.note || "")}</textarea></div>
          <div class="form-actions full"><button class="btn" type="submit">${editing ? "Save repayment" : "Record repayment"}</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Repayment Summary</h2></div>
        <div class="calc-list">
          <div><span>Loan repaid</span><strong>${money(sumTransactions("Loan Repayment"))}</strong></div>
          <div><span>Interest paid</span><strong>${money(sumTransactions("Interest Payment"))}</strong></div>
          <div><span>Active loans</span><strong>${visibleLoans().filter((loan) => loan.status === "Active").length}</strong></div>
          <div><span>Outstanding loans</span><strong>${money(visibleLoans().reduce((sum, loan) => sum + Math.max(0, loan.totalDue - loan.amountPaid), 0))}</strong></div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Loan Repayment Records</h2><button class="btn ghost" data-export="repayments">Export CSV</button></div>
      ${renderLoanRepaymentsTable()}
    </div>
  `;
}

function renderLoanRepaymentsTable() {
  const rows = visibleTransactions().filter((tx) => tx.type === "Loan Repayment").slice().reverse();
  if (!rows.length) return `<div class="empty">No loan repayments recorded yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Location</th><th>Member</th><th>Loan</th><th>Amount</th><th>Officer</th><th></th></tr></thead>
        <tbody>
          ${rows.map((tx) => {
            const loan = state.loans.find((item) => item.id === tx.ref);
            const customer = state.customers.find((item) => item.id === tx.customerId);
            return `
              <tr>
                <td>${tx.date}</td>
                <td>${escapeHtml(groupName(customer?.groupId || loan?.groupId))}</td>
                <td>${escapeHtml(customerName(tx.customerId))}</td>
                <td>${loan ? `${money(loan.principal)} - balance ${money(Math.max(0, loan.totalDue - loan.amountPaid))}` : escapeHtml(tx.ref)}</td>
                <td>${money(tx.amount)}</td>
                <td>${escapeHtml(userName(tx.userId))}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn secondary" data-edit-repayment="${tx.id}">Edit</button>
                    <button class="btn danger" data-delete-repayment="${tx.id}">Delete</button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMemberLoansTable(loans) {
  if (!loans.length) return `<div class="empty">No loans recorded for this member.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Principal</th><th>Monthly Interest</th><th>Interest Schedule</th><th>Total Due</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>
          ${loans.map((loan) => `
            <tr>
              <td>${loan.date}</td>
              <td>${money(loan.principal)}</td>
              <td>${loan.interest}%<br><span class="muted">${money(monthlyInterestAmount(loan))}</span></td>
              <td>${renderInterestSchedule(loan)}</td>
              <td>${money(loan.totalDue)}</td>
              <td>${money(loan.amountPaid)}</td>
              <td>${money(Math.max(0, loan.totalDue - loan.amountPaid))}</td>
              <td><span class="pill ${loanStatusClass(loan.status)}">${loan.status}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderInterestSchedule(loan) {
  const schedule = ensureLoanInterestSchedule(loan);
  return `
    <div class="mini-list">
      ${schedule.map((item, index) => `<span>${index + 1}. ${item.date}: ${money(item.amount)}${item.status === "Paid" ? " paid" : ""}</span>`).join("")}
    </div>
  `;
}

function renderInterestPayments() {
  const rows = interestPaymentRows();
  const pending = rows.filter((row) => interestPaymentStatus(row.entry) !== "Paid");
  const overdue = rows.filter((row) => interestPaymentStatus(row.entry) === "Overdue");
  const paid = rows.filter((row) => interestPaymentStatus(row.entry) === "Paid");
  const pendingAmount = pending.reduce((sum, row) => sum + Number(row.entry.amount || 0), 0);
  const paidAmount = paid.reduce((sum, row) => sum + Number(row.entry.amount || 0), 0);

  return `
    <div class="grid four">
      <div class="stat"><small>Pending Interest</small><strong>${money(pendingAmount)}</strong></div>
      <div class="stat"><small>Pending Count</small><strong>${pending.length}</strong></div>
      <div class="stat"><small>Overdue</small><strong>${overdue.length}</strong></div>
      <div class="stat"><small>Paid Interest</small><strong>${money(paidAmount)}</strong></div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Interest Payment Schedule</h2>
        <button class="btn ghost" data-export="loans">Export CSV</button>
      </div>
      ${renderInterestPaymentsTable(rows)}
    </div>
  `;
}

function renderInterestPaymentsTable(rows = interestPaymentRows()) {
  if (!rows.length) return `<div class="empty">No interest schedules found yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Location</th><th>Member</th><th>Phone</th><th>Loan Date</th><th>Month</th><th>Due Date</th><th>Interest</th><th>Status</th><th>Paid Date</th><th></th></tr></thead>
        <tbody>
          ${rows.map(({ loan, entry, index }) => {
            const customer = state.customers.find((item) => item.id === loan.customerId);
            const status = interestPaymentStatus(entry);
            return `
              <tr>
                <td>${escapeHtml(groupName(loan.groupId))}</td>
                <td>${escapeHtml(customer?.name || customerName(loan.customerId))}<br><span class="muted">${money(loan.principal)} loan</span></td>
                <td>${escapeHtml(customer?.phone || "")}</td>
                <td>${loan.date}</td>
                <td>${entry.month || index + 1} of ${loan.interestMonths || ensureLoanInterestSchedule(loan).length}</td>
                <td>${entry.date}</td>
                <td>${money(entry.amount)}</td>
                <td><span class="pill ${status === "Overdue" ? "bad" : status === "Pending" ? "blue" : ""}">${status}</span></td>
                <td>${entry.paidAt || ""}</td>
                <td>${canManageLoans() ? (status !== "Paid" ? `<button class="btn secondary" data-pay-interest="${loan.id}|${index}">Pay Interest</button>` : `<button class="btn danger" data-undo-interest="${loan.id}|${index}">Undo</button>`) : ""}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMessages() {
  return `
    <div class="panel">
      <div class="section-title">
        <h2>Transaction Messages</h2>
        <div class="row-actions">
          <button class="btn" id="sendSelectedMessagesBtn">Send selected</button>
          <button class="btn secondary" id="markSelectedMessagesBtn">Mark sent</button>
          <button class="btn warning" id="cancelSelectedMessagesBtn">Cancel selected</button>
          <button class="btn ghost" data-export="messages">Export CSV</button>
          <button class="btn warning" id="cancelPendingMessagesBtn">Cancel pending</button>
          <button class="btn danger" id="clearMessagesBtn">Clear messages</button>
        </div>
      </div>
      ${renderMessagesTable()}
    </div>
  `;
}

function renderBackup() {
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Local Backup</h2></div>
        <p class="muted">Export a full copy of this system, or restore from a JSON backup file.</p>
        <div class="row-actions" style="margin-top:16px">
          <button class="btn" id="backupBtn">Export backup</button>
          <label class="btn secondary" for="restoreInput">Restore backup</label>
          <input id="restoreInput" type="file" accept="application/json" hidden />
        </div>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Cloud Backup</h2></div>
        <p class="muted">Use this to force a cloud save or restore when you need the phone and computer to match immediately.</p>
        <div class="row-actions" style="margin-top:16px">
          <button class="btn" id="pushCloudBackup">Back up to cloud</button>
          <button class="btn secondary" id="pullCloudBackup">Restore cloud backup</button>
          <button class="btn warning" id="replaceCloudBackup">Replace this device from cloud</button>
        </div>
        <div class="notice good">Automatic cloud sync still runs when internet is available.</div>
      </div>
      ${renderInitialCloudSnapshotPanel()}
    </div>
    ${renderSynchronizationExtras()}
    ${renderJobEngineExtras()}
    ${renderMonitoringEngineExtras()}
    ${renderGatewayEngineExtras()}
    ${renderRecoveryEngineExtras()}
  `;
}

function renderInitialCloudSnapshotPanel() {
  if (getSyncMode(state) !== "supabase" || !canWriteSnapshot(currentUser()?.role)) return "";
  return `
      <div class="panel">
        <div class="section-title"><h2>Initial Cloud Snapshot</h2></div>
        <p class="muted">Only needed once, when this business has no cloud copy yet. It loads the business from the database, checks it, and creates the first authoritative synchronized copy from that data only. Data already stored on this device is not uploaded.</p>
        <div class="row-actions" style="margin-top:16px">
          <button class="btn warning" id="createInitialCloudSnapshot">Create Initial Cloud Snapshot</button>
        </div>
      </div>`;
}

function renderSynchronizationExtras() {
  const user = currentUser();
  ensureSyncState(state);
  ensureWave4SyncState(state);
  const device = (state.devices || []).find((item) => item.fingerprint === deviceFingerprint());
  const online = navigator.onLine;
  const dash = wave4SyncDashboard(state, { online, deviceId: device?.id });
  const ux = resolveCollectorOfflineUx(state, {
    online,
    synchronizing: state.syncMeta?.status === "synchronizing",
    failed: state.syncMeta?.status === "synchronization_failed"
  });
  const escalation = evaluateOfflineEscalation({
    offlineDurationHours: state.wave4Sync?.offlineSince ? (Date.now() - Date.parse(state.wave4Sync.offlineSince)) / 3600000 : 0,
    queueSize: dash.pending,
    syncSuccessPct: 100,
    openConflicts: dash.conflicts
  });
  const eod = evaluateEodDecision({ pendingCount: dash.pending, online });
  const startOfDay = evaluateDecisionFlow({ flow: "start_of_day", online });
  return renderSyncExtras({
    stats: dash,
    rows: queueViewerRows(state),
    conflicts: state.syncConflicts || [],
    devices: state.devices || [],
    receipts: state.localReceipts || [],
    sessions: state.syncSessions || [],
    network: connectivityStatus({
      online,
      synchronizing: state.syncMeta?.status === "synchronizing",
      failed: state.syncMeta?.status === "synchronization_failed",
      effectiveType: navigator.connection?.effectiveType || ""
    }),
    canRetry: canAction(user, "Sync.Retry"),
    canResolve: canAction(user, "Sync.Resolve"),
    identifierStats: identifierDashboard(state),
    delegations: state.identifierDelegations || [],
    canDelegate: canAction(user, "Identifier.Delegate") || canAction(user, "Settings.Edit"),
    canApproveDelegation: canAction(user, "Identifier.Approve") || isSystemOwner(),
    wave4PlatformHtml: renderOfflineSyncPlatformPanel({ dashboard: dash, ux, escalation, eod, startOfDay }),
    wave6DesktopHtml:
      renderDesktopShellStatus({
        runtime: getElectronRuntime(),
        smoke: wave6SmokeChecklist(state),
        gaps: analyzeWave6Gaps(state, { user }),
        screenshot: desktopScreenshotGuidance()
      }) + renderWave6ParityChecklist(WAVE6_PARITY_CHECKLIST)
  });
}

function renderPaymentEngineExtras() {
  const user = currentUser();
  ensurePaymentState(state);
  const query = sessionStorage.getItem("payment_search_q") || "";
  const method = sessionStorage.getItem("payment_search_method") || "";
  const detailId = sessionStorage.getItem("payment_detail_id") || "";
  const payments = searchPayments(state, { q: query, method });
  return renderPaymentCollectionExtras({
    stats: paymentDashboard(state, { date: today() }),
    payments,
    queue: state.paymentQueue || [],
    callbacks: state.paymentCallbacks || [],
    health: state.providerHealth || [],
    methods: (state.paymentMethods || []).filter((item) => item.enabled !== false).map((item) => item.name),
    query,
    detail: detailId ? paymentDetail(state, detailId) : null,
    canRefund: canAction(user, "Payment.Refund"),
    canReverse: canAction(user, "Payment.Reverse"),
    canView: canAction(user, "Payment.View") || canAction(user, "Savings.Collect") || canAction(user, "Accounting.View")
  });
}

function renderPaymentProviderBlock() {
  const user = currentUser();
  if (!canAction(user, "Payment.Provider") && !canAction(user, "Settings.Edit")) return "";
  ensurePaymentState(state);
  return renderPaymentProviderExtras({
    providers: state.paymentProviders || [],
    methods: state.paymentMethods || [],
    canManage: true
  });
}

function renderPaymentReportsBlock() {
  return renderPaymentReportsExtra({
    reports: [
      { id: "payments_daily", label: "Daily collections" },
      { id: "payments_momo", label: "Mobile Money" },
      { id: "payments_bank", label: "Bank transfer" },
      { id: "payments_settlement", label: "Settlements" },
      { id: "payments_reconciliation", label: "Reconciliation" },
      { id: "payments_failed", label: "Failed payments" },
      { id: "payments_refunds", label: "Refunds" },
      { id: "payments_reversals", label: "Reversals" },
      { id: "payments_provider", label: "Provider performance" },
      { id: "payments_methods", label: "Method analysis" },
      { id: "payments_outstanding_settlements", label: "Outstanding settlements" }
    ]
  });
}

function downloadPaymentReport(reportId) {
  const range = reportDateRange();
  const report = paymentReports(state, reportId, range);
  if (!(report.rows || []).length) {
    toast("No payment rows for this report");
    return;
  }
  downloadCsv(`${reportId}.csv`, report.rows);
}

function renderDocumentEngineExtras() {
  const user = currentUser();
  ensureDocumentState(state);
  const query = sessionStorage.getItem("document_search_q") || "";
  const detailId = sessionStorage.getItem("document_detail_id") || "";
  return renderDocumentCollectionExtras({
    stats: documentDashboard(state),
    documents: searchDocuments(state, { q: query }),
    pending: (state.offlineReceipts || []).filter((item) => !["reconciled", "cancelled"].includes(item.status)),
    mappings: state.receiptReconciliation || [],
    query,
    detail: detailId ? documentDetail(state, detailId) : null,
    canView: canAction(user, "Document.View") || canAction(user, "Savings.Collect") || canAction(user, "Accounting.View"),
    canGenerate: canAction(user, "Document.Generate") || canAction(user, "Savings.Collect")
  });
}

function renderDocumentTemplateBlock() {
  const user = currentUser();
  ensureDocumentState(state);
  return renderDocumentTemplateExtras({
    templates: state.documentTemplates || [],
    canManage: canAction(user, "Document.Template") || canAction(user, "Settings.Edit") || isSystemOwner()
  });
}

function renderDocumentReportsBlock() {
  return renderDocumentReportsExtra({
    reports: [
      { id: "documents_issued", label: "Issued documents" },
      { id: "documents_offline_pending", label: "Pending offline" },
      { id: "documents_reconciled", label: "Reconciled" },
      { id: "documents_rejected", label: "Rejected" },
      { id: "documents_mapping", label: "Mapping history" },
      { id: "documents_approvals", label: "Approvals" },
      { id: "documents_delivery", label: "Delivery" }
    ]
  });
}

function downloadDocumentReport(reportId) {
  const range = reportDateRange();
  const report = documentReports(state, reportId, range);
  if (!(report.rows || []).length) {
    toast("No document rows for this report");
    return;
  }
  download(`${reportId}.csv`, exportDocumentCsv(report), "text/csv");
}

function renderJobEngineExtras() {
  const user = currentUser();
  ensureJobState(state);
  const query = sessionStorage.getItem("job_search_q") || "";
  const detailId = sessionStorage.getItem("job_detail_id") || "";
  return renderJobBackupExtras({
    stats: jobDashboard(state),
    jobs: searchJobs(state, { q: query }),
    workers: state.workerNodes || [],
    schedules: state.jobSchedules || [],
    deadLetters: state.deadLetterQueue || [],
    approvals: state.jobApprovals || [],
    dependencies: state.jobDependencies || [],
    query,
    detail: detailId ? jobDetail(state, detailId) : null,
    canView: canAction(user, "Job.View") || isSystemOwner(),
    canRun: canAction(user, "Job.Run") || isSystemOwner(),
    canRetry: canAction(user, "Job.Retry") || canAction(user, "Job.Run") || isSystemOwner(),
    canReplay: canAction(user, "Job.Replay") || isSystemOwner(),
    canApprove: canAction(user, "Job.Approve") || isSystemOwner(),
    canSchedule: canAction(user, "Job.Schedule") || isSystemOwner()
  });
}

function renderJobReportsBlock() {
  return renderJobReportsExtra({
    reports: [
      { id: "jobs_queued", label: "Queued jobs" },
      { id: "jobs_failed", label: "Failed jobs" },
      { id: "jobs_dlq", label: "Dead letter" },
      { id: "jobs_workers", label: "Workers" },
      { id: "jobs_history", label: "History" },
      { id: "jobs_approvals", label: "Approvals" }
    ]
  });
}

function renderMonitoringEngineExtras() {
  const user = currentUser();
  ensureMonitoringState(state);
  return renderMonitoringBackupExtras({
    stats: monitoringDashboard(state),
    domains: state.healthChecks.slice(-12),
    alerts: state.monitoringAlerts || [],
    incidents: state.incidents || [],
    devices: state.deviceHealthSnapshots || [],
    logs: state.logEntries || [],
    traces: state.traces || [],
    forecast: capacityForecast(state, "collections", 3),
    business: businessMetrics(state, { date: today() }),
    canView: canAction(user, "Monitor.View") || isSystemOwner(),
    canAlert: canAction(user, "Monitor.Alert") || isSystemOwner(),
    canIncident: canAction(user, "Monitor.Incident") || isSystemOwner(),
    canDiagnose: canAction(user, "Monitor.Diagnose") || isSystemOwner()
  });
}

function renderMonitoringExecutiveBlock() {
  const user = currentUser();
  if (!canAction(user, "Monitor.View") && !isSystemOwner()) return "";
  ensureMonitoringState(state);
  return renderMonitoringExecutiveExtras({
    stats: monitoringDashboard(state),
    canView: true
  });
}

function renderMonitoringReportsBlock() {
  return renderMonitoringReportsExtra({
    reports: [
      { id: "monitor_health", label: "System health" },
      { id: "monitor_alerts", label: "Alerts" },
      { id: "monitor_incidents", label: "Incidents" },
      { id: "monitor_devices", label: "Android devices" }
    ]
  });
}

function renderGatewayEngineExtras() {
  const user = currentUser();
  ensureGatewayState(state);
  return renderGatewayBackupExtras({
    stats: gatewayDashboard(state),
    clients: state.apiClients || [],
    keys: (state.apiKeys || []).filter((item) => item.status === "active"),
    webhooks: state.webhookSubscriptions || [],
    requests: state.apiRequests || [],
    spec: generateOpenApiSpec(state),
    canView: canAction(user, "Gateway.View") || isSystemOwner(),
    canClient: canAction(user, "Gateway.Client") || isSystemOwner(),
    canKey: canAction(user, "Gateway.Key") || isSystemOwner(),
    canWebhook: canAction(user, "Gateway.Webhook") || isSystemOwner()
  });
}

function renderGatewayReportsBlock() {
  return renderGatewayReportsExtra({
    reports: [
      { id: "gateway_requests", label: "Gateway requests" },
      { id: "gateway_usage", label: "Usage by client" },
      { id: "gateway_webhooks", label: "Webhooks" }
    ]
  });
}

function renderRecoveryEngineExtras() {
  const user = currentUser();
  ensureBackupRecoveryState(state);
  return renderRecoveryBackupExtras({
    stats: backupDashboard(state),
    sets: state.backupSets || [],
    restores: state.restoreRequests || [],
    tests: state.recoveryTests || [],
    sites: state.disasterRecoverySites || [],
    canView: canAction(user, "Backup.Create") || canAction(user, "Backup.Verify") || canAction(user, "System.Backup") || canAction(user, "DR.View") || isSystemOwner(),
    canCreate: canAction(user, "Backup.Create") || canAction(user, "System.Backup") || isSystemOwner(),
    canRestore: canAction(user, "Backup.Restore") || canAction(user, "System.Restore") || isSystemOwner(),
    canApprove: canAction(user, "Backup.Approve") || isSystemOwner(),
    canTest: canAction(user, "Backup.Test") || canAction(user, "Backup.Verify") || isSystemOwner()
  });
}

function renderRecoveryReportsBlock() {
  return renderRecoveryReportsExtra({
    reports: [
      { id: "backup_jobs", label: "Backup jobs" },
      { id: "restore_history", label: "Restore history" },
      { id: "recovery_tests", label: "Recovery tests" },
      { id: "rto_rpo", label: "RTO / RPO" }
    ]
  });
}

function renderSecurityEngineExtras() {
  const user = currentUser();
  ensureSecurityState(state);
  return renderSecurityAuditExtras({
    stats: securityDashboard(state),
    incidents: state.securityIncidents || [],
    scores: state.riskScores || [],
    fraud: state.fraudCases || [],
    canView: canAction(user, "Security.View") || canAction(user, "Audit.View") || isSystemOwner(),
    canEvaluate: canAction(user, "Security.Evaluate") || isSystemOwner(),
    canIncident: canAction(user, "Security.Incident") || isSystemOwner(),
    schema: schemaDashboard(state)
  });
}

function renderSecurityReportsBlock() {
  return renderSecurityReportsExtra({
    reports: [
      { id: "security_incidents", label: "Incidents" },
      { id: "fraud_cases", label: "Fraud cases" },
      { id: "risk_scores", label: "Risk scores" },
      { id: "contract_invocations", label: "Contract calls" }
    ]
  });
}

function renderWorkflowEngineExtras() {
  const user = currentUser();
  ensureWorkflowState(state);
  return renderWorkflowAuditExtras({
    stats: workflowDashboard(state),
    inbox: taskInbox(state, user),
    instances: state.workflowInstances || [],
    cases: state.businessCases || [],
    definitions: (state.workflowDefinitions || []).filter((item) => item.status === "published"),
    canView: canAction(user, "Workflow.View") || canAction(user, "Audit.View") || isSystemOwner(),
    canStart: canAction(user, "Workflow.Start") || isSystemOwner(),
    canApprove: canAction(user, "Workflow.Approve") || isSystemOwner(),
    canCase: canAction(user, "Workflow.Case") || isSystemOwner()
  });
}

function renderWorkflowReportsBlock() {
  return renderWorkflowReportsExtra({
    reports: [
      { id: "workflow_active", label: "Active workflows" },
      { id: "workflow_completed", label: "Completed" },
      { id: "workflow_sla", label: "SLA" },
      { id: "workflow_cases", label: "Cases" },
      { id: "workflow_escalations", label: "Escalations" }
    ]
  });
}

function renderRuleEngineExtras() {
  const user = currentUser();
  ensureRuleState(state);
  return renderRuleAuditExtras({
    stats: ruleDashboard(state),
    definitions: state.ruleDefinitions || [],
    history: state.ruleExecutionHistory || [],
    canView: canAction(user, "Rule.View") || canAction(user, "Audit.View") || isSystemOwner(),
    canTest: canAction(user, "Rule.Test") || canAction(user, "Rule.View") || isSystemOwner(),
    canSimulate: canAction(user, "Rule.Simulate") || isSystemOwner(),
    canPublish: canAction(user, "Rule.Publish") || isSystemOwner()
  });
}

function renderRuleReportsBlock() {
  return renderRuleReportsExtra({
    reports: [
      { id: "rules_frequency", label: "Frequency" },
      { id: "rules_latency", label: "Latency" },
      { id: "rules_coverage", label: "Coverage" },
      { id: "rules_decisions", label: "Decisions" },
      { id: "rules_versions", label: "Versions" }
    ]
  });
}

function renderExchangeEngineExtras() {
  const user = currentUser();
  ensureExchangeState(state);
  return renderExchangeAuditExtras({
    stats: exchangeDashboard(state),
    imports: state.importJobs || [],
    exports: state.exportJobs || [],
    errors: state.validationErrors || [],
    canView: canAction(user, "Exchange.View") || canAction(user, "Audit.View") || isSystemOwner(),
    canImport: canAction(user, "Exchange.Import") || isSystemOwner(),
    canExport: canAction(user, "Exchange.Export") || canAction(user, "Export.Customers") || isSystemOwner(),
    canApprove: canAction(user, "Exchange.Approve") || isSystemOwner()
  });
}

function renderExchangeReportsBlock() {
  return renderExchangeReportsExtra({
    reports: [
      { id: "exchange_imports", label: "Imports" },
      { id: "exchange_exports", label: "Exports" },
      { id: "exchange_validation", label: "Validation" },
      { id: "exchange_reconciliation", label: "Reconciliation" },
      { id: "exchange_history", label: "History" }
    ]
  });
}

function renderRecordsEngineExtras() {
  const user = currentUser();
  ensureRecordsState(state);
  return renderRecordsAuditExtras({
    stats: recordsDashboard(state, user),
    records: state.digitalRecords || [],
    holds: state.digitalRecordLegalHolds || [],
    canView: canAction(user, "Records.View") || canAction(user, "Audit.View") || isSystemOwner(),
    canUpload: canAction(user, "Records.Upload") || isSystemOwner(),
    canArchive: canAction(user, "Records.Archive") || isSystemOwner(),
    canHold: canAction(user, "Records.Hold") || isSystemOwner()
  });
}

function renderRecordsReportsBlock() {
  return renderRecordsReportsExtra({
    reports: [
      { id: "records_library", label: "Library" },
      { id: "records_access", label: "Access" },
      { id: "records_retention", label: "Retention" },
      { id: "records_holds", label: "Holds" },
      { id: "records_archives", label: "Archives" }
    ]
  });
}

function renderEnterpriseBiExtras() {
  const user = currentUser();
  ensureBiState(state);
  return renderBiAuditExtras({
    stats: biDashboard(state, reportDateRange(), user, uid),
    kpis: state.kpiDefinitions || [],
    metrics: state.metricDefinitions || [],
    canView: canAction(user, "Bi.View") || canAction(user, "Reports.Executive") || canAction(user, "Audit.View") || isSystemOwner(),
    canCalculate: canAction(user, "Bi.View") || canAction(user, "Bi.Kpi") || isSystemOwner(),
    canPublish: canAction(user, "Bi.Publish") || isSystemOwner()
  });
}

function renderEnterpriseBiReportsBlock() {
  return renderBiRegistryReportsExtra({
    reports: [
      { id: "bi_metrics", label: "Metrics" },
      { id: "bi_kpis", label: "KPIs" },
      { id: "bi_schemas", label: "Schemas" },
      { id: "bi_calculations", label: "Calculations" },
      { id: "bi_metric_history", label: "Metric history" }
    ]
  });
}

function renderIntegrationHubExtras() {
  const user = currentUser();
  ensureIntegrationState(state);
  const dash = integrationDashboard(state, user, uid);
  return renderIntegrationAuditExtras({
    stats: dash,
    providers: state.integrationProviders || [],
    webhooks: state.integrationWebhooks || [],
    clients: state.integrationApiClients || [],
    transforms: state.integrationTransforms || [],
    queues: dash.health?.queues || [],
    delivery: dash.delivery || {},
    canView: canAction(user, "Integration.View") || canAction(user, "Audit.View") || canAction(user, "Reports.View") || isSystemOwner(),
    canAdmin: canAction(user, "Integration.Admin") || isSystemOwner(),
    canWebhook: canAction(user, "Integration.Webhook") || canAction(user, "Integration.Admin") || isSystemOwner(),
    canProvider: canAction(user, "Integration.Provider") || canAction(user, "Integration.Admin") || isSystemOwner()
  });
}

function renderIntegrationReportsBlock() {
  return renderIntegrationReportsExtra({
    reports: [
      { id: "integration_providers", label: "Providers" },
      { id: "integration_webhooks", label: "Webhooks" },
      { id: "integration_clients", label: "Clients" },
      { id: "integration_usage", label: "Usage" },
      { id: "integration_queues", label: "Queues" },
      { id: "integration_delivery", label: "Delivery" },
      { id: "integration_ownership", label: "Ownership" }
    ]
  });
}

function renderEnterpriseAiExtras() {
  const user = currentUser();
  ensureAiState(state);
  const dash = aiDashboard(state, user, uid);
  return renderAiAuditExtras({
    stats: dash,
    models: state.aiModels || [],
    fraudAlerts: (state.aiFraudAlerts || []).filter((item) => item.status === "open"),
    recommendations: state.aiRecommendationHistory || [],
    driftEvents: (state.aiDriftEvents || []).filter((item) => item.status === "open"),
    predictions: state.aiPredictionResults || [],
    canView: canAction(user, "Ai.View") || canAction(user, "Audit.View") || canAction(user, "Reports.View") || isSystemOwner(),
    canPredict: canAction(user, "Ai.Predict") || isSystemOwner(),
    canGovern: canAction(user, "Ai.Govern") || isSystemOwner(),
    canAdmin: canAction(user, "Ai.Admin") || isSystemOwner()
  });
}

function renderEnterpriseAiReportsBlock() {
  return renderAiReportsExtra({
    reports: [
      { id: "ai_models", label: "Models" },
      { id: "ai_features", label: "Features" },
      { id: "ai_datasets", label: "Datasets" },
      { id: "ai_predictions", label: "Predictions" },
      { id: "ai_fraud", label: "Fraud" },
      { id: "ai_forecasts", label: "Forecasts" },
      { id: "ai_recommendations", label: "Recommendations" },
      { id: "ai_drift", label: "Drift" },
      { id: "ai_governance", label: "Governance" },
      { id: "ai_audit", label: "AI Audit" }
    ]
  });
}

function renderPlatformAdminExtras() {
  const user = currentUser();
  ensurePlatformState(state);
  const dash = platformOpsDashboard(state, user, uid);
  return renderPlatformAuditExtras({
    stats: dash,
    tenants: state.platformTenants || [],
    licenses: state.platformLicenses || [],
    flags: state.featureFlags || [],
    deployments: state.platformDeploymentHistory || [],
    maintenance: state.platformMaintenanceWindows || [],
    environments: state.platformEnvironmentRegistry || [],
    announcements: state.platformGlobalAnnouncements || [],
    configHistory: state.platformConfigurationHistory || [],
    dr: dash.dr || {},
    canView: canAction(user, "Platform.View") || canAction(user, "Audit.View") || canAction(user, "Reports.View") || isSystemOwner(),
    canTenant: canAction(user, "Platform.Tenant") || isSystemOwner(),
    canFlag: canAction(user, "Platform.Flag") || isSystemOwner(),
    canLicense: canAction(user, "Platform.License") || isSystemOwner(),
    canDeploy: canAction(user, "Platform.Deploy") || isSystemOwner(),
    canMaintenance: canAction(user, "Platform.Maintenance") || isSystemOwner(),
    canAdmin: canAction(user, "Platform.Admin") || isSystemOwner()
  });
}

function renderWave5AdminPortalExtras() {
  const user = currentUser();
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const gaps = analyzeWave5Gaps(state, { user });
  const mon = buildOpsMonitoringModel(state, { user, online });
  let searchQuery = "";
  let searchFilters = {};
  let searchResults = null;
  try {
    searchQuery = sessionStorage.getItem("wave5_search_q") || "";
    searchFilters = JSON.parse(sessionStorage.getItem("wave5_search_filters") || "{}");
    searchResults = JSON.parse(sessionStorage.getItem("wave5_search_results") || "null");
  } catch {
    searchResults = null;
  }
  const canSearch = canAction(user, "Customer.View") || canAction(user, "Audit.View") || canAction(user, "Reports.View") || isSystemOwner();
  return `
    ${renderOpsMonitoringPanel(mon)}
    ${renderAdminPortalChecklist(gaps)}
    ${renderModuleScreenMap(WAVE5_MODULE_SCREEN_MAP)}
    ${renderPortalGlobalSearchPanel({
      query: searchQuery,
      filters: searchFilters,
      results: searchResults,
      canSearch
    })}
  `;
}

function renderWave5ReportsExtras() {
  const user = currentUser();
  let kpis = null;
  try {
    kpis = JSON.parse(sessionStorage.getItem("wave5_api_kpis") || "null");
  } catch {
    kpis = null;
  }
  const mon = buildOpsMonitoringModel(state, {
    user,
    online: typeof navigator === "undefined" ? true : navigator.onLine
  });
  return `
    ${renderOpsMonitoringPanel(mon)}
    ${kpis ? renderPortalApiKpiStrip(kpis) : `<div class="panel" style="margin-top:18px"><p class="muted">Wave 5 API KPIs - use <strong>Refresh API KPIs</strong> on the ops panel (or below) to load dashboards.summary / collections.daily via invokeApi.</p><button class="btn secondary" type="button" id="wave5RefreshKpisBtn" aria-label="Refresh dashboard KPIs via API">Refresh API KPIs</button></div>`}
  `;
}

function bindWave5AdminPortalHandlers() {
  document.querySelectorAll("details.wave5-lazy-panel[data-lazy-panel]").forEach((el) => {
    el.addEventListener("toggle", () => {
      const registry = loadLazyPanelState();
      const id = el.getAttribute("data-lazy-panel");
      if (el.open) registry.open(id);
      else registry.close(id);
      persistLazyPanelState(registry);
    });
  });

  document.querySelector("#wave5RefreshOpsBtn")?.addEventListener("click", () => {
    toast("Operations monitoring refreshed");
    render();
  });

  document.querySelector("#wave5RefreshKpisBtn")?.addEventListener("click", () => {
    void (async () => {
      const gate = assertPortalAction(currentUser(), "Reports.View");
      if (!gate.ok && !assertPortalAction(currentUser(), "Monitor.View").ok) {
        toast(gate.error || "Permission denied");
        return;
      }
      const kpis = await portalDashboardKpis(state, { user: currentUser(), uid, now: new Date().toISOString() });
      sessionStorage.setItem("wave5_api_kpis", JSON.stringify(kpis));
      toast(kpis.ok ? "API KPIs loaded" : "API KPIs partially loaded");
      render();
    })();
  });

  document.querySelector("#wave5RunSearchBtn")?.addEventListener("click", () => {
    document.querySelector("#wave5SearchQ")?.focus();
    document.querySelector("#wave5GlobalSearchForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  document.querySelector("#wave5GlobalSearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void (async () => {
      const data = formData(event.target);
      const gate = assertPortalAction(currentUser(), "Customer.View");
      if (!gate.ok && !isSystemOwner()) {
        toast(gate.error || "Permission denied");
        return;
      }
      const results = await portalGlobalSearch(state, {
        q: data.q || "",
        branchId: data.branchId || "",
        status: data.status || ""
      }, { user: currentUser(), uid, now: new Date().toISOString() });
      if (data.status || data.branchId) {
        results.customers = applyPortalAdvancedFilters(results.customers || [], {
          status: data.status,
          branchId: data.branchId,
          q: ""
        }, { user: currentUser() });
      }
      sessionStorage.setItem("wave5_search_q", data.q || "");
      sessionStorage.setItem("wave5_search_filters", JSON.stringify({ branchId: data.branchId || "", status: data.status || "" }));
      sessionStorage.setItem("wave5_search_results", JSON.stringify(results));
      toast(`${results.totalHits || 0} search hit(s)`);
      render();
    })();
  });
}

function renderWave7AnalyticsExtras() {
  const user = currentUser();
  ensureWave7State(state, uid);
  const smoke = wave7SmokeChecklist(state, { user });
  const gaps = analyzeWave7Gaps(state, { user });
  let executive = {};
  let fraudFindings = [];
  let forecasts = [];
  let insights = [];
  try {
    executive = JSON.parse(sessionStorage.getItem("wave7_executive") || "{}") || {};
  } catch {
    executive = {};
  }
  fraudFindings = (state.wave7FraudFindings || []).filter((f) => f.status === "open").slice(-20).reverse();
  forecasts = (state.wave7ForecastLog || []).slice(-10).reverse();
  insights = (state.wave7InsightLog || []).slice(-10).reverse();
  return `
    ${renderWave7AnalyticsPanel({
      smoke,
      gaps,
      executive,
      fraudFindings,
      forecasts,
      insights,
      canView: canAction(user, "Reports.View") || canAction(user, "Bi.View") || canAction(user, "Audit.View") || canAction(user, "Ai.View") || isSystemOwner(),
      canPredict: canAction(user, "Ai.Predict") || isSystemOwner(),
      canExport: canAction(user, "Reports.View") || canAction(user, "Reports.Print") || isSystemOwner(),
      canAudit: canAction(user, "Reports.Audit") || canAction(user, "Audit.View") || canAction(user, "Security.View") || isSystemOwner()
    })}
    ${renderWave7ParityChecklist(WAVE7_PARITY_CHECKLIST)}
  `;
}

function renderWave7ReportsExtras() {
  const user = currentUser();
  ensureWave7State(state, uid);
  return `
    ${renderWave7AnalyticsExtras()}
    ${renderWave7ReportsExtra({
      catalog: listWave7ReportCatalog(user),
      regulatory: WAVE7_REGULATORY_TEMPLATES,
      framework: reportingFrameworkMeta()
    })}
  `;
}

function bindWave7AnalyticsHandlers() {
  document.querySelector('[data-action="wave7-refresh-kpis"]')?.addEventListener("click", () => {
    const range = reportDateRange();
    const result = calculateWave7Kpis(state, range, currentUser(), uid);
    if (!result.ok) {
      toast(result.error || "KPI calculation failed");
      return;
    }
    const exec = executiveDashboard(state, { roleKey: "CEO", range, user: currentUser(), uid });
    try {
      sessionStorage.setItem("wave7_executive", JSON.stringify(exec.ok ? exec : { kpis: result.dashboard || {} }));
    } catch {
      /* ignore quota */
    }
    saveState();
    toast(`Wave 7 KPIs refreshed (${Object.keys(result.dashboard || {}).length} canonical)`);
    render();
  });

  document.querySelector('[data-action="wave7-ai-insights"]')?.addEventListener("click", () => {
    const result = routeAiInsight(state, { text: "growth kpi recommendations", intent: "recommend" }, currentUser(), uid);
    saveState();
    toast(result.ok ? "Advisory AI insight recorded (audited)" : (result.error || "AI insight blocked"));
    render();
  });

  document.querySelector('[data-action="wave7-fraud-scan"]')?.addEventListener("click", () => {
    const result = runWave7FraudScan(state, { includeAi: true }, currentUser(), uid);
    saveState();
    toast(result.ok ? `Fraud scan complete (${result.count || 0} finding(s))` : (result.error || "Fraud scan blocked"));
    render();
  });

  document.querySelector('[data-action="wave7-forecast-30d"]')?.addEventListener("click", () => {
    const result = runWave7Forecast(state, { horizon: "30d", method: "moving_average", range: reportDateRange() }, currentUser(), uid);
    saveState();
    toast(result.ok ? "30d advisory forecast recorded" : (result.error || "Forecast blocked"));
    render();
  });

  document.querySelector('[data-action="wave7-export-exec"]')?.addEventListener("click", () => {
      const result = exportWave7Report(state, "collections_daily", {
      user: currentUser(),
      format: "json",
      mask: true,
      uid,
      ...reportDateRange()
    });
    if (!result.ok) {
      toast(result.error || "Export forbidden");
      return;
    }
    saveState();
    download(`wave7-collections-daily.json`, result.body, result.contentType || "application/json");
    toast("Wave 7 export downloaded (masked)");
  });

  document.querySelectorAll("[data-wave7-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = exportWave7Report(state, button.dataset.wave7Report, {
        user: currentUser(),
        format: "csv",
        mask: true,
        uid,
        ...reportDateRange()
      });
      if (!result.ok) {
        toast(result.error || "Report export failed");
        return;
      }
      saveState();
      download(`${button.dataset.wave7Report}.csv`, result.body, result.contentType || "text/csv");
      toast("Report exported");
    });
  });

  document.querySelectorAll("[data-wave7-reg]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = generateRegulatoryReport(state, button.dataset.wave7Reg, {
        user: currentUser(),
        range: reportDateRange(),
        uid
      });
      if (!result.ok) {
        toast(result.error || "Regulatory template blocked");
        return;
      }
      saveState();
      download(`${button.dataset.wave7Reg}.json`, JSON.stringify(result.report, null, 2), "application/json");
      toast("Regulatory summary generated");
    });
  });
}

function renderWave8CertificationExtras(opts = {}) {
  const user = currentUser();
  const canView = canAction(user, "Audit.View") || canAction(user, "Reports.View") || canAction(user, "Reports.Audit") || isSystemOwner();
  if (!canView) return "";
  const smoke = wave8SmokeChecklist();
  const gaps = analyzeWave8Gaps();
  let evidence = null;
  try {
    evidence = JSON.parse(sessionStorage.getItem("wave8_last_rc") || "null");
  } catch {
    evidence = null;
  }
  if (!evidence) {
    evidence = loadLastRcEvidence();
  }
  return `
    ${renderWave8CertificationPanel({
      smoke,
      gaps,
      evidence,
      surface: opts.surface || "audit",
      canView
    })}
    ${renderWave8ParityChecklist(WAVE8_PARITY_CHECKLIST)}
  `;
}

function bindWave8CertificationHandlers() {
  document.querySelector('[data-action="wave8-refresh-rc"]')?.addEventListener("click", () => {
    const evidence = loadLastRcEvidence();
    try {
      sessionStorage.setItem("wave8_last_rc", JSON.stringify(evidence || { decision: "unknown", note: "Run npm run validate:rc to generate evidence" }));
    } catch {
      /* ignore */
    }
    toast(evidence ? `RC evidence loaded (${evidence.decision || evidence.passFail || "n/a"})` : "No RC evidence yet - run npm run validate:rc");
    render();
  });
}

function renderWave9PilotExtras(opts = {}) {
  const user = currentUser();
  const canView = canAction(user, "Audit.View") || canAction(user, "Reports.View") || canAction(user, "Reports.Audit") || isSystemOwner();
  if (!canView) return "";
  const smoke = wave9SmokeChecklist();
  const gaps = analyzeWave9Gaps();
  let evidence = null;
  try {
    evidence = JSON.parse(sessionStorage.getItem("wave9_last_pilot") || "null");
  } catch {
    evidence = null;
  }
  if (!evidence) {
    evidence = loadLastPilotEvidence();
  }
  const runSheet = getOrCreateRunSheet();
  const scenarios = mergeRunSheetIntoScenarioRows(evidence?.uatMatrix?.scenarios || [], runSheet);
  const opsRows = evidence?.operationalReadiness?.checks || [];
  const envRows = evidence?.pilotEnvironment?.checklist || [];
  const feedback = evidence?.feedbackRegister || [];
  const issues = evidence?.issueRegister || [];
  return `
    ${renderWave9PilotPanel({
      smoke,
      gaps,
      evidence,
      surface: opts.surface || "audit",
      canView
    })}
    ${renderWave9UatTracker(scenarios)}
    ${renderWave9UatRecorder({ runSheet, canRecord: canView })}
    ${renderWave9TrainingRecorder({ runSheet: getOrCreateTrainingRunSheet(), canRecord: canView })}
    ${renderWave9ReconRecorder({ runSheet: getOrCreateReconRunSheet(), canRecord: canView })}
    ${renderWave9SecurityRecorder({ runSheet: getOrCreateSecurityRunSheet(), canRecord: canView })}
    ${renderWave9ExecutiveRecorder({ runSheet: getOrCreateExecutiveRunSheet(), canRecord: canView })}
    ${renderWave9Readiness(opsRows, envRows)}
    ${renderWave9Feedback(feedback, issues)}
    ${renderWave9GoNoGoSummary(evidence)}
    ${renderWave9ParityChecklist(WAVE9_PARITY_CHECKLIST)}
  `;
}

function bindWave9PilotHandlers() {
  document.querySelector('[data-action="wave9-refresh-pilot"]')?.addEventListener("click", () => {
    const evidence = loadLastPilotEvidence();
    try {
      sessionStorage.setItem(
        "wave9_last_pilot",
        JSON.stringify(
          evidence || {
            goNoGo: { decision: "unknown" },
            note: "Run npm run validate:pilot to generate evidence"
          }
        )
      );
    } catch {
      /* ignore */
    }
    toast(
      evidence
        ? `Pilot evidence loaded (${evidence.goNoGo?.decision || "n/a"})`
        : "No pilot evidence yet - run npm run validate:pilot"
    );
    render();
  });

  document.querySelectorAll('[data-action="wave9-uat-save"]').forEach((button) => {
    button.addEventListener("click", () => {
      const scenarioId = button.getAttribute("data-scenario-id");
      if (!scenarioId) return;
      const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(scenarioId) : scenarioId.replace(/"/g, '\\"');
      const passFailEl = document.querySelector(`[data-uat-passfail="${esc}"]`);
      const notesEl = document.querySelector(`[data-uat-notes="${esc}"]`);
      const executorEl = document.querySelector(`[data-uat-executor="${esc}"]`);
      const runSheet = getOrCreateRunSheet();
      const result = recordScenarioExecution(runSheet, scenarioId, {
        passFail: passFailEl?.value,
        notes: notesEl?.value,
        executedBy: executorEl?.value || currentUser()?.name || currentUser()?.username || "operator"
      });
      if (!result.ok) {
        toast(result.error === "pass_fail_required" ? "Select pass, fail, or blocked before saving" : `UAT save failed: ${result.error}`);
        return;
      }
      saveRunSheetToStorage(result.runSheet);
      toast(`Saved ${scenarioId} (${result.scenario.passFail}) - gates remain PendingHumanSignOff`);
      render();
    });
  });

  document.querySelector('[data-action="wave9-uat-export"]')?.addEventListener("click", () => {
    const runSheet = getOrCreateRunSheet();
    const json = serializeRunSheet(runSheet);
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wave9-uat-run-sheet-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Exported UAT run sheet for human sign-off (HA-* not auto-Approved)");
    } catch (err) {
      toast(`Export failed: ${err?.message || err}`);
    }
  });

  document.querySelector('[data-action="wave9-uat-reset"]')?.addEventListener("click", () => {
    if (!window.confirm("Reset local UAT recorder? This clears Pass/Fail saved in this browser only.")) return;
    const fresh = createUatRunSheet();
    saveRunSheetToStorage(fresh);
    toast("Local UAT recorder reset - ReadyToExecute / PendingHumanSignOff");
    render();
  });

  document.querySelector('[data-action="wave9-uat-gate-approve"]')?.addEventListener("click", () => {
    const gateId = document.querySelector("#wave9UatGateId")?.value || document.querySelector('[name="wave9UatGateId"]')?.value;
    const approverName = document.querySelector("#wave9UatApproverName")?.value
      || document.querySelector('[name="wave9UatApproverName"]')?.value
      || "";
    const confirmPhrase = document.querySelector("#wave9UatConfirmPhrase")?.value
      || document.querySelector('[name="wave9UatConfirmPhrase"]')?.value
      || "";
    const notes = document.querySelector("#wave9UatGateNotes")?.value
      || document.querySelector('[name="wave9UatGateNotes"]')?.value
      || "";
    const runSheet = getOrCreateRunSheet();
    const result = recordHumanGateApproval(runSheet, gateId, { approverName, confirmPhrase, notes });
    if (!result.ok) {
      if (result.error === "approver_name_required") {
        toast("Type the approver's full name - cannot approve without a name");
      } else if (result.error === "confirm_phrase_required") {
        toast(`Type exactly: ${UAT_HUMAN_CONFIRM_PHRASE}`);
      } else {
        toast(`Gate approval failed: ${result.error}`);
      }
      return;
    }
    saveRunSheetToStorage(result.runSheet);
    toast(`${gateId} recorded for ${approverName.trim()} in local run sheet only - update evidence JSON manually with same names/dates`);
    render();
  });
  document.querySelectorAll('[data-action="wave9-training-attendance"]').forEach((button) => {
    button.addEventListener("click", () => {
      const trackId = button.getAttribute("data-track-id");
      if (!trackId) return;
      const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(trackId) : trackId.replace(/"/g, '\\"');
      const participantEl = document.querySelector(`[data-training-participant="${esc}"]`);
      const notesEl = document.querySelector(`[data-training-notes="${esc}"]`);
      const runSheet = getOrCreateTrainingRunSheet();
      const result = recordTrackAttendance(runSheet, trackId, {
        participantName: participantEl?.value,
        facilitator: currentUser()?.name || currentUser()?.username || "JOHN",
        notes: notesEl?.value
      });
      if (!result.ok) {
        toast(result.error === "participant_name_required" ? "Type participant name before saving attendance" : `Attendance failed: ${result.error}`);
        return;
      }
      saveTrainingRunSheetToStorage(result.runSheet);
      toast(`Attendance saved for ${trackId} - training_completion_pending unchanged`);
      render();
    });
  });

  document.querySelectorAll('[data-action="wave9-training-competency"]').forEach((button) => {
    button.addEventListener("click", () => {
      const trackId = button.getAttribute("data-track-id");
      if (!trackId) return;
      const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(trackId) : trackId.replace(/"/g, '\\"');
      const competencyEl = document.querySelector(`[data-training-competency="${esc}"]`);
      const notesEl = document.querySelector(`[data-training-notes="${esc}"]`);
      const runSheet = getOrCreateTrainingRunSheet();
      const result = recordTrackCompetency(runSheet, trackId, {
        competencyPassed: competencyEl?.value,
        competencyNotes: notesEl?.value,
        recordedBy: currentUser()?.name || currentUser()?.username || "JOHN"
      });
      if (!result.ok) {
        toast(result.error === "competency_result_required" ? "Select competency pass/fail/blocked before saving" : `Competency failed: ${result.error}`);
        return;
      }
      saveTrainingRunSheetToStorage(result.runSheet);
      toast(`Competency ${result.track.competencyPassed} for ${trackId} - still PendingHumanSignOff`);
      render();
    });
  });

  function completeTrainingTrack(trackId) {
    const completedBy = document.querySelector("#wave9TrainingCompleterName")?.value
      || document.querySelector('[name="wave9TrainingCompleterName"]')?.value
      || "";
    const confirmPhrase = document.querySelector("#wave9TrainingConfirmPhrase")?.value
      || document.querySelector('[name="wave9TrainingConfirmPhrase"]')?.value
      || "";
    const notes = document.querySelector("#wave9TrainingCompleteNotes")?.value
      || document.querySelector('[name="wave9TrainingCompleteNotes"]')?.value
      || "";
    const runSheet = getOrCreateTrainingRunSheet();
    const result = recordTrackCompletion(runSheet, trackId, { completedBy, confirmPhrase, notes });
    if (!result.ok) {
      if (result.error === "completer_name_required") toast("Type the completer's full name - cannot complete without a name");
      else if (result.error === "confirm_phrase_required") toast(`Type exactly: ${TRAINING_HUMAN_CONFIRM_PHRASE}`);
      else if (result.error === "attendance_required_before_completion") toast("Record attendance before completing the track");
      else if (result.error === "competency_required_before_completion" || result.error === "competency_must_pass_before_completion") toast("Competency must be pass before completion");
      else toast(`Track completion failed: ${result.error}`);
      return;
    }
    saveTrainingRunSheetToStorage(result.runSheet);
    toast(`${trackId} completed by ${completedBy.trim()} in local run sheet - update evidence JSON manually`);
    render();
  }

  document.querySelectorAll('[data-action="wave9-training-complete"]').forEach((button) => {
    button.addEventListener("click", () => {
      const trackId = button.getAttribute("data-track-id");
      if (!trackId) return;
      const trackSelect = document.querySelector("#wave9TrainingTrackId") || document.querySelector('[name="wave9TrainingTrackId"]');
      if (trackSelect) trackSelect.value = trackId;
      completeTrainingTrack(trackId);
    });
  });

  document.querySelector('[data-action="wave9-training-complete-form"]')?.addEventListener("click", () => {
    const trackId = document.querySelector("#wave9TrainingTrackId")?.value
      || document.querySelector('[name="wave9TrainingTrackId"]')?.value;
    if (!trackId) {
      toast("Select a track to complete");
      return;
    }
    completeTrainingTrack(trackId);
  });

  document.querySelector('[data-action="wave9-training-export"]')?.addEventListener("click", () => {
    const runSheet = getOrCreateTrainingRunSheet();
    const json = serializeTrainingRunSheet(runSheet);
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wave9-training-run-sheet-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Exported training run sheet (training_completion_pending not auto-cleared)");
    } catch (err) {
      toast(`Export failed: ${err?.message || err}`);
    }
  });

  document.querySelector('[data-action="wave9-training-reset"]')?.addEventListener("click", () => {
    if (!window.confirm("Reset local training recorder? This clears attendance/competency saved in this browser only.")) return;
    const fresh = createTrainingRunSheet();
    saveTrainingRunSheetToStorage(fresh);
    toast("Local training recorder reset - ReadyToExecute / PendingHumanSignOff");
    render();
  });

  document.querySelector('[data-action="wave9-training-gate-complete"]')?.addEventListener("click", () => {
    const completerName = document.querySelector("#wave9TrainingGateCompleterName")?.value
      || document.querySelector('[name="wave9TrainingGateCompleterName"]')?.value
      || "";
    const confirmPhrase = document.querySelector("#wave9TrainingGateConfirmPhrase")?.value
      || document.querySelector('[name="wave9TrainingGateConfirmPhrase"]')?.value
      || "";
    const notes = document.querySelector("#wave9TrainingGateNotes")?.value
      || document.querySelector('[name="wave9TrainingGateNotes"]')?.value
      || "";
    const runSheet = getOrCreateTrainingRunSheet();
    const result = recordTrainingGateCompletion(runSheet, "HG-02", { completerName, confirmPhrase, notes });
    if (!result.ok) {
      if (result.error === "completer_name_required") toast("Type the completer's full name - cannot approve HG-02 without a name");
      else if (result.error === "confirm_phrase_required") toast(`Type exactly: ${TRAINING_HUMAN_CONFIRM_PHRASE}`);
      else if (result.error === "all_tracks_must_be_completed_first") toast("Complete all training tracks with typed names before HG-02");
      else toast(`HG-02 completion failed: ${result.error}`);
      return;
    }
    saveTrainingRunSheetToStorage(result.runSheet);
    toast(`HG-02 recorded for ${completerName.trim()} in local run sheet only - update evidence JSON manually with same names/dates`);
    render();
  });

  document.querySelectorAll('[data-action="wave9-recon-save"]').forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = button.getAttribute("data-item-id");
      if (!itemId) return;
      const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(itemId) : itemId.replace(/"/g, '\\"');
      const passFailEl = document.querySelector(`[data-recon-passfail="${esc}"]`);
      const varianceEl = document.querySelector(`[data-recon-variance="${esc}"]`);
      const notesEl = document.querySelector(`[data-recon-notes="${esc}"]`);
      const signerEl = document.querySelector(`[data-recon-signer="${esc}"]`);
      const runSheet = getOrCreateReconRunSheet();
      const varianceRaw = String(varianceEl?.value || "").trim();
      const result = recordReconChecklistItem(runSheet, itemId, {
        passFail: passFailEl?.value,
        variancePesewas: varianceRaw === "" ? null : Number(varianceRaw),
        varianceNotes: notesEl?.value,
        executedBy: signerEl?.value || currentUser()?.name || currentUser()?.username || "operator",
        signerName: signerEl?.value || ""
      });
      if (!result.ok) {
        if (result.error === "pass_fail_required") toast("Select pass, fail, or blocked before saving");
        else if (result.error === "variance_notes_required_on_fail") toast("Variance notes required when Fail or Blocked");
        else if (result.error === "variance_must_be_integer_pesewas") toast("Variance must be an integer pesewas value");
        else toast(`Recon save failed: ${result.error}`);
        return;
      }
      saveReconRunSheetToStorage(result.runSheet);
      toast(`Saved ${itemId} (${result.item.passFail}) - productionReconciled stays false; gates PendingHumanSignOff`);
      render();
    });
  });

  document.querySelector('[data-action="wave9-recon-export"]')?.addEventListener("click", () => {
    const runSheet = getOrCreateReconRunSheet();
    const json = serializeReconRunSheet(runSheet);
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wave9-recon-run-sheet-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Exported recon run sheet (productionReconciled not auto-claimed)");
    } catch (err) {
      toast(`Export failed: ${err?.message || err}`);
    }
  });

  document.querySelector('[data-action="wave9-recon-reset"]')?.addEventListener("click", () => {
    if (!window.confirm("Reset local recon recorder? This clears Pass/Fail saved in this browser only.")) return;
    const fresh = createReconRunSheet();
    saveReconRunSheetToStorage(fresh);
    toast("Local recon recorder reset - ReadyToExecute / PendingHumanSignOff");
    render();
  });

  document.querySelector('[data-action="wave9-recon-gate-approve"]')?.addEventListener("click", () => {
    const gateId = document.querySelector("#wave9ReconGateId")?.value
      || document.querySelector('[name="wave9ReconGateId"]')?.value
      || "HA-RECON";
    const signerName = document.querySelector("#wave9ReconSignerName")?.value
      || document.querySelector('[name="wave9ReconSignerName"]')?.value
      || "";
    const confirmPhrase = document.querySelector("#wave9ReconConfirmPhrase")?.value
      || document.querySelector('[name="wave9ReconConfirmPhrase"]')?.value
      || "";
    const notes = document.querySelector("#wave9ReconGateNotes")?.value
      || document.querySelector('[name="wave9ReconGateNotes"]')?.value
      || "";
    const runSheet = getOrCreateReconRunSheet();
    const result = recordReconGateSignOff(runSheet, gateId, { signerName, confirmPhrase, notes });
    if (!result.ok) {
      if (result.error === "signer_name_required") toast("Type the signer's full name - cannot approve without a name");
      else if (result.error === "confirm_phrase_required") toast(`Type exactly: ${RECON_HUMAN_CONFIRM_PHRASE}`);
      else if (result.error === "all_checklist_items_must_be_recorded_first") toast("Record Pass/Fail for all checklist items before gate sign-off");
      else toast(`Recon gate sign-off failed: ${result.error}`);
      return;
    }
    saveReconRunSheetToStorage(result.runSheet);
    toast(`${gateId} recorded for ${signerName.trim()} in local run sheet only - productionReconciled remains false; update evidence JSON manually`);
    render();
  });

  document.querySelectorAll('[data-action="wave9-security-save"]').forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = button.getAttribute("data-item-id");
      if (!itemId) return;
      const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(itemId) : itemId.replace(/"/g, '\\"');
      const passFailEl = document.querySelector(`[data-security-passfail="${esc}"]`);
      const notesEl = document.querySelector(`[data-security-notes="${esc}"]`);
      const evidenceEl = document.querySelector(`[data-security-evidence="${esc}"]`);
      const signerEl = document.querySelector(`[data-security-signer="${esc}"]`);
      const runSheet = getOrCreateSecurityRunSheet();
      const result = recordSecurityChecklistItem(runSheet, itemId, {
        passFail: passFailEl?.value,
        findingNotes: notesEl?.value,
        evidence: evidenceEl?.value,
        executedBy: signerEl?.value || currentUser()?.name || currentUser()?.username || "operator",
        signerName: signerEl?.value || ""
      });
      if (!result.ok) {
        if (result.error === "pass_fail_required") toast("Select pass, fail, or blocked before saving");
        else if (result.error === "finding_notes_required_on_fail") toast("Finding notes required when Fail or Blocked");
        else toast(`Security save failed: ${result.error}`);
        return;
      }
      saveSecurityRunSheetToStorage(result.runSheet);
      toast(`Saved ${itemId} (${result.item.passFail}) - HA-SEC remains PendingHumanSignOff`);
      render();
    });
  });

  document.querySelector('[data-action="wave9-security-export"]')?.addEventListener("click", () => {
    const runSheet = getOrCreateSecurityRunSheet();
    const json = serializeSecurityRunSheet(runSheet);
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wave9-security-run-sheet-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Exported security run sheet (HA-SEC not auto-Approved)");
    } catch (err) {
      toast(`Export failed: ${err?.message || err}`);
    }
  });

  document.querySelector('[data-action="wave9-security-reset"]')?.addEventListener("click", () => {
    if (!window.confirm("Reset local security recorder? This clears Pass/Fail saved in this browser only.")) return;
    const fresh = createSecurityRunSheet();
    saveSecurityRunSheetToStorage(fresh);
    toast("Local security recorder reset - ReadyToExecute / PendingHumanSignOff");
    render();
  });

  document.querySelector('[data-action="wave9-security-gate-approve"]')?.addEventListener("click", () => {
    const signerName = document.querySelector("#wave9SecuritySignerName")?.value
      || document.querySelector('[name="wave9SecuritySignerName"]')?.value
      || "";
    const confirmPhrase = document.querySelector("#wave9SecurityConfirmPhrase")?.value
      || document.querySelector('[name="wave9SecurityConfirmPhrase"]')?.value
      || "";
    const notes = document.querySelector("#wave9SecurityGateNotes")?.value
      || document.querySelector('[name="wave9SecurityGateNotes"]')?.value
      || "";
    const runSheet = getOrCreateSecurityRunSheet();
    const result = recordSecurityGateSignOff(runSheet, "HA-SEC", { signerName, confirmPhrase, notes });
    if (!result.ok) {
      if (result.error === "signer_name_required") toast("Type the signer's full name - cannot approve without a name");
      else if (result.error === "confirm_phrase_required") toast(`Type exactly: ${SECURITY_HUMAN_CONFIRM_PHRASE}`);
      else if (result.error === "all_checklist_items_must_be_recorded_first") toast("Record Pass/Fail for all checklist items before HA-SEC sign-off");
      else if (result.error === "remediate_fail_or_blocked_items_first") toast("Remediate Fail/Blocked items before HA-SEC sign-off");
      else toast(`HA-SEC sign-off failed: ${result.error}`);
      return;
    }
    saveSecurityRunSheetToStorage(result.runSheet);
    toast(`HA-SEC recorded for ${signerName.trim()} in local run sheet only - update evidence JSON manually with same names/dates`);
    render();
  });

  document.querySelector('[data-action="wave9-executive-sync-prereqs"]')?.addEventListener("click", () => {
    const runSheet = getOrCreateExecutiveRunSheet();
    const result = syncExecutivePrerequisitesFromStorage(runSheet);
    if (!result.ok) {
      toast(`Prerequisite sync failed: ${result.error}`);
      return;
    }
    saveExecutiveRunSheetToStorage(result.runSheet);
    toast(`Synced HG-01..04 status from local run sheets (${result.runSheet.scores.prerequisitesPendingCount} still pending)`);
    render();
  });

  document.querySelector('[data-action="wave9-executive-memo-save"]')?.addEventListener("click", () => {
    const runSheet = getOrCreateExecutiveRunSheet();
    const result = recordExecutiveMemoDraft(runSheet, {
      sponsorMemoFields: {
        pilotName: document.querySelector("#wave9ExecMemoPilotName")?.value
          || document.querySelector('[name="wave9ExecMemoPilotName"]')?.value
          || "",
        reviewDate: document.querySelector("#wave9ExecMemoReviewDate")?.value
          || document.querySelector('[name="wave9ExecMemoReviewDate"]')?.value
          || "",
        rc1Summary: document.querySelector("#wave9ExecMemoRc1")?.value
          || document.querySelector('[name="wave9ExecMemoRc1"]')?.value
          || "",
        recommendation: document.querySelector("#wave9ExecMemoRecommendation")?.value
          || document.querySelector('[name="wave9ExecMemoRecommendation"]')?.value
          || "",
        risksOrWaivers: document.querySelector("#wave9ExecMemoRisks")?.value
          || document.querySelector('[name="wave9ExecMemoRisks"]')?.value
          || "",
        wave10EntryIntent: document.querySelector("#wave9ExecMemoWave10")?.value
          || document.querySelector('[name="wave9ExecMemoWave10"]')?.value
          || ""
      },
      trainingStatusNote: document.querySelector("#wave9ExecTrainingNote")?.value
        || document.querySelector('[name="wave9ExecTrainingNote"]')?.value
        || "",
      reconStatusNote: document.querySelector("#wave9ExecReconNote")?.value
        || document.querySelector('[name="wave9ExecReconNote"]')?.value
        || "",
      securityStatusNote: document.querySelector("#wave9ExecSecurityNote")?.value
        || document.querySelector('[name="wave9ExecSecurityNote"]')?.value
        || "",
      decisionRationale: document.querySelector("#wave9ExecRationale")?.value
        || document.querySelector('[name="wave9ExecRationale"]')?.value
        || "",
      openConditions: document.querySelector("#wave9ExecOpenConditions")?.value
        || document.querySelector('[name="wave9ExecOpenConditions"]')?.value
        || ""
    });
    if (!result.ok) {
      toast(`Memo draft save failed: ${result.error}`);
      return;
    }
    saveExecutiveRunSheetToStorage(result.runSheet);
    toast("Executive memo draft saved locally - HA-EXEC remains PendingHumanSignOff");
    render();
  });

  document.querySelector('[data-action="wave9-executive-export"]')?.addEventListener("click", () => {
    const runSheet = getOrCreateExecutiveRunSheet();
    const json = serializeExecutiveRunSheet(runSheet);
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wave9-executive-run-sheet-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Exported executive run sheet (HA-EXEC not auto-Approved; Wave 10 still blocked)");
    } catch (err) {
      toast(`Export failed: ${err?.message || err}`);
    }
  });

  document.querySelector('[data-action="wave9-executive-reset"]')?.addEventListener("click", () => {
    if (!window.confirm("Reset local executive recorder? This clears memo/decision saved in this browser only.")) return;
    const fresh = createExecutiveRunSheet();
    saveExecutiveRunSheetToStorage(fresh);
    toast("Local executive recorder reset - ReadyToExecute / PendingHumanSignOff");
    render();
  });

  document.querySelector('[data-action="wave9-executive-gate-approve"]')?.addEventListener("click", () => {
    const decision = document.querySelector("#wave9ExecDecision")?.value
      || document.querySelector('[name="wave9ExecDecision"]')?.value
      || "";
    const signerName = document.querySelector("#wave9ExecSignerName")?.value
      || document.querySelector('[name="wave9ExecSignerName"]')?.value
      || "";
    const confirmPhrase = document.querySelector("#wave9ExecConfirmPhrase")?.value
      || document.querySelector('[name="wave9ExecConfirmPhrase"]')?.value
      || "";
    const openConditions = document.querySelector("#wave9ExecOpenConditions")?.value
      || document.querySelector('[name="wave9ExecOpenConditions"]')?.value
      || "";
    const acceptOpenConditions = Boolean(
      document.querySelector("#wave9ExecAcceptOpenConditions")?.checked
    );
    const decisionRationale = document.querySelector("#wave9ExecRationale")?.value
      || document.querySelector('[name="wave9ExecRationale"]')?.value
      || "";
    const notes = document.querySelector("#wave9ExecGateNotes")?.value
      || document.querySelector('[name="wave9ExecGateNotes"]')?.value
      || "";
    const runSheet = getOrCreateExecutiveRunSheet();
    const result = recordExecutiveSponsorDecision(runSheet, {
      decision,
      signerName,
      confirmPhrase,
      openConditions,
      acceptOpenConditions,
      decisionRationale,
      notes
    });
    if (!result.ok) {
      if (result.error === "signer_name_required") toast("Type the executive's full name - cannot record without a name");
      else if (result.error === "confirm_phrase_required") toast(`Type exactly: ${EXECUTIVE_HUMAN_CONFIRM_PHRASE}`);
      else if (result.error === "decision_required") toast("Select Full Go, Conditional Go, or No-Go");
      else if (result.error === "full_go_blocked_open_prerequisites") {
        toast("Full Go blocked while HG-01..04 pending — check Accept open conditions and list conditions, or choose Conditional Go");
      } else if (result.error === "open_conditions_required_for_full_go_with_pending_gates") {
        toast("List open conditions when accepting Full Go with pending HG-01..04");
      } else if (result.error === "open_conditions_required_for_conditional_go") {
        toast("Conditional Go requires a non-empty open conditions list");
      } else if (result.error === "rationale_required_for_no_go") {
        toast("No-Go requires a decision rationale");
      } else toast(`Executive decision failed: ${result.error}`);
      return;
    }
    saveExecutiveRunSheetToStorage(result.runSheet);
    toast(`${result.decision} recorded for ${signerName.trim()} in local run sheet only - Wave 10 cutover/CERT-001 remain blocked; update evidence JSON manually`);
    render();
  });

}

function renderWave10GoliveExtras(opts = {}) {
  const user = currentUser();
  const canView = canAction(user, "Audit.View") || canAction(user, "Reports.View") || canAction(user, "Reports.Audit") || isSystemOwner();
  if (!canView) return "";
  const smoke = wave10SmokeChecklist();
  const gaps = analyzeWave10Gaps();
  let evidence = null;
  try {
    evidence = JSON.parse(sessionStorage.getItem("wave10_last_golive") || "null");
  } catch {
    evidence = null;
  }
  if (!evidence) {
    evidence = loadLastGoliveEvidence();
  }
  const steps = evidence?.cutover?.steps || [];
  const envRows = evidence?.productionEnvironment?.checklist || [];
  const metrics = evidence?.successMetrics || [];
  const orgBlocked = listOrgBlockedHardStops();
  return `
    ${renderWave10GolivePanel({
      smoke,
      gaps,
      evidence,
      surface: opts.surface || "audit",
      canView
    })}
    ${renderWave10CutoverChecklist(steps)}
    ${renderWave10ProdEnv(envRows)}
    ${renderWave10HypercareBoard(evidence?.hypercare, metrics)}
    ${renderWave10ClosureSignoff(evidence)}
    ${renderWave10ParityChecklist(WAVE10_PARITY_CHECKLIST)}
    ${renderOrgBlockedHardStopsPanel({
      items: orgBlocked.items,
      note: orgBlocked.note,
      canView
    })}
  `;
}

function bindWave10GoliveHandlers() {
  document.querySelector('[data-action="wave10-refresh-golive"]')?.addEventListener("click", () => {
    const evidence = loadLastGoliveEvidence();
    try {
      sessionStorage.setItem(
        "wave10_last_golive",
        JSON.stringify(
          evidence || {
            goLive: { decision: "unknown" },
            note: "Run npm run validate:golive to generate evidence"
          }
        )
      );
    } catch {
      /* ignore */
    }
    toast(
      evidence
        ? `Go-live evidence loaded (${evidence.goLive?.decision || "n/a"})`
        : "No go-live evidence yet - run npm run validate:golive"
    );
    render();
  });
}

function renderPlatformReportsBlock() {
  return renderPlatformReportsExtra({
    reports: [
      { id: "platform_tenants", label: "Tenants" },
      { id: "platform_licenses", label: "Licenses" },
      { id: "platform_flags", label: "Flags" },
      { id: "platform_deployments", label: "Deployments" },
      { id: "platform_maintenance", label: "Maintenance" },
      { id: "platform_config_history", label: "Config History" },
      { id: "platform_environments", label: "Environments" },
      { id: "platform_announcements", label: "Announcements" },
      { id: "platform_dr", label: "DR" },
      { id: "platform_ops", label: "Ops Summary" }
    ]
  });
}

function downloadJobReport(reportId) {
  const range = reportDateRange();
  const report = jobReports(state, reportId, range);
  if (!(report.rows || []).length) {
    toast("No scheduler rows for this report");
    return;
  }
  download(`${reportId}.csv`, exportJobCsv(report), "text/csv");
}

function bindJobEngineHandlers() {
  document.querySelector("#jobSearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    sessionStorage.setItem("job_search_q", data.q || "");
    render();
  });
  document.querySelector("#jobEngineTickBtn")?.addEventListener("click", () => {
    ensureJobState(state);
    tickScheduler(state, { uid, user: currentUser(), workerId: "wrk-local" });
    saveState();
    toast("Scheduler tick completed");
    render();
  });
  document.querySelector("#jobPaymentRetryBtn")?.addEventListener("click", () => {
    const result = enqueueJob(state, { type: "payment_retry", businessKey: `ui-pay:${Date.now()}` }, currentUser(), uid);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    tickScheduler(state, { uid, user: currentUser(), workerId: "wrk-local" });
    saveState();
    toast("Payment retry queued");
    render();
  });
  document.querySelector("#jobDocumentQueueBtn")?.addEventListener("click", () => {
    const result = enqueueJob(state, { type: "pdf_generation", businessKey: `ui-doc:${Date.now()}` }, currentUser(), uid);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    tickScheduler(state, { uid, user: currentUser(), workerId: "wrk-local" });
    saveState();
    toast("Document queue job started");
    render();
  });
  document.querySelector("#jobScheduleForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    const result = scheduleJob(state, data, currentUser(), uid);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    saveState();
    toast("Schedule added");
    render();
  });
  document.querySelectorAll("[data-job-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("job_detail_id", button.dataset.jobDetail);
      render();
    });
  });
  document.querySelectorAll("[data-job-retry]").forEach((button) => {
    button.addEventListener("click", () => {
      const job = (state.backgroundJobs || []).find((item) => item.id === button.dataset.jobRetry);
      if (job && job.status === "queued") {
        tickScheduler(state, { uid, user: currentUser(), workerId: "wrk-local", maxJobs: 1 });
      } else if (job) {
        enqueueJob(state, { type: job.type, businessKey: `retry:${job.id}:${Date.now()}` }, currentUser(), uid);
        tickScheduler(state, { uid, user: currentUser(), workerId: "wrk-local" });
      }
      saveState();
      toast("Retry requested");
      render();
    });
  });
  document.querySelectorAll("[data-job-replay]").forEach((button) => {
    button.addEventListener("click", () => {
      const gate = canPerformOffline(state, "job.replay", { online: navigator.onLine });
      if (!gate.ok) {
        toast(gate.error);
        return;
      }
      const result = replayJobDeadLetter(state, button.dataset.jobReplay, { user: currentUser(), uid, approved: false });
      if (!result.ok && !result.pending) {
        toast(result.error);
        return;
      }
      saveState();
      toast(result.pending ? "Replay submitted for approval" : "Dead-letter job requeued");
      render();
    });
  });
  document.querySelectorAll("[data-job-approve]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = decideJobApproval(state, button.dataset.jobApprove, { user: currentUser(), uid, approved: true });
      if (!result.ok) {
        toast(result.error);
        return;
      }
      saveState();
      toast("Job action approved");
      render();
    });
  });
  document.querySelectorAll("[data-job-reject]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = decideJobApproval(state, button.dataset.jobReject, { user: currentUser(), uid, approved: false, reason: "Rejected" });
      saveState();
      toast(result.rejected ? "Approval rejected" : (result.error || "Could not reject"));
      render();
    });
  });
  document.querySelectorAll("[data-job-report]").forEach((button) => {
    button.addEventListener("click", () => downloadJobReport(button.dataset.jobReport));
  });
}

function bindMonitoringEngineHandlers() {
  document.querySelector("#monitorSnapshotBtn")?.addEventListener("click", () => {
    collectHealthSnapshot(state, { uid, now: new Date().toISOString(), user: currentUser() });
    saveState();
    toast("Health snapshot collected");
    render();
  });
  document.querySelector("#monitorFlushBtn")?.addEventListener("click", () => {
    const result = flushOfflineMonitoringQueue(state, { user: currentUser(), uid, now: new Date().toISOString(), online: navigator.onLine });
    saveState();
    toast(result.deferred ? "Telemetry stays queued until the device is online" : `Flushed ${result.flushed || 0} health events`);
    render();
  });
  document.querySelectorAll("[data-monitor-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const report = monitoringReports(state, button.dataset.monitorReport, reportDateRange());
      if (!(report.rows || []).length) {
        toast("No monitoring rows for this report");
        return;
      }
      download(`${button.dataset.monitorReport}.csv`, exportMonitorCsv(report), "text/csv");
    });
  });
}

function bindGatewayEngineHandlers() {
  document.querySelector("#gatewayClientForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    const result = registerApiClient(state, data, currentUser(), uid);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    saveState();
    toast("API client registered");
    render();
  });
  document.querySelector("#gatewayWebhookForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    const result = subscribeWebhook(state, data, currentUser(), uid);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    saveState();
    toast("Webhook subscribed");
    render();
  });
  document.querySelectorAll("[data-gateway-rotate]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = rotateApiKey(state, button.dataset.gatewayRotate, { user: currentUser(), uid });
      if (!result.ok) {
        toast(result.error);
        return;
      }
      saveState();
      toast(`New key ends with ${result.key.hint}. Copy it now; it is not stored in plaintext.`);
      render();
    });
  });
  document.querySelectorAll("[data-gateway-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const report = gatewayReports(state, button.dataset.gatewayReport, reportDateRange());
      if (!(report.rows || []).length) {
        toast("No gateway rows for this report");
        return;
      }
      download(`${button.dataset.gatewayReport}.csv`, exportGatewayCsv(report), "text/csv");
    });
  });
}

function bindRecoveryEngineHandlers() {
  document.querySelector("#recoverySnapshotBtn")?.addEventListener("click", () => {
    const result = createBackupSet(state, { type: "snapshot", source: "console" }, currentUser(), uid);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    saveState();
    toast("Verified snapshot cataloged");
    render();
  });
  document.querySelector("#recoveryTestBtn")?.addEventListener("click", () => {
    const result = runRecoveryTest(state, {}, currentUser(), uid);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    saveState();
    toast(result.collectionsUnchanged ? "Recovery drill passed. Production collections unchanged." : "Recovery drill finished");
    render();
  });
  document.querySelectorAll("[data-backup-verify]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = verifyBackup(state, button.dataset.backupVerify, { user: currentUser(), uid });
      saveState();
      toast(result.ok ? "Backup verified" : (result.error || "Verification failed"));
      render();
    });
  });
  document.querySelectorAll("[data-restore-request]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = requestRestore(state, { backupSetId: button.dataset.restoreRequest }, currentUser(), uid);
      if (!result.ok) {
        toast(result.error);
        return;
      }
      transitionRestore(state, result.restore.id, "authorized", { user: currentUser(), uid });
      saveState();
      toast("Restore requested and waiting for approval");
      render();
    });
  });
  document.querySelectorAll("[data-restore-approve]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = transitionRestore(state, button.dataset.restoreApprove, "approved", { user: currentUser(), uid });
      saveState();
      toast(result.ok ? "Restore approved" : (result.error || "Could not approve"));
      render();
    });
  });
  document.querySelectorAll("[data-recovery-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const report = backupReports(state, button.dataset.recoveryReport, reportDateRange());
      if (!(report.rows || []).length) {
        toast("No recovery rows for this report");
        return;
      }
      download(`${button.dataset.recoveryReport}.csv`, exportBackupCsv(report), "text/csv");
    });
  });
}

function bindSecurityEngineHandlers() {
  document.querySelector("#securityEvaluateBtn")?.addEventListener("click", () => {
    const result = evaluateRisk(state, {}, { user: currentUser(), uid, now: new Date().toISOString() });
    if (!result.ok) {
      toast(result.error);
      return;
    }
    saveState();
    toast(`Risk ${result.score.level} · ${result.score.score}`);
    render();
  });
  document.querySelector("#securityIncidentBtn")?.addEventListener("click", () => {
    const result = openSecurityIncident(state, { title: "Manual security incident", severity: "high" }, currentUser(), uid);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    saveState();
    toast("Security incident opened");
    render();
  });
  document.querySelectorAll("[data-security-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = closeSecurityIncident(state, button.dataset.securityClose, { user: currentUser(), uid });
      saveState();
      toast(result.ok ? "Incident closed" : (result.error || "Could not close"));
      render();
    });
  });
  document.querySelectorAll("[data-security-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const report = securityReports(state, button.dataset.securityReport, reportDateRange());
      if (!(report.rows || []).length) {
        toast("No security rows for this report");
        return;
      }
      download(`${button.dataset.securityReport}.csv`, exportSecurityCsv(report), "text/csv");
    });
  });
}

function bindWorkflowEngineHandlers() {
  document.querySelector("#workflowStartBtn")?.addEventListener("click", () => {
    const result = startWorkflow(state, { code: "withdrawal_approval", subjectId: "ui", trigger: "manual" }, currentUser(), uid);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    saveState();
    toast("Withdrawal workflow started");
    render();
  });
  document.querySelector("#workflowAutoBtn")?.addEventListener("click", () => {
    const result = startWorkflow(state, { code: "fully_automated", subjectId: `auto-${Date.now()}`, trigger: "manual" }, currentUser(), uid);
    saveState();
    toast(result.ok ? "Automated workflow completed" : (result.error || "Workflow failed"));
    render();
  });
  document.querySelector("#workflowTickBtn")?.addEventListener("click", () => {
    tickWorkflows(state, { uid, user: currentUser(), now: new Date().toISOString() });
    saveState();
    toast("Workflow SLA tick completed");
    render();
  });
  document.querySelector("#workflowCaseBtn")?.addEventListener("click", () => {
    const result = openCase(state, { type: "compliance_review", title: "Manual compliance review" }, currentUser(), uid);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    saveState();
    toast("Case opened");
    render();
  });
  document.querySelectorAll("[data-workflow-approve]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = completeTask(state, button.dataset.workflowApprove, { decision: "approve" }, currentUser(), uid);
      saveState();
      toast(result.ok ? (result.pending ? "Partial approval recorded" : "Task approved") : (result.error || "Could not approve"));
      render();
    });
  });
  document.querySelectorAll("[data-workflow-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const report = workflowReports(state, button.dataset.workflowReport, reportDateRange());
      if (!(report.rows || []).length) {
        toast("No workflow rows for this report");
        return;
      }
      download(`${button.dataset.workflowReport}.csv`, exportWorkflowCsv(report), "text/csv");
    });
  });
}

function bindRuleEngineHandlers() {
  document.querySelector("#ruleEvalBtn")?.addEventListener("click", () => {
    const result = evaluateRule(state, { code: "min_savings_amount", facts: { amount: 5 } }, currentUser(), uid);
    saveState();
    toast(result.ok ? `Min savings rule: ${result.value}` : (result.error || "Rule failed"));
    render();
  });
  document.querySelector("#ruleSimulateBtn")?.addEventListener("click", () => {
    const result = simulateRule(state, { code: "withdrawal_decision", cases: [{ amount: 200 }, { amount: 8000 }] }, currentUser(), uid);
    saveState();
    toast(result.ok ? "Withdrawal decision simulated" : (result.error || "Simulation failed"));
    render();
  });
  document.querySelector("#ruleTestBtn")?.addEventListener("click", () => {
    const result = runRuleTests(state, "rdef-min-savings", currentUser(), uid);
    saveState();
    toast(result.ok ? `Rule tests passed (${result.coverage}%)` : "Rule tests failed");
    render();
  });
  document.querySelector("#rulePublishBtn")?.addEventListener("click", () => {
    const result = publishRule(state, "rdef-min-savings", currentUser(), uid);
    saveState();
    toast(result.ok ? "Rule published" : (result.error || "Publish failed"));
    render();
  });
  document.querySelectorAll("[data-rule-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const report = ruleReports(state, button.dataset.ruleReport, reportDateRange());
      if (!(report.rows || []).length) {
        toast("No rule rows for this report");
        return;
      }
      download(`${button.dataset.ruleReport}.csv`, exportRuleCsv(report), "text/csv");
    });
  });
}

function bindExchangeEngineHandlers() {
  document.querySelector("#exchangeImportDemoBtn")?.addEventListener("click", () => {
    const result = importExchange(state, {
      type: "customers",
      format: "csv",
      apply: true,
      text: "Full Name,Phone Number\nExchange Demo,0209999000"
    }, currentUser(), uid);
    saveState();
    toast(result.ok ? `Imported ${result.applied || 0} customer(s)` : (result.error || "Import failed"));
    render();
  });
  document.querySelector("#exchangeExportDemoBtn")?.addEventListener("click", () => {
    const result = exportExchange(state, { type: "customers", format: "zip" }, currentUser(), uid);
    saveState();
    toast(result.ok ? (result.pendingApproval ? "Export waiting for approval" : `Exported ${result.recordCount || 0} row(s)`) : (result.error || "Export failed"));
    render();
  });
  document.querySelector("#exchangeValidateDemoBtn")?.addEventListener("click", () => {
    const result = validateImport(state, {
      type: "customers",
      format: "csv",
      text: "Full Name,Phone Number\n,0200000000"
    }, currentUser(), uid);
    saveState();
    toast(result.ok ? "Sample rows are valid" : `${(result.errors || []).length} validation error(s)`);
    render();
  });
  document.querySelector("#exchangeApproveDemoBtn")?.addEventListener("click", () => {
    const pending = (state.exportJobs || []).find((item) => item.status === "pending_approval");
    if (!pending) {
      toast("No export is waiting for approval");
      return;
    }
    const result = approveExportJob(state, pending.id, currentUser(), uid);
    saveState();
    toast(result.ok ? "Export approved" : (result.error || "Approval failed"));
    render();
  });
  document.querySelectorAll("[data-exchange-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const report = exchangeReports(state, button.dataset.exchangeReport);
      if (!(report.rows || []).length) {
        toast("No exchange rows for this report");
        return;
      }
      download(`${button.dataset.exchangeReport}.csv`, exportExchangeCsv(report), "text/csv");
    });
  });
}

function bindRecordsEngineHandlers() {
  document.querySelector("#recordsUploadDemoBtn")?.addEventListener("click", () => {
    const result = uploadRecord(state, {
      type: "national_id",
      fileName: "sample-id.txt",
      mimeType: "text/plain",
      content: `Ghana Card sample ${Date.now()}`,
      ownerId: state.customers?.[0]?.id || "",
      branchId: currentUser()?.branchId || "br-1",
      tags: ["kyc", "demo"]
    }, currentUser(), uid);
    saveState();
    toast(result.ok ? "Sample ID indexed in digital records" : (result.error || "Upload failed"));
    render();
  });
  document.querySelector("#recordsArchiveDemoBtn")?.addEventListener("click", () => {
    const latest = [...(state.digitalRecords || [])].reverse().find((item) => item.status === "active");
    if (!latest) {
      toast("No active record to archive");
      return;
    }
    const result = archiveRecord(state, latest.id, currentUser(), uid);
    saveState();
    toast(result.ok ? "Record archived" : (result.error || "Archive failed"));
    render();
  });
  document.querySelector("#recordsHoldDemoBtn")?.addEventListener("click", () => {
    const latest = [...(state.digitalRecords || [])].reverse().find((item) => item.status === "active" || item.status === "archived");
    if (!latest) {
      toast("No record available for legal hold");
      return;
    }
    const result = placeLegalHold(state, { recordId: latest.id, reason: "Compliance review" }, currentUser(), uid);
    saveState();
    toast(result.ok ? "Legal hold placed" : (result.error || "Hold failed"));
    render();
  });
  document.querySelector("#recordsSearchDemoBtn")?.addEventListener("click", () => {
    const result = searchDigitalRecords(state, {}, currentUser());
    saveState();
    toast(result.ok ? `Found ${result.rows?.length || 0} record(s)` : (result.error || "Search failed"));
    render();
  });
  document.querySelectorAll("[data-records-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const report = recordsReports(state, button.dataset.recordsReport);
      if (!(report.rows || []).length) {
        toast("No records rows for this report");
        return;
      }
      download(`${button.dataset.recordsReport}.csv`, exportRecordsCsv(report), "text/csv");
    });
  });
}

function bindEnterpriseBiHandlers() {
  document.querySelector("#biCalcAllBtn")?.addEventListener("click", () => {
    const result = calculateAllKpis(state, reportDateRange(), currentUser(), uid);
    saveState();
    toast(result.ok ? "All published KPIs calculated" : (result.error || "KPI calculation failed"));
    render();
  });
  document.querySelector("#biCalcCollectionBtn")?.addEventListener("click", () => {
    const result = calculateKpi(state, "KPI-COL-RATE", { ...reportDateRange(), expectedCollections: 100 }, currentUser(), uid);
    saveState();
    toast(result.ok ? `Collection rate: ${result.result.value}%` : (result.error || "Calculation failed"));
    render();
  });
  document.querySelector("#biPublishDemoBtn")?.addEventListener("click", () => {
    const result = publishKpi(state, "KPI-COL-RATE", currentUser(), uid);
    saveState();
    toast(result.ok ? "Collection KPI publication recorded" : (result.error || "Publish failed"));
    render();
  });
  document.querySelectorAll("[data-bi-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const report = biReports(state, button.dataset.biReport);
      if (!(report.rows || []).length) {
        toast("No BI registry rows for this report");
        return;
      }
      download(`${button.dataset.biReport}.csv`, exportBiCsv(report), "text/csv");
    });
  });
}

function bindIntegrationHubHandlers() {
  document.querySelector("#integrationDispatchDemoBtn")?.addEventListener("click", () => {
    const result = hubDispatch(state, {
      providerCode: "MTN_MOMO",
      operation: "health",
      authPolicy: "session",
      payload: { probe: true }
    }, currentUser(), uid);
    saveState();
    toast(result.ok ? `Dispatched via ${result.provider?.code}` : (result.error || "Dispatch failed"));
    render();
  });
  document.querySelector("#integrationWebhookDemoBtn")?.addEventListener("click", () => {
    const result = registerWebhook(state, {
      direction: "inbound",
      eventType: "momo.status",
      version: "1.0.0"
    }, currentUser(), uid);
    saveState();
    toast(result.ok ? "Inbound webhook registered" : (result.error || "Webhook failed"));
    render();
  });
  document.querySelector("#integrationTransformDemoBtn")?.addEventListener("click", () => {
    const result = runTransform(state, "XF-CURRENCY-PESEWAS", { amount: 12550 }, currentUser(), uid);
    saveState();
    toast(result.ok ? `Transform result amount=${result.result?.amount}` : (result.error || "Transform failed"));
    render();
  });
  document.querySelector("#integrationQueueDemoBtn")?.addEventListener("click", () => {
    const result = publishMessage(state, {
      queue: "integration.events",
      payload: { type: "demo", at: new Date().toISOString() },
      idempotencyKey: `demo-${Date.now()}`
    }, uid);
    saveState();
    toast(result.ok ? "Queue message published" : (result.error || "Publish failed"));
    render();
  });
  document.querySelector("#integrationAdvanceDeliveryBtn")?.addEventListener("click", () => {
    const first = (state.integrationDeliverables || [])[0];
    if (!first) {
      toast("No deliverables");
      return;
    }
    const result = advanceMilestone(state, first.code, null, currentUser(), uid);
    saveState();
    toast(result.ok ? `Advanced to ${result.deliverable.deadline.currentMilestone}` : (result.error || "Advance failed"));
    render();
  });
  document.querySelectorAll("[data-integration-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const report = integrationReports(state, button.dataset.integrationReport);
      if (!(report.rows || []).length) {
        toast("No integration rows for this report");
        return;
      }
      download(`${button.dataset.integrationReport}.csv`, exportIntegrationCsv(report), "text/csv");
    });
  });
}

function bindEnterpriseAiHandlers() {
  document.querySelector("#aiPredictBtn")?.addEventListener("click", () => {
    const result = runPrediction(state, { target: "growth" }, currentUser(), uid);
    saveState();
    toast(result.ok ? `Prediction conf ${Math.round((result.explanation?.confidence || 0) * 100)}%` : (result.error || "Prediction failed"));
    render();
  });
  document.querySelector("#aiFraudBtn")?.addEventListener("click", () => {
    const result = detectFraud(state, {}, currentUser(), uid);
    saveState();
    toast(result.ok ? `Fraud alerts: ${result.count}` : (result.error || "Fraud scan failed"));
    render();
  });
  document.querySelector("#aiForecastBtn")?.addEventListener("click", () => {
    const result = runForecast(state, { horizon: "weekly" }, currentUser(), uid);
    saveState();
    toast(result.ok ? `Forecast collections ${result.forecast?.collectionsPesewas}p` : (result.error || "Forecast failed"));
    render();
  });
  document.querySelector("#aiRecommendBtn")?.addEventListener("click", () => {
    const result = generateRecommendations(state, { kind: "all" }, currentUser(), uid);
    saveState();
    toast(result.ok ? `${result.recommendations?.length || 0} recommendations` : (result.error || "Recommend failed"));
    render();
  });
  document.querySelector("#aiDriftBtn")?.addEventListener("click", () => {
    const result = detectDrift(state, { baselineFailRate: 0.05 }, currentUser(), uid);
    saveState();
    toast(result.ok ? (result.drifted ? "Drift detected" : "No drift") : (result.error || "Drift scan failed"));
    render();
  });
  document.querySelector("#aiGovernanceBtn")?.addEventListener("click", () => {
    const result = aiGovernanceView(state, currentUser());
    if (!result.ok) {
      toast(result.error || "Governance denied");
      return;
    }
    toast(`AI permissions in registry: ${result.permissionCount}`);
  });
  document.querySelectorAll("[data-ai-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const report = aiReports(state, button.dataset.aiReport);
      if (!(report.rows || []).length) {
        toast("No AI rows for this report");
        return;
      }
      const csv = exportAiCsv(state, button.dataset.aiReport);
      download(`${button.dataset.aiReport}.csv`, csv.csv || "", "text/csv");
    });
  });
}

function bindPlatformAdminHandlers() {
  document.querySelector("#platformOpsRefreshBtn")?.addEventListener("click", () => {
    ensurePlatformState(state);
    const dash = platformOpsDashboard(state, currentUser(), uid);
    saveState();
    toast(dash.ok ? `Ops tenants ${dash.tenants?.active || 0} active` : (dash.error || "Ops refresh failed"));
    render();
  });
  document.querySelector("#platformMaintScheduleBtn")?.addEventListener("click", () => {
    const result = scheduleMaintenance(state, {
      title: "UI scheduled window",
      type: "scheduled",
      readOnly: true,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 3600 * 1000).toISOString()
    }, currentUser(), uid);
    saveState();
    toast(result.ok ? "Maintenance scheduled" : (result.error || "Schedule failed"));
    render();
  });
  document.querySelector("#platformFlagEvalBtn")?.addEventListener("click", () => {
    const result = evaluateFeatureFlag(state, "enablePlatformAdmin", { tenantId: DEFAULT_TENANT_ID, subjectKey: currentUser()?.id || "ui" });
    toast(result.ok ? `enablePlatformAdmin=${result.enabled} (${result.reason})` : (result.error || "Eval failed"));
  });
  document.querySelector("#platformDeployPlanBtn")?.addEventListener("click", () => {
    const result = planDeployment(state, { version: "30.0.0", strategy: "rolling" }, currentUser(), uid);
    saveState();
    toast(result.ok ? `Deployment ${result.deployment?.status}` : (result.error || "Plan failed"));
    render();
  });
  document.querySelectorAll("[data-platform-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const report = platformReports(state, button.dataset.platformReport);
      if (!(report.rows || []).length) {
        toast("No platform rows for this report");
        return;
      }
      download(`${button.dataset.platformReport}.csv`, exportPlatformCsv(report), "text/csv");
    });
  });
}

function bindPaymentEngineHandlers() {
  document.querySelector("#paymentSearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    sessionStorage.setItem("payment_search_q", data.q || "");
    sessionStorage.setItem("payment_search_method", data.method || "");
    render();
  });
  document.querySelector("#paymentQueueRunBtn")?.addEventListener("click", () => {
    ensureJobState(state);
    enqueueJob(state, { type: "payment_retry", businessKey: `ui:${Date.now()}` }, currentUser(), uid);
    tickScheduler(state, { uid, user: currentUser(), workerId: "wrk-local" });
    saveState();
    toast("Payment queue processed through the scheduler");
    render();
  });
  document.querySelector("#paymentCallbackForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    const secret = state.settings.momoWebhookSecret || "";
    if (!secret) {
      toast("Set MoMo Webhook Secret in System Controls first");
      return;
    }
    const timestamp = new Date().toISOString();
    const body = { reference: data.reference, amount: Number(data.amount || 0), status: data.status, provider: data.providerId };
    const result = processPaymentCallback(state, {
      providerId: data.providerId,
      body,
      timestamp,
      signature: signPaymentPayload(secret, body, timestamp),
      reference: data.reference
    }, { user: currentUser(), uid, now: timestamp });
    saveState();
    toast(result.ok ? (result.duplicate ? "Duplicate callback ignored" : "Callback processed") : (result.error || "Callback failed"));
    render();
  });
  document.querySelectorAll("[data-payment-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("payment_detail_id", button.dataset.paymentDetail);
      render();
    });
  });
  document.querySelectorAll("[data-payment-refund]").forEach((button) => {
    button.addEventListener("click", () => {
      const gate = canPerformOffline(state, "payment.refund", { online: navigator.onLine });
      if (!gate.ok) {
        toast(gate.error);
        return;
      }
      const amount = Number(prompt("Refund amount (leave blank for full)") || "0");
      const result = createRefund(state, button.dataset.paymentRefund, {
        amount: amount || undefined,
        partial: amount > 0,
        reason: "Manual refund",
        user: currentUser(),
        uid,
        online: navigator.onLine
      });
      if (!result.ok) {
        toast(result.error);
        return;
      }
      saveState();
      toast("Refund recorded as a linked payment");
      render();
    });
  });
  document.querySelectorAll("[data-payment-reverse]").forEach((button) => {
    button.addEventListener("click", () => {
      const gate = canPerformOffline(state, "payment.reverse", { online: navigator.onLine });
      if (!gate.ok) {
        toast(gate.error);
        return;
      }
      const result = createReversal(state, button.dataset.paymentReverse, {
        reason: "Manual reversal",
        user: currentUser(),
        uid
      });
      if (!result.ok) {
        toast(result.error);
        return;
      }
      saveState();
      toast("Reversal recorded as a linked payment");
      render();
    });
  });
  document.querySelector("#paymentReconcileForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canAction(currentUser(), "Payment.Reconcile") && !canAction(currentUser(), "Accounting.View")) {
      toast("You cannot reconcile payments");
      return;
    }
    const data = formData(event.target);
    const lines = String(data.lines || "").split(/\n+/).map((line) => {
      const [reference, amount] = line.split(",").map((part) => part.trim());
      return { reference, amount: Number(amount || 0) };
    }).filter((item) => item.reference);
    const result = reconcilePayments(state, { source: data.source || "provider", lines, user: currentUser(), uid });
    saveState();
    toast(`${result.matches.length} matched · ${result.exceptions.length} exception(s)`);
    render();
  });
  document.querySelector("#paymentSettlementForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const gate = canPerformOffline(state, "payment.settle", { online: navigator.onLine });
    if (!gate.ok) {
      toast(gate.error);
      return;
    }
    const data = formData(event.target);
    const result = recordSettlement(state, data, currentUser(), uid);
    if (result.error) {
      toast(result.error);
      return;
    }
    saveState();
    toast("Settlement recorded");
    render();
  });
  document.querySelector("#paymentMethodToggleForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    const result = setPaymentMethodEnabled(state, data.methodId, data.enabled === "true", currentUser(), uid);
    if (result.error) {
      toast(result.error);
      return;
    }
    saveState();
    toast("Payment method updated");
    render();
  });
  document.querySelectorAll("[data-payment-report]").forEach((button) => {
    button.addEventListener("click", () => downloadPaymentReport(button.dataset.paymentReport));
  });
}

function bindDocumentEngineHandlers() {
  document.querySelector("#documentSearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    sessionStorage.setItem("document_search_q", data.q || "");
    render();
  });
  document.querySelectorAll("[data-document-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("document_detail_id", button.dataset.documentDetail);
      render();
    });
  });
  document.querySelector("#documentVerifyForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    const result = verifyDocumentQr(state, data.token);
    const box = document.querySelector("#documentVerifyResult");
    if (box) {
      box.innerHTML = result.authentic
        ? `<div class="notice good">Authentic · ${result.receiptNo || ""} · ${result.status} · ${result.issueDate || ""}</div>`
        : `<div class="notice warn">${result.error || "Not authentic"}</div>`;
    }
  });
  document.querySelector("#documentStatementForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    const result = generateStatement(state, {
      customerId: data.customerId,
      from: data.from,
      to: data.to,
      user: currentUser(),
      uid
    });
    if (!result.ok) {
      toast(result.error);
      return;
    }
    saveState();
    toast("Statement generated");
    render();
  });
  document.querySelectorAll("[data-document-approve]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = decideReceiptApproval(state, button.dataset.documentApprove, { user: currentUser(), uid, approved: true });
      if (!result.ok) {
        toast(result.error);
        return;
      }
      saveState();
      toast("Receipt action approved");
      render();
    });
  });
  document.querySelectorAll("[data-document-reject]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = decideReceiptApproval(state, button.dataset.documentReject, { user: currentUser(), uid, approved: false, reason: "Rejected" });
      saveState();
      toast(result.rejected ? "Approval rejected" : (result.error || "Could not reject"));
      render();
    });
  });
  document.querySelectorAll("[data-document-report]").forEach((button) => {
    button.addEventListener("click", () => downloadDocumentReport(button.dataset.documentReport));
  });
}

function renderGroupDetail() {
  if (!isKBA()) return `<div class="notice">Only the owner can open full location details.</div>`;
  const groupId = sessionStorage.getItem("detail_group_id");
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) return `<div class="notice">Location not found.</div>`;
  const members = state.customers.filter((customer) => customer.groupId === group.id);
  const summary = groupSummary(group.id);
  return `
    <div class="panel">
      <div class="section-title">
        <h2>${escapeHtml(group.name)} Details</h2>
        <button class="btn ghost" data-back-view="groups">Back to locations</button>
      </div>
      <div class="grid four">
        <div class="stat"><small>Members</small><strong>${members.length}</strong></div>
        <div class="stat"><small>Total Contributed</small><strong>${money(summary.contributed)}</strong></div>
        <div class="stat"><small>Expected At Break</small><strong>${money(summary.expected)}</strong></div>
        <div class="stat"><small>Active Loans</small><strong>${state.loans.filter((loan) => loan.groupId === group.id && loan.status === "Active").length}</strong></div>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Members And Contributions</h2><button class="btn ghost" data-export="distribution">Export CSV</button></div>
      ${renderGroupMembersTable(members)}
    </div>
  `;
}

function renderGroupMembersTable(members) {
  if (!members.length) return `<div class="empty">No members in this location yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Account</th><th>Customer</th><th>Phone</th><th>Standard Amount</th><th>Progress</th><th>Total Contribution</th><th>Loan Balance</th><th>Final Payout</th></tr></thead>
        <tbody>
          ${members.map((member) => {
            const contributed = customerBalance(member.id);
            const loanBalance = loanBalanceForCustomer(member.id);
            return `
              <tr class="clickable-row" data-row-member-detail="${member.id}">
                <td>${escapeHtml(member.accountNo)}</td>
                <td><button type="button" class="link-btn" data-member-detail="${member.id}"><strong>${escapeHtml(member.name)}</strong></button></td>
                <td>${escapeHtml(member.phone)}</td>
                <td>${money(perSittingAmount(member))}</td>
                <td>${memberProgress(member.id)}</td>
                <td>${money(contributed)}</td>
                <td>${money(loanBalance)}</td>
                <td>${money(Math.max(0, contributed - loanBalance))}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMemberDetail() {
  const customerId = sessionStorage.getItem("detail_customer_id");
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer || (!isKBA() && !visibleGroupIds().includes(customer.groupId))) return `<div class="notice">Member not found or not assigned to you.</div>`;
  const txs = state.transactions.filter((tx) => tx.customerId === customer.id).slice().reverse();
  const collections = state.collections.filter((item) => item.customerId === customer.id).slice().reverse();
  const loans = state.loans.filter((loan) => loan.customerId === customer.id).slice().reverse();
  const messages = state.messages.filter((message) => message.customerId === customer.id).slice().reverse();
  const sitting = memberSittingSummary(customer.id);
  const personalBal = personalSavingsBalance(customer.id, { collections: state.collections, transactions: state.transactions });
  const showSusu = sitting.isSusu;
  const showPersonal = customerHasPersonalAccount(customer);
  const progressLabel = showSusu ? "Sittings" : "Personal Savings";
  const progressValue = showSusu ? `${sitting.paid} / ${sitting.target}` : money(personalBal);
  return `
    <div class="panel">
      <div class="section-title">
        <h2>${escapeHtml(customer.name)}</h2>
        <div class="row-actions">
          <button class="btn" type="button" data-view-jump="collections" data-collect-for="${customer.id}">Collect payment</button>
          <button class="btn secondary" type="button" data-edit-customer="${customer.id}">Edit member</button>
          <button class="btn secondary" data-print-statement="${customer.id}">Print accounts sheet</button>
          <button class="btn ghost" data-back-view="${isKBA() ? "groupDetail" : "customers"}">${isKBA() ? "Back" : "Back to members"}</button>
        </div>
      </div>
      <div class="grid four">
        <div class="stat"><small>Location</small><strong>${escapeHtml(groupName(customer.groupId))}</strong></div>
        <div class="stat"><small>Total Contribution</small><strong>${money(customerBalance(customer.id))}</strong></div>
        <div class="stat"><small>Loan Balance</small><strong>${money(loanBalanceForCustomer(customer.id))}</strong></div>
        <div class="stat"><small>${progressLabel}</small><strong>${progressValue}</strong></div>
      </div>
    </div>
    ${customer.passportPhoto ? `
      <div class="panel" style="margin-top:18px">
        <div class="section-title"><h2>Passport Picture</h2></div>
        <img class="passport-preview large" src="${escapeAttr(customer.passportPhoto)}" alt="Passport picture for ${escapeAttr(customer.name)}" />
      </div>
    ` : ""}
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Member Profile</h2></div>
      <table>
        <tr><td>Gender</td><td>${escapeHtml(customer.gender || "")}</td></tr>
        <tr><td>Marital Status</td><td>${escapeHtml(customer.maritalStatus || "")}</td></tr>
        <tr><td>Nationality</td><td>${escapeHtml(customer.nationality || "")}</td></tr>
        <tr><td>Business Type</td><td>${escapeHtml(customer.businessType || "")}</td></tr>
        <tr><td>Home Address</td><td>${escapeHtml(customer.homeAddress || customer.address || "")}</td></tr>
        <tr><td>Business Location</td><td>${escapeHtml(customer.businessLocation || "")}</td></tr>
        <tr><td>Next of Kin</td><td>${escapeHtml(customer.nextOfKin || "")} (${escapeHtml(customer.nextOfKinRelationship || "")})${customer.nextOfKinPhone ? ` · ${escapeHtml(customer.nextOfKinPhone)}` : ""}</td></tr>
        <tr><td>Account Type</td><td>${escapeHtml((customer.accountType || "personal").replace("_", " "))}</td></tr>
      </table>
    </div>
    ${renderCustomerProfileExtras({
      customer,
      stats: customerProfileStats(customer, {
        collections: state.collections,
        transactions: state.transactions,
        loans: state.loans,
        withdrawals: state.withdrawalRequests || [],
        susuGroups: state.susuGroups || [],
        savingsAccounts: state.savingsAccounts || [],
        date: today()
      }),
      timeline: customerTimeline(customer, {
        collections: state.collections,
        loans: state.loans,
        withdrawals: state.withdrawalRequests || [],
        users: state.users
      }),
      documents: customer.kycDocuments || [],
      notes: customer.notes || [],
      accounts: customerSavingsAccounts(state, customer.id),
      products: state.savingsProducts || [],
      withdrawals: (state.withdrawalRequests || []).filter((item) => item.customerId === customer.id).slice().reverse(),
      groups: (state.susuGroups || []).filter((group) =>
        (group.memberships || []).some((member) => member.customerId === customer.id && member.active !== false)
        || group.id === customer.susuGroupId
      ),
      productName: savingsProductName,
      agentName: state.users.find((user) => user.id === customer.collectorId)?.name || "",
      branchName: groupName(customer.groupId),
      canVerify: canChangeCustomerStatus(currentUser())
    })}
    ${showPersonal ? `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Personal Savings</h2></div>
      <div class="grid four">
        <div class="stat"><small>Product</small><strong>${escapeHtml(savingsProductName(customer.savingsProductId))}</strong></div>
        <div class="stat"><small>Balance</small><strong>${money(personalBal)}</strong><span>Personal savings only</span></div>
      </div>
    </div>` : ""}
    ${showSusu ? `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Susu Sitting Summary</h2></div>
      <div class="grid four">
        <div class="stat"><small>Total Sittings</small><strong>${sitting.target}</strong><span>Meetings in cycle</span></div>
        <div class="stat"><small>Sittings Paid</small><strong>${sitting.paid}</strong><span>Completed</span></div>
        <div class="stat"><small>Remaining</small><strong>${sitting.remaining}</strong><span>Sittings left</span></div>
        <div class="stat"><small>Per Sitting</small><strong>${money(sitting.perSitting)}</strong><span>Standard amount</span></div>
      </div>
    </div>` : ""}
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Collections</h2></div>
      ${renderCollectionsTable(collections)}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Loans</h2></div>
      ${renderMemberLoansTable(loans)}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Transactions</h2></div>
      ${renderTransactionsTable(txs)}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Messages</h2></div>
      ${renderMemberMessagesTable(messages)}
    </div>
  `;
}

function renderMessagesTable() {
  if (!visibleMessages().length) return `<div class="empty">No member messages yet. A confirmation SMS is created after each transaction.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th><input type="checkbox" id="selectAllMessages" /></th><th>Date</th><th>Type</th><th>Member</th><th>Phone</th><th>Amount</th><th>Total</th><th>Message</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${visibleMessages().slice().reverse().map((message) => `
            <tr>
              <td>${message.status === "Cancelled" || message.status === "Sent" ? "" : `<input type="checkbox" data-message-select="${message.id}" />`}</td>
              <td>${message.date}</td>
              <td>${escapeHtml(message.kind || "Payment")}</td>
              <td>${escapeHtml(customerName(message.customerId))}</td>
              <td>${escapeHtml(message.phone)}</td>
              <td>${money(message.amountPaid)}</td>
              <td>${money(message.totalContributed)}</td>
              <td>${escapeHtml(message.body)}</td>
              <td><span class="pill ${message.status === "Cancelled" ? "bad" : message.status === "Sent" ? "" : "blue"}">${message.status}</span></td>
              <td>${message.status === "Cancelled" || message.status === "Sent" ? "" : `<button class="btn secondary" data-send-message="${message.id}">Send SMS</button>`}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function selectedMessageIds() {
  return Array.from(document.querySelectorAll("[data-message-select]:checked")).map((input) => input.dataset.messageSelect);
}

function renderMemberMessagesTable(messages) {
  if (!messages.length) return `<div class="empty">No messages recorded for this member.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Phone</th><th>Message</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${messages.map((message) => `
            <tr>
              <td>${message.date}</td>
              <td>${escapeHtml(message.kind || "Payment")}</td>
              <td>${escapeHtml(message.phone)}</td>
              <td>${escapeHtml(message.body)}</td>
              <td><span class="pill ${message.status === "Cancelled" ? "bad" : message.status === "Sent" ? "" : "blue"}">${message.status}</span></td>
              <td>${message.status === "Cancelled" || message.status === "Sent" ? "" : `<button class="btn secondary" data-send-message="${message.id}">Send SMS</button>`}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderImports() {
  if (!primaryGroup() && !isKBA()) return `<div class="notice">No susu location has been assigned to this admin yet.</div>`;
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Upload Existing Records</h2></div>
        <form id="importForm" class="form-grid">
          <div class="field full">
            <label>File</label>
            <input name="file" type="file" accept=".xlsx,.xls,.csv,.pdf,.docx,.txt" required />
          </div>
          <div class="field">
            <label>PDF/DOCX Record Type</label>
            <select name="kind">
              <option value="auto">Auto / Excel Sheets</option>
              <option value="savings">Savings Sheet</option>
              <option value="loans">Loan Sheet</option>
              <option value="log">Log Sheet</option>
            </select>
          </div>
          <div class="field">
            <label>Location</label>
            ${groupSelect("groupId")}
          </div>
          <div class="form-actions full"><button class="btn" type="submit">Deduce and import</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Expected Columns</h2></div>
        <div class="calc-list">
          <div><span>Savings</span><strong>date, name, phone, NHIS, amount, total</strong></div>
          <div><span>Loans</span><strong>date, name, principal, interest, interest months, total, paid</strong></div>
          <div><span>Log</span><strong>date, name/user, action, details</strong></div>
        </div>
        <p class="notice">Excel files work best when sheet names include Savings, Loans, or Log. PDF/DOCX files must contain selectable text, not only scanned images.</p>
      </div>
    </div>
    <div id="importResult" class="panel" style="margin-top:18px">
      <div class="empty">Upload a file to preview the import result.</div>
    </div>
  `;
}

function renderReports() {
  const m = metrics();
  const range = reportDateRange();
  const reportTransactions = visibleTransactions().filter((tx) => tx.date >= range.from && tx.date <= range.to);
  return `
    <div class="grid four">
      <div class="stat"><small>Cash In</small><strong>${money(m.deposits + m.repayments + m.interestPaid)}</strong></div>
      <div class="stat"><small>Cash Out</small><strong>${money(m.withdrawals + m.disbursed)}</strong></div>
      <div class="stat"><small>Net Cash</small><strong>${money(m.keeperBalance)}</strong></div>
      <div class="stat"><small>Expected Interest</small><strong>${money(visibleLoans().reduce((s, l) => s + (l.totalDue - l.principal), 0))}</strong></div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Report Period</h2>
        <div class="row-actions">
          <button class="btn secondary" data-report-range="today">Today</button>
          <button class="btn secondary" data-report-range="yesterday">Yesterday</button>
          <button class="btn secondary" data-report-range="week">This Week</button>
          <button class="btn secondary" data-report-range="month">This Month</button>
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label>From</label><input id="reportFrom" type="date" value="${range.from}" /></div>
        <div class="field"><label>To</label><input id="reportTo" type="date" value="${range.to}" /></div>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Daily Money Received</h2>
        <button class="btn ghost" data-export="dailyLog">Export CSV</button>
      </div>
      ${renderDailyMoneyLogTable(dailyMoneyLogRows(range.from, range.to))}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Member Financial Report</h2>
        <button class="btn ghost" data-export="memberReport">Export CSV</button>
      </div>
      ${renderMemberFinancialReportTable()}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Transaction Ledger</h2>
        <div class="row-actions">
          <button class="btn ghost" data-export="transactions">Export CSV</button>
          <button class="btn ghost" onclick="window.print()">Print</button>
        </div>
      </div>
      ${renderTransactionsTable(reportTransactions.slice().reverse())}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Members Behind</h2>
        <button class="btn ghost" data-export="arrears">Export CSV</button>
      </div>
      ${renderArrearsTable()}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Break / Distribution</h2>
        <button class="btn ghost" data-export="distribution">Export CSV</button>
      </div>
      ${renderDistributionTable()}
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Audit Trail</h2>
        <button class="btn ghost" data-export="audit">Export CSV</button>
      </div>
      ${renderAuditTable()}
    </div>
    ${renderAgencyReportsExtra()}
    ${renderCollectionReportsExtra(range)}
    ${renderBiReportsBlock(range)}
    ${renderPaymentReportsBlock()}
    ${renderDocumentReportsBlock()}
    ${renderJobReportsBlock()}
    ${renderMonitoringReportsBlock()}
    ${renderGatewayReportsBlock()}
    ${renderRecoveryReportsBlock()}
    ${renderSecurityReportsBlock()}
    ${renderWorkflowReportsBlock()}
    ${renderRuleReportsBlock()}
    ${renderExchangeReportsBlock()}
    ${renderRecordsReportsBlock()}
    ${renderEnterpriseBiReportsBlock()}
    ${renderIntegrationReportsBlock()}
    ${renderEnterpriseAiReportsBlock()}
    ${renderPlatformReportsBlock()}
    ${renderWave5ReportsExtras()}
    ${renderWave7ReportsExtras()}
    ${renderWave8CertificationExtras({ surface: "reports" })}
    ${renderWave9PilotExtras({ surface: "reports" })}
    ${renderWave10GoliveExtras({ surface: "reports" })}
  `;
}

function renderCollectionReportsExtra(range = reportDateRange()) {
  const rows = visibleCollections().filter((item) => item.date >= range.from && item.date <= range.to && !item.reversed);
  const stats = collectionAnalytics(rows, {
    customers: state.customers,
    users: state.users,
    products: state.savingsProducts,
    groups: state.groups,
    from: range.from,
    to: range.to
  });
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Individual Savings Collection Reports</h2>
        <div class="row-actions">
          <button class="btn ghost" type="button" id="exportCollectionReportBtn">Export CSV / Excel</button>
          <button class="btn ghost" type="button" onclick="window.print()">Print</button>
        </div>
      </div>
      ${renderCollectionAnalyticsPanel(stats)}
      <div class="grid two" style="margin-top:12px">
        <div>
          <h3>Payment methods</h3>
          ${stats.byMethod.map((item) => `<div class="calc-list"><div><span>${escapeHtml(item.label)}</span><strong>${money(item.amount)}</strong></div></div>`).join("") || `<div class="empty">No collections in this period.</div>`}
        </div>
        <div>
          <h3>Top customers</h3>
          ${stats.topCustomers.map((item) => `<div class="calc-list"><div><span>${escapeHtml(item.label)}</span><strong>${money(item.amount)}</strong></div></div>`).join("") || `<div class="empty">No customer totals yet.</div>`}
        </div>
      </div>
    </div>
  `;
}

function renderBiReportsBlock(range = reportDateRange()) {
  const user = currentUser();
  const catalogId = sessionStorage.getItem("bi_report_id") || "collections_daily";
  const result = sessionStorage.getItem("bi_report_id")
    ? runReport(state, catalogId, {
        user,
        from: range.from,
        to: range.to,
        branchId: sessionStorage.getItem("bi_branch") || "",
        agentId: sessionStorage.getItem("bi_agent") || "",
        q: sessionStorage.getItem("bi_q") || ""
      })
    : null;
  const searchQ = sessionStorage.getItem("bi_search") || "";
  return renderBiReportsExtra({
    dash: reportDashboard(state, range, user),
    series: analyticsSeries(state, range, user),
    catalogId,
    result,
    history: state.reportHistory || [],
    canAccounting: canAction(user, "Reports.Accounting") || canAction(user, "Accounting.View"),
    canExecutive: canAction(user, "Reports.Executive"),
    canCustom: canAction(user, "Reports.Custom"),
    canSchedule: canAction(user, "Reports.Schedule"),
    canExport: canAction(user, "Reports.Export"),
    searchHits: searchQ ? searchReportRecords(state, searchQ, user) : null
  });
}

function processDueReports() {
  const due = runDueSchedules(state, currentUser(), uid);
  if (due.ran) saveState();
}

function handleBiReportForm(event) {
  event.preventDefault();
  const data = formData(event.target);
  const range = reportDateRange();
  sessionStorage.setItem("bi_report_id", data.reportId);
  sessionStorage.setItem("bi_branch", data.branchId || "");
  sessionStorage.setItem("bi_agent", data.agentId || "");
  const started = Date.now();
  const result = runReport(state, data.reportId, {
    user: currentUser(),
    from: range.from,
    to: range.to,
    branchId: data.branchId,
    agentId: data.agentId
  });
  recordReportHistory(state, {
    reportId: data.reportId,
    reportName: REPORT_CATALOG.find((item) => item.id === data.reportId)?.name || data.reportId,
    userId: currentUser()?.id,
    branchId: data.branchId || currentUser()?.groupId || "",
    filters: { from: range.from, to: range.to, branchId: data.branchId, agentId: data.agentId },
    format: "view",
    rowCount: result.total || result.rows?.length || 0,
    durationMs: Date.now() - started,
    from: range.from,
    to: range.to,
    error: result.error
  }, uid);
  saveState();
  if (result.error) toast(result.error);
  else toast("Report generated");
  render();
}

function handleCustomReportForm(event) {
  event.preventDefault();
  const data = formData(event.target);
  const range = reportDateRange();
  const spec = {
    name: data.name,
    source: data.source,
    groupBy: data.groupBy,
    sort: data.sort,
    fields: String(data.fields || "").split(",").map((item) => item.trim()).filter(Boolean),
    from: range.from,
    to: range.to
  };
  const result = runCustomReport(state, spec, currentUser());
  if (result.error) {
    toast(result.error);
    return;
  }
  saveReportTemplate(state, { name: spec.name, spec }, currentUser(), uid);
  recordReportHistory(state, {
    reportId: "custom",
    reportName: spec.name,
    userId: currentUser()?.id,
    filters: spec,
    format: "view",
    rowCount: result.total || 0,
    from: range.from,
    to: range.to
  }, uid);
  sessionStorage.setItem("bi_report_id", "collections_daily");
  saveState();
  toast("Custom report saved");
  const csv = exportReportCsv(result, {
    company: state.settings?.businessName,
    generatedBy: currentUser()?.name,
    generatedAt: new Date().toISOString(),
    filters: spec
  });
  download(`custom-report-${today()}.csv`, csv, "text/csv");
}

function handleScheduleReportForm(event) {
  event.preventDefault();
  const data = formData(event.target);
  const result = scheduleReport(state, {
    reportId: data.reportId,
    frequency: data.frequency,
    delivery: data.delivery,
    filters: reportDateRange()
  }, currentUser(), uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast("Report scheduled");
  render();
}

function handleBiSearchForm(event) {
  event.preventDefault();
  const data = formData(event.target);
  sessionStorage.setItem("bi_search", data.q || "");
  render();
}

function exportCurrentBiReport() {
  const reportId = sessionStorage.getItem("bi_report_id");
  if (!reportId) return toast("Generate a report first");
  if (!canAction(currentUser(), "Reports.Export")) return toast("You cannot export reports");
  const range = reportDateRange();
  const result = runReport(state, reportId, {
    user: currentUser(),
    from: range.from,
    to: range.to,
    branchId: sessionStorage.getItem("bi_branch") || "",
    agentId: sessionStorage.getItem("bi_agent") || "",
    pageSize: 10000
  });
  if (result.error) return toast(result.error);
  const csv = exportReportCsv(result, {
    company: state.settings?.businessName,
    generatedBy: currentUser()?.name,
    generatedAt: new Date().toISOString(),
    filters: { from: range.from, to: range.to }
  });
  download(`${reportId}-${today()}.csv`, csv, "text/csv");
}

function renderLogs() {
  const selectedDate = sessionStorage.getItem("log_date") || today();
  const rows = dailyInputLogRows(selectedDate);
  return `
    <div class="panel">
      <div class="section-title">
        <h2>Collector's Sheet</h2>
        <div class="row-actions">
          <input id="logDate" type="date" value="${selectedDate}" />
          <button class="btn secondary" id="todayLogBtn" type="button">Today</button>
          <button class="btn ghost" id="printLogBtn" type="button">Print / PDF</button>
          <button class="btn ghost" data-export="dailyInputs">Export CSV</button>
        </div>
      </div>
      <div class="notice good">This shows all money inputs recorded for the selected day: contributions, loan repayments, and interest payments.</div>
      <div id="dailyInputLogTable">${renderDailyInputLogTable(rows)}</div>
    </div>
  `;
}

function renderDailyInputLogTable(rows = dailyInputLogRows()) {
  if (!rows.length) return `<div class="empty">No inputs recorded for this date.</div>`;
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const tableHtml = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Date</th><th>Location</th><th>Member</th><th>Input Type</th><th>Amount</th><th>Officer</th><th>Reference</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.time)}</td>
              <td>${escapeHtml(row.date)}</td>
              <td>${escapeHtml(row.group)}</td>
              <td>${escapeHtml(row.member)}</td>
              <td>${escapeHtml(row.type)}</td>
              <td>${money(row.amount)}</td>
              <td>${escapeHtml(row.officer)}</td>
              <td>${escapeHtml(row.ref)}</td>
            </tr>
          `).join("")}
          <tr>
            <td colspan="5"><strong>Total received</strong></td>
            <td><strong>${money(total)}</strong></td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  return mobileTableWrap(renderMobileDailyInputLogCards(rows), tableHtml);
}

function handoverReceiverSelect(name, selectedId = "", { collectorId = "", groupId = "" } = {}) {
  const receivers = listHandoverReceivers(state.users || [], {
    excludeUserId: collectorId || currentUser()?.id || "",
    groupId: groupId || primaryGroup()?.id || ""
  });
  if (!receivers.length) {
    return `<select name="${name}" required disabled><option value="">No Manager / Accountant available — ask owner to create one</option></select>`;
  }
  return `<select name="${name}" required>
    <option value="">Select who receives the cash</option>
    ${receivers.map((user) => `<option value="${escapeAttr(user.id)}" ${user.id === selectedId ? "selected" : ""}>${escapeHtml(user.name)} · ${escapeHtml(roleLabel(user.role))}</option>`).join("")}
  </select>`;
}

function renderHandover() {
  const date = sessionStorage.getItem("handover_date") || today();
  const user = currentUser();
  const focusId = sessionStorage.getItem("handover_focus_id") || "";
  const collectorId = isCollector()
    ? user.id
    : sessionStorage.getItem("handover_collector_id") || state.users.find((item) => item.role === "Collector" && item.active)?.id || "";
  const groupId = isCollector()
    ? (user.groupId || primaryGroup()?.id || "")
    : (state.users.find((item) => item.id === collectorId)?.groupId || primaryGroup()?.id || "");
  const channels = channelTotalsForCollector(state, collectorId, date, { collections: visibleCollections() });
  const expected = expectedCashForCollector(state, collectorId, date, {
    collections: visibleCollections(),
    verificationStatus: (item) => collectionVerificationStatus(item)
  });
  const existing = (state.handovers || []).find((item) => item.collectorId === collectorId && item.date === date);
  const canSubmit = isCollector() && user.id === collectorId && (!existing || !handoverIsConfirmed(existing));
  const pendingForMe = pendingHandoversForReceiver(state.handovers || [], user.id);
  const verifyTarget = focusId
    ? (state.handovers || []).find((item) => item.id === focusId)
    : (pendingForMe[0] || (existing && canVerifyHandover(user, existing, state) ? existing : null));
  const canVerify = verifyTarget && canVerifyHandover(user, verifyTarget, state) && verifyTarget.status === "Submitted";
  const receivers = listHandoverReceivers(state.users || [], { excludeUserId: collectorId, groupId });
  return `
    ${!isCollector() && pendingForMe.length ? `
    <div class="panel notice good" style="margin-bottom:18px">
      <div class="section-title"><h2>Pending cash to confirm (${pendingForMe.length})</h2></div>
      <p class="muted">Collectors handed cash to you. Confirm the amount you received.</p>
      <div class="mobile-card-list">
        ${pendingForMe.map((row) => `
          <article class="mobile-data-card">
            <div class="mobile-data-card-head">
              <div>
                <strong>${escapeHtml(userName(row.collectorId))}</strong>
                <div class="muted">${row.date}</div>
              </div>
              <strong>${money(row.declaredCash)}</strong>
            </div>
            <div class="mobile-data-card-actions">
              <button class="btn collector-action-btn" type="button" data-focus-handover="${row.id}">Confirm received</button>
            </div>
          </article>
        `).join("")}
      </div>
    </div>` : ""}
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Daily Cash Handover</h2></div>
        <p class="muted">${isCollector()
          ? "Choose the Manager, Operations Manager, Accountant, or Cashier who is receiving your cash, then submit the amount."
          : "Collectors submit cash to a responsible receiver. Confirm receipt when the cash reaches you."}</p>
        ${!receivers.length && isCollector() ? `<div class="notice warn">No handover receiver is set up yet. Ask the owner to create a Branch Manager, Operations Manager, Accountant, or Cashier account.</div>` : ""}
        <form id="handoverForm" class="form-grid">
          <div class="field"><label>Date</label><input name="date" type="date" value="${date}" required ${canSubmit ? "" : "readonly"} /></div>
          ${!isCollector() ? `<div class="field full"><label>Collector</label>${collectorSelect("collectorId", collectorId)}</div>` : `<input type="hidden" name="collectorId" value="${escapeAttr(collectorId)}" />`}
          <div class="field full"><label>Hand over to</label>
            ${canSubmit
              ? handoverReceiverSelect("receiverId", existing?.receiverId || "", { collectorId, groupId })
              : `<input readonly value="${escapeAttr(existing?.receiverName || userName(existing?.receiverId) || "—")}" />`}
          </div>
          <div class="field"><label>Expected Cash (Verified)</label><input readonly value="${expected.toFixed(2)}" /></div>
          <div class="field"><label>Cash Declared / Handed Over</label><input name="declaredCash" type="number" min="0" step="0.01" value="${existing?.declaredCash ?? ""}" required ${canSubmit ? "" : "readonly"} /></div>
          <div class="field full"><label>Note</label><textarea name="note" ${canSubmit ? "" : "readonly"}>${escapeHtml(existing?.note || "")}</textarea></div>
          ${canSubmit ? `<div class="form-actions full ${isMobileLayout() ? "collection-sticky-actions" : ""}"><button class="btn collector-action-btn" type="submit" ${receivers.length ? "" : "disabled"}>${existing ? "Update handover" : "Submit handover"}</button></div>` : ""}
          ${existing && isCollector() ? `<div class="notice ${handoverIsConfirmed(existing) ? "good" : "warn"}">${handoverIsConfirmed(existing)
            ? `Confirmed received by ${escapeHtml(userName(existing.verifiedBy) || existing.receiverName || "receiver")} · ${money(existing.countedCash ?? existing.declaredCash)}`
            : `Awaiting confirmation from ${escapeHtml(existing.receiverName || userName(existing.receiverId) || "receiver")}`}</div>` : ""}
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>${date} Channel Totals</h2></div>
        <div class="calc-list">
          <div><span>Cash (verified expected)</span><strong>${money(expected)}</strong></div>
          <div><span>Mobile Money</span><strong>${money(channels["Mobile Money"] || 0)}</strong></div>
          <div><span>Bank Transfer</span><strong>${money(channels["Bank Transfer"] || 0)}</strong></div>
          <div><span>POS / Card</span><strong>${money(channels["POS/Card"] || 0)}</strong></div>
        </div>
        ${verifyTarget ? `
          <div class="section-title" style="margin-top:16px"><h3>Confirm cash received</h3></div>
          <div class="calc-list">
            <div><span>Collector</span><strong>${escapeHtml(userName(verifyTarget.collectorId))}</strong></div>
            <div><span>Handed to</span><strong>${escapeHtml(verifyTarget.receiverName || userName(verifyTarget.receiverId) || "—")}</strong></div>
            <div><span>Status</span><strong>${escapeHtml(handoverStatusLabel(verifyTarget.status))}</strong></div>
            <div><span>Declared cash</span><strong>${money(verifyTarget.declaredCash)}</strong></div>
            <div><span>Counted cash</span><strong>${money(verifyTarget.countedCash ?? 0)}</strong></div>
          </div>
          ${canVerify ? `
            <form id="verifyHandoverForm" class="form-grid" style="margin-top:16px">
              <input type="hidden" name="handoverId" value="${verifyTarget.id}" />
              <div class="field"><label>Counted cash you received</label><input name="countedCash" type="number" min="0" step="0.01" value="${Number(verifyTarget.declaredCash || 0).toFixed(2)}" required /></div>
              <div class="field full"><label>Shortage / surplus reason (if any)</label><textarea name="shortageReason">${escapeHtml(verifyTarget.shortageReason || "")}</textarea></div>
              <div class="form-actions full"><button class="btn collector-action-btn" type="submit">Confirm I received this cash</button></div>
            </form>
          ` : handoverIsConfirmed(verifyTarget) ? `<div class="notice good" style="margin-top:12px">Already confirmed by ${escapeHtml(userName(verifyTarget.verifiedBy))}.</div>` : ""}
        ` : `<div class="empty" style="margin-top:16px">${isCollector() ? "After you submit, your selected receiver will confirm the cash." : "No handover selected for confirmation."}</div>`}
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Handover History</h2></div>
      ${renderHandoverTable()}
    </div>
  `;
}

function renderHandoverTable() {
  const rows = (state.handovers || []).slice().reverse();
  if (!rows.length) return `<div class="empty">No handovers yet.</div>`;
  const tableHtml = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Collector</th><th>Handed to</th><th>Expected</th><th>Declared</th><th>Counted</th><th>Status</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${row.date}</td>
              <td>${escapeHtml(userName(row.collectorId))}</td>
              <td>${escapeHtml(row.receiverName || userName(row.receiverId) || "—")}</td>
              <td>${money(row.expectedCash)}</td>
              <td>${money(row.declaredCash)}</td>
              <td>${money(row.countedCash ?? 0)}</td>
              <td><span class="pill ${handoverIsConfirmed(row) ? "" : "warn"}">${escapeHtml(handoverStatusLabel(row.status))}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  return mobileTableWrap(renderMobileHandoverCards(rows), tableHtml);
}

function handleHandover(event) {
  event.preventDefault();
  const data = formData(event.target);
  const collectorId = isCollector() ? currentUser().id : data.collectorId;
  const groupId = state.users.find((item) => item.id === collectorId)?.groupId || primaryGroup()?.id || "";
  if (!collectorId || !groupId) {
    toast("Collector and branch are required");
    return;
  }
  const receiverId = String(data.receiverId || "").trim();
  const receiver = (state.users || []).find((item) => item.id === receiverId);
  if (!receiverId || !receiver) {
    toast("Select who you are handing the cash to (Manager, Accountant, or Cashier)");
    return;
  }
  let handover = (state.handovers || []).find((item) => item.collectorId === collectorId && item.date === data.date);
  if (handover && handoverIsConfirmed(handover)) {
    toast("This handover was already confirmed. Start a new day or ask the receiver to review.");
    return;
  }
  if (!handover) {
    handover = buildHandoverRecord(state, {
      id: uid("hand"),
      collectorId,
      groupId,
      date: data.date,
      declaredCash: data.declaredCash,
      note: data.note,
      userId: currentUser().id,
      receiverId,
      receiverName: `${receiver.name} · ${roleLabel(receiver.role)}`
    });
    state.handovers.push(handover);
  } else {
    handover.declaredCash = Number(data.declaredCash || 0);
    handover.note = data.note || "";
    handover.receiverId = receiverId;
    handover.receiverName = `${receiver.name} · ${roleLabel(receiver.role)}`;
    handover.status = "Submitted";
    handover.submittedAt = new Date().toISOString();
    handover.verifiedAt = "";
    handover.verifiedBy = "";
    handover.countedCash = null;
  }
  const diff = Number(handover.declaredCash) - Number(handover.expectedCash || 0);
  if (diff < 0) {
    recordException(state, {
      id: uid("ex"),
      type: "handover_shortage",
      severity: "danger",
      referenceId: handover.id,
      referenceType: "handover",
      collectorId,
      reason: `Declared cash short by ${money(Math.abs(diff))} on ${handover.date}`
    });
  }
  sessionStorage.setItem("handover_date", data.date);
  saveState();
  logAudit("Cash handover submitted", `${userName(collectorId)} → ${handover.receiverName} · ${handover.date} · ${money(handover.declaredCash)}`);
  toast(`Handover submitted to ${receiver.name}. They must confirm receipt.`);
  render();
}

function handleVerifyHandover(event) {
  event.preventDefault();
  const data = formData(event.target);
  const handover = (state.handovers || []).find((item) => item.id === data.handoverId);
  if (!handover || !canVerifyHandover(currentUser(), handover, state)) {
    toast("You cannot confirm this handover");
    return;
  }
  verifyHandover(handover, {
    countedCash: data.countedCash,
    verifiedBy: currentUser().id,
    shortageReason: data.shortageReason
  });
  handoverExceptions(handover).forEach((ex) => {
    recordException(state, {
      id: uid("ex"),
      type: ex.type,
      severity: ex.severity,
      referenceId: handover.id,
      referenceType: "handover",
      collectorId: handover.collectorId,
      reason: `${ex.type} on ${handover.date}`
    });
  });
  sessionStorage.removeItem("handover_focus_id");
  saveState();
  logAudit("Cash handover received", `${userName(handover.collectorId)} · confirmed by ${currentUser().name} · ${money(handover.countedCash)}`);
  toast(`Confirmed: received ${money(handover.countedCash)} from ${userName(handover.collectorId)}`);
  render();
}

function renderDailyClosing() {
  const selectedDate = sessionStorage.getItem("closing_date") || today();
  const expected = expectedCashForDate(selectedDate);
  const channels = paymentChannelTotals(selectedDate);
  const electronicTotal = PAYMENT_METHODS.filter((method) => method !== "Cash").reduce((sum, method) => sum + Number(channels[method] || 0), 0);
  const closing = visibleClosings().find((item) => item.date === selectedDate);
  const canEdit = canSaveClosing() || isKBA();
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Close Day</h2></div>
        ${canEdit ? "" : `<div class="notice">View only. Daily closing is saved by Manager, Assistant Manager or Collector.</div>`}
        <form id="closingForm" class="form-grid">
          <div class="field"><label>Date</label><input name="date" type="date" value="${selectedDate}" required ${canEdit ? "" : "readonly"} /></div>
          <div class="field"><label>Expected Cash (Verified)</label><input name="expected" type="number" step="0.01" value="${expected}" readonly /></div>
          <div class="field"><label>Cash Counted</label><input name="counted" type="number" min="0" step="0.01" value="${closing?.counted || ""}" required ${canEdit ? "" : "readonly"} /></div>
          <div class="field"><label>Closed By</label><input name="closedByName" value="${escapeAttr(closing?.closedByName || currentUser()?.name || "")}" required ${canEdit ? "" : "readonly"} /></div>
          <div class="field full"><label>Note</label><textarea name="note" ${canEdit ? "" : "readonly"}>${escapeHtml(closing?.note || "")}</textarea></div>
          <div class="form-actions full">${canEdit ? `<button class="btn" type="submit">${closing ? "Update closing" : "Save closing"}</button>` : ""}<button class="btn ghost" type="button" id="printClosingBtn">Print Control Sheet</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>${selectedDate} Reconciliation</h2></div>
        <div class="calc-list">
          <div><span>Cash expected</span><strong>${money(expected)}</strong></div>
          <div><span>Electronic collections</span><strong>${money(electronicTotal)}</strong></div>
          <div><span>Cash counted</span><strong>${money(closing?.counted || 0)}</strong></div>
          <div><span>Shortage / overage</span><strong>${money(Number(closing?.counted || 0) - expected)}</strong></div>
          <div><span>Status</span><strong>${closing ? "Closed" : "Open"}</strong></div>
        </div>
        <div class="section-title" style="margin-top:16px"><h3>Payment Channels</h3></div>
        <div class="calc-list">
          ${PAYMENT_METHODS.map((method) => `<div><span>${method}</span><strong>${money(channels[method] || 0)}</strong></div>`).join("")}
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Closing History</h2><button class="btn ghost" data-export="closings">Export CSV</button></div>
      ${renderClosingsTable()}
    </div>
  `;
}

function renderClosingsTable() {
  const rows = visibleClosings().slice().reverse();
  if (!rows.length) return `<div class="empty">No daily closings yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Location</th><th>Expected</th><th>Counted</th><th>Short / Over</th><th>Closed By</th><th>Note</th><th></th></tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>
            <td>${row.date}</td>
            <td>${escapeHtml(groupName(row.groupId))}</td>
            <td>${money(row.expected)}</td>
            <td>${money(row.counted)}</td>
            <td>${money(row.difference)}</td>
            <td>${escapeHtml(row.closedByName || userName(row.userId))}</td>
            <td>${escapeHtml(row.note || "")}</td>
            <td><button class="btn secondary" data-print-closing="${row.id}">Print</button></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDistributionTable() {
  const rows = distributionRows();
  if (!rows.length) return `<div class="empty">No members available for distribution calculation.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Location</th><th>Customer</th><th>Contributed</th><th>Loan Balance</th><th>Final Payout</th><th>Progress</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.group)}</td>
              <td>${escapeHtml(row.member)}</td>
              <td>${money(row.contributed)}</td>
              <td>${money(row.loanBalance)}</td>
              <td><strong>${money(row.finalPayout)}</strong></td>
              <td>${row.settingsPaid} / ${row.settingsTarget}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDailyMoneyLogTable(rows = dailyMoneyLogRows()) {
  if (!rows.length) return `<div class="empty">No money received yet.</div>`;
  const tableHtml = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Susu Contributions</th><th>Loan Repaid</th><th>Interest Paid</th><th>Total Received</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${row.date}</td>
              <td>${money(row.contributions)}</td>
              <td>${money(row.loanRepaid)}</td>
              <td>${money(row.interestPaid)}</td>
              <td><strong>${money(row.totalReceived)}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  return mobileTableWrap(renderMobileDailyMoneyLogCards(rows), tableHtml);
}

function renderMemberFinancialReportTable() {
  const rows = memberFinancialReportRows();
  if (!rows.length) return `<div class="empty">No members available for report.</div>`;
  const totals = rows.reduce((sum, row) => ({
    contribution: sum.contribution + row.totalContribution,
    loan: sum.loan + row.totalLoan,
    loanRepaid: sum.loanRepaid + row.loanRepaid,
    interestPaid: sum.interestPaid + row.interestPaid,
    interestRemaining: sum.interestRemaining + row.interestRemaining,
    amountToReceive: sum.amountToReceive + row.amountToReceive
  }), { contribution: 0, loan: 0, loanRepaid: 0, interestPaid: 0, interestRemaining: 0, amountToReceive: 0 });
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Location</th><th>Member</th><th>Total Contributions</th><th>Total Loan</th><th>Loan Repaid</th><th>Interest Paid</th><th>Interest Remaining</th><th>Amount To Receive</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.group)}</td>
              <td>${escapeHtml(row.member)}</td>
              <td>${money(row.totalContribution)}</td>
              <td>${money(row.totalLoan)}</td>
              <td>${money(row.loanRepaid)}</td>
              <td>${money(row.interestPaid)}</td>
              <td>${money(row.interestRemaining)}</td>
              <td><strong>${money(row.amountToReceive)}</strong></td>
            </tr>
          `).join("")}
          <tr>
            <td colspan="2"><strong>Totals</strong></td>
            <td><strong>${money(totals.contribution)}</strong></td>
            <td><strong>${money(totals.loan)}</strong></td>
            <td><strong>${money(totals.loanRepaid)}</strong></td>
            <td><strong>${money(totals.interestPaid)}</strong></td>
            <td><strong>${money(totals.interestRemaining)}</strong></td>
            <td><strong>${money(totals.amountToReceive)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderAuditTable() {
  const rows = visibleAudit().slice().reverse();
  if (!rows.length) return `<div class="empty">No audit activity yet.</div>`;
  const tableHtml = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${row.date}</td>
              <td>${escapeHtml(userName(row.userId))}</td>
              <td>${escapeHtml(row.action)}</td>
              <td>${escapeHtml(row.details || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  return mobileTableWrap(renderMobileAuditCards(rows), tableHtml);
}

function renderTransactionsTable(transactions) {
  if (!transactions.length) return `<div class="empty">No transactions yet.</div>`;
  const tableHtml = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Customer</th><th>Amount</th><th>Officer</th><th>Reference</th></tr></thead>
        <tbody>
          ${transactions.map((tx) => `
            <tr>
              <td>${tx.date}</td>
              <td>${tx.type}</td>
              <td>${escapeHtml(customerName(tx.customerId))}</td>
              <td>${money(tx.amount)}</td>
              <td>${escapeHtml(userName(tx.userId))}</td>
              <td>
                <div class="row-actions">
                  <button class="btn secondary" data-receipt="${tx.id}">Print</button>
                  <button class="btn ghost" data-share-receipt="${tx.id}">Share</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  return mobileTableWrap(renderMobileTransactionCards(transactions), tableHtml);
}

function renderDevicesPanel() {
  const devices = (state.devices || []).slice().sort((a, b) => Date.parse(b.lastSeenAt || 0) - Date.parse(a.lastSeenAt || 0));
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Registered Devices</h2></div>
      <p class="muted">Disable lost or stolen collector phones immediately. Disabled devices cannot sign in.</p>
      ${devices.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Label</th><th>Collector</th><th>Last seen</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${devices.map((device) => `
                <tr>
                  <td>${escapeHtml(device.label || device.fingerprint?.slice(0, 12) || "Device")}</td>
                  <td>${escapeHtml(userName(device.userId))}</td>
                  <td>${device.lastSeenAt ? escapeHtml(new Date(device.lastSeenAt).toLocaleString()) : "-"}</td>
                  <td><span class="pill ${device.active !== false ? "" : "bad"}">${device.active !== false ? "Active" : "Disabled"}</span></td>
                  <td>
                    ${device.active !== false
                      ? `<button class="btn danger" type="button" data-disable-device="${device.id}">Disable</button>`
                      : `<button class="btn secondary" type="button" data-enable-device="${device.id}">Enable</button>`}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">No devices registered yet. Devices register automatically on staff login.</div>`}
    </div>
  `;
}

function renderMfaPanel() {
  if (!isKBA()) return "";
  const user = currentUser();
  if (!user) return "";
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Two-Factor Authentication (MFA)</h2></div>
      <p class="muted">Required for Manager and Assistant Manager accounts in production. Use Google Authenticator or similar app.</p>
      <div class="calc-list">
        <div><span>Status</span><strong>${userMfaEnabled(user) ? "Enabled" : user.mfaPending ? "Setup pending" : "Not enabled"}</strong></div>
        ${user.mfaPending && user.mfaSecret ? `<div class="field full"><label>Setup secret</label><input readonly value="${escapeAttr(user.mfaSecret)}" /><div class="muted">Scan this secret in your authenticator app, then enter the 6-digit code below.</div></div>` : ""}
      </div>
      <form id="mfaSetupForm" class="form-grid" style="margin-top:12px">
        <div class="field"><label>Verification code</label><input name="token" inputmode="numeric" maxlength="6" placeholder="000000" required /></div>
        <div class="form-actions full">
          <button class="btn secondary" type="submit" name="action" value="enable">${userMfaEnabled(user) ? "Re-verify MFA" : "Enable MFA"}</button>
          ${userMfaEnabled(user) ? `<button class="btn ghost" type="submit" name="action" value="disable">Disable MFA</button>` : ""}
          ${!user.mfaPending && !userMfaEnabled(user) ? `<button class="btn ghost" type="button" id="startMfaSetup">Start setup</button>` : ""}
        </div>
      </form>
    </div>
  `;
}

async function handleMfaSetup(event) {
  event.preventDefault();
  const user = currentUser();
  if (!user || !isKBA()) return;
  const data = formData(event.submitter ? event.target : event.target);
  const action = event.submitter?.value || data.action || "enable";
  if (action === "disable") {
    disableUserMfa(user);
    saveState();
    toast("MFA disabled");
    render();
    return;
  }
  const result = await confirmMfaSetup(user, data.token);
  if (!result.ok) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("MFA enabled", user.username);
  toast("MFA enabled successfully");
  render();
}

async function importLocalSnapshotToPostgres() {
  if (!relationalSyncEnabled(state)) {
    toast("Enable relational sync and configure Supabase first");
    return;
  }
  if (!confirm("Import current local data into PostgreSQL? Run once after migrations 001–005.")) return;
  toast("Importing to PostgreSQL...");
  const result = await importSnapshotToRelational(state, state);
  if (!result.ok) {
    toast(result.error || "Import failed");
    return;
  }
  logAudit("PostgreSQL import completed", JSON.stringify(result.result || {}));
  toast("Import completed");
  if (state.settings.postgresSourceOfTruth) {
    await loadStateFromRelational(state);
    saveState();
  }
  render();
}

function renderProductionPanel() {
  return `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Go-live checklist</h2></div>
      <ol class="muted">
        <li>Back up all data (Backup &amp; Restore screen)</li>
        <li>Run Supabase migrations 001–005</li>
        <li>Run <code>npm run import:relational</code> to migrate snapshot data</li>
        <li>Change owner password (min 8 characters) and enable MFA</li>
        <li>Enable relational sync + PostgreSQL source of truth + production mode</li>
        <li>Configure MoMo webhook URL on your provider dashboard</li>
        <li>Pilot one branch for 2–4 weeks before live funds</li>
      </ol>
      <p class="muted">See <code>PRODUCTION.md</code> in the project folder for the full checklist.</p>
      <div class="form-actions" style="margin-top:12px">
        <button class="btn secondary" type="button" id="importPostgresBtn">Import local data to PostgreSQL</button>
      </div>
    </div>
  `;
}

function renderSettings() {
  if (!canAccessSystemSettings()) return `<div class="notice">System defaults are controlled by the owner. Location operating rules are managed from My Location.</div>`;
  const syncMode = getSyncMode(state);
  const ownerPasswordPanel = isKBA() ? `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Change ${isSystemOwner() ? "Owner" : "Administrator"} Password</h2></div>
      <form id="kbaPasswordForm" class="form-grid">
        <div class="field"><label>Current password</label><div class="password-row"><input id="kbaCurrentPassword" name="currentPassword" type="password" required /><button class="btn ghost password-toggle" type="button" data-toggle-password="kbaCurrentPassword">Show</button></div></div>
        <div class="field"><label>New password</label><div class="password-row"><input id="kbaNewPassword" name="newPassword" type="password" minlength="8" required /><button class="btn ghost password-toggle" type="button" data-toggle-password="kbaNewPassword">Show</button></div></div>
        <div class="field"><label>Confirm new password</label><div class="password-row"><input id="kbaConfirmPassword" name="confirmPassword" type="password" minlength="8" required /><button class="btn ghost password-toggle" type="button" data-toggle-password="kbaConfirmPassword">Show</button></div></div>
        <div class="form-actions full"><button class="btn secondary" type="submit">Update password</button></div>
      </form>
    </div>
    ${isSystemOwner() ? `
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Transfer System Ownership</h2></div>
      <p class="muted">Only the System Owner can transfer the highest privilege to another active staff account. The current owner becomes a Super Administrator.</p>
      <form id="ownershipTransferForm" class="form-grid">
        <div class="field full"><label>New System Owner</label>
          <select name="userId" required>
            <option value="">Select an account</option>
            ${listUsersForActor(state.users, currentUser()).filter((user) => user.id !== currentUser()?.id && user.active && !user.pending && !isSystemDeveloperAccount(user)).map((user) =>
              `<option value="${escapeAttr(user.id)}">${escapeHtml(user.name)} (@${escapeHtml(user.username)}) · ${escapeHtml(roleLabel(user.role))}</option>`
            ).join("")}
          </select>
        </div>
        <div class="form-actions full"><button class="btn danger" type="submit">Transfer ownership</button></div>
      </form>
    </div>` : ""}
    ${renderDevicesPanel()}
    ${renderMfaPanel()}
    ${renderProductionPanel()}
  ` : "";
  return `
    <div class="panel">
      <div class="section-title"><h2>System Controls</h2></div>
      <form id="settingsForm" class="form-grid">
        <div class="field"><label>Business Name</label><input name="businessName" value="${escapeAttr(state.settings.businessName)}" required /></div>
        <div class="field"><label>Currency</label><input name="currency" value="${escapeAttr(state.settings.currency)}" required /></div>
        <div class="field"><label>Default Loan Interest %</label><input name="loanInterest" type="number" min="0" step="0.01" value="${state.settings.loanInterest}" required /></div>
        <div class="field"><label>Business ID</label><input name="businessId" value="${escapeAttr(businessId())}" readonly /></div>
        <div class="field"><label>Cloud Mode</label><select name="cloudMode"><option value="auto" ${state.settings.cloudMode === "auto" ? "selected" : ""}>Auto detect</option><option value="supabase" ${state.settings.cloudMode === "supabase" ? "selected" : ""}>Supabase</option><option value="local" ${state.settings.cloudMode === "local" ? "selected" : ""}>Local backup server</option></select></div>
        <div class="field full"><label>Supabase Project URL</label><input name="cloudUrl" value="${escapeAttr(cloudUrl())}" placeholder="https://your-project.supabase.co" /></div>
        <div class="field full"><label>Supabase Anon Key</label><textarea name="cloudKey" placeholder="Paste Supabase anon public key">${escapeHtml(cloudKey())}</textarea></div>
        <div class="field full"><label>Local Backup URL</label><input name="localBackupUrl" value="${escapeAttr(localBackupUrl())}" placeholder="http://localhost:8787" /></div>
        <div class="field full"><label>Sync Token</label><input name="syncToken" value="${escapeAttr(state.settings.syncToken || "")}" placeholder="Optional token for local backup server" /></div>
        <div class="field"><label><input type="checkbox" name="productionMode" ${state.settings.productionMode ? "checked" : ""} /> Production mode (blocks unsafe financial writes)</label></div>
        <div class="field"><label><input type="checkbox" name="relationalSync" ${state.settings.relationalSync ? "checked" : ""} /> Relational PostgreSQL sync (dual-write collections)</label></div>
        <div class="field"><label><input type="checkbox" name="postgresSourceOfTruth" ${state.settings.postgresSourceOfTruth ? "checked" : ""} /> PostgreSQL as source of truth (load from database)</label></div>
        <div class="field"><label><input type="checkbox" name="supabaseAuthEnabled" ${state.settings.supabaseAuthEnabled ? "checked" : ""} /> Supabase Auth (JWT) on login</label></div>
        <div class="field full"><label>MoMo Webhook Secret</label><input name="momoWebhookSecret" value="${escapeAttr(state.settings.momoWebhookSecret || "")}" placeholder="HMAC secret for provider callbacks" /></div>
        <div class="field"><label><input type="checkbox" name="encryptOfflineQueue" ${state.settings.encryptOfflineQueue !== false ? "checked" : ""} /> Encrypt offline queue at rest</label></div>
        <div class="field"><label><input type="checkbox" name="assistantCanVerifyHandover" ${state.settings.assistantCanVerifyHandover ? "checked" : ""} /> Assistant Manager can verify handovers</label></div>
        <div class="field"><label><input type="checkbox" name="assistantCanApproveReversals" ${state.settings.assistantCanApproveReversals ? "checked" : ""} /> Assistant Manager can approve reversals</label></div>
        <div class="form-actions full"><button class="btn" type="submit">Save settings</button></div>
      </form>
      ${productionWarnings(state, getAppConfig()).length ? `
        <div class="notice warn" style="margin-top:14px">
          <strong>Production warnings</strong>
          <ul>${productionWarnings(state, getAppConfig()).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
      ` : `<div class="notice good" style="margin-top:14px">No critical production warnings detected.</div>`}
      <div class="notice">Active sync mode: <strong>${syncMode}</strong>. Enable <strong>relational sync</strong> after running SQL migrations 001–003 in Supabase.</div>
      <div class="notice">Phone on same Wi‑Fi: set Local Backup URL to <code>http://YOUR-PC-IP:8787</code> (example <code>http://192.168.1.20:8787</code>) and enter the same sync token as the desktop server.</div>
    </div>
    ${ownerPasswordPanel}
    ${renderSystemAdministrationExtras()}
    ${renderPaymentProviderBlock()}
    ${renderDocumentTemplateBlock()}
  `;
}

function renderSystemAdministrationExtras() {
  const user = currentUser();
  ensureSystemConfig(state);
  let searchQuery = "";
  let category = "";
  try {
    const stored = JSON.parse(sessionStorage.getItem("config_search") || "{}");
    searchQuery = stored.q || "";
    category = stored.category || "";
  } catch {
    searchQuery = "";
  }
  const compare = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("config_compare") || "null");
    } catch {
      return null;
    }
  })();
  const diffs = compare ? compareConfigVersions(state, compare.from, compare.to) : [];
  const flags = FEATURE_FLAG_CATALOG.map((item) => {
    const row = (state.featureFlags || []).find((flag) => flag.id === item.id);
    return { ...item, enabled: row ? row.enabled !== false : item.defaultEnabled };
  });
  return renderSystemConfigExtras({
    profile: state.companyProfile || {},
    parameters: searchConfig(state, searchQuery, category),
    flags,
    products: state.productDefinitions || [],
    holidays: state.businessCalendars?.[0]?.holidays || [],
    drafts: state.configurationDrafts || [],
    versions: state.configurationVersions || [],
    diffs,
    searchQuery,
    category,
    stats: configDashboard(state),
    canConfigure: canAction(user, "System.Configure") || canAction(user, "Settings.Edit"),
    canSecurity: canAction(user, "System.Security"),
    canFlags: canAction(user, "System.FeatureFlags") || canAction(user, "Settings.Edit"),
    canApprove: canAction(user, "System.ConfigurationApprove") || isSystemOwner(),
    canBackup: canAction(user, "System.Backup") || canAction(user, "Backup.Create"),
    canProducts: canAction(user, "System.Products") || canAction(user, "Settings.Edit")
  });
}

function renderAdminStaffFields(editing = null) {
  return `
    <div class="section-title full"><h3>Assistant Manager Assignment</h3></div>
    <div class="field full"><label>Assigned Branch</label>${groupSelect("adminGroupId", editing?.groupId || "", true)}</div>
    <p class="muted full">Assistant Managers can verify electronic payments, review collections, and support daily operations for the assigned branch.</p>
  `;
}

function renderStaffRoleFields(editing) {
  if (editing?.role === "Collector") {
    return `
      <div class="field"><label>Role</label><input readonly value="${escapeAttr(agencyRoleLabel("Collector"))}" /><input type="hidden" name="role" value="Collector" /></div>
      ${renderCollectorLocationFields(editing)}
      ${renderAgentStaffExtras(editing)}
      ${renderAgentOpsFormExtras(editing || {}, listUsersForActor(state.users, currentUser()).filter((user) => ["FieldSupervisor", "Admin", "OperationsManager"].includes(user.role)))}
    `;
  }
  if (editing?.role && !isDefaultSystemAccount(editing) && editing.role !== "Developer") {
    return `
      <div class="field"><label>Role</label><input readonly value="${escapeAttr(agencyRoleLabel(editing.role))}" /><input type="hidden" name="role" value="${escapeAttr(editing.role)}" /></div>
      ${renderAdminStaffFields(editing)}
      ${editing.role === "FieldSupervisor" || editing.role === "GroupCoordinator" ? `${renderAgentStaffExtras(editing)}${renderAgentOpsFormExtras(editing || {}, listUsersForActor(state.users, currentUser()).filter((user) => ["FieldSupervisor", "Admin", "OperationsManager"].includes(user.role)))}` : ""}
    `;
  }
  return `
    <div class="field"><label>Staff Role</label>
      <select name="role" id="staffRoleSelect">
        ${staffRoleOptions().map((item) => `<option value="${escapeAttr(item.value)}">${escapeHtml(item.label)}</option>`).join("")}
      </select>
    </div>
    <div id="collectorStaffFields">
      ${renderCollectorLocationFields(null)}
      ${renderAgentStaffExtras(null)}
      ${renderAgentOpsFormExtras({}, listUsersForActor(state.users, currentUser()).filter((user) => ["FieldSupervisor", "Admin", "OperationsManager"].includes(user.role)))}
    </div>
    <div id="adminStaffFields" style="display:none">
      ${renderAdminStaffFields()}
    </div>
  `;
}

function renderPermissions() {
  if (!canManagePermissions()) return `<div class="notice">Only the Manager can control collector screen permissions.</div>`;
  const collectors = state.users.filter((user) => user.role === "Collector" && user.active);
  if (!collectors.length) return `<div class="panel"><div class="empty">Create a collector account first from Staff & Collectors.</div></div>`;
  const selectedId = sessionStorage.getItem("permissions_user_id") || collectors[0].id;
  const selected = collectors.find((user) => user.id === selectedId) || collectors[0];
  const perms = getCollectorScreenPermissions(selected);
  const capabilityBlocked = new Set(collectorCapabilityBlockedScreens(selected));
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title"><h2>Collector Screen Access</h2></div>
        <p class="muted">Choose which screens each collector can see in their sidebar. Unchecked screens are hidden and blocked. Screens greyed out are not available for this collector's assignment type.</p>
        <form id="permissionsForm" class="form-grid">
          <div class="field full"><label>Collector</label>${collectorSelect("userId", selected.id)}</div>
          <div class="section-title full"><h3>Allowed Screens</h3></div>
          <div class="field full permission-grid">
            ${COLLECTOR_PERMISSION_SCREENS.map(([key, label]) => `
              <label class="permission-item ${capabilityBlocked.has(key) ? "muted" : ""}">
                <input type="checkbox" name="perm_${key}" ${perms[key] !== false && !capabilityBlocked.has(key) ? "checked" : ""} ${capabilityBlocked.has(key) ? "disabled" : ""} />
                <span>${escapeHtml(label)}${capabilityBlocked.has(key) ? " (not assigned)" : ""}</span>
              </label>
            `).join("")}
          </div>
          <div class="form-actions full row-actions">
            <button class="btn" type="submit">Save permissions</button>
            <button class="btn secondary" type="button" id="permissionsAllowAll">Allow all</button>
            <button class="btn ghost" type="button" id="permissionsDenyAll">Deny all</button>
          </div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>Operations Summary</h2></div>
        <p class="muted">Quick view of collector access, similar to an operations control board.</p>
        ${renderPermissionsSummaryTable()}
      </div>
    </div>
  `;
}

function renderPermissionsSummaryTable() {
  const collectors = state.users.filter((user) => user.role === "Collector");
  if (!collectors.length) return `<div class="empty">No collectors yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Collector</th><th>Branch</th><th>Allowed</th><th>Blocked</th><th>Blocked Screens</th><th></th></tr></thead>
        <tbody>
          ${collectors.map((user) => {
            const counts = countCollectorAllowedScreens(user);
            const blocked = COLLECTOR_PERMISSION_SCREENS
              .filter(([key]) => !collectorScreenAllowed(user, key))
              .map(([, label]) => label)
              .join(", ") || "None";
            return `
              <tr>
                <td>${escapeHtml(user.name)}</td>
                <td>${escapeHtml(groupName(user.groupId) || "")}</td>
                <td>${counts.allowed}</td>
                <td>${counts.denied}</td>
                <td>${escapeHtml(blocked)}</td>
                <td><button class="btn secondary" data-permissions-user="${user.id}">Edit</button></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function visibleAgents() {
  const actor = currentUser();
  const agents = staffAgents(listUsersForActor(state.users, actor));
  if (isCollector()) return agents.filter((user) => user.id === actor?.id);
  if (isKBA() || roleIs("ManagingDirector") || roleIs("OperationsManager")) return agents;
  const branchIds = visibleGroupIds();
  return agents.filter((user) => branchIds.includes(user.groupId) || branchIds.includes(user.branchId));
}

function renderAgents() {
  if (!canAccessView("agents")) return `<div class="notice">You do not have permission to view agents.</div>`;
  const user = currentUser();
  const self = isCollector();
  if (self) {
    const desk = agentDeskModel(user, state, { date: today() });
    return `
      ${renderAgentDesk(desk, { self: true, user })}
      <div class="panel" style="margin-top:18px">
        <div class="section-title"><h2>Field Expense</h2></div>
        ${renderAgentExpenseForm(user.id)}
      </div>
      <div class="panel" style="margin-top:18px">
        <div class="section-title"><h2>Leave & Visits</h2></div>
        ${renderAgentProfile({
          user,
          kpis: desk.kpis,
          wallet: desk.wallet,
          customers: state.customers.filter((item) => item.collectorId === user.id),
          groups: (state.susuGroups || []).filter((item) => item.collectorId === user.id),
          attendance: (state.agentAttendance || []).filter((item) => item.agentId === user.id).slice().reverse(),
          leave: (state.agentLeave || []).filter((item) => item.agentId === user.id).slice().reverse(),
          visits: (state.agentVisits || []).filter((item) => item.agentId === user.id).slice().reverse(),
          routes: (state.agentRoutes || []).filter((item) => item.agentId === user.id),
          notes: user.notes || [],
          documents: user.documents || [],
          history: user.activityLog || [],
          branchName: groupName(user.groupId),
          supervisorName: state.users.find((item) => item.id === user.supervisorId)?.name || "",
          canManage: false
        })}
      </div>
      <button class="dash-fab collector-action-btn" type="button" data-view-jump="collections" aria-label="Collect">Collect</button>
    `;
  }
  const agents = visibleAgents();
  const rankings = agentRankings(agents, state, { date: today() });
  const todayTotal = rankings.reduce((sum, row) => sum + Number(row.collected || 0), 0);
  const editingRoute = (state.agentRoutes || []).find((item) => item.id === sessionStorage.getItem("edit_route_id"));
  return `
    ${renderAgentAnalytics({
      total: agents.length,
      active: agents.filter((item) => item.employmentStatus === "Active" || (item.active !== false && !item.employmentStatus)).length,
      inactive: agents.filter((item) => ["On Leave", "Suspended", "Resigned", "Terminated"].includes(item.employmentStatus)).length,
      today: todayTotal
    }, rankings)}
    <div class="panel" style="margin-top:18px">
      <div class="section-title">
        <h2>Agents & Collectors</h2>
        ${renderAgentFilters(visibleGroups())}
      </div>
      <div id="agentTable">${renderFilteredAgentTable(agents)}</div>
    </div>
    ${canManageAgents(user) ? renderRouteForm(state.agentRoutes || [], agents, visibleGroups(), editingRoute || {}) : ""}
    <div class="notice" style="margin-top:18px">Create login accounts on <strong>Staff & Collectors</strong>. This screen manages field operations, routes, attendance, and performance.</div>
  `;
}

function renderFilteredAgentTable(agents) {
  const query = document.querySelector("#agentSearch")?.value || sessionStorage.getItem("agent_search") || "";
  const status = document.querySelector("#agentStatusFilter")?.value || "";
  const branch = document.querySelector("#agentBranchFilter")?.value || "";
  let filtered = searchAgents(agents, query, { branchName: (user) => groupName(user.groupId) });
  if (status) filtered = filtered.filter((user) => (user.employmentStatus || "Active") === status);
  if (branch) filtered = filtered.filter((user) => user.groupId === branch || user.branchId === branch);
  const page = Number(sessionStorage.getItem("agent_page") || 1);
  const paged = paginateList(filtered, page, 40);
  sessionStorage.setItem("agent_page", String(paged.page));
  return `${renderAgentTable(paged.items, {
    branchName: (user) => groupName(user.groupId),
    kpis: (user) => agentKpis(user, state, { date: today() }),
    pendingIds: new Set((state.offlineQueue || []).filter((item) => item.status === "pending" && item.payload?.userId).map((item) => item.payload.userId))
  })}${renderAgentPager(paged)}`;
}

function renderAgentDetail() {
  const id = sessionStorage.getItem("detail_agent_id") || (isCollector() ? currentUser()?.id : "");
  const user = state.users.find((item) => item.id === id);
  if (!user || (!isCollector() && !isKBA() && !visibleAgents().some((item) => item.id === user.id))) {
    return `<div class="notice">Agent not found or not in your branch.</div>`;
  }
  if (isCollector() && user.id !== currentUser()?.id) return `<div class="notice">You can only view your own desk.</div>`;
  const desk = agentDeskModel(user, state, { date: today() });
  return `
    ${renderAgentDesk(desk, { self: isCollector(), user })}
    ${renderAgentProfile({
      user,
      kpis: desk.kpis,
      wallet: desk.wallet,
      customers: state.customers.filter((item) => item.collectorId === user.id),
      groups: (state.susuGroups || []).filter((item) => item.collectorId === user.id),
      attendance: (state.agentAttendance || []).filter((item) => item.agentId === user.id).slice().reverse(),
      leave: (state.agentLeave || []).filter((item) => item.agentId === user.id).slice().reverse(),
      visits: (state.agentVisits || []).filter((item) => item.agentId === user.id).slice().reverse(),
      routes: (state.agentRoutes || []).filter((item) => item.agentId === user.id),
      notes: user.notes || [],
      documents: user.documents || [],
      history: user.activityLog || [],
      branchName: groupName(user.groupId),
      supervisorName: state.users.find((item) => item.id === user.supervisorId)?.name || "",
      canManage: canManageAgents(currentUser())
    })}
  `;
}

function renderUsers() {
  if (!canManageUsers()) return `<div class="notice">Only the Manager can create staff accounts.</div>`;
  const actor = currentUser();
  const editing = listUsersForActor(state.users, actor).find((user) => user.id === sessionStorage.getItem("edit_user_id") && canEditUserAccount(actor, user));
  const formTitle = editing
    ? (editing.role === "Admin" ? "Edit Assistant Manager" : "Edit Collector")
    : "Create Staff Account";
  const submitLabel = editing
    ? (editing.role === "Admin" ? "Save assistant manager" : "Save collector & location")
    : "Create staff account";
  return `
    <div class="grid two">
      <div class="panel">
        <div class="section-title">
          <h2>${formTitle}</h2>
          ${editing ? `<button class="btn ghost" id="cancelUserEdit" type="button">Cancel</button>` : ""}
        </div>
        <form id="userForm" class="form-grid" novalidate>
          ${editing ? `<input type="hidden" name="id" value="${editing.id}" />` : ""}
          <div class="section-title full"><h3>Account Details</h3></div>
          <div class="field"><label>Name</label><input name="name" value="${escapeAttr(editing?.name || "")}" required /></div>
          <div class="field"><label>Username</label><input name="username" value="${escapeAttr(editing?.username || "")}" required /></div>
          <div class="field"><label>Phone</label><input name="phone" value="${escapeAttr(editing?.phone || "")}" placeholder="024 123 4567" required /></div>
          <div class="field"><label>Ghana Card</label><input name="ghanaCard" value="${escapeAttr(editing?.ghanaCard || "")}" placeholder="GHA-XXXXXXXXX-X" /></div>
          <div class="field"><label>Password</label><input name="password" ${editing ? `placeholder="Leave blank to keep current password"` : "required"} /></div>
          ${renderPassportPhotoField({ scope: "staff", photoSrc: editing?.passportPhoto || "", required: !editing })}
          ${renderStaffRoleFields(editing)}
          <div class="form-actions full"><button class="btn" type="submit">${submitLabel}</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="section-title"><h2>How It Works</h2></div>
        <table>
          <tr><td>Manager</td><td>Create Collector accounts with susu locations, or create Assistant Manager accounts for branch oversight.</td></tr>
          <tr><td>Assistant Manager</td><td>Verifies electronic payments, reviews collections, supports daily closing and approvals.</td></tr>
          <tr><td>Collector</td><td>Logs in, registers customers, and records field collections for the assigned branch.</td></tr>
        </table>
      </div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="section-title"><h2>Staff Accounts</h2></div>
      ${renderUsersTable()}
    </div>
  `;
}

function renderUsersTable() {
  const actor = currentUser();
  const visibleUsers = listUsersForActor(state.users, actor);
  const showPasswords = visibleUsers.some((u) => canViewStaffLoginPassword(actor, u));
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Photo</th><th>Name</th><th>Phone</th><th>Ghana Card</th><th>Username</th>${showPasswords ? "<th>Password</th>" : ""}<th>Code</th><th>Assigned Location</th><th>Role</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${visibleUsers.map((u) => {
            const passwordCell = showPasswords
              ? `<td>${canViewStaffLoginPassword(actor, u)
                ? escapeHtml(staffLoginPasswordDisplay(u) || "—")
                : "—"}</td>`
              : "";
            return `
            <tr>
              <td>${u.passportPhoto && !isDefaultSystemAccount(u) && u.role !== "Developer" ? `<img class="passport-preview table-thumb" src="${escapeAttr(u.passportPhoto)}" alt="" />` : "-"}</td>
              <td>${escapeHtml(u.name)}</td>
              <td>${escapeHtml(formatGhanaPhoneDisplay(u.phone) || u.phone || "-")}</td>
              <td>${escapeHtml(u.ghanaCard || "-")}</td>
              <td>${escapeHtml(u.username)}</td>
              ${passwordCell}
              <td>${escapeHtml(collectorCodeForGroup(u.groupId) || "-")}</td>
              <td>${escapeHtml(groupName(u.groupId) || u.requestedGroupName || "")}</td>
              <td>${escapeHtml(roleLabel(u.role))}</td>
              <td><span class="pill ${u.pending ? "warn" : u.active ? "" : "bad"}">${u.pending ? "Pending" : u.active ? "Active" : "Disabled"}</span></td>
              <td>${isProtectedOwnerAccount(u) || isSystemDeveloperAccount(u) || u.role === "Developer" ? "" : `
                <div class="row-actions">
                  ${u.role === "Collector" ? `<button class="btn secondary" data-permissions-user="${u.id}">Permissions</button>` : ""}
                  ${canEditUserAccount(actor, u) ? `<button class="btn secondary" data-edit-user="${u.id}">Edit</button>` : ""}
                  ${canDisableUserAccount(actor, u) ? `<button class="btn secondary" data-toggle-user="${u.id}">${u.active ? "Disable" : "Activate"}</button>` : ""}
                  ${canDeleteUserAccount(actor, u) ? `<button class="btn danger" data-delete-user="${u.id}">Delete</button>` : ""}
                </div>
              `}</td>
            </tr>
          `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function handleReassignCustomer(customerId) {
  if (!canManageUsers()) {
    toast("Only the Manager can reassign customers");
    return;
  }
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return;
  const collectors = state.users.filter((user) => user.role === "Collector" && user.active && user.id !== customer.collectorId);
  if (!collectors.length) {
    toast("No other active collectors available");
    return;
  }
  const list = collectors.map((user, index) => `${index + 1}. ${user.name} (${collectorCodeForGroup(user.groupId) || user.username})`).join("\n");
  const choice = prompt(`Reassign ${customer.name} to collector:\n${list}\n\nEnter collector number:`);
  const index = Number(choice) - 1;
  const target = collectors[index];
  if (!target) {
    toast("Invalid collector selection");
    return;
  }
  const reason = prompt("Reason for reassignment (required):");
  if (!String(reason || "").trim()) {
    toast("A reason is required for reassignment");
    return;
  }
  const result = reassignCustomer(state, customer, target.id, {
    reason,
    approvedBy: currentUser()?.id || "",
    uid,
    logAudit
  });
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  pushCloudBackup(false);
  toast(`${customer.name} reassigned to ${target.name}`);
  render();
}

function renderPortalShell(customer, portalView = null) {
  syncToApp();
  document.body.className = `theme-${state.settings.theme || "emerald"} color-mode-${state.settings.colorMode || "light"} layout-mobile`;
  app.innerHTML = `<div class="app portal-app"><main class="main" style="margin:0"><section class="content">${renderCustomerPortal(customer, portalView)}</section></main></div>`;
  document.querySelector("#portalLogoutBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem(PORTAL_CUSTOMER_KEY);
    clearPortalSession();
    render();
  });
  document.querySelector("#portalWithdrawForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (portalView) void handleServerPortalWithdrawal(formData(event.target));
    else handlePortalWithdrawal(customer, formData(event.target));
  });
  document.querySelector("#portalChangePinForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (portalView) void handleServerPortalChangePin(formData(event.target));
    else handlePortalChangePin(customer, formData(event.target));
  });
  document.querySelector("#portalPrintStatement")?.addEventListener("click", () => printMemberStatement(customer.id, {}, portalView || state));
}

function storedPortalView() {
  const bundle = storedPortalSession()?.bundle;
  if (!bundle?.customer?.id) return null;
  return { customer: bundle.customer, view: portalStateFromBundle(bundle) };
}

async function refreshServerPortal() {
  const result = await portalServerRefresh(state);
  if (!result.ok && !result.offline) toast(result.error || "Session expired. Please sign in again.");
  render();
}

async function handleServerPortalChangePin(data) {
  const result = await portalServerChangePin(state, data.currentPin, data.newPin);
  if (!result.ok) {
    toast(result.error || "Unable to update PIN");
    return;
  }
  toast("PIN updated");
  await refreshServerPortal();
}

async function handleServerPortalWithdrawal(data) {
  const result = await portalServerRequestWithdrawal(state, data.amount, data.reason);
  if (!result.ok) {
    toast(result.error || "Unable to submit withdrawal request");
    return;
  }
  toast("Withdrawal request submitted");
  await refreshServerPortal();
}

async function handlePortalLogin(event) {
  event.preventDefault();
  syncToApp();
  const accountNo = document.querySelector("#portalAccountNo")?.value || "";
  const pin = document.querySelector("#portalPin")?.value || "";
  const errorBox = document.querySelector("#portalLoginError");
  const submitBtn = event.target?.querySelector?.('button[type="submit"]');
  if (portalServerAvailable(state)) {
    if (errorBox) errorBox.innerHTML = `<div class="notice">Checking your account...</div>`;
    if (submitBtn) submitBtn.disabled = true;
    const result = await portalServerLogin(state, accountNo, pin);
    if (submitBtn) submitBtn.disabled = false;
    if (result.ok) {
      sessionStorage.removeItem(PORTAL_CUSTOMER_KEY);
      render();
      return;
    }
    // Before the server portal is deployed, devices that still hold the legacy sync key use the local check.
    if (!(result.unavailable && legacySyncAccessKey())) {
      if (errorBox) errorBox.innerHTML = `<div class="notice">${escapeHtml(result.error || "Account not found or wrong PIN.")}</div>`;
      return;
    }
  }
  let customer = findPortalCustomer(state, accountNo);
  if (!customer) {
    if (errorBox) errorBox.innerHTML = `<div class="notice">Checking your account...</div>`;
    if (submitBtn) submitBtn.disabled = true;
    try {
      await loadUnifiedBusinessData();
      syncToApp();
    } catch {
      // Offline or cloud unavailable: fall through to the not-found message.
    }
    if (submitBtn) submitBtn.disabled = false;
    customer = findPortalCustomer(state, accountNo);
  }
  if (!customer) {
    if (errorBox) errorBox.innerHTML = `<div class="notice">Account not found. Use your account number (e.g. c13000001) or registered phone.</div>`;
    return;
  }
  ensureDefaultPortalCredentials(customer);
  if (!verifyPortalPin(customer, pin)) {
    if (errorBox) {
      errorBox.innerHTML = `<div class="notice">Wrong PIN. Default PIN is the last 4 digits of the member phone number.</div>`;
    }
    return;
  }
  sessionStorage.setItem(PORTAL_CUSTOMER_KEY, customer.id);
  saveState();
  render();
}

function handlePortalChangePin(customer, data) {
  if (!verifyPortalPin(customer, data.currentPin)) {
    toast("Current PIN is incorrect");
    return;
  }
  const result = setPortalPin(customer, data.newPin);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast("PIN updated");
  render();
}

function handlePortalWithdrawal(customer, data) {
  if (!canCustomerRequestWithdrawal(customer)) {
    toast("This account cannot request withdrawals");
    return;
  }
  const result = createWithdrawalRequest(state, {
    customerId: customer.id,
    groupId: customer.groupId,
    amount: Number(data.amount),
    availableBalance: portalAccountBalance(state, customer.id),
    reason: data.reason,
    requestedBy: customer.id,
    date: today()
  }, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  queueNotification(state, {
    event: "withdrawal_approved",
    channel: "In-App",
    customerId: customer.id,
    vars: { name: customer.name, amount: Number(data.amount).toFixed(2) },
    uid
  });
  saveState();
  toast("Withdrawal request submitted");
  render();
}

function handleExpenseForm(event) {
  event.preventDefault();
  const data = formData(event.target);
  if (isAccountingPeriodClosed(state, data.date)) {
    toast("The accounting period is closed");
    return;
  }
  const result = createExpense(state, {
    ...data,
    groupId: primaryGroup()?.id || "",
    branchId: primaryGroup()?.branchId || primaryGroup()?.id || "",
    recordedBy: currentUser()?.id
  }, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Expense posted", `${result.expense.category} · ${money(result.expense.amount)}`);
  toast("Expense posted");
  render();
}

function handleGroupMeetingForm(event) {
  event.preventDefault();
  if (!canConductGroupMeetings(currentUser()) || isReadOnlyUser()) {
    toast("You do not have permission to record meetings");
    return;
  }
  const form = event.target;
  const data = formData(form);
  const created = createGroupMeeting(state, {
    susuGroupId: data.susuGroupId,
    date: data.date,
    notes: data.notes,
    recordedBy: currentUser()?.id,
    branchId: primaryGroup()?.id || ""
  }, uid);
  if (created.error) {
    toast(created.error);
    return;
  }
  const meeting = created.meeting;
  const group = state.susuGroups.find((item) => item.id === data.susuGroupId);
  (group?.memberships || []).forEach((member) => {
    recordAttendance(meeting, member.customerId, Boolean(data[`present_${member.customerId}`]));
    const contrib = Number(data[`contrib_${member.customerId}`] || 0);
    const loan = Number(data[`loan_${member.customerId}`] || 0);
    const fine = Number(data[`fine_${member.customerId}`] || 0);
    const welfare = Number(data[`welfare_${member.customerId}`] || 0);
    if (contrib > 0) recordMeetingLine(meeting, "contributions", { customerId: member.customerId, amount: contrib, method: "Cash" });
    if (loan > 0) recordMeetingLine(meeting, "loanRepayments", { customerId: member.customerId, amount: loan });
    if (fine > 0) recordMeetingLine(meeting, "fines", { customerId: member.customerId, amount: fine });
    if (welfare > 0) recordMeetingLine(meeting, "welfare", { customerId: member.customerId, amount: welfare });
  });
  finalizeMeetingTotals(meeting);
  sessionStorage.setItem("meeting_group_id", data.susuGroupId);
  saveState();
  logAudit("Group meeting recorded", group?.name || data.susuGroupId);
  toast("Meeting saved");
  render();
}

function handleStartGroupMeeting() {
  const group = susuGroupById(sessionStorage.getItem("susu_group_detail_id"));
  if (!group || !canConductGroupMeetings(currentUser())) {
    toast("You cannot start this meeting");
    return;
  }
  const created = startMeeting(state, group, { date: today(), recordedBy: currentUser()?.id, uid });
  if (created.error) {
    toast(created.error);
    return;
  }
  sessionStorage.setItem("meeting_wizard_id", created.meeting.id);
  if (!navigator.onLine) {
    enqueueSyncItem(state, {
      kind: "meeting",
      idempotencyKey: `meeting:${created.meeting.id}`,
      payload: created.meeting,
      deviceId: (state.devices || []).find((item) => item.fingerprint === deviceFingerprint())?.id || deviceFingerprint(),
      agentId: currentUser()?.id || ""
    }, uid);
  }
  saveState();
  logAudit("Group meeting started", group.name);
  toast(navigator.onLine ? "Meeting started" : "Meeting saved offline");
  render();
}

function handleMeetingWizard(event) {
  event.preventDefault();
  if (!canConductGroupMeetings(currentUser())) return;
  const data = formData(event.target);
  const meeting = (state.groupMeetings || []).find((item) => item.id === data.meetingId);
  const group = susuGroupById(data.susuGroupId);
  if (!meeting || !group) return;
  const members = activeMemberships(group);
  if (meeting.step === "attendance" || !meeting.step) {
    members.forEach((member) => {
      const status = data[`att_${member.customerId}`] || "Present";
      recordAttendance(meeting, member.customerId, ["Present", "Late", "Guest"].includes(status), "", status);
    });
    setMeetingStep(meeting, "contributions");
  } else if (meeting.step === "contributions") {
    members.forEach((member) => {
      const amount = Number(data[`contrib_${member.customerId}`] || 0);
      if (amount > 0) recordMeetingLine(meeting, "contributions", { customerId: member.customerId, amount, reason: data[`contribType_${member.customerId}`] || "Regular" });
    });
    setMeetingStep(meeting, "fines");
  } else if (meeting.step === "fines") {
    members.forEach((member) => {
      const fine = Number(data[`fine_${member.customerId}`] || 0);
      const welfare = Number(data[`welfare_${member.customerId}`] || 0);
      if (fine > 0) recordMeetingLine(meeting, "fines", { customerId: member.customerId, amount: fine, reason: data[`fineReason_${member.customerId}`] || "Fine" });
      if (welfare > 0) recordMeetingLine(meeting, "welfare", { customerId: member.customerId, amount: welfare });
    });
    setMeetingStep(meeting, "loans");
  } else if (meeting.step === "loans") {
    members.forEach((member) => {
      const loan = Number(data[`loan_${member.customerId}`] || 0);
      if (loan > 0) recordMeetingLine(meeting, "loanRepayments", { customerId: member.customerId, amount: loan });
    });
    setMeetingStep(meeting, "notes");
  } else if (meeting.step === "notes") {
    meeting.agenda = data.agenda || "";
    meeting.notes = data.notes || "";
    meeting.decisions = data.decisions || "";
    meeting.resolutions = data.resolutions || "";
    meeting.actionItems = data.actionItems || "";
    const closed = closeMeeting(state, meeting, group, {
      actor: currentUser(),
      uid,
      receiptFn: () => buildReceiptNo(state, collectorCodeForGroup(group.branchId))
    });
    if (closed.error) {
      toast(closed.error);
      return;
    }
    sessionStorage.removeItem("meeting_wizard_id");
    queueNotification(state, {
      event: "meeting_reminder",
      channel: "In-App",
      vars: { groupName: group.name, meetingDay: meeting.date },
      uid
    });
    logGroupActivity(state, { action: "Meeting closed", susuGroupId: group.id, detail: meeting.date, userId: currentUser()?.id || "", uid });
    toast(`Meeting closed. ${closed.posted?.length || 0} receipt(s) posted.`);
    saveState();
    render();
    return;
  }
  saveState();
  render();
}

function handleGroupWelfare(event) {
  event.preventDefault();
  if (!canManageSusuGroups()) return;
  const data = formData(event.target);
  const group = susuGroupById(data.susuGroupId);
  const direction = data.type === "Withdrawal" ? "out" : "in";
  const result = recordWelfare(state, {
    group,
    customerId: data.customerId,
    amount: data.amount,
    type: data.type,
    direction,
    recordedBy: currentUser()?.id,
    uid
  });
  if (result.error) {
    toast(result.error);
    return;
  }
  if (direction === "out") {
    const approved = approveWelfarePayout(group, result.welfare, currentUser());
    if (approved.error) toast(approved.error);
  }
  saveState();
  logAudit("Group welfare recorded", `${group?.name} · ${data.type} · ${money(data.amount)}`);
  toast("Welfare recorded");
  render();
}

function handleGroupShare(event) {
  event.preventDefault();
  if (!canManageSusuGroups()) return;
  const data = formData(event.target);
  const group = susuGroupById(data.susuGroupId);
  const result = recordShare(state, {
    group,
    customerId: data.customerId,
    amount: data.amount,
    type: data.type,
    recordedBy: currentUser()?.id,
    uid
  });
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Group share recorded", `${group?.name} · ${data.type} · ${money(data.amount)}`);
  toast("Share recorded");
  render();
}

function handleCreateShareOut() {
  const group = susuGroupById(sessionStorage.getItem("susu_group_detail_id"));
  if (!group || !canManageSusuGroups()) return;
  const result = createShareOut(state, group, {
    customers: visibleCustomers(),
    collections: visibleCollections(),
    loans: visibleLoans(),
    fines: state.groupFines || [],
    shares: state.groupShares || []
  }, { cycleLabel: `${group.code}-${today().slice(0, 7)}`, createdBy: currentUser()?.id, uid });
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast("Share-out request created");
  render();
}

function handleGroupStatusForm(event) {
  event.preventDefault();
  if (!canManageSusuGroups()) return;
  const data = formData(event.target);
  const group = susuGroupById(data.susuGroupId);
  const result = setGroupStatus(group, data.status, currentUser());
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Group status", `${group.code} · ${data.status}`);
  toast("Group status updated");
  render();
}

function handleWithdrawalRequestFromForm(form) {
  const data = formData(form);
  const customer = state.customers.find((item) => item.id === data.customerId);
  if (!customer) {
    toast("Select a member");
    return;
  }
  const available = customerBalance(customer.id);
  const held = Number(customer.heldBalance || 0);
  const todayPaid = visibleTransactions()
    .filter((tx) => tx.type === "Withdrawal" && tx.customerId === customer.id && tx.date === (data.date || today()) && !tx.reversed)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const eligibility = validateWithdrawalEligibility({
    customer,
    account: (state.savingsAccounts || []).find((item) => item.customerId === customer.id && item.status !== "Closed"),
    product: productById(state.savingsProducts, customer.savingsProductId),
    amount: Number(data.amount),
    availableBalance: available,
    heldBalance: held,
    loanBalance: loanBalanceForCustomer(customer.id),
    todayWithdrawn: todayPaid,
    withdrawalType: data.withdrawalType || "Normal Withdrawal",
    requireClearLoans: Boolean(state.settings.requireClearLoansForWithdrawal),
    asOfDate: data.date || today()
  });
  if (!eligibility.ok) {
    toast(eligibility.error || "Withdrawal is not eligible");
    return;
  }
  const payload = {
    customerId: customer.id,
    groupId: customer.groupId,
    branchId: customer.branchId || customer.groupId,
    amount: Number(data.amount),
    availableBalance: eligibility.usable,
    reason: data.note,
    requestedBy: currentUser()?.id,
    date: data.date || today(),
    withdrawalType: data.withdrawalType || "Normal Withdrawal",
    paymentMethod: data.paymentMethod || "Cash",
    paymentReference: data.paymentReference || "",
    productId: customer.savingsProductId || "",
    eligibility,
    idempotencyKey: `wdr:${customer.id}:${Number(data.amount)}:${data.date || today()}:${currentUser()?.id || ""}`
  };
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline) {
    enqueueSyncItem(state, {
      kind: "withdrawal",
      idempotencyKey: payload.idempotencyKey,
      payload,
      deviceId: (state.devices || []).find((item) => item.fingerprint === deviceFingerprint())?.id || deviceFingerprint(),
      agentId: currentUser()?.id || ""
    }, uid);
    saveState();
    toast("Withdrawal request queued until you are online");
    render();
    return;
  }
  const result = submitWithdrawalRequest(state, payload, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  queueNotification(state, {
    event: "withdrawal_requested",
    channel: "SMS",
    customerId: customer.id,
    vars: { name: customer.name, amount: Number(data.amount).toFixed(2) },
    uid,
    idempotencyKey: `${result.request?.id || result.withdrawal?.id || customer.id}:withdrawal_requested`
  });
  saveState();
  logAudit("Withdrawal requested", `${customer.name} · ${money(data.amount)} · ${payload.withdrawalType}`);
  toast(result.replay ? "This withdrawal request was already submitted" : "Withdrawal sent for approval");
  render();
}

function handleAdvanceWithdrawal(id, reject = false) {
  const request = (state.withdrawalRequests || []).find((item) => item.id === id);
  if (!request) return;
  const user = currentUser();
  const customer = state.customers.find((item) => item.id === request.customerId);
  if (reject) {
    const reason = prompt("Reason for rejecting this withdrawal:");
    if (reason === null) return;
    const result = advanceWithdrawal(request, "Rejected", user?.id, String(reason).trim());
    if (result.error) {
      toast(result.error);
      logAudit("Withdrawal status rejected", `${request.id} · ${result.error}`);
      return;
    }
    queueNotification(state, {
      event: "withdrawal_rejected",
      channel: "SMS",
      customerId: request.customerId,
      vars: { name: customer?.name || "", amount: Number(request.amount).toFixed(2) },
      uid,
      idempotencyKey: `${request.id}:withdrawal_rejected`
    });
    saveState();
    logAudit("Withdrawal Rejected", `${request.id} · ${String(reason).trim()}`);
    toast("Withdrawal rejected");
    render();
    return;
  }
  const next = nextWithdrawalAction(request.status);
  if (!canAdvanceWithdrawal(user, request)) {
    toast("You cannot advance this withdrawal");
    return;
  }
  if (!reject && ["Approved", "Paid"].includes(next) && !canApproveAmount(user, request.amount, configuredApprovalLimits(state))) {
    toast("This amount is above your approval limit");
    return;
  }
  if (next === "Approved") {
    const online = typeof navigator === "undefined" || navigator.onLine !== false;
    const gate = canPerformOffline(state, "withdrawal.approve", { online });
    if (!gate.ok) {
      toast(gate.error);
      return;
    }
  }
  if (next === "Paid") {
    const result = payWithdrawal(state, request, {
      userId: user?.id || "",
      role: user?.role || "",
      availableBalance: customerBalance(request.customerId),
      heldBalance: Number(customer?.heldBalance || 0),
      online: typeof navigator === "undefined" || navigator.onLine !== false,
      allowOfflinePay: Boolean(state.settings.allowOfflineWithdrawalPay),
      paymentMethod: request.paymentMethod || "Cash",
      paymentReference: request.paymentReference || "",
      idempotencyKey: request.idempotencyKey || `pay:${request.id}`,
      postPayment: ({ amount, method, reference }) => {
        const withdrawRef = uid("wd");
        addTransaction("Withdrawal", request.customerId, amount, withdrawRef, request.date, request.reason || "Approved withdrawal", {
          paymentMethod: method,
          paymentReference: reference,
          paymentNo: withdrawRef
        });
        return { receiptNo: withdrawRef };
      }
    });
    if (result.error) {
      toast(result.error);
      logAudit("Withdrawal status rejected", `${request.id} · ${result.error}`);
      return;
    }
    if (!result.replay) {
      registerBusinessPayment(state, {
        paymentType: "withdrawal_payout",
        paymentMethod: request.paymentMethod || "Cash",
        amount: request.amount,
        customerId: request.customerId,
        businessType: "withdrawal",
        businessId: request.id,
        paymentReference: request.paymentReference || "",
        accountingAlreadyPosted: true,
        idempotencyKey: `pay:withdrawal:${request.id}`
      }, user, uid);
      registerBusinessDocument(state, {
        type: "withdrawal_receipt",
        receiptNo: request.receiptNo,
        amount: request.amount,
        customerId: request.customerId,
        customerName: customer?.name || "",
        paymentMethod: request.paymentMethod || "Cash",
        businessType: "withdrawal",
        businessId: request.id,
        accountingAlreadyPosted: true,
        idempotencyKey: `doc:withdrawal:${request.id}`
      }, user, uid);
      queueNotification(state, {
        event: "withdrawal_approved",
        channel: "SMS",
        customerId: request.customerId,
        vars: { name: customer?.name || "", amount: Number(request.amount).toFixed(2), receiptNo: request.receiptNo },
        uid,
        idempotencyKey: `${request.id}:withdrawal_approved:SMS`
      });
      queueNotification(state, {
        event: "withdrawal_paid",
        channel: "In-App",
        customerId: request.customerId,
        vars: { name: customer?.name || "", amount: Number(request.netAmount || request.amount).toFixed(2), receiptNo: request.receiptNo },
        uid,
        idempotencyKey: `${request.id}:withdrawal_paid`
      });
    }
    saveState();
    logAudit("Withdrawal Paid", request.id);
    toast(result.replay ? "Payment already recorded" : "Withdrawal paid");
    if (customer && !result.replay) printWithdrawalFormForCustomer(customer, request.netAmount || request.amount, request.date);
    render();
    return;
  }
  const result = advanceWithdrawal(request, next, user?.id);
  if (result.error) {
    toast(result.error);
    logAudit("Withdrawal status rejected", `${request.id} · ${result.error}`);
    return;
  }
  if (next === "Approved") {
    queueNotification(state, {
      event: "withdrawal_approved",
      channel: "SMS",
      customerId: request.customerId,
      vars: { name: customer?.name || "", amount: Number(request.amount).toFixed(2) },
      uid,
      idempotencyKey: `${request.id}:withdrawal_approved:SMS`
    });
  }
  saveState();
  logAudit(`Withdrawal ${next}`, request.id);
  toast(`Withdrawal ${next.toLowerCase()}`);
  render();
}

function handleReversePaidWithdrawal(id) {
  const request = (state.withdrawalRequests || []).find((item) => item.id === id);
  if (!request) return;
  if (!canApproveFinancial(currentUser())) {
    toast("Only an authorized officer can reverse a paid withdrawal");
    return;
  }
  const reason = prompt("Reason for reversing this withdrawal:");
  if (reason === null) return;
  const result = reverseWithdrawalPayment(state, request, {
    userId: currentUser()?.id || "",
    role: currentUser()?.role || "",
    reason: String(reason).trim(),
    postReversal: (wd) => {
      const tx = (state.transactions || []).find((item) => item.ref === wd.receiptNo && item.type === "Withdrawal" && !item.reversed);
      if (!tx) return { error: "Payment transaction not found" };
      tx.reversed = true;
      tx.updatedAt = new Date().toISOString();
      markLedgerPairReversed(state, tx.ref, "withdrawal");
      return { ok: true };
    }
  });
  if (result.error) {
    toast(result.error);
    logAudit("Withdrawal status rejected", `${request.id} · ${result.error}`);
    return;
  }
  const customer = state.customers.find((item) => item.id === request.customerId);
  queueNotification(state, {
    event: "withdrawal_reversed",
    channel: "In-App",
    customerId: request.customerId,
    vars: { name: customer?.name || "", receiptNo: request.receiptNo || request.id },
    uid,
    idempotencyKey: `${request.id}:withdrawal_reversed`
  });
  saveState();
  logAudit("Withdrawal Reversed", `${request.id} · ${String(reason).trim()}`);
  toast("Withdrawal reversed");
  render();
}

function handleJournalForm(event) {
  event.preventDefault();
  const data = formData(event.target);
  const amount = Number(data.amount);
  const result = createJournalEntry(state, {
    date: data.date,
    narration: data.narration,
    createdBy: currentUser()?.id,
    lines: [
      { accountCode: data.debitAccount, debit: amount, credit: 0 },
      { accountCode: data.creditAccount, debit: 0, credit: amount }
    ]
  }, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Journal posted", data.narration);
  toast("Journal posted");
  render();
}

function handleClosePeriodForm(event) {
  event.preventDefault();
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  const gate = canPerformOffline(state, "accounting.closePeriod", { online });
  if (!gate.ok) {
    toast(gate.error);
    return;
  }
  const data = formData(event.target);
  const result = closeAccountingPeriod(state, {
    from: data.from,
    to: data.to,
    user: currentUser(),
    reason: data.reason
  });
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Accounting period closed", `${data.from} → ${data.to}`);
  toast("Accounting period closed");
  render();
}

function handleTaxDefinitionForm(event) {
  event.preventDefault();
  const data = formData(event.target);
  const result = upsertTaxDefinition(state, data, currentUser(), uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Tax configuration updated", `${result.tax.code} v${result.tax.version}`);
  toast("Tax saved");
  render();
}

function handleNotificationTemplateForm(event) {
  event.preventDefault();
  const data = formData(event.target);
  const templates = { ...defaultNotificationTemplates(), ...(state.notificationTemplates || {}) };
  Object.keys(templates).forEach((eventKey) => {
    if (data[`sms_${eventKey}`] !== undefined) templates[eventKey].sms = data[`sms_${eventKey}`];
  });
  state.notificationTemplates = templates;
  saveState();
  toast("Templates saved");
  render();
}

function handleSendNotificationForm(event) {
  event.preventDefault();
  const data = formData(event.target);
  const result = queueNotification(state, {
    event: data.event,
    channel: data.channel,
    vars: { name: data.name || "Member", amount: data.amount || "0.00", receiptNo: data.receiptNo || "", balance: data.amount || "0.00", date: today(), dueDate: today(), meetingDay: today(), groupName: "Susu Group", agentName: currentUser()?.name || "" },
    uid
  });
  if (result.skipped) {
    toast("Not sent - customer opted out of this channel");
    return;
  }
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast(`${data.channel} notification queued`);
  render();
}

function handleBulkNotificationForm(event) {
  event.preventDefault();
  const data = formData(event.target);
  const result = queueBulkNotifications(state, {
    event: data.event,
    channel: data.channel,
    filters: { branchId: data.branchId, agentId: data.agentId },
    vars: { name: data.name || "Member", amount: "0.00" },
    user: currentUser(),
    uid
  });
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast(`Queued ${result.queued} of ${result.total} messages`);
  render();
}

function handleScheduleNotificationForm(event) {
  event.preventDefault();
  const data = formData(event.target);
  const result = scheduleNotification(state, data, currentUser(), uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast("Notification schedule saved");
  render();
}

function handleAnnouncementForm(event) {
  event.preventDefault();
  const data = formData(event.target);
  const result = createAnnouncement(state, data, currentUser(), uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast("Announcement published");
  render();
}

function handleProviderOverrideForm(event) {
  event.preventDefault();
  const data = formData(event.target);
  const result = upsertProvider(state, {
    id: data.id,
    priority: data.priority,
    maintenance: data.maintenance === "true"
  }, currentUser());
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast("Provider updated");
  render();
}

function handleProcessNotificationQueue() {
  ensureNotificationProviders(state);
  const due = runDueNotificationSchedules(state, currentUser(), uid);
  const processed = processNotificationQueue(state);
  saveState();
  toast(`Processed ${processed.delivered} sent · ${processed.failed} failed · ${due.ran} schedules`);
  render();
}

function printCollectionReceipt(collection, customer) {
  const product = productById(state.savingsProducts, collection.savingsProductId);
  const payload = {
    receiptNo: collection.receiptNo || collection.paymentNo,
    transactionId: collection.id,
    customerName: customer?.name || "",
    customerNumber: customer?.customerNumber || customer?.accountNo || "",
    agentName: userName(collection.userId) || currentUser()?.name || "",
    branchName: groupName(collection.groupId || customer?.groupId),
    productName: product?.name || collection.collectionType || "Collection",
    amount: collection.amount,
    balance: customerBalance(customer?.id),
    date: collection.date,
    time: (collection.createdAt || "").slice(11, 19),
    paymentMethod: collection.paymentMethod
  };
  const html = `<html><head><title>${payload.receiptNo}</title><style>body{font-family:Arial;padding:16px;width:280px}h2{margin:8px 0}p{margin:4px 0}.receipt-codes svg{width:120px;height:auto;margin:8px 8px 0 0}@media print{body{width:auto}}</style></head><body>
    <img src="assets/smile-trust-logo.png" style="width:72px" alt="Smile Trust" />
    <h2>${escapeHtml(state.settings.businessName)}</h2>
    <p>Receipt ${escapeHtml(payload.receiptNo)}</p>
    <p>Txn ${escapeHtml(payload.transactionId)}</p>
    <p>${escapeHtml(payload.customerName)}</p>
    <p>No. ${escapeHtml(payload.customerNumber)}</p>
    <p>Agent: ${escapeHtml(payload.agentName)}</p>
    <p>Branch: ${escapeHtml(payload.branchName)}</p>
    <p>${escapeHtml(payload.productName)}</p>
    <p>Paid ${money(payload.amount)}</p>
    <p>Balance: ${money(payload.balance)}</p>
    <p>${escapeHtml(payload.paymentMethod)}</p>
    <p>${escapeHtml(payload.date)} ${escapeHtml(payload.time)}</p>
    ${collection.offline || collection.temporaryReceiptNo ? `<p>Offline receipt</p>` : ""}
    ${collection.permanentReceiptNo ? `<p>Server ${escapeHtml(collection.permanentReceiptNo)}</p>` : ""}
    <div>${qrSvg(payload.receiptNo)}${barcodeSvg(payload.receiptNo)}</div>
    <p>Thank you for saving with Smile Trust.</p>
    <script>window.print()</script></body></html>`;
  const popup = window.open("", "_blank");
  if (!popup) return toast("Allow pop-ups to print receipts");
  popup.document.write(html);
  popup.document.close();
}

function attachAgencyHandlers() {
  document.querySelector("#expenseForm")?.addEventListener("submit", handleExpenseForm);
  document.querySelector("#groupMeetingForm")?.addEventListener("submit", handleGroupMeetingForm);
  document.querySelector("#meetingGroupSelect")?.addEventListener("change", (event) => {
    sessionStorage.setItem("meeting_group_id", event.target.value);
    render();
  });
  document.querySelector("#journalForm")?.addEventListener("submit", handleJournalForm);
  document.querySelector("#closePeriodForm")?.addEventListener("submit", handleClosePeriodForm);
  document.querySelector("#taxDefinitionForm")?.addEventListener("submit", handleTaxDefinitionForm);
  document.querySelector("#accountingRangeForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    sessionStorage.setItem("acct_from", data.from || "");
    sessionStorage.setItem("acct_to", data.to || today());
    render();
  });
  document.querySelector("#notificationTemplateForm")?.addEventListener("submit", handleNotificationTemplateForm);
  document.querySelector("#sendNotificationForm")?.addEventListener("submit", handleSendNotificationForm);
  document.querySelector("#bulkNotificationForm")?.addEventListener("submit", handleBulkNotificationForm);
  document.querySelector("#scheduleNotificationForm")?.addEventListener("submit", handleScheduleNotificationForm);
  document.querySelector("#announcementForm")?.addEventListener("submit", handleAnnouncementForm);
  document.querySelector("#providerOverrideForm")?.addEventListener("submit", handleProviderOverrideForm);
  document.querySelector("#processNotificationQueueBtn")?.addEventListener("click", handleProcessNotificationQueue);
  document.querySelector("#requestWithdrawBtn")?.addEventListener("click", () => {
    const form = document.querySelector("#withdrawForm");
    if (form) handleWithdrawalRequestFromForm(form);
  });
  document.querySelectorAll("[data-advance-withdrawal]").forEach((button) => {
    button.addEventListener("click", () => handleAdvanceWithdrawal(button.dataset.advanceWithdrawal));
  });
  document.querySelectorAll("[data-reject-withdrawal]").forEach((button) => {
    button.addEventListener("click", () => handleAdvanceWithdrawal(button.dataset.rejectWithdrawal, true));
  });
  document.querySelectorAll("[data-reverse-withdrawal]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirm("Reverse this paid withdrawal? This cannot be deleted; it will be marked reversed.")) return;
      handleReversePaidWithdrawal(button.dataset.reverseWithdrawal);
    });
  });
  const gpsBox = document.querySelector('#collectionForm [name="captureGps"]');
  if (gpsBox) {
    gpsBox.addEventListener("change", () => {
      if (!gpsBox.checked || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((pos) => {
        const form = document.querySelector("#collectionForm");
        const lat = form?.querySelector('[name="gpsLat"]');
        const lng = form?.querySelector('[name="gpsLng"]');
        if (lat) lat.value = String(pos.coords.latitude);
        if (lng) lng.value = String(pos.coords.longitude);
        toast("GPS saved for this collection");
      }, () => toast("Could not capture GPS"), { timeout: 5000 });
    });
  }
  document.querySelector("#auditSearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    sessionStorage.setItem("audit_search", JSON.stringify(formData(event.target)));
    render();
  });
  document.querySelector("#auditTimelineForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    let current = {};
    try {
      current = JSON.parse(sessionStorage.getItem("audit_search") || "{}");
    } catch {
      current = {};
    }
    sessionStorage.setItem("audit_search", JSON.stringify({ ...current, entityType: data.entityType, entityId: data.entityId }));
    render();
  });
  document.querySelector("#auditSaveFilterForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canAction(currentUser(), "Audit.Export")) {
      toast("You cannot save audit filters");
      return;
    }
    let filters = {};
    try {
      filters = JSON.parse(sessionStorage.getItem("audit_search") || "{}");
    } catch {
      filters = {};
    }
    saveAuditFilter(state, formData(event.target).name, filters, uid);
    logAudit("Audit filter saved", formData(event.target).name);
    toast("Search saved");
    render();
  });
  document.querySelector("#auditVerifyIntegrityBtn")?.addEventListener("click", () => {
    if (!canAction(currentUser(), "Audit.Integrity")) {
      toast("You cannot verify audit integrity");
      return;
    }
    const check = verifyAuditIntegrity(state, uid, { userId: currentUser()?.id || "" });
    saveState();
    toast(check.ok ? "Integrity chain is intact" : `${check.breaks} integrity break(s) recorded`);
    render();
  });
  document.querySelector("#auditProcessOutboxBtn")?.addEventListener("click", () => {
    if (!canAction(currentUser(), "Audit.Integrity")) return;
    const result = processAuditOutbox(state);
    saveState();
    toast(`Outbox: ${result.published} published, ${result.dead} dead-letter`);
    render();
  });
  document.querySelector("#auditArchiveBtn")?.addEventListener("click", () => {
    if (!canAction(currentUser(), "Audit.Archive")) {
      toast("You cannot archive audit records");
      return;
    }
    const result = archiveExpiredAudit(state);
    logAudit("Audit retention applied", `${result.archived} archived`);
    toast(`${result.archived} record(s) archived`);
    render();
  });
  document.querySelectorAll("[data-compliance-report]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canAction(currentUser(), "Audit.Export")) {
        toast("You cannot export audit reports");
        return;
      }
      const rows = complianceReport(state, button.dataset.complianceReport);
      if (!rows.length) {
        toast("Nothing to export");
        return;
      }
      const watermark = `CONFIDENTIAL · Smile Trust · ${currentUser()?.username || ""} · ${new Date().toISOString()} · ${button.dataset.complianceReport}`;
      state.auditExports = state.auditExports || [];
      state.auditExports.push({
        id: uid("aexp"),
        reportId: button.dataset.complianceReport,
        userId: currentUser()?.id || "",
        createdAt: new Date().toISOString(),
        rowCount: rows.length
      });
      logAudit("Audit report exported", button.dataset.complianceReport);
      download(`audit-${button.dataset.complianceReport}-${today()}.csv`, complianceCsv(rows, watermark), "text/csv");
    });
  });
  document.querySelectorAll("[data-replay-dlq]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canAction(currentUser(), "Audit.Integrity")) return;
      const result = replayAuditDeadLetter(state, button.dataset.replayDlq);
      saveState();
      toast(result.error || "Dead-letter replayed");
      render();
    });
  });
}

function attachHandlers() {
  document.querySelectorAll("[data-view-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.navFilter || "";
      if (filter) sessionStorage.setItem("nav_filter", filter);
      else sessionStorage.removeItem("nav_filter");
      if (button.dataset.collectFor) {
        sessionStorage.setItem("prefill_collection_customer", button.dataset.collectFor);
      }
      if (button.dataset.panelFocus) {
        sessionStorage.setItem("panel_focus", button.dataset.panelFocus);
      }
      const nextView = button.dataset.viewJump;
      resetCustomersUiForNavigation(nextView);
      activeView = nextView;
      render();
    });
  });
  document.querySelectorAll("[data-clear-nav-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.removeItem("nav_filter");
      render();
    });
  });
  document.querySelectorAll("tr[data-row-member-detail], article[data-row-member-detail]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, textarea, label")) return;
      sessionStorage.setItem("detail_customer_id", row.dataset.rowMemberDetail);
      resetCustomersUiForNavigation("memberDetail");
      activeView = "memberDetail";
      render();
    });
  });

  const customerForm = document.querySelector("#customerForm");
  if (customerForm) {
    customerForm.addEventListener("submit", handleCustomer);
    const accountTypeSelect = document.querySelector("#memberAccountTypeSelect");
    if (accountTypeSelect) accountTypeSelect.addEventListener("change", syncMemberAccountTypeFields);
    syncMemberAccountTypeFields();
    const groupPicker = customerForm.querySelector('select[name="groupId"]');
    if (groupPicker) {
      groupPicker.addEventListener("change", () => refreshMemberAccountPreview(groupPicker.value));
    }
    bindRegionDistrictCascade(customerForm);
    initMemberSignaturePad(customerForm);
  }
  attachPassportPhotoHandlers("member");
  attachPassportPhotoHandlers("staff");
  const cancelCustomerEdit = document.querySelector("#cancelCustomerEdit");
  if (cancelCustomerEdit) cancelCustomerEdit.addEventListener("click", () => {
    resetMemberRegistrationHardware();
    closeCustomerRegistrationSession(sessionStorage, localStorage);
    render();
  });
  document.querySelector("#openCustomerCreateFab")?.addEventListener("click", () => {
    resetMemberRegistrationHardware();
    openCustomerRegistrationSession(sessionStorage, localStorage);
    activeView = "customers";
    render();
    queueMicrotask(() => document.querySelector("#customerForm")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  });
  document.querySelector("#openCustomerCreateBtn")?.addEventListener("click", () => {
    resetMemberRegistrationHardware();
    openCustomerRegistrationSession(sessionStorage, localStorage);
    activeView = "customers";
    render();
    queueMicrotask(() => document.querySelector("#customerForm")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  });

  const groupForm = document.querySelector("#groupForm");
  if (groupForm) groupForm.addEventListener("submit", handleGroup);
  const susuGroupForm = document.querySelector("#susuGroupForm");
  if (susuGroupForm) susuGroupForm.addEventListener("submit", handleSusuGroup);
  const susuGroupMemberForm = document.querySelector("#susuGroupMemberForm");
  if (susuGroupMemberForm) susuGroupMemberForm.addEventListener("submit", handleSusuGroupMember);
  document.querySelector("#cancelSusuGroupEdit")?.addEventListener("click", () => {
    sessionStorage.removeItem("edit_susu_group_id");
    render();
  });
  document.querySelector("#backSusuGroups")?.addEventListener("click", () => {
    sessionStorage.removeItem("susu_group_detail_id");
    render();
  });
  document.querySelectorAll("[data-edit-susu-group]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("edit_susu_group_id", button.dataset.editSusuGroup);
      sessionStorage.removeItem("susu_group_detail_id");
      render();
    });
  });
  document.querySelectorAll("[data-susu-group-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("susu_group_detail_id", button.dataset.susuGroupDetail);
      sessionStorage.removeItem("edit_susu_group_id");
      render();
    });
  });
  const cancelGroupEdit = document.querySelector("#cancelGroupEdit");
  if (cancelGroupEdit) cancelGroupEdit.addEventListener("click", () => {
    sessionStorage.removeItem("edit_group_id");
    render();
  });

  const collectionForm = document.querySelector("#collectionForm");
  if (collectionForm) {
    collectionForm.addEventListener("submit", handleCollection);
    const customerPicker = collectionForm.querySelector('select[name="customerId"]');
    const amountInput = collectionForm.querySelector('input[name="amount"]');
    if (customerPicker && amountInput) {
      customerPicker.addEventListener("change", () => fillCollectionDefaultAmount(true));
      if (!amountInput.value) fillCollectionDefaultAmount(false);
    }
  }
  const cancelCollectionEdit = document.querySelector("#cancelCollectionEdit");
  if (cancelCollectionEdit) cancelCollectionEdit.addEventListener("click", () => {
    sessionStorage.removeItem("edit_collection_id");
    render();
  });

  const withdrawForm = document.querySelector("#withdrawForm");
  if (withdrawForm) {
    withdrawForm.addEventListener("submit", handleWithdrawal);
    const withdrawAmount = withdrawForm.querySelector("#withdrawAmount");
    const withdrawAmountWords = withdrawForm.querySelector("#withdrawAmountWords");
    if (withdrawAmount && withdrawAmountWords) {
      withdrawAmount.addEventListener("input", () => {
        withdrawAmountWords.value = amountInWords(withdrawAmount.value);
      });
    }
    const memberPicker = withdrawForm.querySelector('select[name="customerId"]');
    const fillWithdrawPreview = () => {
      const customer = state.customers.find((item) => item.id === memberPicker?.value);
      const bal = customer ? customerBalance(customer.id) : 0;
      const held = Number(customer?.heldBalance || 0);
      const balanceInput = document.querySelector("#withdrawAvailableBalance");
      if (balanceInput) balanceInput.value = Number(bal).toFixed(2);
      const slot = document.querySelector("#withdrawalCustomerPreviewSlot");
      if (slot) {
        slot.innerHTML = customer ? renderWithdrawalCustomerPreview({
          name: customer.name,
          customerNumber: customer.customerNumber || customer.accountNo || "",
          branchName: groupName(customer.groupId),
          agentName: userName(customer.collectorId),
          productName: productById(state.savingsProducts, customer.savingsProductId)?.name || "",
          balance: bal,
          held
        }) : "";
      }
    };
    if (memberPicker) memberPicker.addEventListener("change", fillWithdrawPreview);
    fillWithdrawPreview();
  }
  document.querySelector("#exportWithdrawalRows")?.addEventListener("click", () => {
    const rows = exportWithdrawalRows(state.withdrawalRequests || [], {
      customer: customerName,
      user: userName
    });
    if (!rows.length) {
      toast("No withdrawal requests to export");
      return;
    }
    downloadCsv("smile-trust-withdrawals.csv", rows);
  });
  const printWithdrawBlankBtn = document.querySelector("#printWithdrawBlankBtn");
  if (printWithdrawBlankBtn) {
    printWithdrawBlankBtn.addEventListener("click", () => {
      openPrintWindow(renderWithdrawalForm({
        date: document.querySelector('#withdrawForm input[name="date"]')?.value || today(),
        accountNo: "",
        accountName: "",
        amountWords: "",
        amountFigures: "",
        collectorName: currentUser()?.name || ""
      }));
    });
  }

  const loanForm = document.querySelector("#loanForm");
  if (loanForm) {
    loanForm.addEventListener("submit", handleLoan);
    const syncLoanApplicant = () => {
      const customer = state.customers.find((item) => item.id === loanForm.querySelector('select[name="customerId"]')?.value);
      const setValue = (id, value) => {
        const input = loanForm.querySelector(`#${id}`);
        if (input) input.value = value || "";
      };
      setValue("loanAccountNo", customer?.accountNo);
      setValue("loanGhanaCard", customer?.ghanaCard);
      setValue("loanPhone", customer?.phone);
      setValue("loanAddress", customer?.homeAddress || customer?.address);
    };
    const loanPrincipal = loanForm.querySelector("#loanPrincipal");
    const loanAmountWords = loanForm.querySelector("#loanAmountWords");
    loanForm.querySelector('select[name="customerId"]')?.addEventListener("change", syncLoanApplicant);
    if (loanPrincipal && loanAmountWords) {
      loanPrincipal.addEventListener("input", () => {
        loanAmountWords.value = amountInWords(loanPrincipal.value);
      });
    }
    syncLoanApplicant();
  }
  const cancelLoanEdit = document.querySelector("#cancelLoanEdit");
  if (cancelLoanEdit) cancelLoanEdit.addEventListener("click", () => {
    sessionStorage.removeItem("edit_loan_id");
    render();
  });

  const repaymentForm = document.querySelector("#repaymentForm");
  if (repaymentForm) repaymentForm.addEventListener("submit", handleRepayment);
  const cancelRepaymentEdit = document.querySelector("#cancelRepaymentEdit");
  if (cancelRepaymentEdit) cancelRepaymentEdit.addEventListener("click", () => {
    sessionStorage.removeItem("edit_repayment_id");
    render();
  });

  const importForm = document.querySelector("#importForm");
  if (importForm) importForm.addEventListener("submit", handleImport);
  const closingForm = document.querySelector("#closingForm");
  if (closingForm) {
    closingForm.addEventListener("submit", handleClosing);
    closingForm.querySelector('input[name="date"]').addEventListener("change", (event) => {
      sessionStorage.setItem("closing_date", event.target.value || today());
      render();
    });
  }
  const handoverForm = document.querySelector("#handoverForm");
  if (handoverForm) {
    handoverForm.addEventListener("submit", handleHandover);
    handoverForm.querySelector('input[name="date"]')?.addEventListener("change", (event) => {
      sessionStorage.setItem("handover_date", event.target.value || today());
      render();
    });
    handoverForm.querySelector('select[name="collectorId"]')?.addEventListener("change", (event) => {
      sessionStorage.setItem("handover_collector_id", event.target.value || "");
      render();
    });
  }
  const verifyHandoverForm = document.querySelector("#verifyHandoverForm");
  if (verifyHandoverForm) verifyHandoverForm.addEventListener("submit", handleVerifyHandover);
  document.querySelectorAll("[data-focus-handover]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("handover_focus_id", button.dataset.focusHandover || "");
      const row = (state.handovers || []).find((item) => item.id === button.dataset.focusHandover);
      if (row?.date) sessionStorage.setItem("handover_date", row.date);
      if (row?.collectorId) sessionStorage.setItem("handover_collector_id", row.collectorId);
      activeView = "handover";
      render();
      queueMicrotask(() => document.querySelector("#verifyHandoverForm")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  });
  const printClosingBtn = document.querySelector("#printClosingBtn");
  if (printClosingBtn) printClosingBtn.addEventListener("click", () => printClosing(sessionStorage.getItem("closing_date") || today()));

  const settingsForm = document.querySelector("#settingsForm");
  if (settingsForm) settingsForm.addEventListener("submit", handleSettings);
  document.querySelector("#companyProfileForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canAction(currentUser(), "System.Configure") && !canAction(currentUser(), "Settings.Edit")) return;
    const result = updateCompanyProfile(state, formData(event.target), currentUser(), uid);
    if (result.error) {
      toast(result.error);
      return;
    }
    saveState();
    toast("Company profile saved");
    render();
  });
  document.querySelector("#configSearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    sessionStorage.setItem("config_search", JSON.stringify(formData(event.target)));
    render();
  });
  document.querySelector("#configParameterForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canAction(currentUser(), "System.Configure") && !canAction(currentUser(), "Settings.Edit")) return;
    const online = typeof navigator === "undefined" || navigator.onLine !== false;
    const gate = canPerformOffline(state, "configuration.change", { online });
    if (!gate.ok) {
      toast(gate.error);
      return;
    }
    const data = formData(event.target);
    const result = setParameter(state, { key: data.key, value: data.value, reason: data.reason, user: currentUser() }, uid);
    if (result.error) {
      toast(result.error);
      return;
    }
    saveState();
    toast(result.pending ? "Submitted for approval" : "Parameter saved");
    render();
  });
  document.querySelector("#featureFlagForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canAction(currentUser(), "System.FeatureFlags") && !canAction(currentUser(), "Settings.Edit")) return;
    const data = formData(event.target);
    FEATURE_FLAG_CATALOG.forEach((flag) => {
      setFeatureFlag(state, { id: flag.id, enabled: Boolean(data[`flag_${flag.id}`]), reason: "Flag form", user: currentUser() }, uid);
    });
    saveState();
    toast("Feature flags updated");
    render();
  });
  document.querySelector("#holidayForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    const result = addHoliday(state, data, currentUser(), uid);
    if (result.error) {
      toast(result.error);
      return;
    }
    saveState();
    toast("Holiday added");
    render();
  });
  document.querySelector("#configProductForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canAction(currentUser(), "System.Products") && !canAction(currentUser(), "Settings.Edit")) return;
    const data = formData(event.target);
    const result = upsertProductDefinition(state, data, currentUser(), uid);
    if (result.error) {
      toast(result.error);
      return;
    }
    saveState();
    toast("Product updated");
    render();
  });
  document.querySelector("#configCompareForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formData(event.target);
    sessionStorage.setItem("config_compare", JSON.stringify({ from: data.from, to: data.to }));
    render();
  });
  document.querySelectorAll("[data-config-rollback]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirm("Rollback to this configuration version?")) return;
      const result = rollbackConfigVersion(state, button.dataset.configRollback, currentUser(), uid);
      if (result.error) {
        toast(result.error);
        return;
      }
      saveState();
      toast("Configuration rolled back");
      render();
    });
  });
  document.querySelectorAll("[data-config-approve]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = approveConfigDraft(state, button.dataset.configApprove, currentUser(), uid);
      if (result.error) {
        toast(result.error);
        return;
      }
      saveState();
      toast("Configuration approved");
      render();
    });
  });
  document.querySelectorAll("[data-config-reject]").forEach((button) => {
    button.addEventListener("click", () => {
      rejectConfigDraft(state, button.dataset.configReject, currentUser(), uid);
      saveState();
      toast("Draft rejected");
      render();
    });
  });
  document.querySelector("#exportConfigBtn")?.addEventListener("click", () => {
    download(`smile-trust-config-v${state.configVersionNumber || 1}.json`, JSON.stringify(exportConfig(state), null, 2), "application/json");
  });
  document.querySelector("#importConfigInput")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const result = importConfig(state, payload, currentUser(), uid);
        if (result.error) {
          toast(result.error);
          return;
        }
        saveState();
        toast("Configuration imported");
        render();
      } catch {
        toast("Invalid configuration file");
      }
    };
    reader.readAsText(file);
  });
  const savingsProductForm = document.querySelector("#savingsProductForm");
  if (savingsProductForm) savingsProductForm.addEventListener("submit", handleSavingsProduct);
  document.querySelector("#cancelProductEdit")?.addEventListener("click", () => {
    sessionStorage.removeItem("edit_savings_product_id");
    render();
  });
  document.querySelectorAll("[data-edit-product]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("edit_savings_product_id", button.dataset.editProduct);
      render();
    });
  });
  const kbaPasswordForm = document.querySelector("#kbaPasswordForm");
  if (kbaPasswordForm) kbaPasswordForm.addEventListener("submit", handleKbaPassword);
  const ownershipTransferForm = document.querySelector("#ownershipTransferForm");
  if (ownershipTransferForm) ownershipTransferForm.addEventListener("submit", handleOwnershipTransfer);
  const mfaSetupForm = document.querySelector("#mfaSetupForm");
  if (mfaSetupForm) mfaSetupForm.addEventListener("submit", handleMfaSetup);
  document.querySelector("#startMfaSetup")?.addEventListener("click", () => {
    const user = currentUser();
    if (!user) return;
    beginMfaSetup(user);
    saveState();
    render();
  });
  document.querySelector("#importPostgresBtn")?.addEventListener("click", () => { void importLocalSnapshotToPostgres(); });
  const pushCloudButton = document.querySelector("#pushCloudBackup");
  if (pushCloudButton) pushCloudButton.addEventListener("click", () => pushCloudBackup(false));
  const pullCloudButton = document.querySelector("#pullCloudBackup");
  if (pullCloudButton) pullCloudButton.addEventListener("click", pullCloudBackup);
  const replaceCloudButton = document.querySelector("#replaceCloudBackup");
  if (replaceCloudButton) replaceCloudButton.addEventListener("click", replaceCloudBackup);
  document.querySelector("#createInitialCloudSnapshot")?.addEventListener("click", () => { void createInitialCloudSnapshotFlow(); });

  const userForm = document.querySelector("#userForm");
  if (userForm) userForm.addEventListener("submit", handleUser);
  const syncLocationMode = () => {
    const mode = document.querySelector('input[name="locationMode"]:checked')?.value || "new";
    const newFields = document.querySelector("#newLocationFields");
    const existingFields = document.querySelector("#existingLocationFields");
    if (newFields) {
      newFields.style.display = mode === "new" ? "contents" : "none";
      setContainerFieldsActive(newFields, mode === "new");
    }
    if (existingFields) {
      existingFields.style.display = mode === "existing" ? "block" : "none";
      setContainerFieldsActive(existingFields, mode === "existing");
    }
    refreshExistingCollectorCodeField();
  };
  const refreshExistingCollectorCodeField = () => {
    const host = document.querySelector("#existingCollectorCodeField");
    const groupId = document.querySelector('#existingLocationFields select[name="collectorGroupId"]')?.value;
    if (!host) return;
    const group = groupById(groupId);
    host.innerHTML = group ? renderCollectorCodeField(group, { required: !group.collectorCode }) : "";
  };
  const groupSelectEl = document.querySelector('#existingLocationFields select[name="collectorGroupId"]');
  if (groupSelectEl) groupSelectEl.addEventListener("change", refreshExistingCollectorCodeField);
  const syncStaffRoleFields = () => {
    const role = document.querySelector("#staffRoleSelect")?.value || "Collector";
    const collectorFields = document.querySelector("#collectorStaffFields");
    const adminFields = document.querySelector("#adminStaffFields");
    const isCollectorRole = role === "Collector" || role === "GroupCoordinator" || role === "FieldSupervisor";
    if (collectorFields) {
      collectorFields.style.display = isCollectorRole ? "contents" : "none";
      setContainerFieldsActive(collectorFields, isCollectorRole);
    }
    if (adminFields) {
      const showAdmin = !isCollectorRole;
      adminFields.style.display = showAdmin ? "block" : "none";
      setContainerFieldsActive(adminFields, showAdmin);
    }
    if (isCollectorRole) {
      syncLocationMode();
      syncCollectorCollectionFields();
    }
  };
  document.querySelectorAll("[data-collector-capability]").forEach((input) => {
    input.addEventListener("change", syncCollectorCollectionFields);
  });
  const staffRoleSelect = document.querySelector("#staffRoleSelect");
  if (staffRoleSelect) staffRoleSelect.addEventListener("change", syncStaffRoleFields);
  document.querySelectorAll("[data-location-mode]").forEach((input) => {
    input.addEventListener("change", syncLocationMode);
  });
  syncLocationMode();
  syncStaffRoleFields();
  const cancelUserEdit = document.querySelector("#cancelUserEdit");
  if (cancelUserEdit) cancelUserEdit.addEventListener("click", () => {
    sessionStorage.removeItem("edit_user_id");
    render();
  });

  const permissionsForm = document.querySelector("#permissionsForm");
  if (permissionsForm) permissionsForm.addEventListener("submit", handlePermissions);
  const permissionsCollectorSelect = document.querySelector("#permissionsCollectorSelect");
  if (permissionsCollectorSelect) {
    permissionsCollectorSelect.addEventListener("change", () => {
      sessionStorage.setItem("permissions_user_id", permissionsCollectorSelect.value);
      render();
    });
  }
  const permissionsAllowAll = document.querySelector("#permissionsAllowAll");
  if (permissionsAllowAll) {
    permissionsAllowAll.addEventListener("click", () => {
      document.querySelectorAll("#permissionsForm input[type='checkbox']").forEach((input) => { input.checked = true; });
    });
  }
  const permissionsDenyAll = document.querySelector("#permissionsDenyAll");
  if (permissionsDenyAll) {
    permissionsDenyAll.addEventListener("click", () => {
      document.querySelectorAll("#permissionsForm input[type='checkbox']").forEach((input) => { input.checked = false; });
    });
  }
  document.querySelectorAll("[data-permissions-user]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("permissions_user_id", button.dataset.permissionsUser);
      activeView = "permissions";
      render();
    });
  });

  const clearMessagesBtn = document.querySelector("#clearMessagesBtn");
  if (clearMessagesBtn) clearMessagesBtn.addEventListener("click", () => {
    if (!confirm("Clear all visible messages from this device?")) return;
    const visibleIds = visibleMessages().map((message) => message.id);
    state.messages = state.messages.filter((message) => !visibleIds.includes(message.id));
    saveState();
    render();
  });
  const cancelPendingMessagesBtn = document.querySelector("#cancelPendingMessagesBtn");
  if (cancelPendingMessagesBtn) cancelPendingMessagesBtn.addEventListener("click", () => {
    const cancelled = cancelPendingMessages(false);
    if (cancelled) {
      saveState();
      pushCloudBackup(true);
    }
    toast(cancelled ? `${cancelled} pending message(s) cancelled` : "No pending messages to cancel");
    render();
  });
  const selectAllMessages = document.querySelector("#selectAllMessages");
  if (selectAllMessages) selectAllMessages.addEventListener("change", () => {
    document.querySelectorAll("[data-message-select]").forEach((input) => { input.checked = selectAllMessages.checked; });
  });
  const sendSelectedMessagesBtn = document.querySelector("#sendSelectedMessagesBtn");
  if (sendSelectedMessagesBtn) sendSelectedMessagesBtn.addEventListener("click", () => sendSelectedMessages());
  const markSelectedMessagesBtn = document.querySelector("#markSelectedMessagesBtn");
  if (markSelectedMessagesBtn) markSelectedMessagesBtn.addEventListener("click", () => markSelectedMessagesSent());
  const cancelSelectedMessagesBtn = document.querySelector("#cancelSelectedMessagesBtn");
  if (cancelSelectedMessagesBtn) cancelSelectedMessagesBtn.addEventListener("click", () => cancelSelectedMessages());

  const backupButton = document.querySelector("#backupBtn");
  if (backupButton) backupButton.addEventListener("click", exportBackup);
  const restoreInput = document.querySelector("#restoreInput");
  if (restoreInput) restoreInput.addEventListener("change", restoreBackup);
  document.querySelector("#syncEngineRunBtn")?.addEventListener("click", () => { void flushOfflineQueueNow().then(() => { toast("Ordered sync finished"); render(); }); });
  document.querySelector("#wave4SyncNowBtn")?.addEventListener("click", () => { void flushOfflineQueueNow().then(() => { toast("Wave 4 sync finished"); render(); }); });
  document.querySelector("#wave4RecoverQueueBtn")?.addEventListener("click", () => {
    void durableRecover(state, {
      secret: offlineQueueSecrets(),
      fingerprint: deviceFingerprint(),
      uid
    }).then((res) => {
      toast(res.ok ? `Recovered ${res.recovered || 0} queue item(s)` : (res.error || "Recover failed"));
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-sync-retry]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = retrySyncItem(state, button.dataset.syncRetry);
      if (result.error) {
        toast(result.error);
        return;
      }
      saveState();
      toast("Queued for retry");
      render();
    });
  });
  document.querySelectorAll("[data-sync-resolve]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = resolveConflict(state, button.dataset.syncResolve, button.dataset.strategy || "business_rule", currentUser(), uid);
      if (result.error) {
        toast(result.error);
        return;
      }
      saveState();
      toast("Conflict resolved");
      render();
    });
  });
  bindPaymentEngineHandlers();
  bindDocumentEngineHandlers();
  bindJobEngineHandlers();
  bindMonitoringEngineHandlers();
  bindGatewayEngineHandlers();
  bindRecoveryEngineHandlers();
  bindSecurityEngineHandlers();
  bindWorkflowEngineHandlers();
  bindRuleEngineHandlers();
  bindExchangeEngineHandlers();
  bindRecordsEngineHandlers();
  bindEnterpriseBiHandlers();
  bindIntegrationHubHandlers();
  bindEnterpriseAiHandlers();
  bindPlatformAdminHandlers();
  bindWave5AdminPortalHandlers();
  bindWave7AnalyticsHandlers();
  bindWave8CertificationHandlers();
  bindWave9PilotHandlers();
  bindWave10GoliveHandlers();
  document.querySelector("#identifierDelegationForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canAction(currentUser(), "Identifier.Delegate") && !canAction(currentUser(), "Settings.Edit")) return;
    const data = formData(event.target);
    const created = requestDelegation(state, data, currentUser(), uid);
    if (created.error) {
      toast(created.error);
      return;
    }
    ["submitted", "risk_assessment", "pending_approval"].forEach((step) => advanceDelegation(state, created.delegation.id, step, currentUser(), uid));
    saveState();
    toast("Delegation submitted for approval");
    render();
  });
  document.querySelectorAll("[data-id-approve]").forEach((button) => {
    button.addEventListener("click", () => {
      const approved = advanceDelegation(state, button.dataset.idApprove, "approved", currentUser(), uid);
      if (approved.error) {
        toast(approved.error);
        return;
      }
      if (!approved.pending) advanceDelegation(state, button.dataset.idApprove, "activated", currentUser(), uid);
      saveState();
      toast(approved.pending ? "Waiting for a second approver" : "Delegation approved");
      render();
    });
  });
  const logDate = document.querySelector("#logDate");
  if (logDate) logDate.addEventListener("change", () => {
    sessionStorage.setItem("log_date", logDate.value || today());
    document.querySelector("#dailyInputLogTable").innerHTML = renderDailyInputLogTable(dailyInputLogRows(logDate.value || today()));
  });
  const todayLogBtn = document.querySelector("#todayLogBtn");
  if (todayLogBtn) todayLogBtn.addEventListener("click", () => {
    sessionStorage.setItem("log_date", today());
    render();
  });
  const printLogBtn = document.querySelector("#printLogBtn");
  if (printLogBtn) printLogBtn.addEventListener("click", printDailyInputLog);
  const reportFrom = document.querySelector("#reportFrom");
  const reportTo = document.querySelector("#reportTo");
  if (reportFrom) reportFrom.addEventListener("change", () => setReportRange(reportFrom.value, reportTo?.value || reportFrom.value));
  if (reportTo) reportTo.addEventListener("change", () => setReportRange(reportFrom?.value || reportTo.value, reportTo.value));
  document.querySelectorAll("[data-report-range]").forEach((button) => {
    button.addEventListener("click", () => setQuickReportRange(button.dataset.reportRange));
  });
  processDueReports();
  document.querySelector("#biReportForm")?.addEventListener("submit", handleBiReportForm);
  document.querySelector("#customReportForm")?.addEventListener("submit", handleCustomReportForm);
  document.querySelector("#scheduleReportForm")?.addEventListener("submit", handleScheduleReportForm);
  document.querySelector("#biSearchForm")?.addEventListener("submit", handleBiSearchForm);
  document.querySelector("#biExportCsvBtn")?.addEventListener("click", exportCurrentBiReport);
  document.querySelectorAll("[data-drill-date]").forEach((row) => {
    row.addEventListener("click", () => {
      const day = row.dataset.drillDate;
      sessionStorage.setItem("bi_report_id", "collections_daily");
      setReportRange(day, day);
    });
  });

  const refreshCustomerTable = () => {
    const query = document.querySelector("#customerSearch")?.value || "";
    const status = document.querySelector("#customerStatusFilter")?.value || "";
    const branch = document.querySelector("#customerBranchFilter")?.value || "";
    const agent = document.querySelector("#customerAgentFilter")?.value || "";
    let filtered = searchCustomersAdvanced(visibleCustomers(), query, {
      branchName: (customer) => groupName(customer.groupId),
      agentName: (customer) => state.users.find((user) => user.id === customer.collectorId)?.name || ""
    });
    if (status) filtered = filtered.filter((customer) => (customer.memberStatus || "Active") === status);
    if (branch) filtered = filtered.filter((customer) => customer.groupId === branch);
    if (agent) filtered = filtered.filter((customer) => customer.collectorId === agent);
    const table = document.querySelector("#customerTable");
    if (table) {
      table.innerHTML = renderCustomerTable(filtered);
      attachToggleButtons();
    }
  };
  const search = document.querySelector("#customerSearch");
  if (search) search.addEventListener("input", refreshCustomerTable);
  ["customerStatusFilter", "customerBranchFilter", "customerAgentFilter"].forEach((id) => {
    document.querySelector(`#${id}`)?.addEventListener("change", refreshCustomerTable);
  });
  document.querySelector("#exportCustomersBtn")?.addEventListener("click", exportVisibleCustomersCsv);
  document.querySelector("#addBeneficiaryRow")?.addEventListener("click", () => {
    const box = document.querySelector("#beneficiaryRows");
    if (!box) return;
    const row = document.createElement("div");
    row.className = "crm-ben-row";
    row.innerHTML = `<input name="benName" placeholder="Name" /><input name="benRelationship" placeholder="Relationship" /><input name="benShare" type="number" min="0" max="100" placeholder="%" /><input name="benPhone" placeholder="Phone" /><input name="benAddress" placeholder="Address" />`;
    box.appendChild(row);
  });
  document.querySelector("#customerNoteForm")?.addEventListener("submit", handleCustomerNote);
  document.querySelector("#customerStatementForm")?.addEventListener("submit", handleCustomerStatement);
  document.querySelector("#customerDocumentForm")?.addEventListener("submit", handleCustomerDocument);
  document.querySelector("#customerAccountForm")?.addEventListener("submit", handleCustomerAccount);
  document.querySelector("#customerMessageForm")?.addEventListener("submit", handleCustomerMessage);
  document.querySelectorAll("[data-kyc-verify]").forEach((button) => {
    button.addEventListener("click", () => handleKycVerify(button.dataset.kycVerify));
  });
  document.querySelectorAll("[data-print-card]").forEach((button) => {
    button.addEventListener("click", () => printMembershipCard(button.dataset.printCard));
  });
  document.querySelectorAll("[data-export-statement]").forEach((button) => {
    button.addEventListener("click", () => exportCustomerStatementCsv(button.dataset.exportStatement));
  });
  document.querySelectorAll("[data-share-statement]").forEach((button) => {
    button.addEventListener("click", () => shareCustomerStatement(button.dataset.shareStatement));
  });
  document.querySelectorAll("[data-customer-page]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("customer_page", button.dataset.customerPage);
      refreshCustomerTable();
    });
  });
  document.querySelector("#selectAllCustomers")?.addEventListener("change", (event) => {
    document.querySelectorAll("[data-select-customer]").forEach((input) => {
      input.checked = event.target.checked;
    });
  });
  document.querySelector("#bulkAssignBtn")?.addEventListener("click", handleBulkCustomerAssign);
  document.querySelector("#bulkSuspendBtn")?.addEventListener("click", () => handleBulkCustomerStatus("Suspended"));
  document.querySelector("#bulkDeleteBtn")?.addEventListener("click", handleBulkCustomerDelete);
  document.querySelector("#importCustomersInput")?.addEventListener("change", handleCustomerImport);
  initCustomerWizard(document.querySelector("#customerForm"));
  bindCustomerDraft(document.querySelector("#customerForm"));
  bindCustomerMessagePreview();
  bindAgentHandlers();
  bindBranchHandlers();
  bindCollectionHandlers();
  bindGroupHandlers();

  const collectionSearch = document.querySelector("#collectionSearch");
  if (collectionSearch) collectionSearch.addEventListener("input", refreshCollectionHistory);

  const memberSearch = document.querySelector("#collectionMemberSearch");
  if (memberSearch) memberSearch.addEventListener("input", () => {
    const q = memberSearch.value.trim().toLowerCase();
    const match = visibleCustomers().find((c) => `${c.name} ${c.phone} ${c.accountNo}`.toLowerCase().includes(q));
    const select = document.querySelector('#collectionForm select[name="customerId"]');
    if (match && select) {
      select.value = match.id;
      fillCollectionDefaultAmount(true);
    }
  });

  attachToggleButtons();

  document.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", () => exportCsv(button.dataset.export));
  });
  document.querySelectorAll("[data-receipt]").forEach((button) => {
    button.addEventListener("click", () => printReceipt(button.dataset.receipt));
  });
  document.querySelectorAll("[data-share-receipt]").forEach((button) => {
    button.addEventListener("click", () => shareReceipt(button.dataset.shareReceipt));
  });
  document.querySelectorAll("[data-back-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.backView;
      resetCustomersUiForNavigation(nextView);
      activeView = nextView;
      render();
    });
  });
}

function attachToggleButtons() {
  document.querySelectorAll("[data-toggle-customer]").forEach((button) => {
    button.addEventListener("click", () => {
      const customer = state.customers.find((c) => c.id === button.dataset.toggleCustomer);
      if (!customer) return;
      const next = customer.active === false || customer.memberStatus === "Suspended" ? "Active" : "Suspended";
      const result = setCustomerStatus(customer, next, currentUser(), uid);
      if (result.error) {
        toast(result.error);
        return;
      }
      saveState();
      logAudit("Customer status changed", `${customer.name} · ${next}`);
      render();
    });
  });
  document.querySelectorAll("[data-edit-customer]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      resetMemberRegistrationHardware();
      try { localStorage.removeItem(CUSTOMER_REG_DRAFT_KEY); } catch { /* ignore */ }
      sessionStorage.setItem(EDIT_CUSTOMER_ID_KEY, button.dataset.editCustomer);
      sessionStorage.setItem(CUSTOMER_CREATE_OPEN_KEY, "0");
      activeView = "customers";
      render();
      queueMicrotask(() => document.querySelector("#customerForm")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  });
  document.querySelectorAll("[data-delete-customer]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteCustomer(button.dataset.deleteCustomer);
    });
  });
  document.querySelectorAll("[data-reassign-customer]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handleReassignCustomer(button.dataset.reassignCustomer);
    });
  });
  document.querySelectorAll("[data-member-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      sessionStorage.setItem("detail_customer_id", button.dataset.memberDetail);
      resetCustomersUiForNavigation("memberDetail");
      activeView = "memberDetail";
      render();
    });
  });
  document.querySelectorAll("[data-toggle-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = state.groups.find((item) => item.id === button.dataset.toggleGroup);
      group.active = !group.active;
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-edit-group]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("edit_group_id", button.dataset.editGroup);
      render();
    });
  });
  document.querySelectorAll("[data-delete-group]").forEach((button) => {
    button.addEventListener("click", () => deleteGroup(button.dataset.deleteGroup));
  });
  document.querySelectorAll("[data-group-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("detail_group_id", button.dataset.groupDetail);
      activeView = "groupDetail";
      render();
    });
  });
  document.querySelectorAll("[data-toggle-user]").forEach((button) => {
    button.addEventListener("click", () => {
      const actor = currentUser();
      const user = getUserForActor(state.users, button.dataset.toggleUser, actor);
      if (!user || !canDisableUserAccount(actor, user)) {
        toast("System accounts cannot be disabled here");
        return;
      }
      user.active = !user.active;
      if (user.active) {
        user.pending = false;
        ensureGroupForAdmin(user);
      }
      user.updatedAt = new Date().toISOString();
      saveState();
      logAudit(user.active ? "Admin activated" : "Admin disabled", user.username);
      mirrorStaffAccount(user);
      pushCloudBackup(false);
      render();
    });
  });
  document.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () => {
      const actor = currentUser();
      const user = getUserForActor(state.users, button.dataset.editUser, actor);
      if (!user || !canEditUserAccount(actor, user)) {
        toast("This account cannot be edited");
        return;
      }
      sessionStorage.setItem("edit_user_id", button.dataset.editUser);
      // Agents table "Edit account" must open Staff & Collectors, not stay on agents.
      if (canAccessView("users")) activeView = "users";
      render();
    });
  });
  document.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", () => deleteUser(button.dataset.deleteUser));
  });
  document.querySelectorAll("[data-edit-collection]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("edit_collection_id", button.dataset.editCollection);
      render();
    });
  });
  document.querySelectorAll("[data-verify-payment]").forEach((button) => {
    button.addEventListener("click", () => verifyPayment(button.dataset.verifyPayment));
  });
  document.querySelectorAll("[data-approve-reversal]").forEach((button) => {
    button.addEventListener("click", () => approveReversalById(button.dataset.approveReversal));
  });
  document.querySelectorAll("[data-disable-device]").forEach((button) => {
    button.addEventListener("click", () => {
      if (confirm("Disable this device? The collector will not be able to sign in from it.")) {
        toggleDeviceActive(button.dataset.disableDevice, false);
      }
    });
  });
  document.querySelectorAll("[data-enable-device]").forEach((button) => {
    button.addEventListener("click", () => toggleDeviceActive(button.dataset.enableDevice, true));
  });
  const distributionForm = document.querySelector("#distributionForm");
  if (distributionForm) distributionForm.addEventListener("submit", handleCreateDistribution);
  document.querySelectorAll("[data-approve-distribution]").forEach((button) => {
    button.addEventListener("click", () => approveDistributionById(button.dataset.approveDistribution));
  });
  document.querySelectorAll("[data-pay-distribution]").forEach((button) => {
    button.addEventListener("click", () => {
      if (confirm("Confirm that physical payouts were completed for this cycle?")) {
        payDistributionById(button.dataset.payDistribution);
      }
    });
  });
  document.querySelectorAll("[data-reverse-collection]").forEach((button) => {
    button.addEventListener("click", () => requestCollectionReversal(button.dataset.reverseCollection));
  });
  document.querySelectorAll("[data-delete-collection]").forEach((button) => {
    button.addEventListener("click", () => requestCollectionReversal(button.dataset.deleteCollection));
  });
  document.querySelectorAll("[data-edit-loan]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("edit_loan_id", button.dataset.editLoan);
      render();
    });
  });
  document.querySelectorAll("[data-delete-loan]").forEach((button) => {
    button.addEventListener("click", () => deleteLoan(button.dataset.deleteLoan));
  });
  document.querySelectorAll("[data-approve-loan]").forEach((button) => {
    button.addEventListener("click", () => approveLoan(button.dataset.approveLoan));
  });
  document.querySelectorAll("[data-reject-loan]").forEach((button) => {
    button.addEventListener("click", () => rejectLoan(button.dataset.rejectLoan));
  });
  document.querySelectorAll("[data-cancel-loan]").forEach((button) => {
    button.addEventListener("click", () => cancelLoan(button.dataset.cancelLoan));
  });
  document.querySelectorAll("[data-disburse-loan]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirm("Disburse this loan and record cash out?")) return;
      disburseLoan(button.dataset.disburseLoan);
    });
  });
  document.querySelectorAll("[data-edit-repayment]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("edit_repayment_id", button.dataset.editRepayment);
      render();
    });
  });
  document.querySelectorAll("[data-delete-repayment]").forEach((button) => {
    button.addEventListener("click", () => deleteRepayment(button.dataset.deleteRepayment));
  });
  document.querySelectorAll("[data-send-collection-sms]").forEach((button) => {
    button.addEventListener("click", () => sendCollectionSms(button.dataset.sendCollectionSms));
  });
  document.querySelectorAll("[data-send-loan-sms]").forEach((button) => {
    button.addEventListener("click", () => sendLoanSms(button.dataset.sendLoanSms));
  });
  document.querySelectorAll("[data-send-message]").forEach((button) => {
    button.addEventListener("click", () => sendMessageSms(button.dataset.sendMessage));
  });
  document.querySelectorAll("[data-pay-interest]").forEach((button) => {
    button.addEventListener("click", () => {
      const [loanId, index] = button.dataset.payInterest.split("|");
      payInterest(loanId, Number(index));
    });
  });
  document.querySelectorAll("[data-undo-interest]").forEach((button) => {
    button.addEventListener("click", () => {
      const [loanId, index] = button.dataset.undoInterest.split("|");
      undoInterestPayment(loanId, Number(index));
    });
  });
  document.querySelectorAll("[data-print-loan-app]").forEach((button) => {
    button.addEventListener("click", () => printLoanApplicationFormForLoan(button.dataset.printLoanApp));
  });
  document.querySelectorAll("[data-print-loan-accept]").forEach((button) => {
    button.addEventListener("click", () => printLoanAcceptanceFormForLoan(button.dataset.printLoanAccept));
  });
  document.querySelectorAll("[data-print-statement]").forEach((button) => {
    button.addEventListener("click", () => printMemberStatement(button.dataset.printStatement));
  });
  document.querySelectorAll("[data-print-closing]").forEach((button) => {
    button.addEventListener("click", () => printClosingById(button.dataset.printClosing));
  });
  attachAgencyHandlers();
}

async function handleAdminRequest(event) {
  event.preventDefault();
  const notice = document.querySelector("#requestNotice");
  const submitButton = event.target.querySelector('button[type="submit"]');
  const data = formData(event.target);
  if (!String(data.name || "").trim() || !String(data.username || "").trim() || !String(data.password || "").trim() || !String(data.groupName || "").trim()) {
    notice.innerHTML = `<div class="notice">Fill in name, username, location, and password.</div>`;
    return;
  }
  if (state.users.some((user) => user.username.toLowerCase() === data.username.toLowerCase())) {
    notice.innerHTML = `<div class="notice">That username already exists.</div>`;
    return;
  }
  if (submitButton) submitButton.disabled = true;
  try {
    state.deletedUsers = (state.deletedUsers || []).filter((item) => String(item.username || "").toLowerCase() !== data.username.toLowerCase());
    state.users.push({
      id: uid("user"),
      name: data.name,
      username: data.username,
      passwordHash: await hashPasswordForUser(data.password),
      loginPasswordHint: String(data.password || "").trim(),
      role: "Admin",
      active: false,
      pending: true,
      requestedGroupName: data.groupName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    saveState();
    pushCloudBackup(false);
    notice.innerHTML = `<div class="notice good">Request sent. The owner must activate this admin before login.</div>`;
    event.target.reset();
  } catch (error) {
    console.error("Admin request failed:", error);
    notice.innerHTML = `<div class="notice">Could not send request. ${escapeHtml(error?.message || "Try again.")}</div>`;
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function fillCollectionDefaultAmount(force = false) {
  const form = document.querySelector("#collectionForm");
  if (!form) return;
  const select = form.querySelector('select[name="customerId"]');
  const amountInput = form.querySelector('input[name="amount"]');
  const accountInput = form.querySelector("#collectionAccountNo");
  const customer = state.customers.find((item) => item.id === select?.value);
  if (!customer) {
    if (accountInput) accountInput.value = "";
    return;
  }
  if (accountInput) accountInput.value = customer.accountNo || customer.customerNumber || "";
  if (!amountInput) return;
  const amount = perSittingAmount(customer);
  if (force || !amountInput.value) amountInput.value = amount;
  const cardHost = document.querySelector("#collectionCustomerCard");
  if (cardHost) cardHost.innerHTML = renderCollectionCustomerCard(collectionCardForCustomer(customer));
}

function handleBulkCollection(event) {
  event.preventDefault();
  const form = event.target;
  const ids = [...form.querySelectorAll('input[name="bulkId"]:checked')].map((input) => input.value);
  if (!ids.length) {
    toast("Select at least one customer");
    return;
  }
  const rows = ids.map((id) => {
    const customer = state.customers.find((item) => item.id === id);
    return {
      customer,
      agent: currentUser(),
      product: productById(state.savingsProducts, customer?.savingsProductId),
      amount: Number(form.querySelector(`[name="bulkAmount_${id}"]`)?.value || 0),
      date: today()
    };
  });
  const checked = validateBulkDrafts(rows);
  if (!checked.ok) {
    toast(checked.results.find((item) => !item.ok)?.error || "Bulk collection failed validation");
    return;
  }
  let saved = 0;
  collectionWriteOptions = { silent: true, skipDuplicateConfirm: true };
  try {
    ids.forEach((id) => {
      const fakeForm = document.createElement("form");
      fakeForm.innerHTML = `
        <input name="customerId" value="${id}" />
        <input name="amount" value="${form.querySelector(`[name="bulkAmount_${id}"]`)?.value || 0}" />
        <input name="paymentMethod" value="Cash" />
        <input name="date" value="${today()}" />
        <input name="visitOutcome" value="Paid" />
        <input name="note" value="Bulk collection" />
      `;
      const submitEvent = new Event("submit", { cancelable: true, bubbles: true });
      Object.defineProperty(submitEvent, "target", { value: fakeForm });
      const before = state.collections.length;
      handleCollection(submitEvent);
      if (state.collections.length > before) saved += 1;
    });
  } finally {
    collectionWriteOptions = {};
  }
  sessionStorage.removeItem("collection_bulk");
  toast(saved ? `${saved} collections saved` : "No collections saved");
  render();
}

function handleAdjustCollection(collectionId) {
  if (!canApproveFinancial(currentUser()) && !canRequestCollectionReversal()) {
    toast("You cannot request an adjustment");
    return;
  }
  const collection = state.collections.find((item) => item.id === collectionId);
  if (!collection || collection.reversed) {
    toast("Collection not found");
    return;
  }
  const amount = Number(prompt(`Adjustment amount to subtract from ${money(collection.amount)}`, "0"));
  const reason = prompt("Reason for adjustment");
  const result = createAdjustmentRequest(state, {
    collection,
    amount,
    reason,
    requestedBy: currentUser()?.id || "",
    uid
  });
  if (result.error) {
    toast(result.error);
    return;
  }
  logAudit("Collection adjustment requested", `${collection.receiptNo || collection.id} · ${money(amount)}`);
  saveState();
  toast("Adjustment submitted for approval");
  render();
}

function handleApproveAdjustment(adjustmentId) {
  if (!canApproveFinancial(currentUser())) {
    toast("You cannot approve this adjustment");
    return;
  }
  const pending = (state.collectionAdjustments || []).find((item) => item.id === adjustmentId);
  const result = applyAdjustment(state, adjustmentId, currentUser());
  if (result.error) {
    toast(result.error);
    return;
  }
  if (pending && result.collection) {
    postDoubleEntry(state, {
      id: uid("led"),
      entryType: "Collection Adjustment",
      customerId: result.collection.customerId,
      groupId: result.collection.groupId,
      collectorId: result.collection.collectorId,
      amount: pending.amount,
      direction: "debit",
      referenceId: result.collection.id,
      referenceType: "collection_adjustment",
      receiptNo: result.collection.receiptNo,
      paymentMethod: result.collection.paymentMethod,
      reason: pending.reason,
      createdBy: currentUser().id,
      clientCreatedAt: new Date().toISOString()
    }, uid);
  }
  logAudit("Collection adjustment approved", `${result.collection?.receiptNo || adjustmentId}`);
  saveState();
  toast("Adjustment applied");
  render();
}

function bindCollectionHandlers() {
  document.querySelector("#toggleBulkCollection")?.addEventListener("click", () => {
    sessionStorage.setItem("collection_bulk", sessionStorage.getItem("collection_bulk") === "1" ? "" : "1");
    render();
  });
  document.querySelector("#bulkCollectionForm")?.addEventListener("submit", handleBulkCollection);
  document.querySelector("#quickCollectFab")?.addEventListener("click", () => {
    document.querySelector('#collectionForm input[name="amount"]')?.focus();
    document.querySelector("#collectionForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.querySelector("#collectionPrevCustomer")?.addEventListener("click", () => shiftCollectionCustomer(-1));
  document.querySelector("#collectionNextCustomer")?.addEventListener("click", () => shiftCollectionCustomer(1));
  document.querySelectorAll("[data-keypad]").forEach((button) => {
    button.addEventListener("click", () => applyCollectionKeypad(button.dataset.keypad));
  });
  document.querySelectorAll("[data-adjust-collection]").forEach((button) => {
    button.addEventListener("click", () => handleAdjustCollection(button.dataset.adjustCollection));
  });
  document.querySelectorAll("[data-approve-adjustment]").forEach((button) => {
    button.addEventListener("click", () => handleApproveAdjustment(button.dataset.approveAdjustment));
  });
  document.querySelectorAll("[data-reprint-collection]").forEach((button) => {
    button.addEventListener("click", () => {
      const collection = state.collections.find((item) => item.id === button.dataset.reprintCollection);
      const customer = state.customers.find((item) => item.id === collection?.customerId);
      if (collection) printCollectionReceipt(collection, customer);
    });
  });
  document.querySelector("#exportCollectionExcel")?.addEventListener("click", exportVisibleCollectionsCsv);
  document.querySelector("#exportCollectionReportBtn")?.addEventListener("click", exportVisibleCollectionsCsv);
  ["collectionFrom", "collectionTo", "collectionMethodFilter", "collectionAgentFilter", "collectionBranchFilter", "collectionProductFilter"].forEach((id) => {
    document.querySelector(`#${id}`)?.addEventListener("change", refreshCollectionHistory);
  });
}

function bindGroupHandlers() {
  const refreshGroupTable = () => {
    const table = document.querySelector("#susuGroupTable");
    if (!table) return;
    const filtered = searchGroups(visibleSusuGroups(), {
      q: document.querySelector("#groupSearch")?.value || "",
      status: document.querySelector("#groupStatusFilter")?.value || "",
      groupType: document.querySelector("#groupTypeFilter")?.value || "",
      agentId: document.querySelector("#groupAgentFilter")?.value || "",
      branchId: document.querySelector("#groupBranchFilter")?.value || ""
    });
    table.innerHTML = renderSusuGroupTable(filtered);
    document.querySelectorAll("[data-susu-group-detail]").forEach((button) => {
      button.addEventListener("click", () => {
        sessionStorage.setItem("susu_group_detail_id", button.dataset.susuGroupDetail);
        sessionStorage.removeItem("edit_susu_group_id");
        render();
      });
    });
    document.querySelectorAll("[data-edit-susu-group]").forEach((button) => {
      button.addEventListener("click", () => {
        sessionStorage.setItem("edit_susu_group_id", button.dataset.editSusuGroup);
        sessionStorage.removeItem("susu_group_detail_id");
        render();
      });
    });
  };
  document.querySelector("#groupSearch")?.addEventListener("input", refreshGroupTable);
  ["groupStatusFilter", "groupTypeFilter", "groupAgentFilter", "groupBranchFilter"].forEach((id) => {
    document.querySelector(`#${id}`)?.addEventListener("change", refreshGroupTable);
  });
  document.querySelector("#exportGroupsBtn")?.addEventListener("click", () => {
    const rows = exportGroupRows(visibleSusuGroups(), {
      branchName: (group) => groupName(group.branchId),
      agentName: (group) => userName(group.collectorId)
    });
    if (!rows.length) {
      toast("No groups to export");
      return;
    }
    downloadCsv("smile-trust-groups.csv", rows);
  });
  document.querySelector("#startGroupMeeting")?.addEventListener("click", handleStartGroupMeeting);
  document.querySelector("#startGroupMeetingFab")?.addEventListener("click", handleStartGroupMeeting);
  document.querySelector("#meetingWizardForm")?.addEventListener("submit", handleMeetingWizard);
  document.querySelector("#groupWelfareForm")?.addEventListener("submit", handleGroupWelfare);
  document.querySelector("#groupShareForm")?.addEventListener("submit", handleGroupShare);
  document.querySelector("#groupStatusForm")?.addEventListener("submit", handleGroupStatusForm);
  document.querySelector("#createShareOutBtn")?.addEventListener("click", handleCreateShareOut);
  document.querySelectorAll("[data-member-status]").forEach((button) => {
    button.addEventListener("click", () => handleGroupMemberStatus(button.dataset.memberStatus, button.dataset.memberNext));
  });
  document.querySelectorAll("[data-member-transfer]").forEach((button) => {
    button.addEventListener("click", () => handleGroupMemberTransfer(button.dataset.memberTransfer));
  });
}

function shiftCollectionCustomer(step) {
  const select = document.querySelector('#collectionForm select[name="customerId"]');
  const queue = assignedCollectionQueue();
  const index = queue.findIndex((item) => item.id === select?.value);
  const next = queue[index + step];
  if (!select || !next) return;
  select.value = next.id;
  fillCollectionDefaultAmount(true);
}

function applyCollectionKeypad(key) {
  const input = document.querySelector('#collectionForm input[name="amount"]');
  if (!input) return;
  if (key === "⌫") {
    input.value = String(input.value).slice(0, -1);
    return;
  }
  if (key === "." && String(input.value).includes(".")) return;
  input.value = `${input.value || ""}${key}`;
}

function collectionHistoryQuery() {
  return {
    q: document.querySelector("#collectionSearch")?.value || "",
    from: document.querySelector("#collectionFrom")?.value || "",
    to: document.querySelector("#collectionTo")?.value || "",
    method: document.querySelector("#collectionMethodFilter")?.value || "",
    agentId: document.querySelector("#collectionAgentFilter")?.value || "",
    branchId: document.querySelector("#collectionBranchFilter")?.value || "",
    productId: document.querySelector("#collectionProductFilter")?.value || ""
  };
}

function refreshCollectionHistory() {
  const table = document.querySelector("#collectionTable");
  if (!table) return;
  const filtered = filterCollections(visibleCollections(), collectionHistoryQuery(), {
    customerName: (item) => customerName(item.customerId),
    agentName: (item) => userName(item.userId || item.collectorId),
    branchName: (item) => groupName(item.groupId),
    productName: (item) => productById(state.savingsProducts, item.savingsProductId)?.name || ""
  });
  table.innerHTML = renderCollectionsTable(filtered);
  attachToggleButtons();
  document.querySelectorAll("[data-adjust-collection]").forEach((button) => {
    button.addEventListener("click", () => handleAdjustCollection(button.dataset.adjustCollection));
  });
  document.querySelectorAll("[data-reprint-collection]").forEach((button) => {
    button.addEventListener("click", () => {
      const collection = state.collections.find((item) => item.id === button.dataset.reprintCollection);
      const customer = state.customers.find((item) => item.id === collection?.customerId);
      if (collection) printCollectionReceipt(collection, customer);
    });
  });
}

function exportVisibleCollectionsCsv() {
  const rows = exportCollectionRows(filterCollections(visibleCollections(), collectionHistoryQuery(), {
    customerName: (item) => customerName(item.customerId),
    agentName: (item) => userName(item.userId || item.collectorId),
    branchName: (item) => groupName(item.groupId),
    productName: (item) => productById(state.savingsProducts, item.savingsProductId)?.name || ""
  }), {
    customerName: (item) => customerName(item.customerId),
    agentName: (item) => userName(item.userId || item.collectorId),
    branchName: (item) => groupName(item.groupId),
    productName: (item) => productById(state.savingsProducts, item.savingsProductId)?.name || ""
  });
  if (!rows.length) {
    toast("No collections to export");
    return;
  }
  downloadCsv("smile-trust-collections.csv", rows);
}

function collectionStatusForAmount(customer, amount) {
  const perSitting = perSittingAmount(customer);
  if (amount <= 0) return "Missed";
  if (perSitting && amount < perSitting) return "Partial";
  return "Paid";
}

function cancelPendingMessages(markMigration = false) {
  const user = currentUser();
  const groupIds = user ? visibleGroupIds() : [];
  let count = 0;
  state.messages.forEach((message) => {
    const customer = state.customers.find((item) => item.id === message.customerId);
    const canSee = markMigration || !user || isKBA() || groupIds.includes(customer?.groupId);
    if (!canSee || !isUnsentMessage(message)) return;
    message.status = "Cancelled";
    message.cancelledAt = new Date().toISOString();
    message.cancelledBy = currentUser()?.id || "system";
    count += 1;
  });
  if (markMigration) localStorage.setItem(CANCEL_PENDING_MESSAGES_KEY, "true");
  return count;
}

function cancelPendingMessagesOnce() {
  if (localStorage.getItem(CANCEL_PENDING_MESSAGES_KEY) === "true") return 0;
  return cancelPendingMessages(true);
}

function sendSelectedMessages() {
  const ids = selectedMessageIds();
  if (!ids.length) {
    toast("Select messages first");
    return;
  }
  sendMessageSms(ids[0]);
}

function markSelectedMessagesSent() {
  const ids = selectedMessageIds();
  if (!ids.length) {
    toast("Select messages first");
    return;
  }
  state.messages.forEach((message) => {
    if (ids.includes(message.id) && message.status !== "Cancelled") {
      message.status = "Sent";
      message.sentAt = new Date().toISOString();
      message.sentManually = true;
    }
  });
  saveState();
  toast(`${ids.length} message(s) marked sent`);
  render();
}

function cancelSelectedMessages() {
  const ids = selectedMessageIds();
  if (!ids.length) {
    toast("Select messages first");
    return;
  }
  state.messages.forEach((message) => {
    if (ids.includes(message.id) && message.status !== "Sent") {
      message.status = "Cancelled";
      message.cancelledAt = new Date().toISOString();
      message.cancelledBy = currentUser()?.id || "system";
    }
  });
  saveState();
  toast(`${ids.length} message(s) cancelled`);
  render();
}

function createSusuLocation({ name, intervalDays, targetContributions, defaultAmount, interest, note = "", collectorId = "", collectorCode = "" }) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  const existing = state.groups.find((group) => group.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    if (collectorId) {
      existing.collectorId = collectorId;
      existing.active = true;
      existing.updatedAt = new Date().toISOString();
    }
    if (collectorCode) existing.collectorCode = normalizeCollectorCode(collectorCode);
    syncGroupStaffIds(existing);
    return existing;
  }
  const group = {
    id: uid("grp"),
    name: trimmed,
    adminId: "",
    collectorId,
    collectorCode: normalizeCollectorCode(collectorCode),
    intervalDays: Number(intervalDays) || 1,
    targetContributions: Number(targetContributions) || 31,
    defaultAmount: Number(defaultAmount) || 0,
    interest: Number(interest ?? state.settings.loanInterest),
    note: String(note || "").trim(),
    active: true,
    createdBy: currentUser()?.id || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.groups.push(group);
  syncGroupStaffIds(group);
  return group;
}

function updateSusuLocationFromForm(group, data) {
  if (!group) return null;
  const name = String(data.locationName || data.name || group.name || "").trim();
  if (!name) return null;
  const duplicate = state.groups.find((item) => item.id !== group.id && item.name.toLowerCase() === name.toLowerCase());
  if (duplicate) return null;
  const hasMembers = state.customers.some((customer) => customer.groupId === group.id);
  const nextCollectorCode = String(data.newCollectorCode || data.collectorCode || group.collectorCode || "").trim();
  Object.assign(group, {
    name,
    intervalDays: Number(data.intervalDays) || group.intervalDays || 1,
    targetContributions: Number(data.targetContributions) || group.targetContributions || 31,
    defaultAmount: Number(data.defaultAmount ?? group.defaultAmount ?? 0),
    interest: Number(data.interest ?? group.interest ?? state.settings.loanInterest),
    note: String(data.locationNote || data.note || group.note || "").trim(),
    collectorCode: hasMembers && group.collectorCode ? group.collectorCode : normalizeCollectorCode(nextCollectorCode),
    updatedAt: new Date().toISOString()
  });
  syncGroupStaffIds(group);
  return group;
}

function renderCollectorCodeField(group, { required = true, readonly = false, name = "collectorCode" } = {}) {
  const value = group?.collectorCode || "";
  const locked = readonly || Boolean(group && state.customers.some((customer) => customer.groupId === group.id && group.collectorCode));
  if (locked) {
    return `
      <div class="field full"><label>Collector Code</label><input readonly value="${escapeAttr(value)}" /><input type="hidden" name="${name}" value="${escapeAttr(value)}" /><div class="muted">Member accounts use this prefix (e.g. ${escapeHtml(value)}000001). Code is locked after members are registered.</div></div>
    `;
  }
  return `
    <div class="field full"><label>Collector Code</label><input name="${name}" value="${escapeAttr(value)}" ${required ? "required" : ""} placeholder="e.g. c13" /><div class="muted">Member account numbers will follow this code (e.g. c13000001, c13000002).</div></div>
  `;
}

function renderCollectorCycleFields(group = null) {
  const intervalDays = group?.intervalDays ?? 1;
  const targetContributions = group?.targetContributions ?? 31;
  const defaultAmount = group?.defaultAmount ?? 0;
  return `
    <div id="susuGroupCycleFields" class="collector-cycle-fields">
      <div class="section-title full"><h3>Collection Cycle</h3><p class="muted">Only required for susu group collection.</p></div>
      <div class="field"><label>Collect every (days)</label><input name="intervalDays" type="number" min="1" value="${intervalDays}" required /></div>
      <div class="field susu-only-cycle-field"><label>Number of collection days</label><input name="targetContributions" type="number" min="1" value="${targetContributions}" /></div>
      <div class="field susu-only-cycle-field"><label>Default contribution amount</label><input name="defaultAmount" type="number" min="0" step="0.01" value="${defaultAmount}" /></div>
    </div>
  `;
}

function renderCollectorCapabilitiesFields(editing = null) {
  const caps = editing?.collectionCapabilities || {};
  return `
    <div class="section-title full"><h3>Collection Types</h3></div>
    <div class="field"><label><input type="checkbox" name="susuGroupCollection" data-collector-capability ${caps.susuGroupCollection !== false ? "checked" : ""} /> Susu group collection</label></div>
    <div class="field"><label><input type="checkbox" name="personalSavingsCollection" data-collector-capability ${caps.personalSavingsCollection !== false ? "checked" : ""} /> Personal savings collection</label></div>
  `;
}

function setContainerFieldsActive(container, active) {
  if (!container) return;
  container.querySelectorAll("input, select, textarea").forEach((input) => {
    if (input.type === "hidden") return;
    if (input.type === "radio" || input.type === "checkbox") {
      input.disabled = !active;
      return;
    }
    input.required = active;
    input.disabled = !active;
  });
}

function syncCollectorCollectionFields() {
  const susuChecked = document.querySelector('input[name="susuGroupCollection"]')?.checked !== false;
  const host = document.querySelector("#susuGroupCycleFields");
  if (!host) return;
  host.style.display = susuChecked ? "" : "none";
  host.querySelectorAll(".susu-only-cycle-field input").forEach((input) => {
    input.required = susuChecked;
    if (!susuChecked) {
      if (input.name === "targetContributions") input.value = "31";
      if (input.name === "defaultAmount") input.value = "0";
    }
  });
  const intervalInput = host.querySelector('input[name="intervalDays"]');
  if (intervalInput) intervalInput.required = susuChecked;
}

function renderCollectorLocationFields(editing) {
  const group = editing ? groupById(editing.groupId) : null;
  if (editing) {
    return `
      <div class="section-title full"><h3>Branch / Location</h3></div>
      ${renderCollectorCodeField(group)}
      <div class="field full"><label>Location Name</label><input name="locationName" value="${escapeAttr(group?.name || editing.requestedGroupName || "")}" required /></div>
      <div class="field full"><label>Location Note</label><textarea name="locationNote">${escapeHtml(group?.note || "")}</textarea></div>
      ${renderCollectorCapabilitiesFields(editing)}
      ${renderCollectorCycleFields(group)}
      <div class="field full"><label>Reassign Collector To</label>${groupSelect("collectorGroupId", editing.groupId || "", true)}</div>
    `;
  }
  return `
    <div class="section-title full"><h3>Branch / Location</h3></div>
    ${renderCollectorCapabilitiesFields(null)}
    <div class="field full location-mode">
      <label class="inline-choice"><input type="radio" name="locationMode" value="new" checked data-location-mode /> Create new location</label>
      <label class="inline-choice"><input type="radio" name="locationMode" value="existing" data-location-mode /> Use existing location</label>
    </div>
    <div id="newLocationFields">
      ${renderCollectorCodeField(null, { name: "newCollectorCode" })}
      <div class="field full"><label>Location Name</label><input name="locationName" required /></div>
      <div class="field full"><label>Location Note</label><textarea name="locationNote"></textarea></div>
      ${renderCollectorCycleFields(null)}
    </div>
    <div id="existingLocationFields" style="display:none">
      <div class="field full"><label>Existing Location</label>${groupSelect("collectorGroupId", "", false)}</div>
      <div id="existingCollectorCodeField"></div>
    </div>
  `;
}

function ensureGroupForAdmin(user) {
  if (!user || user.role !== "Admin") return null;
  if (user.groupId) {
    const assigned = groupById(user.groupId);
    if (assigned) {
      assigned.adminId = user.id;
      assigned.active = true;
      assigned.updatedAt = new Date().toISOString();
      return assigned;
    }
  }
  const requestedName = String(user.requestedGroupName || "").trim();
  let group = state.groups.find((item) => item.adminId === user.id);
  if (!group && requestedName) {
    group = state.groups.find((item) => item.name.toLowerCase() === requestedName.toLowerCase());
  }
  if (group) {
    group.adminId = user.id;
    group.active = true;
    user.groupId = group.id;
    group.updatedAt = new Date().toISOString();
    return group;
  }
  if (!requestedName) return null;
  group = {
    id: uid("grp"),
    name: requestedName,
    adminId: user.id,
    intervalDays: 1,
    targetContributions: 31,
    defaultAmount: 0,
    interest: state.settings.loanInterest,
    note: "Created automatically from admin account request",
    active: true,
    createdBy: currentUser()?.id || user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  user.groupId = group.id;
  state.groups.push(group);
  return group;
}

function tombstoneRecord(collection, recordOrId) {
  const recordId = typeof recordOrId === "string" ? recordOrId : recordOrId?.id;
  if (!recordId) return;
  state.deletedRecords = state.deletedRecords || [];
  if (state.deletedRecords.some((item) => item.collection === collection && item.recordId === recordId)) return;
  const timestamp = new Date().toISOString();
  state.deletedRecords.push({
    id: uid("deleted-record"),
    collection,
    recordId,
    deletedBy: currentUser()?.id || "",
    deletedAt: timestamp,
    createdAt: timestamp
  });
}

function tombstoneRecords(collection, rows) {
  rows.forEach((row) => tombstoneRecord(collection, row));
}

function deleteGroup(groupId) {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group || !isKBA()) return;
  const hasMembers = state.customers.some((customer) => customer.groupId === groupId);
  const hasLoans = state.loans.some((loan) => loan.groupId === groupId);
  const hasCollections = state.collections.some((item) => item.groupId === groupId);
  if (hasMembers || hasLoans || hasCollections) {
    toast("Location has records. Close it instead of deleting.");
    return;
  }
  if (!confirm(`Delete location "${group.name}"?`)) return;
  tombstoneRecord("groups", group);
  state.groups = state.groups.filter((item) => item.id !== groupId);
  sessionStorage.removeItem("edit_group_id");
  saveState();
  pushCloudBackup(false);
  logAudit("Susu location deleted", group.name);
  render();
}

function deleteUser(userId) {
  const actor = currentUser();
  const user = getUserForActor(state.users, userId, actor);
  if (!user || !canDeleteUserAccount(actor, user)) {
    toast("This account cannot be deleted");
    return;
  }
  const ownsGroup = state.groups.some((group) => group.adminId === userId);
  const hasTransactions = state.transactions.some((tx) => tx.userId === userId);
  if (ownsGroup || hasTransactions) {
    toast("Admin has location or money records. Disable instead of deleting.");
    return;
  }
  if (!confirm(`Delete admin "${user.name}"?`)) return;
  state.deletedUsers = state.deletedUsers || [];
  state.deletedUsers.push({
    id: uid("deleted-user"),
    userId: user.id,
    username: user.username,
    name: user.name,
    deletedBy: currentUser()?.id || "",
    deletedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });
  state.users = state.users.filter((item) => item.id !== userId);
  sessionStorage.removeItem("edit_user_id");
  saveState();
  pushCloudBackup(false);
  logAudit("Admin deleted", user.username);
  render();
}

function deleteCustomer(customerId) {
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return;
  const canReach = visibleGroupIds().includes(customer.groupId)
    || canHardDeleteCustomers(currentUser())
    || visibleCustomers().some((item) => item.id === customerId);
  if (!canManageMembers() || !canReach) {
    toast("You cannot delete this member");
    return;
  }
  const hasHistory = customerHasFinancialHistory(state, customerId);
  if (!canHardDeleteCustomers(currentUser()) || hasHistory) {
    const question = hasHistory && canHardDeleteCustomers(currentUser())
      ? `Member "${customer.name}" has financial history, so it cannot be deleted. Close the member instead?`
      : `Close member "${customer.name}" and retain history?`;
    if (!confirm(question)) return;
    const result = setCustomerStatus(customer, "Closed", currentUser(), uid);
    if (result.error) {
      toast(result.error);
      return;
    }
    saveState();
    pushCloudBackup(false);
    logAudit("Member closed", customer.name);
    toast("Member closed - history retained");
    render();
    return;
  }
  if (!confirm(`Permanently delete member "${customer.name}"? This member has no financial records.`)) return;
  const linkedMessages = state.messages.filter((item) => item.customerId === customerId);
  tombstoneRecord("customers", customer);
  tombstoneRecords("messages", linkedMessages);
  state.customers = state.customers.filter((item) => item.id !== customerId);
  state.messages = state.messages.filter((item) => item.customerId !== customerId);
  sessionStorage.removeItem("edit_customer_id");
  saveState();
  pushCloudBackup(false);
  logAudit("Member deleted", customer.name);
  render();
}

function deleteCollection(collectionId) {
  requestCollectionReversal(collectionId);
}

function requestCollectionReversal(collectionId) {
  const collection = state.collections.find((item) => item.id === collectionId);
  if (!collection || !visibleGroupIds().includes(collection.groupId)) return;
  if (collection.reversed) {
    toast("This collection has already been reversed");
    return;
  }
  if (!canRequestCollectionReversal()) {
    toast("Only Manager or Assistant Manager can request a reversal");
    return;
  }
  const reason = prompt("Enter reason for reversing this collection:");
  if (!reason || !String(reason).trim()) {
    toast("A reason is required for reversals");
    return;
  }
  const customer = state.customers.find((item) => item.id === collection.customerId);
  const reversal = createReversalRequest(state, {
    id: uid("rev"),
    originalCollection: collection,
    reason: String(reason).trim(),
    requestedBy: currentUser().id,
    customerId: collection.customerId,
    groupId: collection.groupId,
    collectorId: collection.collectorId || collection.userId
  });
  recordException(state, {
    id: uid("ex"),
    type: "reversal_requested",
    severity: "warn",
    referenceId: reversal.id,
    referenceType: "reversal",
    collectorId: reversal.collectorId,
    reason: reversal.reason
  });
  if (canApproveReversal(currentUser(), reversal, state) && isKBA()) {
    const result = approveReversal(state, reversal.id, currentUser(), uid);
    if (result.ok) {
      saveState();
      pushCloudBackup(false);
      logAudit("Collection reversed", `${customerName(collection.customerId)} · ${collection.receiptNo || collection.paymentNo} · ${reversal.reason}`);
      toast("Collection reversed with audit trail");
      render();
      return;
    }
  }
  saveState();
  pushCloudBackup(false);
  logAudit("Reversal requested", `${customerName(collection.customerId)} · ${collection.receiptNo || collection.paymentNo}`);
  toast("Reversal requested. Manager approval required.");
  render();
}

function deleteLoan(loanId) {
  const loan = state.loans.find((item) => item.id === loanId);
  if (!loan || !canDeleteLoans() || !visibleGroupIds().includes(loan.groupId)) return;
  const disbursement = state.transactions.find((item) => item.ref === loanId && item.type === "Loan Disbursement" && !item.reversed);
  if (disbursement) {
    requestTransactionReversal(disbursement.id);
    return;
  }
  if (!confirm(`Cancel pending loan application for ${customerName(loan.customerId)}?`)) return;
  tombstoneRecord("loans", loan);
  state.loans = state.loans.filter((item) => item.id !== loanId);
  sessionStorage.removeItem("edit_loan_id");
  saveState();
  pushCloudBackup(false);
  logAudit("Loan application cancelled", `${customerName(loan.customerId)} · ${money(loan.principal)}`);
  render();
}

function deleteRepayment(transactionId) {
  requestTransactionReversal(transactionId);
}

function handleGroup(event) {
  event.preventDefault();
  const data = formData(event.target);
  if (isAdmin()) {
    if (!data.id) {
      if (currentUser().role !== "Admin") {
        toast("Only the assigned Admin can create a location");
        return;
      }
      if (primaryGroup()) {
        toast("This admin already has a location");
        return;
      }
      const group = {
        id: uid("grp"),
        name: data.name,
        adminId: currentUser().id,
        intervalDays: Number(data.intervalDays),
        targetContributions: Number(data.targetContributions),
        defaultAmount: Number(data.defaultAmount),
        interest: Number(data.interest),
        note: data.note,
        active: true,
        createdBy: currentUser().id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.groups.push(group);
      syncGroupStaffIds(group);
      saveState();
      logAudit("Admin susu location created", group.name);
      pushCloudBackup(false);
      toast("Location created");
      render();
      return;
    }
    const group = state.groups.find((item) => item.id === data.id && userLinkedToGroup(currentUser(), item));
    if (!group || currentUser().role !== "Admin") {
      toast("This location is not assigned to you");
      return;
    }
    Object.assign(group, {
      intervalDays: Number(data.intervalDays),
      targetContributions: Number(data.targetContributions),
      defaultAmount: Number(data.defaultAmount),
      interest: Number(data.interest),
      note: data.note,
      updatedAt: new Date().toISOString()
    });
    syncGroupStaffIds(group);
  saveState();
  logAudit("Location setup saved", group.name);
  toast("Location setup saved");
    render();
    return;
  }
  if (!isKBA()) {
    toast("Only the owner can create locations");
    return;
  }
  if (!data.id) {
    toast("Create collectors and locations from Users");
    return;
  }
  const group = state.groups.find((item) => item.id === data.id);
  if (!group) return;
  Object.assign(group, {
    name: data.name,
    note: data.note,
    updatedAt: new Date().toISOString()
  });
  syncGroupStaffIds(group);
  sessionStorage.removeItem("edit_group_id");
  saveState();
  logAudit("Susu location edited", data.name);
  toast("Location saved");
  render();
}

function resetMemberRegistrationHardware() {
  try { stopPassportCamera("member"); } catch { /* ignore */ }
  try { stopPassportCamera("staff"); } catch { /* ignore */ }
  try { document.body.classList.remove("member-wizard-open"); } catch { /* ignore */ }
}

function prepareNextMemberRegistration({ keepOpen = false } = {}) {
  resetMemberRegistrationHardware();
  if (keepOpen) {
    openCustomerRegistrationSession(sessionStorage, localStorage);
  } else {
    closeCustomerRegistrationSession(sessionStorage, localStorage);
  }
}

function handleCustomer(event) {
  event.preventDefault();
  const form = event.target;
  syncMemberSignatureFromPad(form);
  const data = formData(form);
  if (!canManageMembers()) {
    toast("You do not have permission to register members");
    return;
  }
  if (!data.groupId || !visibleGroupIds().includes(data.groupId)) {
    toast("This location is not assigned to you");
    return;
  }
  if (!isValidGhanaPhone(data.phone)) {
    toast("Enter a valid Ghana phone number (e.g. 024 123 4567)");
    return;
  }
  const normalizedPhone = normalizeGhanaPhone(data.phone);
  const group = groupById(data.groupId);
  if (isCollector()) {
    const collector = currentUser();
    const accountType = data.accountType || "personal";
    if (!collectorDoesSusuGroup(collector) && accountType !== "personal") {
      toast("You can only register personal savings members");
      return;
    }
    if (!collectorDoesPersonalSavings(collector) && accountType === "personal") {
      toast("You can only register susu group members");
      return;
    }
  }
  // Media compression is async; a second tap on Save must not register the member twice.
  if (form.dataset.submitting === "1") return;
  form.dataset.submitting = "1";
  resolvePassportPhotoFromForm(form).then(async (uploadedPhoto) => {
    try {
      let passportPhoto = uploadedPhoto || data.existingPassportPhoto || "";
      let signatureData = String(data.signatureData || form.querySelector("#memberSignatureData")?.value || "").trim();
      const softError = validateMemberRegistrationPayload({
        ...data,
        phone: normalizedPhone,
        passportPhoto,
        signatureData,
        businessLocation: data.businessLocation || defaultBusinessLocationForCollector({
          editingBusinessLocation: data.businessLocation || "",
          isCollector: isCollector() && !isKBA(),
          groupName: groupName(data.groupId),
          branchName: group?.name || ""
        })
      }, { isCreate: !data.id });
      if (softError) {
        toast(softError);
        return;
      }
      let idFrontImage = await readOptionalCustomerFile(form.querySelector('[name="idFrontFile"]')?.files?.[0]);
      let idBackImage = await readOptionalCustomerFile(form.querySelector('[name="idBackFile"]')?.files?.[0]);
      const compressed = await compressMemberMediaBundle({
        passportPhoto,
        signatureData,
        idFrontImage,
        idBackImage
      });
      passportPhoto = compressed.passportPhoto || passportPhoto;
      signatureData = compressed.signatureData || signatureData;
      idFrontImage = compressed.idFrontImage || idFrontImage;
      idBackImage = compressed.idBackImage || idBackImage;
      const homeAddress = String(data.homeAddress || "").trim();
      const businessLocation = String(data.businessLocation || "").trim() || defaultBusinessLocationForCollector({
        isCollector: isCollector() && !isKBA(),
        groupName: groupName(data.groupId),
        branchName: group?.name || ""
      });
      const payload = {
        name: String(data.name || "").trim(),
        phone: normalizedPhone,
        memberStatus: data.memberStatus || "Active",
        ghanaCard: data.ghanaCard || "",
        gender: data.gender || "",
        maritalStatus: data.maritalStatus || "",
        nationality: data.nationality || "",
        businessType: data.businessType || "",
        homeAddress,
        businessLocation,
        nextOfKin: data.nextOfKin || "",
        nextOfKinRelationship: data.nextOfKinRelationship || "",
        passportPhoto,
        signatureData,
        address: homeAddress,
        groupId: data.groupId,
        savingsProductId: data.savingsProductId || "",
        accountType: data.accountType || "personal",
        dailyAmount: data.accountType === "personal" ? 0 : Number(data.dailyAmount || group?.defaultAmount || 0),
        collectionDays: data.accountType === "personal" ? undefined : Number(data.collectionDays || group?.targetContributions || state.settings.collectionDays || 31),
        nhis: 0,
        updatedAt: new Date().toISOString()
      };
      const beneficiaries = [];
      applyCustomerKyc(payload, {
        ...data,
        signatureData,
        nationalId: data.idNumber || data.ghanaCard,
        customerNumber: data.customerNumber || nextCustomerNumber(state.customers),
        beneficiaries,
        phoneAlt: ""
      });
      applyCustomerCrm(payload, {
        ...data,
        beneficiaries,
        whatsapp: normalizedPhone,
        phoneSecondary: "",
        idFrontImage: idFrontImage || data.idFrontImage,
        idBackImage: idBackImage || data.idBackImage
      });
      ensureCustomerNumber(payload, state.customers);
      payload.beneficiaries = beneficiaries;
      payload.signatureData = signatureData;
      payload.whatsapp = normalizedPhone;
      payload.phoneSecondary = "";
      payload.phoneAlt = "";
      const duplicates = findDuplicateCustomers(state.customers, { ...payload, accountNo: data.accountNo || payload.accountNo }, data.id);
      if (duplicates.length && !confirm(`Possible duplicate of ${duplicates[0].name} (${duplicates[0].phone || duplicates[0].accountNo}). Continue anyway?`)) {
        toast("Registration cancelled — possible duplicate");
        return;
      }
      if (data.id) {
        const customer = state.customers.find((item) => item.id === data.id && visibleGroupIds().includes(item.groupId));
        if (!customer) {
          toast("Member not found or not assigned to you");
          return;
        }
        const previousStatus = customer.memberStatus || (customer.active === false ? "Closed" : "Active");
        if (!canChangeCustomerStatus(currentUser())) payload.memberStatus = previousStatus;
        applyCustomerCrm(payload, {
          ...data,
          notes: customer.notes,
          statusHistory: customer.statusHistory,
          activityLog: customer.activityLog,
          beneficiaries: customer.beneficiaries || [],
          whatsapp: normalizedPhone || customer.whatsapp,
          phoneSecondary: "",
          idFrontImage: idFrontImage || customer.idFrontImage,
          idBackImage: idBackImage || customer.idBackImage
        });
        Object.assign(customer, payload);
        if (payload.memberStatus && payload.memberStatus !== previousStatus) {
          setCustomerStatus(customer, payload.memberStatus, currentUser(), uid);
        }
        if (customer.savingsProductId) ensureSavingsAccount(state, customer, customer.savingsProductId, uid);
        appendCustomerActivity(customer, { action: "Profile updated", detail: customer.name, userId: currentUser()?.id || "", uid });
        prepareNextMemberRegistration({ keepOpen: false });
        saveState({ keepCustomerId: customer.id });
        logAudit("Member edited", data.name);
        toast("Member saved");
        render();
        queueMicrotask(() => document.querySelector(".members-list-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
        return;
      }
      const accountNo = String(data.accountNo || "").trim() || nextAccountNo(data.groupId);
      if (!isValidAccountNo(accountNo, data.groupId)) {
        const code = collectorCodeForGroup(data.groupId);
        toast(code ? `Account number must start with ${code} followed by digits (e.g. ${code}000001)` : "Account number must look like c13000001");
        return;
      }
      if (state.customers.some((item) => String(item.accountNo || "").toLowerCase() === accountNo.toLowerCase())) {
        toast("That account number is already in use");
        return;
      }
      const online = typeof navigator === "undefined" || navigator.onLine !== false;
      const gate = canPerformOffline(state, "customer.create", { online });
      if (!gate.ok) {
        toast(gate.error || "Cannot register member right now");
        return;
      }
      const collectorId = resolveCollectorForRegistration(currentUser(), group, state.users);
      if (!collectorId) {
        toast("This location has no assigned collector. Create a collector for this branch first.");
        return;
      }
      const collectorCode = collectorCodeForGroup(data.groupId);
      if (!collectorCode) {
        toast("This location has no collector code yet. Set one on Staff & Collectors first.");
        return;
      }
      const created = {
        id: uid("cust"),
        accountNo,
        collectorId,
        createdAt: new Date().toISOString(),
        ...payload
      };
      applyCustomerCrm(created, { ...data, whatsapp: normalizedPhone, phoneSecondary: "", beneficiaries: [] });
      created.signatureData = signatureData;
      created.whatsapp = normalizedPhone;
      created.phoneSecondary = "";
      created.phoneAlt = "";
      created.beneficiaries = [];
      ensureDefaultPortalCredentials(created);
      appendCustomerActivity(created, { action: "Customer Registered", detail: created.name, userId: currentUser()?.id || "", uid });
      if (created.savingsProductId) ensureSavingsAccount(state, created, created.savingsProductId, uid);
      state.customers.push(created);
      // Always return to the member list after save so Customers stays usable for N registrations.
      prepareNextMemberRegistration({ keepOpen: false });
      if (!navigator.onLine) {
        enqueueSyncItem(state, {
          kind: "customer",
          idempotencyKey: `customer:${created.id}`,
          payload: { id: created.id, phone: created.phone || "" },
          deviceId: (state.devices || []).find((item) => item.fingerprint === deviceFingerprint())?.id || deviceFingerprint(),
          agentId: currentUser()?.id || ""
        }, uid);
      }
      let smsToast = "";
      try {
        const smsResult = enqueueCustomerRegistrationSms(state, created, {
          uid,
          runtime: typeof window !== "undefined" ? window : {}
        });
        smsToast = smsResult?.toast ? ` ${smsResult.toast}` : "";
        if (smsResult?.status === "error" || smsResult?.status === "invalid_phone") {
          // non-blocking warning only
        }
      } catch {
        smsToast = " SMS warning: could not queue message";
      }
      try {
        const approx = JSON.stringify(state).length;
        if (approx > 2_800_000) reclaimCustomerMediaSpace(state, { keepCustomerId: created.id });
      } catch { /* ignore */ }
      saveState({ keepCustomerId: created.id });
      logAudit("Member registered", `${data.name} · ${groupName(data.groupId)}`);
      const pinHint = created.portalPin || portalPinFromPhone(created.phone);
      toast((navigator.onLine ? "Member registered" : "Member saved offline - will sync when online")
        + ` · Login: ${created.accountNo} / PIN ${pinHint}`
        + (isMobileLayout() ? " · Tap + to register another" : "")
        + smsToast);
      render();
      queueMicrotask(() => {
        document.querySelector(".members-list-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      toast(error?.message || "Could not register member");
    }
  }).catch((error) => {
    toast(error?.message || "Could not save passport picture");
  }).finally(() => {
    delete form.dataset.submitting;
  });
}

function handleCollection(event) {
  event.preventDefault();
  const data = formData(event.target);
  const guard = blockFinancialWriteIfUnsafe(state, getAppConfig());
  if (!guard.ok) {
    toast(guard.error);
    return;
  }
  const device = (state.devices || []).find((item) => item.fingerprint === deviceFingerprint());
  const healthGate = canCollectWithDeviceHealth(state, { deviceId: device?.id || deviceFingerprint() });
  if (!healthGate.ok) {
    toast(healthGate.error);
    return;
  }
  if (!canManageCollections()) {
    toast("Only assigned staff can record collections");
    return;
  }
  if (data.id) {
    toast("Collections cannot be edited. Request a reversal from the Manager.");
    return;
  }
  const amount = Number(data.amount);
  const customer = state.customers.find((item) => item.id === data.customerId);
  if (!customer || !canAccessCustomer(customer, currentUser(), { groupIds: visibleGroupIds() })) {
    toast("This customer is not assigned to you");
    return;
  }
  const paymentMethod = data.paymentMethod || "Cash";
  const paymentReference = String(data.paymentReference || "").trim();
  if (paymentMethod !== "Cash" && !paymentReference) {
    toast("Payment reference is required for electronic payments");
    return;
  }
  const payCheck = validatePaymentRequest(state, {
    paymentType: "savings_deposit",
    paymentMethod,
    paymentReference,
    amount,
    customerId: data.customerId,
    businessId: data.id || ""
  });
  if (!payCheck.ok) {
    toast(payCheck.error);
    return;
  }
  const momoCheck = verifyMomoPaymentLocally(state, { paymentMethod, paymentReference });
  if (!momoCheck.ok) {
    toast(momoCheck.error);
    return;
  }
  const verificationStatus = resolveVerificationStatus(paymentMethod, paymentReference, "");
  if (verificationStatus === "Duplicate Reference") {
    toast("This payment reference has already been used");
    return;
  }
  const idempotencyKey = buildIdempotencyKey({
    deviceId: deviceFingerprint(),
    clientId: data.clientId || "",
    timestamp: data.clientTimestamp || new Date().toISOString()
  });
  if (isDuplicateIdempotencyKey(state, idempotencyKey)) {
    recordDuplicateHit(state, {
      idempotencyKey,
      source: "mobile-app",
      resolution: "Original Returned",
      originalTransactionId: (state.collections || []).find((item) => item.idempotencyKey === idempotencyKey)?.id || ""
    });
    toast("This collection was already recorded on this device");
    return;
  }
  const idemGate = beginIdempotentRequest(state, {
    idempotencyKey,
    operationType: "savings.collection",
    fingerprint: {
      operationType: "savings.collection",
      customerId: data.customerId,
      amount,
      date: data.date,
      paymentMethod,
      branchId: customer.branchId || customer.groupId || ""
    },
    source: "mobile-app",
    userId: currentUser()?.id || "",
    clientId: data.clientId || deviceFingerprint(),
    correlationId: data.clientId || idempotencyKey,
    requestId: data.requestId || idempotencyKey
  }, uid);
  if (idemGate.duplicate) {
    toast("This collection was already recorded on this device");
    return;
  }
  if (idemGate.processing) {
    toast("This collection is already being recorded");
    return;
  }
  if (idemGate.conflict) {
    toast("Idempotency key conflict");
    return;
  }
  if (!idemGate.proceed) {
    toast(idemGate.error || "Collection could not be recorded");
    return;
  }
  const status = collectionStatusForAmount(customer, amount);
  const visitOutcome = data.visitOutcome || "Paid";
  if (state.collections.some((item) => item.customerId === data.customerId && item.date === data.date && Number(item.amount || 0) > 0)) {
    queueNotification(state, {
      event: "duplicate_attempt",
      channel: "In-App",
      customerId: customer.id,
      userId: currentUser()?.id || "",
      vars: { name: customer.name, date: data.date },
      uid
    });
    if (!collectionWriteOptions.skipDuplicateConfirm && !confirm(`${customer.name} already has a contribution on ${data.date}. Save another one?`)) return;
  }
  const group = groupById(customer.groupId);
  const susuGroupId = data.susuGroupId || "";
  const savingsProductId = susuGroupId ? "" : (customer.savingsProductId || data.savingsProductId || "");
  const collectionType = susuGroupId ? COLLECTION_TYPES.SUSU_GROUP : COLLECTION_TYPES.PERSONAL;
  const resolvedSittingsPaid = shouldCountSittings(customer, collectionType, susuGroupId)
    ? (calculateSittingsPaid(customer, amount) || (amount > 0 ? 1 : 0))
    : 0;
  const contributionNo = shouldCountSittings(customer, collectionType, susuGroupId) ? nextContributionNo(data.customerId) : 0;
  if (collectionType === COLLECTION_TYPES.PERSONAL && !collectorCanCollectType(currentUser(), "personal")) {
    toast("You are not assigned to collect personal savings");
    return;
  }
  if (collectionType === COLLECTION_TYPES.SUSU_GROUP && !collectorCanCollectType(currentUser(), "susu_group")) {
    toast("You are not assigned to collect susu group contributions");
    return;
  }
  const product = productById(state.savingsProducts, savingsProductId);
  if (!agentCanCollectProduct(currentUser(), product || {}, {
    isGroup: collectionType === COLLECTION_TYPES.SUSU_GROUP
  })) {
    toast("You are not permitted to collect this savings product");
    return;
  }
  const branch = (state.branches || []).find((item) => item.id === customer.branchId || item.locationGroupId === customer.groupId) || group;
  const draftError = validateCollectionDraft({
    customer,
    agent: currentUser(),
    branch,
    product,
    amount,
    date: data.date,
    today: today()
  });
  if (draftError) {
    toast(draftError);
    return;
  }
  if (susuGroupId) {
    const susuGroup = visibleSusuGroups().find((item) => item.id === susuGroupId);
    if (!susuGroup) {
      toast("Selected susu group is not assigned to you");
      return;
    }
    if (!activeMemberships(susuGroup).some((item) => item.customerId === customer.id)) {
      toast("Customer is not an active member of this susu group");
      return;
    }
  }
  const receiptNo = buildReceiptNo(state, group?.collectorCode || collectorCodeForGroup(customer.groupId));
  const paymentNo = receiptNo;
  const collection = {
    id: uid("col"),
    paymentNo,
    receiptNo,
    idempotencyKey,
    customerId: data.customerId,
    groupId: customer.groupId,
    susuGroupId,
    savingsProductId,
    collectionType,
    contributionNo,
    sittingsPaid: resolvedSittingsPaid,
    amount,
    amountPesewas: toPesewas(amount),
    date: data.date,
    status,
    paymentMethod,
    paymentReference,
    verificationStatus,
    visitOutcome,
    note: data.note,
    gpsLat: data.gpsLat || "",
    gpsLng: data.gpsLng || "",
    userId: currentUser().id,
    collectorId: customer.collectorId || currentUser().id,
    accountNo: customer.accountNo || "",
    reversed: false,
    deviceFingerprint: deviceFingerprint(),
    deviceId: deviceFingerprint(),
    branchId: customer.branchId || "",
    customerConfirmed: data.customerConfirmed === "on" || data.customerConfirmed === true,
    signature: String(data.signature || "").trim(),
    syncStatus: navigator.onLine ? "Synced" : "Pending",
    offline: !navigator.onLine,
    temporaryReceiptNo: navigator.onLine ? "" : receiptNo,
    createdAt: new Date().toISOString(),
    serverCreatedAt: new Date().toISOString()
  };
  const classASnap = beginClassASnapshot();
  const collectionAudit = (action, details) => {
    try {
      return logAudit(action, details, {
        skipSave: true,
        required: true,
        transactionId: collection.id,
        correlationId: collection.id,
        entityType: "collection",
        entityId: collection.id,
        entityName: customer.name,
        module: "6",
        guarantee: "G1",
        deliveryClass: "A"
      });
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };
  if (!navigator.onLine) {
    state.collections.push(collection);
    if (amount > 0) {
      postDoubleEntry(state, {
        id: uid("led"),
        entryType: "Susu Deposit",
        customerId: data.customerId,
        groupId: customer.groupId,
        collectorId: collection.collectorId,
        amount,
        direction: "credit",
        referenceId: collection.id,
        referenceType: "collection",
        receiptNo,
        paymentMethod,
        paymentReference,
        createdBy: currentUser().id,
        clientCreatedAt: collection.createdAt
      }, uid);
    }
    const audit = collectionAudit("Collection recorded offline", `${customer.name} · ${receiptNo}`);
    if (!audit.ok && !audit.duplicate) {
      rollbackClassASnapshot(classASnap);
      failIdempotentRequest(state, idempotencyKey, { recoverable: true, error: "Audit persist failed" });
      toast("Collection could not be recorded. Audit is required.");
      return;
    }
    completeIdempotentRequest(state, idempotencyKey, {
      transactionId: collection.id,
      receiptNumber: receiptNo,
      responsePayload: { id: collection.id, receiptNo }
    });
    void enqueueOfflineCollection(collection, idempotencyKey);
    saveState();
    afterCollectionSaved(collection, customer);
    rememberCollectionSuccess(collection, customer);
    if (!collectionWriteOptions.silent) {
      toast(`Saved offline. Receipt ${receiptNo} will sync when online.`);
      render();
    }
    return;
  }
  state.collections.push(collection);
  if (amount > 0) {
    postDoubleEntry(state, {
      id: uid("led"),
      entryType: "Susu Deposit",
      customerId: data.customerId,
      groupId: customer.groupId,
      collectorId: collection.collectorId,
      amount,
      direction: "credit",
      referenceId: collection.id,
      referenceType: "collection",
      receiptNo,
      paymentMethod,
      paymentReference,
      createdBy: currentUser().id,
      clientCreatedAt: collection.createdAt
    }, uid);
    const audit = collectionAudit("Collection recorded", `${customer.name} · ${customer.accountNo} · ${money(amount)} · ${paymentMethod} · ${receiptNo}`);
    if (!audit.ok && !audit.duplicate) {
      rollbackClassASnapshot(classASnap);
      failIdempotentRequest(state, idempotencyKey, { recoverable: true, error: "Audit persist failed" });
      toast("Collection could not be recorded. Audit is required.");
      return;
    }
    completeIdempotentRequest(state, idempotencyKey, {
      transactionId: collection.id,
      receiptNumber: receiptNo,
      responsePayload: { id: collection.id, receiptNo }
    });
    const smsResult = deliverCustomerMessage(buildPaymentMessage(data.customerId, amount, data.date, collection.id));
    saveState();
    void pushCollectionToRelational(state, collection);
    const smsNote = transactionMessageNotice(smsResult);
    const verifyNote = verificationStatus === "Pending Verification" ? " Payment is pending verification." : "";
    rememberCollectionSuccess(collection, customer);
    afterCollectionSaved(collection, customer);
    queueNotification(state, {
      event: "contribution_received",
      channel: "SMS",
      customerId: customer.id,
      vars: {
        name: customer.name,
        amount: Number(amount).toFixed(2),
        receiptNo,
        balance: customerBalance(customer.id).toFixed(2)
      },
      uid,
      idempotencyKey: `${collection.id}:contribution_received:SMS`
    });
    if (!collectionWriteOptions.silent) {
      toast(smsResult === "invalid_phone"
        ? `Collection recorded. Receipt ${receiptNo}.${verifyNote} Correct ${customer.name}'s phone number to send SMS.`
        : `Collection recorded. Receipt ${receiptNo}.${verifyNote}${smsNote}`);
      render();
    }
    return;
  }
  const zeroAudit = collectionAudit("Collection recorded", `${customer.name} · ${money(amount)} · ${receiptNo}`);
  if (!zeroAudit.ok && !zeroAudit.duplicate) {
    rollbackClassASnapshot(classASnap);
    failIdempotentRequest(state, idempotencyKey, { recoverable: true, error: "Audit persist failed" });
    toast("Collection could not be recorded. Audit is required.");
    return;
  }
  completeIdempotentRequest(state, idempotencyKey, {
    transactionId: collection.id,
    receiptNumber: receiptNo,
    responsePayload: { id: collection.id, receiptNo }
  });
  saveState();
  afterCollectionSaved(collection, customer);
  rememberCollectionSuccess(collection, customer);
  if (!collectionWriteOptions.silent) {
    toast(`Collection recorded. Receipt ${receiptNo}.`);
    render();
  }
}

function verifyPayment(collectionId) {
  if (!canVerifyPayments()) {
    toast("Only Manager or Assistant Manager can verify payments");
    return;
  }
  const collection = state.collections.find((item) => item.id === collectionId);
  if (!collection || !visibleGroupIds().includes(collection.groupId)) return;
  if (collectionVerificationStatus(collection) === "Verified") {
    toast("Payment is already verified");
    return;
  }
  collection.verificationStatus = "Verified";
  collection.verifiedAt = new Date().toISOString();
  collection.verifiedBy = currentUser().id;
  saveState();
  logAudit("Payment verified", `${customerName(collection.customerId)} · ${money(collection.amount)} · ${collection.paymentNo || collection.id}`);
  toast("Payment verified");
  render();
}

function handleWithdrawal(event) {
  event.preventDefault();
  const data = formData(event.target);
  if (!canManageWithdrawals()) {
    toast("Only assigned staff can record withdrawals");
    return;
  }
  const customer = state.customers.find((item) => item.id === data.customerId);
  if (!customer || !visibleGroupIds().includes(customer.groupId)) {
    toast("This member is not in your assigned location");
    return;
  }
  const amount = Number(data.amount);
  const withdrawDate = data.date || today();
  if (customer.active === false || ["Suspended", "Closed", "Blacklisted", "Deceased"].includes(customer.memberStatus)) {
    toast("Customer is not active");
    return;
  }
  if (amount > customerBalance(data.customerId)) {
    toast("Withdrawal is more than savings balance");
    return;
  }
  const withdrawRef = uid("wd");
  addTransaction("Withdrawal", data.customerId, amount, withdrawRef, withdrawDate, data.note || "", {
    paymentMethod: data.paymentMethod || "Cash",
    paymentReference: data.paymentReference || "",
    paymentNo: withdrawRef
  });
  const smsResult = deliverCustomerMessage(buildWithdrawalMessage(data.customerId, amount, withdrawDate, withdrawRef));
  saveState();
  logAudit("Withdrawal recorded", `${customer.name} · ${money(amount)}`);
  toast(`Withdrawal recorded.${transactionMessageNotice(smsResult)}`);
  printWithdrawalFormForCustomer(customer, amount, withdrawDate);
  render();
}

function handleLoan(event) {
  event.preventDefault();
  if (!canManageLoans()) {
    toast("Only assigned staff can submit loan applications");
    return;
  }
  const data = formData(event.target);
  const principal = Number(data.principal);
  const customer = state.customers.find((item) => item.id === data.customerId);
  if (!customer || !visibleGroupIds().includes(customer.groupId)) {
    toast("This member is not in your assigned location");
    return;
  }
  if (!isValidPhone(customer.phone)) {
    toast("Member phone number is wrong. Edit the member and correct the phone number first.");
    activeView = "customers";
    sessionStorage.setItem("edit_customer_id", customer.id);
    render();
    return;
  }
  const group = groupById(customer?.groupId);
  const interest = Number(group?.interest ?? data.interest ?? state.settings.loanInterest);
  const interestMonths = Number(data.interestMonths || 1);
  const loanDate = data.date || today();
  const requestDate = data.requestDate || loanDate;
  const interestSchedule = buildInterestSchedule(loanDate, principal, interest, interestMonths);
  const totalDue = principal + ((principal * interest) / 100) * interestMonths;
  const loanExtras = {
    requestDate,
    guarantorName: data.guarantorName || "",
    guarantorGhanaCard: data.guarantorGhanaCard || "",
    guarantorAccountNo: data.guarantorAccountNo || "",
    guarantorPhone: data.guarantorPhone || "",
    collectorRecommendation: data.collectorRecommendation || "",
    managerRecommendation: data.managerRecommendation || ""
  };
  if (data.id) {
    const loan = state.loans.find((item) => item.id === data.id && visibleGroupIds().includes(item.groupId));
    if (!loan) return;
    if (loan.status === "Active" || loan.status === "Completed") {
      if (!canManageLoans()) return;
    } else if (!loanIsEditable(loan.status)) {
      toast("This loan can no longer be edited");
      return;
    }
    const disbursed = state.transactions.some((item) => item.ref === loan.id && item.type === "Loan Disbursement" && !item.reversed);
    if (disbursed && (Number(loan.principal) !== principal || loan.customerId !== data.customerId || loan.date !== loanDate)) {
      toast("A disbursed loan's member, principal and date are posted. Reverse the disbursement and issue a new loan instead.");
      return;
    }
    const before = { principal: loan.principal, interest: loan.interest, interestMonths: loan.interestMonths, totalDue: loan.totalDue };
    const nextStatus = loan.status === "Active" || loan.status === "Completed"
      ? (loan.amountPaid >= totalDue ? "Completed" : "Active")
      : loan.status;
    Object.assign(loan, {
      customerId: data.customerId,
      groupId: customer?.groupId || "",
      principal,
      interest,
      termDays: interestMonths * 30,
      interestMonths,
      interestSchedule,
      purpose: data.purpose,
      totalDue,
      date: loanDate,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      ...loanExtras
    });
    sessionStorage.removeItem("edit_loan_id");
    saveState();
    logAudit("Loan edited", `${customer.name} - ${JSON.stringify(before)} to principal ${money(principal)}, interest ${interest}%`);
    toast("Loan application saved");
    render();
    return;
  }
  const loan = {
    id: uid("loan"),
    customerId: data.customerId,
    groupId: customer?.groupId || "",
    principal,
    interest,
    termDays: interestMonths * 30,
    interestMonths,
    interestSchedule,
    purpose: data.purpose,
    totalDue,
    amountPaid: 0,
    status: "Pending",
    date: loanDate,
    submittedBy: currentUser().id,
    ...loanExtras
  };
  state.loans.push(loan);
  saveState();
  logAudit("Loan application submitted", `${customer.name} · ${money(principal)} · ${interest}% for ${interestMonths} month(s)`);
  toast("Loan application submitted for approval.");
  printLoanApplicationFormForLoan(loan.id);
  render();
}

function approveLoan(loanId) {
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  const gate = canPerformOffline(state, "loan.approve", { online });
  if (!gate.ok) {
    toast(gate.error);
    return;
  }
  const loan = state.loans.find((item) => item.id === loanId);
  if (!loan || !visibleGroupIds().includes(loan.groupId)) {
    toast("This loan is not in your assigned location");
    return;
  }
  if (!canApproveLoans()) {
    toast("Only an admin or the owner can approve loans");
    return;
  }
  if (!loanCanApproveNow(loan.status)) {
    toast("Only pending applications can be approved");
    return;
  }
  if (!canApproveAmount(currentUser(), loan.principal, configuredApprovalLimits(state))) {
    toast("Amount exceeds your approval limit");
    logAudit("Loan status rejected", `${customerName(loan.customerId)} · ${loan.id} · ${loan.status} → Approved · Amount exceeds your approval limit`);
    return;
  }
  const result = applyLoanTransition(loan, "Approved", { reason: "Approved" });
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast(isKBA() ? "Loan approved by owner. Disburse when cash is ready." : "Loan approved. Disburse when cash is ready.");
  render();
}

function rejectLoan(loanId) {
  const loan = state.loans.find((item) => item.id === loanId);
  if (!loan || !visibleGroupIds().includes(loan.groupId)) {
    toast("This loan is not in your assigned location");
    return;
  }
  if (!canRejectLoans()) {
    toast("You cannot reject this loan");
    return;
  }
  if (!loanCanRejectNow(loan.status)) {
    toast("This loan cannot be rejected");
    return;
  }
  const reason = prompt("Reason for rejecting this loan application:");
  if (reason === null) return;
  const result = applyLoanTransition(loan, "Rejected", { reason: String(reason).trim() });
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast("Loan application rejected.");
  render();
}

function cancelLoan(loanId) {
  const loan = state.loans.find((item) => item.id === loanId);
  if (!loan || !visibleGroupIds().includes(loan.groupId)) {
    toast("This loan is not in your assigned location");
    return;
  }
  if (!canManageLoans() && !canApproveLoans()) {
    toast("You cannot cancel this loan");
    return;
  }
  if (!loanCanBeCancelled(loan.status)) {
    toast("This loan cannot be cancelled");
    return;
  }
  if (state.transactions.some((tx) => tx.ref === loan.id && tx.type === "Loan Disbursement" && !tx.reversed)) {
    toast("Disbursed loans cannot be cancelled");
    return;
  }
  const reason = prompt("Reason for cancelling this loan:");
  if (reason === null) return;
  const result = applyLoanTransition(loan, "Cancelled", { reason: String(reason).trim() });
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast("Loan cancelled. No financial transaction was created.");
  render();
}

function disburseLoan(loanId) {
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  const gate = canPerformOffline(state, "loan.disburse", { online });
  if (!gate.ok) {
    toast(gate.error);
    return;
  }
  const loan = state.loans.find((item) => item.id === loanId);
  if (!loan || !visibleGroupIds().includes(loan.groupId)) {
    toast("This loan is not in your assigned location");
    return;
  }
  if (!canDisburseLoans()) {
    toast("Only an admin or the owner can disburse loans");
    return;
  }
  if (!loanAwaitingDisbursement(loan.status)) {
    toast("Only approved loans can be disbursed");
    return;
  }
  if (state.transactions.some((tx) => tx.ref === loan.id && tx.type === "Loan Disbursement")) {
    toast("This loan has already been disbursed");
    return;
  }
  const result = applyLoanTransition(loan, "Disbursed", { reason: "Disbursed" });
  if (result.error) {
    toast(result.error);
    return;
  }
  loan.date = today();
  loan.interestSchedule = buildInterestSchedule(loan.date, loan.principal, loan.interest, loan.interestMonths || 1);
  addTransaction("Loan Disbursement", loan.customerId, loan.principal, loan.id, loan.date);
  registerBusinessPayment(state, {
    paymentType: "loan_disbursement",
    paymentMethod: "Cash",
    amount: loan.principal,
    customerId: loan.customerId,
    businessType: "loan",
    businessId: loan.id,
    accountingAlreadyPosted: true,
    idempotencyKey: `pay:disburse:${loan.id}`
  }, currentUser(), uid);
  registerBusinessDocument(state, {
    type: "loan_disbursement_receipt",
    amount: loan.principal,
    customerId: loan.customerId,
    customerName: customerName(loan.customerId),
    paymentMethod: "Cash",
    businessType: "loan",
    businessId: loan.id,
    accountingAlreadyPosted: true,
    idempotencyKey: `doc:disburse:${loan.id}`
  }, currentUser(), uid);
  const smsResult = deliverCustomerMessage(buildLoanMessage(loan));
  saveState();
  toast(`Loan disbursed.${transactionMessageNotice(smsResult)}`);
  printLoanAcceptanceFormForLoan(loan.id);
  render();
}

function handleRepayment(event) {
  event.preventDefault();
  const data = formData(event.target);
  const loan = state.loans.find((item) => item.id === data.loanId);
  if (!canManageLoans() || !loan || !visibleGroupIds().includes(loan.groupId)) {
    toast("This loan is not in your assigned location");
    return;
  }
  const amount = Number(data.amount);
  if (data.id) {
    const tx = state.transactions.find((item) => item.id === data.id && item.type === "Loan Repayment");
    const oldLoan = state.loans.find((item) => item.id === tx?.ref);
    if (!tx || !oldLoan || !visibleGroupIds().includes(oldLoan.groupId)) return;
    oldLoan.amountPaid = Math.max(0, Number(oldLoan.amountPaid || 0) - Number(tx.amount || 0));
    loan.amountPaid = Number(loan.amountPaid || 0) + amount;
    oldLoan.status = oldLoan.amountPaid >= oldLoan.totalDue ? "Completed" : "Active";
    loan.status = loan.amountPaid >= loan.totalDue ? "Completed" : "Active";
    Object.assign(tx, {
      customerId: loan.customerId,
      amount,
      ref: loan.id,
      date: data.date,
      note: data.note,
      updatedAt: new Date().toISOString()
    });
    sessionStorage.removeItem("edit_repayment_id");
    saveState();
    logAudit("Loan repayment edited", `${customerName(loan.customerId)} - ${money(amount)}`);
    toast("Repayment saved");
    render();
    return;
  }
  if (!loanAcceptsRepayment(loan.status)) {
    toast("Repayments cannot be recorded for this loan status");
    logAudit("Loan status rejected", `${customerName(loan.customerId)} · ${loan.id} · repayment blocked on ${loan.status}`);
    return;
  }
  const previousPaid = loan.amountPaid;
  const previousStatus = loan.status;
  loan.amountPaid += amount;
  const lifecycle = applyRepaymentLifecycle(loan, {
    userId: currentUser()?.id || "",
    role: currentUser()?.role || "",
    reason: "Repayment"
  });
  if (lifecycle.error) {
    loan.amountPaid = previousPaid;
    loan.status = previousStatus;
    toast(lifecycle.error);
    return;
  }
  if (loan.status !== previousStatus) {
    logAudit(
      "Loan status changed",
      `${customerName(loan.customerId)} · ${loan.id} · ${previousStatus} → ${loan.status}`
    );
  }
  addTransaction("Loan Repayment", loan.customerId, amount, loan.id, data.date);
  registerBusinessPayment(state, {
    paymentType: "loan_repayment",
    paymentMethod: data.paymentMethod || "Cash",
    amount,
    customerId: loan.customerId,
    businessType: "loan",
    businessId: loan.id,
    paymentReference: data.paymentReference || "",
    accountingAlreadyPosted: true,
    idempotencyKey: `pay:repay:${loan.id}:${data.date}:${amount}`
  }, currentUser(), uid);
  registerBusinessDocument(state, {
    type: "loan_repayment_receipt",
    amount,
    customerId: loan.customerId,
    customerName: customerName(loan.customerId),
    paymentMethod: data.paymentMethod || "Cash",
    businessType: "loan_repayment",
    businessId: `${loan.id}:${data.date}:${amount}`,
    accountingAlreadyPosted: true,
    idempotencyKey: `doc:repay:${loan.id}:${data.date}:${amount}`
  }, currentUser(), uid);
  const smsResult = deliverCustomerMessage(buildRepaymentMessage(loan, amount, data.date));
  saveState();
  logAudit("Loan repayment recorded", `${customerName(loan.customerId)} · ${money(amount)}`);
  toast(`Repayment recorded.${transactionMessageNotice(smsResult)}`);
  render();
}

function payInterest(loanId, scheduleIndex) {
  const loan = state.loans.find((item) => item.id === loanId);
  if (!canManageLoans() || !loan || !visibleGroupIds().includes(loan.groupId)) {
    toast("This loan is not in your assigned location");
    return;
  }
  const schedule = ensureLoanInterestSchedule(loan);
  const entry = schedule[scheduleIndex];
  if (!entry) {
    toast("Interest schedule not found");
    return;
  }
  if (entry.status === "Paid") {
    toast("This interest has already been paid");
    return;
  }
  const amount = Number(entry.amount || 0);
  entry.status = "Paid";
  entry.paidAt = today();
  entry.paidBy = currentUser().id;
  loan.amountPaid = Number(loan.amountPaid || 0) + amount;
  applyRepaymentLifecycle(loan, {
    userId: currentUser()?.id || "",
    role: currentUser()?.role || "",
    reason: "Interest payment"
  });
  addTransaction("Interest Payment", loan.customerId, amount, loan.id, entry.paidAt);
  const smsResult = deliverCustomerMessage(buildInterestMessage(loan, amount, entry.paidAt, entry.month || scheduleIndex + 1));
  saveState();
  logAudit("Interest payment recorded", `${customerName(loan.customerId)} - ${money(amount)} - month ${entry.month || scheduleIndex + 1}`);
  toast(`Interest payment recorded.${transactionMessageNotice(smsResult)}`);
  render();
}

function undoInterestPayment(loanId, scheduleIndex) {
  const loan = state.loans.find((item) => item.id === loanId);
  if (!canManageLoans() || !loan || !visibleGroupIds().includes(loan.groupId)) {
    toast("This loan is not in your assigned location");
    return;
  }
  const entry = ensureLoanInterestSchedule(loan)[scheduleIndex];
  if (!entry || entry.status !== "Paid") return;
  const tx = state.transactions.find((item) =>
    item.type === "Interest Payment"
    && item.ref === loan.id
    && item.customerId === loan.customerId
    && Number(item.amount || 0) === Number(entry.amount || 0)
    && item.date === entry.paidAt
    && !item.reversed
  );
  if (!tx) {
    toast("Interest payment transaction not found");
    return;
  }
  requestTransactionReversal(tx.id);
}

async function handleImport(event) {
  event.preventDefault();
  const data = formData(event.target);
  const file = event.target.elements.file.files[0];
  const groupId = data.groupId;
  if (!file || !visibleGroupIds().includes(groupId)) {
    toast("Choose a file and assigned location");
    return;
  }
  const result = document.querySelector("#importResult");
  result.innerHTML = `<div class="empty">Reading ${escapeHtml(file.name)}...</div>`;
  try {
    const imported = await importFileRecords(file, data.kind, groupId);
    saveState();
    logAudit("Records imported", `${file.name}: ${imported.savings} savings, ${imported.loans} loans, ${imported.logs} logs`);
    result.innerHTML = `
      <div class="section-title"><h2>Import Complete</h2></div>
      <div class="grid three">
        <div class="stat"><small>Savings rows</small><strong>${imported.savings}</strong></div>
        <div class="stat"><small>Loan rows</small><strong>${imported.loans}</strong></div>
        <div class="stat"><small>Log rows</small><strong>${imported.logs}</strong></div>
      </div>
      <div class="notice">${escapeHtml(imported.note)}</div>
    `;
  } catch (error) {
    result.innerHTML = `<div class="notice">Import failed: ${escapeHtml(error.message)}</div>`;
  }
}

function handleClosing(event) {
  event.preventDefault();
  if (!canSaveClosing() && !isKBA()) {
    toast("You do not have permission to save daily closing");
    return;
  }
  const data = formData(event.target);
  const groupId = isKBA() ? visibleGroupIds()[0] || "" : primaryGroup()?.id || "";
  const expected = expectedCashForDate(data.date);
  const counted = Number(data.counted || 0);
  let closing = state.closings.find((item) => item.date === data.date && item.groupId === groupId);
  if (closing) {
    Object.assign(closing, {
      expected,
      counted,
      difference: counted - expected,
      closedByName: data.closedByName,
      note: data.note,
      updatedAt: new Date().toISOString()
    });
  } else {
    closing = {
      id: uid("close"),
      date: data.date,
      groupId,
      expected,
      counted,
      difference: counted - expected,
      closedByName: data.closedByName,
      note: data.note,
      userId: currentUser()?.id || "",
      createdAt: new Date().toISOString()
    };
    state.closings.push(closing);
  }
  state.settings.lastBackupAt = new Date().toISOString();
  saveState();
  logAudit("Daily closing saved", `${data.date} - expected ${money(expected)} - counted ${money(counted)}`);
  toast("Daily closing saved");
  render();
}

function handleSettings(event) {
  event.preventDefault();
  const data = formData(event.target);
  const previous = {
    businessName: state.settings.businessName,
    currency: state.settings.currency,
    loanInterest: state.settings.loanInterest
  };
  Object.assign(state.settings, {
    businessName: data.businessName,
    currency: data.currency,
    loanInterest: Number(data.loanInterest),
    cloudMode: data.cloudMode || "auto",
    productionMode: Boolean(data.productionMode),
    relationalSync: Boolean(data.relationalSync),
    postgresSourceOfTruth: Boolean(data.postgresSourceOfTruth),
    supabaseAuthEnabled: Boolean(data.supabaseAuthEnabled),
    momoWebhookSecret: String(data.momoWebhookSecret || "").trim(),
    encryptOfflineQueue: Boolean(data.encryptOfflineQueue),
    assistantCanVerifyHandover: Boolean(data.assistantCanVerifyHandover),
    assistantCanApproveReversals: Boolean(data.assistantCanApproveReversals)
  });
  persistCloudSettings(state, {
    cloudUrl: data.cloudUrl,
    cloudKey: data.cloudKey,
    localBackupUrl: data.localBackupUrl,
    syncToken: data.syncToken,
    businessId: data.businessId
  });
  recordLiveSettingsChange(state, previous, state.settings, currentUser(), uid);
  saveState();
  toast("Settings saved");
  render();
}

async function handleKbaPassword(event) {
  event.preventDefault();
  if (!isKBA()) {
    toast("Only the owner or super administrator can change this password");
    return;
  }
  const data = formData(event.target);
  const account = currentUser();
  if (!account) return;
  if (data.newPassword !== data.confirmPassword) {
    toast("New passwords do not match");
    return;
  }
  if (!(await verifyPassword(data.currentPassword, account.passwordHash))) {
    toast("Current password is incorrect");
    return;
  }
  const invalid = validateForcedPassword(data.newPassword, data.currentPassword, undefined, {
    minLength: getConfigValue(state, "security.passwordMinLength")
  });
  if (invalid) {
    toast(invalid);
    return;
  }
  account.passwordHash = await hashPasswordForUser(data.newPassword);
  account.mustChangePassword = false;
  account.passwordChangedAt = new Date().toISOString();
  account.updatedAt = account.passwordChangedAt;
  delete account.password;
  saveState();
  pushCloudBackup(false);
  logAudit("Password changed", account.username);
  toast("Password updated");
  event.target.reset();
}

function handleOwnershipTransfer(event) {
  event.preventDefault();
  if (!canTransferOwnership(currentUser())) {
    toast("Only the System Owner can transfer ownership");
    return;
  }
  const data = formData(event.target);
  const nextOwner = getUserForActor(state.users, data.userId, currentUser());
  if (!nextOwner || isSystemDeveloperAccount(nextOwner)) {
    toast("Select an account");
    return;
  }
  if (!confirm(`Transfer System Owner privilege to ${nextOwner.name} (@${nextOwner.username})?`)) return;
  const result = transferSystemOwnership(currentUser(), nextOwner);
  if (result.error) {
    toast(result.error);
    return;
  }
  logAudit("System ownership transferred", `${currentUser()?.username} → ${nextOwner.username}`);
  saveState();
  pushCloudBackup(false);
  toast(`Ownership transferred to ${nextOwner.name}`);
  render();
}

async function handlePermissions(event) {
  event.preventDefault();
  if (!canManagePermissions()) {
    toast("Only the Manager can update collector permissions");
    return;
  }
  const data = formData(event.target);
  const user = state.users.find((item) => item.id === data.userId && item.role === "Collector");
  if (!user) {
    toast("Collector not found");
    return;
  }
  const screenPermissions = {};
  COLLECTOR_PERMISSION_SCREENS.forEach(([key]) => {
    screenPermissions[key] = Boolean(data[`perm_${key}`]);
  });
  if (!Object.values(screenPermissions).some(Boolean)) {
    toast("At least one screen must remain allowed");
    return;
  }
  user.screenPermissions = screenPermissions;
  user.updatedAt = new Date().toISOString();
  sessionStorage.setItem("permissions_user_id", user.id);
  saveState();
  pushCloudBackup(false);
  logAudit("Collector permissions updated", `${user.username} · ${Object.entries(screenPermissions).filter(([, allowed]) => !allowed).map(([key]) => key).join(", ") || "all allowed"}`);
  toast(`Permissions saved for ${user.name}`);
  render();
}

function resolveCollectorCodeInput(data, groupId = "", form = null) {
  const group = groupById(groupId);
  const locationMode = data.locationMode || form?.querySelector('input[name="locationMode"]:checked')?.value || "new";
  let code = "";
  if (locationMode === "existing") {
    code = String(data.collectorCode || group?.collectorCode || "").trim();
    if (!code && form) {
      code = String(form.querySelector('#existingCollectorCodeField input[name="collectorCode"]')?.value || "").trim();
    }
  } else {
    code = String(data.newCollectorCode || data.collectorCode || "").trim();
    if (!code && form) {
      code = String(form.querySelector('#newLocationFields input[name="newCollectorCode"]')?.value || "").trim();
    }
  }
  if (!code) {
    code = String(group?.collectorCode || "").trim();
  }
  if (!code) {
    toast("Enter a collector code for member account numbers (e.g. c13)");
    return "";
  }
  if (!isValidCollectorCode(code)) {
    toast("Collector code must start with a letter and use letters or numbers only");
    return "";
  }
  if (collectorCodeInUse(code, groupId)) {
    toast("Another location already uses this collector code");
    return "";
  }
  return normalizeCollectorCode(code);
}

function staffFormGroupId(data, staffRole) {
  if (staffRole === "Collector" || staffRole === "GroupCoordinator" || staffRole === "FieldSupervisor") {
    return String(data.collectorGroupId || data.adminGroupId || "").trim();
  }
  return String(data.adminGroupId || data.collectorGroupId || "").trim();
}

async function handleUser(event) {
  event.preventDefault();
  if (!canManageUsers()) {
    toast("Only the Manager can create or edit staff accounts");
    return;
  }
  const submitButton = event.target.querySelector('button[type="submit"]');
  if (submitButton?.disabled) return;
  const raw = formData(event.target);
  const allowedRoles = new Set(staffRoleOptions().map((item) => item.value));
  const staffRole = allowedRoles.has(raw.role) ? raw.role : "Collector";
  const data = { ...raw, groupId: staffFormGroupId(raw, staffRole) };
  if (!String(data.name || "").trim()) {
    toast("Enter the staff member's name");
    return;
  }
  if (!String(data.username || "").trim()) {
    toast("Enter a username");
    return;
  }
  if (isReservedDeveloperUsername(data.username) && !isSystemDeveloperAccount(currentUser())) {
    toast("That username is reserved");
    return;
  }
  if (!data.id && !String(data.password || "").trim()) {
    toast("Enter a password for the new account");
    return;
  }
  if (!isValidGhanaPhone(data.phone)) {
    toast("Enter a valid Ghana phone number (e.g. 024 123 4567)");
    return;
  }
  const normalizedPhone = normalizeGhanaPhone(data.phone);
  const originalSubmitLabel = submitButton?.textContent || (data.id ? "Save collector & location" : "Create staff account");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = data.id ? "Saving..." : "Creating...";
  }
  try {
  const form = event.target;
  const rawPassportPhoto = await resolvePassportPhotoFromForm(form);
  const passportPhoto = (await compressMemberMediaBundle({ passportPhoto: rawPassportPhoto })).passportPhoto || rawPassportPhoto;
  if (!data.id && !passportPhoto) {
    toast("Passport picture is required for staff accounts");
    return;
  }
  if (data.id) {
    const user = getUserForActor(state.users, data.id, currentUser());
    if (!user || !canEditUserAccount(currentUser(), user)) return;
    if (state.users.some((item) => item.id !== data.id && item.username.toLowerCase() === data.username.toLowerCase())) {
      toast("Username already exists");
      return;
    }
    state.groups.forEach((group) => {
      if (group.collectorId === user.id && staffRole !== "Collector") group.collectorId = "";
    });
    user.name = data.name;
    user.username = data.username;
    user.role = staffRole;
    assignStaffProfileFields(user, {
      phone: normalizedPhone,
      ghanaCard: String(data.ghanaCard || "").trim(),
      passportPhoto
    });
    applyAgentProfile(user, {
      ...data,
      agentCode: data.agentCode || user.agentCode || nextAgentCode(state.users),
      nationalId: data.ghanaCard
    });
    applyAgentOps(user, {
      ...data,
      productPermissions: productPermissionFromForm(data),
      notes: user.notes,
      documents: user.documents,
      activityLog: user.activityLog
    });
    if (data.password) {
      user.passwordHash = await hashPasswordForUser(data.password);
      setStaffLoginPasswordHint(user, data.password);
    }
    if (staffRole === "Collector") {
      let group = groupById(user.groupId);
      if (data.groupId && data.groupId !== user.groupId) {
        state.groups.forEach((item) => {
          if (item.collectorId === user.id) item.collectorId = "";
        });
        group = groupById(data.groupId);
        if (!group) {
          toast("Location not found");
          return;
        }
        if (group.collectorId && group.collectorId !== user.id) {
          toast("This location already has a collector assigned");
          return;
        }
        user.groupId = group.id;
      }
      if (group) {
        const hasMembers = state.customers.some((customer) => customer.groupId === group.id);
        if (!hasMembers || !group.collectorCode) {
          const collectorCode = resolveCollectorCodeInput(data, group.id, form);
          if (!collectorCode) return;
          data.collectorCode = collectorCode;
        }
        const updated = updateSusuLocationFromForm(group, data);
        if (!updated) {
          toast("Another location already uses that name");
          return;
        }
        user.groupId = updated.id;
      } else if (String(data.locationName || "").trim()) {
        const collectorCode = resolveCollectorCodeInput(data, "", form);
        if (!collectorCode) return;
        group = createSusuLocation({
          name: data.locationName,
          intervalDays: data.intervalDays,
          targetContributions: data.targetContributions,
          defaultAmount: data.defaultAmount,
          interest: state.settings.loanInterest,
          note: data.locationNote,
          collectorId: user.id,
          collectorCode
        });
        user.groupId = group?.id || "";
      }
      linkUserToGroupStaff(user);
      updateCollectorCapabilities(user, data.collectionAuthority
        ? capabilitiesFromAuthority(data.collectionAuthority)
        : {
            susuGroupCollection: Boolean(data.susuGroupCollection),
            personalSavingsCollection: Boolean(data.personalSavingsCollection)
          }
      );
    } else {
      state.groups.forEach((group) => {
        if (group.adminId === user.id && group.id !== data.groupId) group.adminId = "";
      });
      user.groupId = data.groupId || "";
      if (user.groupId && user.role === "Admin") {
        const group = groupById(user.groupId);
        if (group) group.adminId = user.id;
      }
      if (user.active && user.role === "Admin") ensureGroupForAdmin(user);
      linkUserToGroupStaff(user);
    }
    user.updatedAt = new Date().toISOString();
    sessionStorage.removeItem("edit_user_id");
    saveState();
    mirrorStaffAccount(user);
    pushCloudBackup(false);
    const roleNames = { Admin: "Branch Manager", Auditor: "Auditor", Collector: "Agent / Collector" };
    logAudit(`${roleNames[staffRole] || agencyRoleLabel(staffRole)} updated`, data.username);
    toast(`${roleNames[staffRole] || agencyRoleLabel(staffRole)} saved`);
    render();
    return;
  }
  if (state.users.some((user) => user.username.toLowerCase() === data.username.toLowerCase())) {
    toast("Username already exists");
    return;
  }
  if (staffRole === "Collector") {
    const useExisting = data.locationMode === "existing";
    if (useExisting && !data.groupId) {
      toast("Choose an existing susu location");
      return;
    }
    if (!useExisting && !String(data.locationName || "").trim()) {
      toast("Enter a susu location name");
      return;
    }
  }
  if ((staffRole === "Admin" || staffRole === "Auditor" || staffRole === "ManagingDirector" || staffRole === "OperationsManager" || staffRole === "Accountant" || staffRole === "Cashier" || staffRole === "CustomerService") && !data.groupId) {
    toast("Choose a branch for this account");
    return;
  }
  state.deletedUsers = (state.deletedUsers || []).filter((item) => String(item.username || "").toLowerCase() !== data.username.toLowerCase());
  const user = {
    id: uid("user"),
    name: data.name,
    username: data.username,
    phone: normalizedPhone,
    ghanaCard: String(data.ghanaCard || "").trim(),
    passportPhoto,
    passwordHash: await hashPasswordForUser(data.password),
    loginPasswordHint: String(data.password || "").trim(),
    role: staffRole,
    groupId: "",
    screenPermissions: staffRole === "Collector" ? defaultCollectorScreenPermissions() : undefined,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  applyAgentProfile(user, {
    ...data,
    agentCode: data.agentCode || nextAgentCode(state.users),
    nationalId: data.ghanaCard
  });
  applyAgentOps(user, { ...data, productPermissions: productPermissionFromForm(data) });
  state.users.push(user);
  if (staffRole === "Collector") {
    let group;
    if (data.locationMode === "existing") {
      group = groupById(data.groupId);
      if (!group) {
        state.users.pop();
        toast("Location not found");
        return;
      }
      if (group.collectorId) {
        state.users.pop();
        toast("This location already has a collector assigned");
        return;
      }
      const collectorCode = group.collectorCode || resolveCollectorCodeInput(data, group.id, form);
      if (!collectorCode) {
        state.users.pop();
        return;
      }
      group.collectorCode = collectorCode;
      group.collectorId = user.id;
      user.groupId = group.id;
      linkUserToGroupStaff(user);
    } else {
      const collectorCode = resolveCollectorCodeInput(data, "", form);
      if (!collectorCode) {
        state.users.pop();
        return;
      }
      group = createSusuLocation({
        name: data.locationName,
        intervalDays: data.intervalDays,
        targetContributions: data.targetContributions,
        defaultAmount: data.defaultAmount,
        interest: state.settings.loanInterest,
        note: data.locationNote,
        collectorId: user.id,
        collectorCode
      });
      if (!group) {
        state.users.pop();
        toast("Could not create susu location");
        return;
      }
      user.groupId = group.id;
      linkUserToGroupStaff(user);
    }
    updateCollectorCapabilities(user, data.collectionAuthority
      ? capabilitiesFromAuthority(data.collectionAuthority)
      : {
          susuGroupCollection: Boolean(data.susuGroupCollection),
          personalSavingsCollection: Boolean(data.personalSavingsCollection)
        }
    );
    saveState();
    mirrorStaffAccount(user);
    pushCloudBackup(false);
    logAudit("Collector and location created", `${data.username} · ${group.name}`);
    toast("Collector and location created");
    render();
    return;
  }
  if (user.role !== "Collector") {
    user.groupId = data.groupId || "";
    if (user.groupId && (user.role === "Admin" || user.role === "ManagingDirector" || user.role === "OperationsManager")) {
      const group = groupById(user.groupId);
      if (group && user.role === "Admin") group.adminId = user.id;
    }
    linkUserToGroupStaff(user);
    saveState();
    mirrorStaffAccount(user);
    pushCloudBackup(false);
    logAudit(`${agencyRoleLabel(staffRole)} created`, data.username);
    toast(`${agencyRoleLabel(staffRole)} account created`);
    render();
    return;
  }
  } catch (error) {
    console.error("Staff save failed:", error);
    toast(error?.message || "Could not save staff account. Try again.");
  } finally {
    if (submitButton && submitButton.isConnected) {
      submitButton.disabled = false;
      submitButton.textContent = originalSubmitLabel;
    }
  }
}

function addTransaction(type, customerId, amount, ref, date, note = "", extra = {}) {
  const customer = state.customers.find((item) => item.id === customerId);
  const credits = ["Susu Deposit", "Loan Repayment", "Interest Payment"];
  const direction = credits.includes(type) ? "credit" : "debit";
  postDoubleEntry(state, {
    id: uid("led"),
    entryType: type,
    customerId,
    groupId: customer?.groupId || extra.groupId || "",
    collectorId: customer?.collectorId || currentUser()?.id || "",
    amount,
    direction,
    referenceId: ref,
    referenceType: String(type).toLowerCase().replace(/\s+/g, "_"),
    receiptNo: extra.paymentNo || "",
    paymentMethod: extra.paymentMethod || "Cash",
    paymentReference: extra.paymentReference || "",
    reason: note,
    createdBy: currentUser()?.id || "",
    clientCreatedAt: `${date}T12:00:00.000Z`
  }, uid);
}

function customerBalance(customerId) {
  if ((state.ledgerEntries || []).some((entry) => entry.customerId === customerId)) {
    return ledgerBalanceForCustomer(state, customerId);
  }
  const deposits = state.transactions.filter((tx) => tx.customerId === customerId && tx.type === "Susu Deposit" && !tx.reversed).reduce((sum, tx) => sum + Number(tx.amount), 0);
  const withdrawals = state.transactions.filter((tx) => tx.customerId === customerId && tx.type === "Withdrawal" && !tx.reversed).reduce((sum, tx) => sum + Number(tx.amount), 0);
  return deposits - withdrawals;
}

function buildCustomerMessage({ kind, customerId, ref = "", date, body, amountPaid = 0, totalContributed = 0 }) {
  const customer = state.customers.find((item) => item.id === customerId);
  return {
    id: uid("msg"),
    kind,
    ref,
    customerId,
    phone: customer?.phone || "",
    amountPaid,
    totalContributed,
    body,
    status: "Ready to send",
    date,
    createdAt: new Date().toISOString()
  };
}

function transactionMessageNotice(result) {
  if (result === "sent") return " SMS sent to member.";
  if (result === "queued") return " SMS queued for phone.";
  if (result === "permission") return " SMS waiting for phone permission.";
  if (result === "invalid_phone") return " Update member phone to send SMS.";
  return " Message saved in Messages.";
}

function deliverCustomerMessage(message) {
  if (!message) return "missing";
  if (!state.messages.some((item) => item.id === message.id)) {
    state.messages.push(message);
  }
  const customer = state.customers.find((item) => item.id === message.customerId);
  const phone = customer?.phone || message.phone;
  if (!isValidPhone(phone)) {
    saveState();
    return "invalid_phone";
  }
  message.phone = phone;
  message.autoSend = true;
  saveState();

  if (window.KbaSmsGateway) {
    if (sendViaPhoneGateway(message)) {
      pushCloudBackup(true);
      return "sent";
    }
    if (message.status === "Waiting for SMS permission") return "permission";
  }

  openMessageSender(message, true);
  saveState();

  if (message.status === "Sent") {
    pushCloudBackup(true);
    return "sent";
  }
  if (message.status === "Queued for phone") return "queued";
  if (message.status === "Waiting for SMS permission") return "permission";
  return "ready";
}

function buildPaymentMessage(customerId, amountPaid, date, ref = "") {
  const customer = state.customers.find((item) => item.id === customerId);
  const totalContributed = customerBalance(customerId);
  const group = groupById(customer?.groupId);
  const body = `Hello ${customer?.name || "member"}, your ${group?.name || "susu"} payment of ${money(amountPaid)} has been received on ${date}. Your total contributed amount is now ${money(totalContributed)}. Thank you.`;
  return buildCustomerMessage({
    kind: "Payment",
    customerId,
    ref,
    date,
    body,
    amountPaid,
    totalContributed
  });
}

function createPaymentMessage(customerId, amountPaid, date, ref = "") {
  const message = buildPaymentMessage(customerId, amountPaid, date, ref);
  state.messages.push(message);
  return message;
}

function buildWithdrawalMessage(customerId, amount, date, ref = "") {
  const customer = state.customers.find((item) => item.id === customerId);
  const balance = customerBalance(customerId);
  const body = `Hello ${customer?.name || "member"}, your withdrawal of ${money(amount)} was processed on ${date}. Your remaining susu balance is ${money(balance)}. Thank you.`;
  return buildCustomerMessage({
    kind: "Withdrawal",
    customerId,
    ref,
    date,
    body,
    amountPaid: amount,
    totalContributed: balance
  });
}

function buildRepaymentMessage(loan, amount, date) {
  const customer = state.customers.find((item) => item.id === loan.customerId);
  const remaining = Math.max(0, Number(loan.totalDue || 0) - Number(loan.amountPaid || 0));
  const body = `Hello ${customer?.name || "member"}, your loan repayment of ${money(amount)} was received on ${date}. Remaining loan balance is ${money(remaining)}. Thank you.`;
  return buildCustomerMessage({
    kind: "Repayment",
    customerId: loan.customerId,
    ref: loan.id,
    date,
    body,
    amountPaid: amount,
    totalContributed: remaining
  });
}

function buildInterestMessage(loan, amount, date, monthNo) {
  const customer = state.customers.find((item) => item.id === loan.customerId);
  const body = `Hello ${customer?.name || "member"}, your interest payment of ${money(amount)} for month ${monthNo} was received on ${date}. Thank you.`;
  return buildCustomerMessage({
    kind: "Interest",
    customerId: loan.customerId,
    ref: loan.id,
    date,
    body,
    amountPaid: amount,
    totalContributed: Math.max(0, Number(loan.totalDue || 0) - Number(loan.amountPaid || 0))
  });
}

function buildLoanMessage(loan) {
  const customer = state.customers.find((item) => item.id === loan.customerId);
  const firstPayment = loan.interestSchedule?.[0];
  const body = `Hello ${customer?.name || "member"}, your loan of ${money(loan.principal)} has been recorded on ${loan.date}. Monthly interest is ${money(monthlyInterestAmount(loan))} for ${loan.interestMonths || 1} month(s). Total due is ${money(loan.totalDue)}.${firstPayment ? ` First interest date: ${firstPayment.date}.` : ""} Thank you.`;
  return buildCustomerMessage({
    kind: "Loan",
    customerId: loan.customerId,
    ref: loan.id,
    date: loan.date,
    body,
    amountPaid: loan.principal,
    totalContributed: loan.totalDue
  });
}

function createLoanMessage(loan) {
  const message = buildLoanMessage(loan);
  state.messages.push(message);
  return message;
}

function getOrCreateCollectionMessage(collection) {
  let message = state.messages.find((item) => item.ref === collection.id && item.kind === "Payment");
  if (!message) {
    message = createPaymentMessage(collection.customerId, Number(collection.amount || 0), collection.date, collection.id);
    saveState();
  }
  return message;
}

function messageLink(message) {
  const phone = String(message.phone || "").replace(/[^\d+]/g, "");
  return `sms:${phone}?&body=${encodeURIComponent(message.body)}`;
}

function isValidPhone(phone) {
  return isValidGhanaPhone(phone);
}

function gatewayPhone(message) {
  return String(message.phone || "").replace(/[^\d+]/g, "");
}

function sendCollectionSms(collectionId) {
  const collection = state.collections.find((item) => item.id === collectionId);
  if (!collection || !visibleGroupIds().includes(collection.groupId)) return;
  const customer = state.customers.find((item) => item.id === collection.customerId);
  if (!isValidPhone(customer?.phone)) {
    toast("Member phone number is wrong. Edit the member and correct the phone number first.");
    activeView = "customers";
    sessionStorage.setItem("edit_customer_id", customer?.id || "");
    render();
    return;
  }
  openMessageSender(getOrCreateCollectionMessage(collection), true);
}

function sendLoanSms(loanId) {
  const loan = state.loans.find((item) => item.id === loanId);
  if (!loan || !visibleGroupIds().includes(loan.groupId)) return;
  const customer = state.customers.find((item) => item.id === loan.customerId);
  if (!isValidPhone(customer?.phone)) {
    toast("Member phone number is wrong. Edit the member and correct the phone number first.");
    activeView = "customers";
    sessionStorage.setItem("edit_customer_id", customer?.id || "");
    render();
    return;
  }
  let message = state.messages.find((item) => item.ref === loan.id && item.kind === "Loan");
  if (!message) {
    message = buildLoanMessage(loan);
    state.messages.push(message);
    saveState();
  }
  openMessageSender(message, true);
}

function sendMessageSms(messageId) {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message || !visibleMessages().some((item) => item.id === message.id)) return;
  const customer = state.customers.find((item) => item.id === message.customerId);
  if (!isValidPhone(customer?.phone || message.phone)) {
    toast("Member phone number is wrong. Edit the member and correct the phone number first.");
    activeView = "customers";
    sessionStorage.setItem("edit_customer_id", customer?.id || "");
    render();
    return;
  }
  message.phone = customer?.phone || message.phone;
  openMessageSender(message, true);
}

function openMessageSender(message, force = false) {
  if (!message?.phone) return;
  if (message.status === "Cancelled") {
    toast("This old message was cancelled. New entries will create new messages.");
    return;
  }
  if (window.KbaSmsGateway) {
    sendViaPhoneGateway(message);
    return;
  }
  if (/Electron/i.test(navigator.userAgent)) {
    queueSmsForPhone(message);
    return;
  }
  if (force || /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    window.location.href = messageLink(message);
  }
}

function queueSmsForPhone(message) {
  message.status = "Queued for phone";
  message.queuedAt = new Date().toISOString();
  saveState();
  pushCloudBackup(true);
  showDesktopSmsDialog(message);
  toast("Message queued. Open the APK on the phone to send it.");
}

function sendViaPhoneGateway(message) {
  if (!window.KbaSmsGateway) return false;
  if (!window.KbaSmsGateway.hasPermission()) {
    message.status = "Waiting for SMS permission";
    saveState();
    window.KbaSmsGateway.requestPermission();
    toast("Allow SMS permission, then tap Send SMS again.");
    return false;
  }
  const result = window.KbaSmsGateway.sendSms(gatewayPhone(message), message.body);
  if (result === "SENT") {
    message.status = "Sent";
    message.sentAt = new Date().toISOString();
    saveState();
    pushCloudBackup(true);
    toast("SMS sent from phone");
    return true;
  }
  message.status = result || "Failed";
  saveState();
  pushCloudBackup(true);
  toast("SMS failed on phone");
  return false;
}

async function processPhoneGatewayQueue() {
  if (!window.KbaSmsGateway || syncBusy) return;
  try {
    const snapshot = await latestCloudSnapshot();
    if (snapshot?.payload) state = normalizeState(snapshot.payload);
  } catch {
    return;
  }
  const pending = state.messages.filter((message) => ["Queued for phone", "Waiting for SMS permission"].includes(message.status));
  if (!pending.length) return;
  if (!window.KbaSmsGateway.hasPermission()) {
    window.KbaSmsGateway.requestPermission();
    toast(`${pending.length} SMS waiting. Allow SMS permission.`);
    return;
  }
  let sent = 0;
  pending.forEach((message) => {
    if (sendViaPhoneGateway(message)) sent += 1;
  });
  if (sent) {
    toast(`${sent} queued SMS sent`);
    render();
  }
}

function showDesktopSmsDialog(message) {
  const existing = document.querySelector(".sms-dialog");
  if (existing) existing.remove();
  const node = document.createElement("div");
  node.className = "sms-dialog";
  node.innerHTML = `
    <div class="sms-box">
      <div class="section-title">
        <h2>Message Queued</h2>
        <button class="btn ghost" type="button" data-close-sms>Close</button>
      </div>
      <div class="notice good">This computer has queued the SMS for the phone gateway. Open the APK on the phone with internet, allow SMS permission, and it will send through the phone SIM.</div>
      <div class="field"><label>Phone</label><input value="${escapeAttr(message.phone)}" readonly /></div>
      <div class="field"><label>Message</label><textarea readonly>${escapeHtml(message.body)}</textarea></div>
      <div class="row-actions" style="margin-top:14px">
        <button class="btn" type="button" data-copy-sms>Copy message</button>
      </div>
    </div>
  `;
  document.body.appendChild(node);
  node.querySelector("[data-close-sms]").addEventListener("click", () => node.remove());
  node.querySelector("[data-copy-sms]").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(message.body);
      toast("Message copied");
    } catch {
      toast("Copy failed. Select and copy the message manually.");
    }
  });
}

function monthlyInterestAmount(loan) {
  return (Number(loan.principal || 0) * Number(loan.interest || 0)) / 100;
}

function ensureLoanInterestSchedule(loan) {
  if (!loan.interestSchedule?.length) {
    loan.interestSchedule = buildInterestSchedule(loan.date, loan.principal, loan.interest, loan.interestMonths || 1);
  }
  return loan.interestSchedule;
}

function interestPaymentRows() {
  return visibleLoans().flatMap((loan) => ensureLoanInterestSchedule(loan).map((entry, index) => ({ loan, entry, index })));
}

function interestPaymentStatus(entry) {
  if (entry.status === "Paid") return "Paid";
  return String(entry.date || "") < today() ? "Overdue" : "Pending";
}

function buildInterestSchedule(startDate, principal, interest, months) {
  const count = Math.max(1, Number(months || 1));
  const monthlyAmount = (Number(principal || 0) * Number(interest || 0)) / 100;
  return Array.from({ length: count }, (_, index) => ({
    month: index + 1,
    date: addMonths(startDate || today(), index + 1),
    amount: monthlyAmount,
    status: "Pending"
  }));
}

function addMonths(dateText, months) {
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return today();
  const day = date.getDate();
  date.setMonth(date.getMonth() + Number(months || 0));
  if (date.getDate() !== day) date.setDate(0);
  return date.toISOString().slice(0, 10);
}

function auditActorContext(extra = {}) {
  const user = extra.user || currentUser();
  return {
    userId: extra.userId ?? user?.id ?? "",
    username: extra.username ?? user?.username ?? "",
    fullName: extra.fullName ?? user?.name ?? "",
    role: extra.role ?? user?.role ?? "",
    branch: extra.branch ?? user?.groupId ?? user?.branchId ?? "",
    groupIds: extra.groupIds ?? (user?.groupId ? [user.groupId] : visibleGroupIds()),
    deviceId: extra.deviceId ?? (typeof deviceFingerprint === "function" ? deviceFingerprint() : ""),
    deviceType: extra.deviceType ?? (typeof navigator !== "undefined" && /android/i.test(navigator.userAgent || "") ? "Android" : "Web"),
    applicationVersion: extra.applicationVersion ?? APP_VERSION,
    operatingSystem: extra.operatingSystem ?? (typeof navigator !== "undefined" ? navigator.platform || "" : ""),
    sessionId: extra.sessionId ?? sessionUserId ?? "",
    ipAddress: extra.ipAddress ?? ""
  };
}

function logAudit(action, details = "", extra = {}) {
  const {
    skipSave,
    required,
    user,
    forcePersistFailure,
    ...fields
  } = extra;
  const result = recordAuditEvent(state, {
    action,
    details,
    ...auditActorContext({ ...fields, user }),
    ...fields,
    forcePersistFailure
  }, uid);
  if (skipSave) return result;
  if (result.ok || result.duplicate) saveState();
  if (required && !result.ok && !result.duplicate) {
    throw new Error(result.error || "Audit persist failed");
  }
  return result;
}

function beginClassASnapshot(keys = ["collections", "audit", "ledgerEntries", "transactions", "journalEntries", "auditOutbox"]) {
  return Object.fromEntries(keys.map((key) => [key, (state[key] || []).length]));
}

function rollbackClassASnapshot(snap) {
  Object.keys(snap || {}).forEach((key) => {
    if (Array.isArray(state[key])) state[key].length = snap[key];
  });
}

function visibleAudit() {
  if (isKBA()) return state.audit;
  const groups = visibleGroupIds();
  return state.audit.filter((row) => (row.groupIds || []).some((id) => groups.includes(id)));
}

function loanBalanceForCustomer(customerId) {
  return state.loans
    .filter((loan) => loan.customerId === customerId && loanAcceptsRepayment(loan.status) && loan.status !== "Written Off")
    .reduce((sum, loan) => sum + Math.max(0, loan.totalDue - loan.amountPaid), 0);
}

function perSittingAmount(customer) {
  const group = groupById(customer?.groupId);
  return Number(customer?.dailyAmount ?? group?.defaultAmount ?? 0);
}

function distributionRows() {
  return visibleCustomers().map((customer) => {
    const group = groupById(customer.groupId);
    const contributed = customerBalance(customer.id);
    const loanBalance = loanBalanceForCustomer(customer.id);
    const settingsPaid = state.collections
      .filter((item) => item.customerId === customer.id && Number(item.amount) > 0)
      .reduce((sum, item) => sum + Number(item.sittingsPaid || item.contributionNo || 0), 0);
    return {
      group: groupName(customer.groupId),
      member: customer.name,
      contributed,
      loanBalance,
      finalPayout: Math.max(0, contributed - loanBalance),
      settingsPaid,
      settingsTarget: group?.targetContributions || state.settings.collectionDays
    };
  });
}

function dailyMoneyLogRows(from = "0000-01-01", to = "9999-12-31") {
  const moneyTypes = ["Susu Deposit", "Loan Repayment", "Interest Payment"];
  const days = new Map();
  visibleTransactions().filter((tx) => moneyTypes.includes(tx.type) && tx.date >= from && tx.date <= to).forEach((tx) => {
    const row = days.get(tx.date) || { date: tx.date, contributions: 0, loanRepaid: 0, interestPaid: 0, totalReceived: 0 };
    const amount = Number(tx.amount || 0);
    if (tx.type === "Susu Deposit") row.contributions += amount;
    if (tx.type === "Loan Repayment") row.loanRepaid += amount;
    if (tx.type === "Interest Payment") row.interestPaid += amount;
    row.totalReceived += amount;
    days.set(tx.date, row);
  });
  return Array.from(days.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function dailyInputLogRows(date = sessionStorage.getItem("log_date") || today()) {
  const moneyTypes = ["Susu Deposit", "Loan Repayment", "Interest Payment"];
  return visibleTransactions()
    .filter((tx) => moneyTypes.includes(tx.type) && tx.date === date)
    .map((tx) => {
      const customer = state.customers.find((item) => item.id === tx.customerId);
      const created = tx.createdAt ? new Date(tx.createdAt) : null;
      return {
        date: tx.date,
        time: created && !Number.isNaN(created.getTime()) ? created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        group: groupName(customer?.groupId),
        member: customerName(tx.customerId),
        type: tx.type === "Susu Deposit" ? "Contribution" : tx.type,
        amount: Number(tx.amount || 0),
        officer: userName(tx.userId),
        ref: tx.ref || tx.id,
        createdAt: tx.createdAt || ""
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function memberFinancialReportRows() {
  return visibleCustomers().map((customer) => {
    const loans = state.loans.filter((loan) => loan.customerId === customer.id);
    const totalContribution = customerBalance(customer.id);
    const totalLoan = loans.reduce((sum, loan) => sum + Number(loan.principal || 0), 0);
    const loanRepaid = state.transactions
      .filter((tx) => tx.customerId === customer.id && tx.type === "Loan Repayment")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const interestPaid = state.transactions
      .filter((tx) => tx.customerId === customer.id && tx.type === "Interest Payment")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const interestRemaining = loans.reduce((sum, loan) => {
      return sum + ensureLoanInterestSchedule(loan)
        .filter((entry) => entry.status !== "Paid")
        .reduce((entrySum, entry) => entrySum + Number(entry.amount || 0), 0);
    }, 0);
    return {
      group: groupName(customer.groupId),
      member: customer.name,
      totalContribution,
      totalLoan,
      loanRepaid,
      interestPaid,
      interestRemaining,
      amountToReceive: totalContribution + loanRepaid - interestRemaining - totalLoan
    };
  });
}

function arrearsRows() {
  return visibleCustomers()
    .filter((customer) => customerHasSusuAccount(customer))
    .map((customer) => {
      const summary = memberSittingSummary(customer.id);
      return {
        customerId: customer.id,
        group: groupName(customer.groupId),
        member: customer.name,
        phone: customer.phone,
        paid: summary.paid,
        target: summary.target,
        remaining: summary.remaining,
        amountRemaining: summary.remainingAmount
      };
    })
    .filter((row) => row.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);
}

function renderArrearsTable(rows = arrearsRows()) {
  if (!rows.length) return `<div class="empty">No customers are behind on contributions.</div>`;
  const tableHtml = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Location</th><th>Customer</th><th>Phone</th><th>Sittings Paid</th><th>Outstanding</th><th>Amount Remaining</th></tr></thead>
        <tbody>
          ${rows.map((row) => `<tr class="clickable-row" data-row-member-detail="${row.customerId}">
            <td>${escapeHtml(row.group)}</td>
            <td><button type="button" class="link-btn" data-member-detail="${row.customerId}">${escapeHtml(row.member)}</button></td>
            <td>${escapeHtml(row.phone || "")}</td>
            <td>${row.paid} / ${row.target}</td>
            <td>${row.remaining}</td>
            <td>${money(row.amountRemaining)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
  return mobileTableWrap(renderMobileArrearsCards(rows), tableHtml);
}

function reportDateRange() {
  return {
    from: sessionStorage.getItem("report_from") || today(),
    to: sessionStorage.getItem("report_to") || today()
  };
}

function setReportRange(from, to) {
  sessionStorage.setItem("report_from", from || today());
  sessionStorage.setItem("report_to", to || from || today());
  render();
}

function setQuickReportRange(kind) {
  const now = new Date(`${today()}T00:00:00`);
  if (kind === "yesterday") {
    now.setDate(now.getDate() - 1);
    const value = now.toISOString().slice(0, 10);
    setReportRange(value, value);
    return;
  }
  if (kind === "week") {
    const end = today();
    const start = new Date(`${today()}T00:00:00`);
    start.setDate(start.getDate() - 6);
    setReportRange(start.toISOString().slice(0, 10), end);
    return;
  }
  if (kind === "month") {
    const end = today();
    const start = `${today().slice(0, 8)}01`;
    setReportRange(start, end);
    return;
  }
  setReportRange(today(), today());
}

function openPrintWindow(html) {
  if (isElectronRuntime()) {
    void desktopPrintHtml({ html, title: "SMILE TRUST SUSU MANAGEMENT SYSTEM" }).then((res) => {
      if (res && res.ok === false && !res.cancelled) {
        toast(res.error || "Desktop print failed");
      }
    });
    return null;
  }
  const popup = window.open("", "_blank");
  if (!popup) {
    toast("Pop-up blocked. Allow pop-ups to print.");
    return null;
  }
  popup.document.write(html);
  popup.document.close();
  return popup;
}

function printWithdrawalFormForCustomer(customer, amount, date) {
  openPrintWindow(renderWithdrawalForm({
    date,
    accountNo: customer?.accountNo || "",
    accountName: customer?.name || "",
    amountWords: amountInWords(amount),
    amountFigures: money(amount),
    collectorName: currentUser()?.name || ""
  }));
}

function loanFormPayload(loan) {
  const customer = state.customers.find((item) => item.id === loan.customerId);
  return {
    applicantName: customer?.name || "",
    accountNo: customer?.accountNo || "",
    ghanaCard: customer?.ghanaCard || "",
    phone: customer?.phone || "",
    address: customer?.address || "",
    amountFigures: money(loan.principal),
    amountWords: amountInWords(loan.principal),
    purpose: loan.purpose || "",
    repaymentPeriod: `${loan.interestMonths || 0} month(s)`,
    requestDate: loan.requestDate || loan.date || today(),
    guarantorName: loan.guarantorName || "",
    guarantorGhanaCard: loan.guarantorGhanaCard || "",
    guarantorAccountNo: loan.guarantorAccountNo || "",
    guarantorPhone: loan.guarantorPhone || "",
    collectorRecommendation: loan.collectorRecommendation || "",
    managerRecommendation: loan.managerRecommendation || "",
    amountApproved: money(loan.principal),
    period: `${loan.interestMonths || 0} month(s)`,
    principal: money(loan.principal),
    interest: `${loan.interest || 0}%`,
    approvedDate: loan.date || today()
  };
}

function printLoanApplicationFormForLoan(loanId) {
  const loan = state.loans.find((item) => item.id === loanId);
  if (!loan) return;
  openPrintWindow(renderLoanApplicationForm(loanFormPayload(loan)));
}

function printLoanAcceptanceFormForLoan(loanId) {
  const loan = state.loans.find((item) => item.id === loanId);
  const customer = state.customers.find((item) => item.id === loan?.customerId);
  if (!loan || !customer) return;
  const start = new Date(loan.date || today());
  const end = new Date(start);
  end.setMonth(end.getMonth() + Number(loan.interestMonths || 0));
  const monthly = Number(loan.interestMonths || 0) ? loan.totalDue / Number(loan.interestMonths || 1) : loan.totalDue;
  openPrintWindow(renderLoanAcceptanceForm({
    applicantName: customer.name,
    acceptanceDay: String(start.getDate()),
    acceptanceMonth: start.toLocaleString("en-GB", { month: "long" }),
    acceptanceYear: String(start.getFullYear()).slice(-2),
    amountFigures: money(loan.principal),
    amountWords: amountInWords(loan.principal),
    purpose: loan.purpose || "",
    repaymentMonths: String(loan.interestMonths || ""),
    monthlyInstallment: money(monthly),
    interestRate: String(loan.interest || state.settings.loanInterest),
    startDate: loan.date || today(),
    endDate: end.toISOString().slice(0, 10)
  }));
}

function printReceipt(transactionId) {
  const tx = state.transactions.find((item) => item.id === transactionId);
  if (!tx) return;
  if (tx.type === "Withdrawal") {
    const customer = state.customers.find((item) => item.id === tx.customerId);
    printWithdrawalFormForCustomer(customer, tx.amount, tx.date);
    return;
  }
  const customer = state.customers.find((item) => item.id === tx.customerId);
  openPrintWindow(renderAccountsSheet({
    accountNo: customer?.accountNo || "",
    transactions: buildAccountLedgerTransactions(customer, [tx], money)
  }));
}

function printMemberStatement(customerId, range = {}, source = state) {
  const customer = (source.customers || []).find((item) => item.id === customerId);
  if (!customer) return;
  const txs = (source.transactions || []).filter((tx) => {
    if (tx.customerId !== customer.id) return false;
    if (range.from && tx.date < range.from) return false;
    if (range.to && tx.date > range.to) return false;
    return true;
  });
  openPrintWindow(renderAccountsSheet({
    accountNo: customer.accountNo || "",
    transactions: buildAccountLedgerTransactions(customer, txs, money)
  }));
}

function handleCustomerNote(event) {
  event.preventDefault();
  const data = formData(event.target);
  const customer = state.customers.find((item) => item.id === data.customerId);
  if (!customer) return;
  const result = addCustomerNote(customer, {
    ...data,
    userId: currentUser()?.id || "",
    userName: currentUser()?.name || "",
    branchId: customer.groupId
  }, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Customer note added", `${customer.name} · ${data.type}`);
  toast("Note saved");
  render();
}

function handleCustomerStatement(event) {
  event.preventDefault();
  const data = formData(event.target);
  printMemberStatement(data.customerId, { from: data.from, to: data.to });
}

function handleKycVerify(status) {
  const customer = state.customers.find((item) => item.id === sessionStorage.getItem("detail_customer_id"));
  if (!customer) return;
  const result = setKycVerification(customer, status, currentUser(), uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Customer KYC updated", `${customer.name} · ${status}`);
  toast(`KYC ${status.toLowerCase()}`);
  render();
}

function printMembershipCard(customerId) {
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return;
  const card = membershipCardPayload(customer, {
    businessName: state.settings.businessName || "SMILE TRUST SUSU MANAGEMENT SYSTEM",
    branch: groupName(customer.groupId),
    agent: state.users.find((user) => user.id === customer.collectorId)?.name || ""
  });
  openPrintWindow(renderMembershipCardHtml(card));
}

function downloadCsv(filename, rows) {
  const keys = Object.keys(rows[0] || {});
  const csv = [keys.join(","), ...rows.map((row) => keys.map((key) => `"${String(row[key] ?? "").replace(/"/g, "\"\"")}"`).join(","))].join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  link.click();
}

function exportVisibleCustomersCsv() {
  const rows = exportCustomerRows(visibleCustomers(), {
    branchName: (customer) => groupName(customer.groupId),
    agentName: (customer) => state.users.find((user) => user.id === customer.collectorId)?.name || "",
    balance: (customer) => customerBalance(customer.id)
  });
  if (!rows.length) {
    toast("No customers to export");
    return;
  }
  downloadCsv("smile-trust-customers.csv", rows);
}

function bindBranchHandlers() {
  const refresh = () => {
    const table = document.querySelector("#branchTable");
    if (!table) return;
    table.innerHTML = renderFilteredBranchTable(visibleBranches());
    bindBranchRowClicks();
  };
  document.querySelector("#branchSearch")?.addEventListener("input", (event) => {
    sessionStorage.setItem("branch_search", event.target.value);
    refresh();
  });
  ["branchStatusFilter", "branchTypeFilter"].forEach((id) => {
    document.querySelector(`#${id}`)?.addEventListener("change", refresh);
  });
  document.querySelector("#exportBranchesBtn")?.addEventListener("click", () => {
    const rows = exportBranchRows(visibleBranches(), state);
    if (!rows.length) {
      toast("No branches to export");
      return;
    }
    downloadCsv("smile-trust-branches.csv", rows);
  });
  document.querySelectorAll("[data-branch-page]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("branch_page", button.dataset.branchPage);
      refresh();
    });
  });
  document.querySelector("#branchForm")?.addEventListener("submit", handleBranchSave);
  document.querySelector("#cancelBranchEdit")?.addEventListener("click", () => {
    sessionStorage.removeItem("edit_branch_id");
    render();
  });
  document.querySelector("#branchFab")?.addEventListener("click", () => {
    sessionStorage.removeItem("edit_branch_id");
    document.querySelector("#branchForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.querySelectorAll("[data-edit-branch]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      sessionStorage.setItem("edit_branch_id", button.dataset.editBranch);
      activeView = "groups";
      render();
    });
  });
  bindBranchRowClicks();
  document.querySelector("#branchTransferForm")?.addEventListener("submit", handleBranchTransfer);
  document.querySelector("#branchBulkCustomerForm")?.addEventListener("submit", handleBranchBulkCustomers);
  document.querySelector("#branchAnnounceForm")?.addEventListener("submit", handleBranchAnnounce);
  document.querySelector("#branchCalendarForm")?.addEventListener("submit", handleBranchCalendar);
  document.querySelector("#branchDocumentForm")?.addEventListener("submit", handleBranchDocument);
  document.querySelectorAll("[data-ack-announcement]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = (state.branchAnnouncements || []).find((row) => row.id === button.dataset.ackAnnouncement);
      if (!item) return;
      acknowledgeAnnouncement(item, currentUser()?.id || "");
      saveState();
      toast("Acknowledged");
      render();
    });
  });
  document.querySelectorAll("[data-branch-status]").forEach((button) => {
    button.addEventListener("click", () => handleBranchStatus(button.dataset.branchStatus));
  });
  const dest = document.querySelector("#branchTransferDest");
  if (dest && !dest.options.length) {
    dest.innerHTML = visibleBranches().map((branch) => `<option value="${escapeAttr(branch.id)}">${escapeHtml(branch.name)}</option>`).join("");
    const bulk = document.querySelector("#bulkToBranchId");
    if (bulk) bulk.value = dest.value;
    dest.addEventListener("change", () => {
      const bulkField = document.querySelector("#bulkToBranchId");
      if (bulkField) bulkField.value = dest.value;
    });
  }
}

function bindBranchRowClicks() {
  document.querySelectorAll("[data-branch-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      sessionStorage.setItem("detail_branch_id", button.dataset.branchDetail);
      activeView = "branchDetail";
      render();
    });
  });
}

function handleBranchSave(event) {
  event.preventDefault();
  if (!canManageBranches(currentUser())) {
    toast("You cannot manage branches");
    return;
  }
  const data = formData(event.target);
  const result = saveBranch(state, {
    ...data,
    updatedBy: currentUser()?.id || "",
    emergencyClosed: data.emergencyClosed === "on",
    targets: {
      monthlyCollection: Number(data.targetMonthlyCollection || 0),
      loanRecovery: Number(data.targetLoanRecovery || 0),
      customerAcquisition: Number(data.targetCustomerAcquisition || 0),
      expenseLimit: Number(data.targetExpenseLimit || 0)
    },
    settings: {
      receiptPrefix: data.receiptPrefix,
      customerPrefix: data.customerPrefix,
      cashHoldingLimit: Number(data.cashHoldingLimit || 0)
    }
  }, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  sessionStorage.removeItem("edit_branch_id");
  saveState();
  logAudit(data.id ? "Branch updated" : "Branch created", result.branch.name);
  toast(data.id ? "Branch saved" : "Branch created");
  render();
}

function handleBranchTransfer(event) {
  event.preventDefault();
  const data = formData(event.target);
  const created = createBranchTransfer(state, { ...data, requestedBy: currentUser()?.id || "" }, uid);
  if (created.error) {
    toast(created.error);
    return;
  }
  if (created.transfer.kind !== "cash") {
    const applied = applyEntityTransfer(state, created.transfer, { uid, logAudit, approvedBy: currentUser()?.id || "" });
    if (applied.error) {
      toast(applied.error);
      return;
    }
  }
  saveState();
  logAudit("Branch transfer", `${data.kind} · ${data.reason}`);
  toast(created.transfer.kind === "cash" ? "Cash transfer submitted for approval" : "Transfer applied");
  render();
}

function handleBranchBulkCustomers(event) {
  event.preventDefault();
  const data = formData(event.target);
  const dest = document.querySelector("#branchTransferDest")?.value || data.toBranchId;
  const ids = String(data.customerIds || "").split(",").map((item) => item.trim()).filter(Boolean);
  const result = bulkTransferCustomers(state, ids, dest, {
    reason: data.reason,
    requestedBy: currentUser()?.id || "",
    uid,
    logAudit
  });
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast(`Transferred ${result.results.filter((item) => item.ok).length} customer(s)`);
  render();
}

function handleBranchAnnounce(event) {
  event.preventDefault();
  const data = formData(event.target);
  const result = publishAnnouncement(state, { ...data, createdBy: currentUser()?.id || "" }, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Branch announcement", result.announcement.title);
  toast("Announcement published");
  render();
}

function handleBranchCalendar(event) {
  event.preventDefault();
  const data = formData(event.target);
  const result = addCalendarEvent(state, data, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast("Event added");
  render();
}

function handleBranchDocument(event) {
  event.preventDefault();
  const form = event.target;
  const data = formData(form);
  const branch = (state.branches || []).find((item) => item.id === data.branchId);
  const file = form.querySelector('[name="file"]')?.files?.[0];
  if (!branch || !file) return;
  readOptionalCustomerFile(file).then((dataUrl) => {
    addBranchDocument(branch, { type: data.type, reference: data.reference, fileName: file.name, dataUrl }, uid);
    saveState();
    logAudit("Branch document uploaded", `${branch.name} · ${data.type}`);
    toast("Document uploaded");
    render();
  }).catch((error) => toast(error.message || "Could not upload document"));
}

function handleBranchStatus(status) {
  const branch = (state.branches || []).find((item) => item.id === sessionStorage.getItem("detail_branch_id"));
  if (!branch) return;
  if (!confirm(`Set ${branch.name} to ${status}?`)) return;
  const result = setBranchStatus(branch, status, currentUser(), uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Branch status changed", `${branch.name} · ${status}`);
  toast(`Branch ${status.toLowerCase()}`);
  render();
}

function bindAgentHandlers() {
  const refreshAgentTable = () => {
    const table = document.querySelector("#agentTable");
    if (!table) return;
    table.innerHTML = renderFilteredAgentTable(visibleAgents());
    bindAgentRowClicks();
  };
  document.querySelector("#agentSearch")?.addEventListener("input", (event) => {
    sessionStorage.setItem("agent_search", event.target.value);
    refreshAgentTable();
  });
  ["agentStatusFilter", "agentBranchFilter"].forEach((id) => {
    document.querySelector(`#${id}`)?.addEventListener("change", refreshAgentTable);
  });
  document.querySelector("#exportAgentsBtn")?.addEventListener("click", () => {
    const rows = exportAgentRows(visibleAgents(), state, { branchName: (user) => groupName(user.groupId) });
    if (!rows.length) {
      toast("No agents to export");
      return;
    }
    downloadCsv("smile-trust-agents.csv", rows);
  });
  document.querySelectorAll("[data-agent-page]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("agent_page", button.dataset.agentPage);
      refreshAgentTable();
    });
  });
  bindAgentRowClicks();
  document.querySelector("#agentRouteForm")?.addEventListener("submit", handleAgentRoute);
  document.querySelectorAll("[data-edit-route]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("edit_route_id", button.dataset.editRoute);
      render();
    });
  });
  document.querySelectorAll("[data-agent-clock]").forEach((button) => {
    button.addEventListener("click", () => handleAgentClock(button.dataset.agentClock));
  });
  document.querySelector("#agentAssignForm")?.addEventListener("submit", handleAgentAssign);
  document.querySelector("#agentAttendanceForm")?.addEventListener("submit", handleAgentAttendance);
  document.querySelector("#agentLeaveForm")?.addEventListener("submit", handleAgentLeave);
  document.querySelectorAll("[data-leave-decide]").forEach((button) => {
    button.addEventListener("click", () => handleLeaveDecision(button.dataset.leaveDecide, button.dataset.leaveOk === "1"));
  });
  document.querySelector("#agentVisitForm")?.addEventListener("submit", handleAgentVisit);
  document.querySelector("#agentDocumentForm")?.addEventListener("submit", handleAgentDocument);
  document.querySelector("#agentNoteForm")?.addEventListener("submit", handleAgentNote);
  document.querySelector("#agentTransferForm")?.addEventListener("submit", handleAgentTransfer);
  document.querySelector("#agentExpenseForm")?.addEventListener("submit", handleAgentExpense);
  document.querySelectorAll("[data-agent-status]").forEach((button) => {
    button.addEventListener("click", () => handleAgentStatus(button.dataset.agentStatus));
  });
  const transfer = document.querySelector("#agentTransferBranch");
  if (transfer && !transfer.options.length) {
    transfer.innerHTML = visibleGroups().map((group) => `<option value="${escapeAttr(group.id)}">${escapeHtml(group.name)}</option>`).join("");
  }
}

function bindAgentRowClicks() {
  document.querySelectorAll("[data-agent-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      sessionStorage.setItem("detail_agent_id", button.dataset.agentDetail);
      activeView = "agentDetail";
      render();
    });
  });
}

function captureOptionalGps(enabled) {
  return new Promise((resolve) => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) {
      resolve("");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(`${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`),
      () => resolve(""),
      { timeout: 4000, maximumAge: 60000 }
    );
  });
}

function handleAgentClock(action) {
  const user = currentUser();
  if (!user) return;
  const run = async () => {
    const gps = await captureOptionalGps(user.gpsEnabled && state.settings.gpsTrackingEnabled !== false);
    const result = action === "out"
      ? clockOut(state, user, { date: today(), uid })
      : clockIn(state, user, { date: today(), gps, uid });
    if (result.error) {
      toast(result.error);
      return;
    }
    saveState();
    logAudit(action === "out" ? "Agent clocked out" : "Agent clocked in", user.name);
    toast(action === "out" ? "Clocked out" : "Clocked in");
    render();
  };
  run();
}

function handleAgentRoute(event) {
  event.preventDefault();
  if (!canManageAgents(currentUser())) {
    toast("You cannot manage routes");
    return;
  }
  const data = formData(event.target);
  const result = upsertRoute(state, data, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  sessionStorage.removeItem("edit_route_id");
  saveState();
  logAudit("Agent route saved", result.route.code);
  toast("Route saved");
  render();
}

function handleAgentAssign(event) {
  event.preventDefault();
  const data = formData(event.target);
  const ids = String(data.customerIds || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!ids.length) {
    toast("Enter at least one customer id");
    return;
  }
  const results = bulkAssignCustomers(state, ids, data.agentId, {
    reason: data.reason,
    approvedBy: currentUser()?.id || "",
    uid,
    logAudit
  });
  const ok = results.filter((item) => item.ok).length;
  saveState();
  toast(ok ? `Assigned ${ok} customer(s)` : results[0]?.error || "No customers assigned");
  render();
}

function handleAgentAttendance(event) {
  event.preventDefault();
  const data = formData(event.target);
  const agent = state.users.find((item) => item.id === data.agentId);
  if (!agent) return;
  const result = markAttendance(state, agent, { date: data.date, status: data.status, uid, actorId: currentUser()?.id || "" });
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast("Attendance saved");
  render();
}

function handleAgentLeave(event) {
  event.preventDefault();
  const data = formData(event.target);
  const agent = state.users.find((item) => item.id === data.agentId);
  if (!agent) return;
  const result = requestLeave(state, agent, data, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Leave requested", `${agent.name} · ${data.type}`);
  toast("Leave request submitted");
  render();
}

function handleLeaveDecision(leaveId, approved) {
  const result = decideLeave(state, leaveId, currentUser(), approved, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit(approved ? "Leave approved" : "Leave rejected", leaveId);
  toast(approved ? "Leave approved" : "Leave rejected");
  render();
}

function handleAgentVisit(event) {
  event.preventDefault();
  const data = formData(event.target);
  captureOptionalGps(currentUser()?.gpsEnabled).then((gps) => {
    const result = logVisit(state, { ...data, gps }, uid);
    if (result.error) {
      toast(result.error);
      return;
    }
    saveState();
    toast("Visit logged");
    render();
  });
}

function handleAgentDocument(event) {
  event.preventDefault();
  const form = event.target;
  const data = formData(form);
  const agent = state.users.find((item) => item.id === data.agentId);
  const file = form.querySelector('[name="file"]')?.files?.[0];
  if (!agent || !file) return;
  readOptionalCustomerFile(file).then((dataUrl) => {
    addAgentDocument(agent, { type: data.type, reference: data.reference, fileName: file.name, dataUrl }, uid);
    saveState();
    logAudit("Agent document uploaded", `${agent.name} · ${data.type}`);
    toast("Document uploaded");
    render();
  }).catch((error) => toast(error.message || "Could not upload document"));
}

function handleAgentNote(event) {
  event.preventDefault();
  const data = formData(event.target);
  const agent = state.users.find((item) => item.id === data.agentId);
  if (!agent) return;
  const result = addAgentNote(agent, { ...data, userId: currentUser()?.id || "", userName: currentUser()?.name || "" }, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast("Note saved");
  render();
}

function handleAgentTransfer(event) {
  event.preventDefault();
  const data = formData(event.target);
  const agent = state.users.find((item) => item.id === data.agentId);
  if (!agent) return;
  const result = transferAgentBranch(state, agent, data.branchId, {
    reason: data.reason,
    approvedBy: currentUser()?.id || "",
    uid,
    logAudit
  });
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  toast("Agent transferred");
  render();
}

function handleAgentStatus(status) {
  const agent = state.users.find((item) => item.id === sessionStorage.getItem("detail_agent_id"));
  if (!agent) return;
  if (!confirm(`Set ${agent.name} to ${status}?`)) return;
  const result = setAgentStatus(agent, status, currentUser(), uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Agent status changed", `${agent.name} · ${status}`);
  toast(`Status set to ${status}`);
  render();
}

function handleAgentExpense(event) {
  event.preventDefault();
  const data = formData(event.target);
  if (isAccountingPeriodClosed(state, data.date)) {
    toast("The accounting period is closed");
    return;
  }
  const result = createExpense(state, {
    ...data,
    recordedBy: data.agentId || currentUser()?.id || "",
    groupId: currentUser()?.groupId || "",
    status: canApproveAgentExpense(currentUser()) ? "Posted" : "Pending"
  }, uid);
  if (result.error) {
    toast(result.error);
    return;
  }
  saveState();
  logAudit("Agent expense submitted", `${data.category} · ${data.amount}`);
  toast(result.expense.status === "Posted" ? "Expense posted" : "Expense submitted for approval");
  render();
}

function exportCustomerStatementCsv(customerId) {
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return;
  const rows = statementRows(state.transactions, state.collections, customer.id);
  if (!rows.length) {
    toast("No statement rows");
    return;
  }
  downloadCsv(`${customer.accountNo || customer.customerNumber}-statement.csv`, rows);
}

function readOptionalCustomerFile(file) {
  if (!file) return Promise.resolve("");
  if (file.size > CUSTOMER_DOC_MAX_BYTES) return Promise.reject(new Error("File must be under 2 MB"));
  if (file.type && !CUSTOMER_DOC_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
    return Promise.reject(new Error("Use JPEG, PNG, or PDF"));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function handleCustomerDocument(event) {
  event.preventDefault();
  const form = event.target;
  const data = formData(form);
  const customer = state.customers.find((item) => item.id === data.customerId);
  const file = form.querySelector('[name="file"]')?.files?.[0];
  if (!customer || !file) return;
  readOptionalCustomerFile(file).then((dataUrl) => {
    const kycDoc = addKycDocument(customer, { type: data.type, reference: data.reference, fileName: file.name, dataUrl }, uid);
    indexCustomerKycDocument(state, customer, kycDoc, currentUser(), uid);
    appendCustomerActivity(customer, { action: "Document uploaded", detail: data.type, userId: currentUser()?.id || "", uid });
    saveState();
    logAudit("Customer document uploaded", `${customer.name} · ${data.type}`);
    toast("Document uploaded");
    render();
  }).catch((error) => toast(error.message || "Could not upload document"));
}

function handleCustomerAccount(event) {
  event.preventDefault();
  const data = formData(event.target);
  const customer = state.customers.find((item) => item.id === data.customerId);
  if (!customer || !data.productId) return;
  ensureSavingsAccount(state, customer, data.productId, uid);
  appendCustomerActivity(customer, { action: "Savings started", detail: savingsProductName(data.productId), userId: currentUser()?.id || "", uid });
  saveState();
  toast("Savings account added");
  render();
}

function handleCustomerMessage(event) {
  event.preventDefault();
  const data = formData(event.target);
  const customer = state.customers.find((item) => item.id === data.customerId);
  if (!customer) return;
  const body = String(data.body || "").trim();
  if (!body) {
    toast("Message text is required");
    return;
  }
  const channel = data.channel || "SMS";
  state.messages.push({
    id: uid("msg"),
    customerId: customer.id,
    phone: customer.whatsapp || customer.phone,
    date: today(),
    kind: data.templateId || "CRM",
    body,
    status: "Queued",
    channel
  });
  queueNotification(state, {
    event: data.templateId === "birthday" ? "birthday_wishes" : "missed_contribution",
    channel: channel === "Push" ? "In-App" : channel,
    customerId: customer.id,
    userId: currentUser()?.id || "",
    vars: { name: customer.name, date: today(), amount: "0", receiptNo: "", balance: String(customerBalance(customer.id)), dueDate: today(), groupName: groupName(customer.groupId) },
    uid
  });
  appendCustomerActivity(customer, { action: "Message queued", detail: channel, userId: currentUser()?.id || "", uid });
  saveState();
  if (channel === "WhatsApp") {
    const link = whatsappLink(customer.whatsapp || customer.phone, body);
    if (link) window.open(link, "_blank", "noopener");
  } else if (channel === "Email" && customer.email) {
    window.location.href = emailLink(customer.email, "Smile Trust Susu", body);
  } else if (channel === "SMS") {
    window.location.href = `sms:${customer.phone}?body=${encodeURIComponent(body)}`;
  }
  toast(`${channel} message queued`);
  render();
}

function shareCustomerStatement(channel) {
  const customer = state.customers.find((item) => item.id === sessionStorage.getItem("detail_customer_id"));
  if (!customer) return;
  const rows = statementRows(state.transactions, state.collections, customer.id);
  const closing = rows.length ? rows[rows.length - 1].balance : customerBalance(customer.id);
  const text = `Smile Trust statement for ${customer.name} (${customer.accountNo || customer.customerNumber}). Closing balance: ${money(closing)}.`;
  if (channel === "whatsapp") {
    const link = whatsappLink(customer.whatsapp || customer.phone, text);
    if (link) window.open(link, "_blank", "noopener");
    return;
  }
  if (customer.email) {
    window.location.href = emailLink(customer.email, "Smile Trust Statement", text);
    return;
  }
  toast("This customer has no email address");
}

function selectedCustomerIds() {
  return Array.from(document.querySelectorAll("[data-select-customer]:checked")).map((input) => input.dataset.selectCustomer);
}

function handleBulkCustomerAssign() {
  const ids = selectedCustomerIds();
  const agentId = document.querySelector("#bulkAgentId")?.value || "";
  const branchId = document.querySelector("#bulkBranchId")?.value || "";
  if (!ids.length) {
    toast("Select at least one customer");
    return;
  }
  if (!agentId && !branchId) {
    toast("Choose an agent or branch");
    return;
  }
  ids.forEach((id) => {
    const customer = state.customers.find((item) => item.id === id);
    if (!customer) return;
    if (agentId) customer.collectorId = agentId;
    if (branchId) customer.groupId = branchId;
    appendCustomerActivity(customer, { action: "Assignment updated", detail: `${agentId ? "agent" : ""} ${branchId ? "branch" : ""}`.trim(), userId: currentUser()?.id || "", uid });
  });
  saveState();
  logAudit("Customers reassigned", `${ids.length} records`);
  toast(`Updated ${ids.length} customer(s)`);
  render();
}

function handleBulkCustomerStatus(status) {
  const ids = selectedCustomerIds();
  if (!ids.length) {
    toast("Select at least one customer");
    return;
  }
  ids.forEach((id) => {
    const customer = state.customers.find((item) => item.id === id);
    if (customer) setCustomerStatus(customer, status, currentUser(), uid);
  });
  saveState();
  toast(`${status} ${ids.length} customer(s)`);
  render();
}

function handleBulkCustomerDelete() {
  if (!canHardDeleteCustomers(currentUser())) {
    toast("Only the system owner can delete customers");
    return;
  }
  const ids = selectedCustomerIds();
  if (!ids.length || !confirm(`Permanently delete ${ids.length} customer(s)? Members with financial records are skipped; close them instead.`)) return;
  let deleted = 0;
  ids.forEach((id) => {
    const customer = state.customers.find((item) => item.id === id);
    if (!customer || customerHasFinancialHistory(state, id)) return;
    tombstoneRecord("customers", customer);
    state.customers = state.customers.filter((item) => item.id !== id);
    deleted += 1;
  });
  saveState();
  pushCloudBackup(false);
  const skipped = ids.length - deleted;
  toast(skipped ? `Deleted ${deleted} customer(s); ${skipped} with financial history kept (close them instead)` : "Selected customers deleted");
  render();
}

function handleCustomerImport(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      toast("CSV needs a header row and data");
      return;
    }
    const headers = lines[0].split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    });
    const parsed = parseCustomerImportRows(rows);
    let created = 0;
    parsed.forEach((row) => {
      if (findDuplicateCustomers(state.customers, row).length) return;
      const groupId = primaryGroup()?.id || visibleGroups()[0]?.id;
      if (!groupId) return;
      const createdCustomer = {
        id: uid("cust"),
        name: row.name,
        phone: row.phone,
        ghanaCard: row.ghanaCard,
        email: row.email,
        accountNo: row.accountNo || nextAccountNo(groupId),
        groupId,
        collectorId: resolveCollectorForRegistration(currentUser(), groupById(groupId), state.users),
        memberStatus: "Pending Verification",
        createdAt: new Date().toISOString()
      };
      applyCustomerKyc(createdCustomer, row);
      applyCustomerCrm(createdCustomer, row);
      ensureCustomerNumber(createdCustomer, state.customers);
      state.customers.push(createdCustomer);
      created += 1;
    });
    saveState();
    toast(created ? `Imported ${created} customer(s)` : "No new customers imported (duplicates skipped)");
    render();
  };
  reader.readAsText(file);
}

function bindRegionDistrictCascade(form) {
  if (!form) return;
  const regionSelect = form.querySelector("#customerRegionSelect") || form.querySelector('select[name="region"]');
  const districtSelect = form.querySelector("#customerDistrictSelect") || form.querySelector('select[name="district"]');
  if (!regionSelect || !districtSelect || regionSelect.dataset.cascadeBound === "1") return;
  regionSelect.dataset.cascadeBound = "1";
  regionSelect.addEventListener("change", () => {
    const previous = districtSelect.value;
    districtSelect.innerHTML = districtSelectOptionsHtml(regionSelect.value, "", escapeAttr);
    if (previous && [...districtSelect.options].some((opt) => opt.value === previous)) {
      districtSelect.value = previous;
    }
  });
}

function syncMemberSignatureFromPad(form) {
  const canvas = form?.querySelector?.("#memberSignaturePad");
  const hidden = form?.querySelector?.("#memberSignatureData") || form?.querySelector?.('[name="signatureData"]');
  if (!canvas || !hidden) return;
  if (canvas.dataset.hasInk === "1") {
    try {
      hidden.value = canvas.toDataURL("image/png");
    } catch {
      /* ignore */
    }
  }
}

function initMemberSignaturePad(form) {
  if (!form) return;
  const canvas = form.querySelector("#memberSignaturePad");
  const hidden = form.querySelector("#memberSignatureData") || form.querySelector('[name="signatureData"]');
  const clearBtn = form.querySelector("#clearMemberSignature");
  const preview = form.querySelector("#memberSignaturePreview");
  if (!canvas || !hidden || canvas.dataset.padReady === "1") return;
  canvas.dataset.padReady = "1";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const resize = () => {
    const wrap = canvas.parentElement;
    const cssWidth = Math.max(280, Math.floor(wrap?.clientWidth || canvas.clientWidth || 640));
    const cssHeight = 180;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const existing = hidden.value && String(hidden.value).startsWith("data:image/") ? hidden.value : "";
    canvas.width = Math.floor(cssWidth * ratio);
    canvas.height = Math.floor(cssHeight * ratio);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#102a43";
    ctx.lineWidth = 2.25;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    if (existing) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
        canvas.dataset.hasInk = "1";
      };
      img.src = existing;
    } else {
      canvas.dataset.hasInk = "0";
    }
  };

  const pointFromEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    const source = event.touches?.[0] || event.changedTouches?.[0] || event;
    return {
      x: source.clientX - rect.left,
      y: source.clientY - rect.top
    };
  };

  let drawing = false;
  const start = (event) => {
    event.preventDefault();
    drawing = true;
    const point = pointFromEvent(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };
  const move = (event) => {
    if (!drawing) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    canvas.dataset.hasInk = "1";
  };
  const end = (event) => {
    if (!drawing) return;
    event?.preventDefault?.();
    drawing = false;
    if (canvas.dataset.hasInk === "1") {
      hidden.value = canvas.toDataURL("image/png");
      if (preview) {
        preview.src = hidden.value;
        preview.hidden = false;
        preview.removeAttribute("hidden");
      }
    }
  };

  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointerleave", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end, { passive: false });
  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseup", end);
  canvas.addEventListener("mouseleave", end);

  clearBtn?.addEventListener("click", () => {
    const wrap = canvas.parentElement;
    const cssWidth = Math.max(280, Math.floor(wrap?.clientWidth || 640));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssWidth, 180);
    canvas.dataset.hasInk = "0";
    hidden.value = "";
    if (preview) {
      preview.removeAttribute("src");
      preview.hidden = true;
    }
  });

  resize();
  if (!canvas.dataset.resizeBound) {
    canvas.dataset.resizeBound = "1";
    window.addEventListener("resize", () => {
      if (!document.body.contains(canvas)) return;
      syncMemberSignatureFromPad(form);
      resize();
    });
  }
}

function initCustomerWizard(form) {
  if (!form || form.dataset.wizardReady) return;
  const kids = [...form.children];
  if (kids.length < 8) return;
  const steps = bucketCrmWizardSteps(kids);
  if (steps.length < 2) return;
  form.dataset.wizardReady = "1";
  form.dataset.wizardSteps = String(steps.length);
  document.body.classList.add("member-wizard-open");
  const wraps = steps.map((nodes, index) => {
    const wrap = document.createElement("div");
    wrap.className = "crm-wizard-step full";
    wrap.dataset.wizardIndex = String(index);
    wrap.hidden = index > 0;
    nodes.forEach((node) => wrap.appendChild(node));
    form.appendChild(wrap);
    return wrap;
  });
  const progressTop = document.createElement("div");
  progressTop.className = "crm-wizard-progress-top full";
  progressTop.setAttribute("aria-live", "polite");
  progressTop.innerHTML = `Step <b id="crmWizardStep">1</b> of <b id="crmWizardTotal">${wraps.length}</b>`;
  form.insertBefore(progressTop, form.firstChild);
  const nav = document.createElement("div");
  nav.className = "crm-wizard-nav full form-sticky-actions";
  nav.innerHTML = `<button class="btn ghost" type="button" id="crmWizardPrev" hidden>Back</button><button class="btn collector-action-btn" type="button" id="crmWizardNext">Next</button>`;
  form.appendChild(nav);
  let current = 0;
  const progressStep = () => form.querySelector("#crmWizardStep");
  const progressTotal = () => form.querySelector("#crmWizardTotal");
  const show = (index, { validate = false } = {}) => {
    const nextIndex = Math.min(Math.max(0, index), wraps.length - 1);
    if (validate && nextIndex > current) {
      const invalid = requiredFieldsInStep(wraps[current]).find((el) => !el.checkValidity());
      if (invalid) {
        invalid.reportValidity();
        invalid.focus({ preventScroll: false });
        invalid.scrollIntoView({ block: "center", behavior: "smooth" });
        return false;
      }
    }
    current = nextIndex;
    wraps.forEach((wrap, i) => { wrap.hidden = i !== current; });
    if (progressStep()) progressStep().textContent = String(current + 1);
    if (progressTotal()) progressTotal().textContent = String(wraps.length);
    const prev = form.querySelector("#crmWizardPrev");
    const next = form.querySelector("#crmWizardNext");
    if (prev) prev.hidden = current === 0;
    if (next) next.hidden = current === wraps.length - 1;
    const submitWrap = form.querySelector("[type=submit]")?.closest(".form-actions");
    if (submitWrap) submitWrap.hidden = current !== wraps.length - 1;
    form.querySelector("[type=submit]")?.classList.toggle("crm-wizard-submit", current === wraps.length - 1);
    progressTop.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return true;
  };
  form.querySelector("#crmWizardPrev")?.addEventListener("click", () => show(current - 1));
  form.querySelector("#crmWizardNext")?.addEventListener("click", () => show(current + 1, { validate: true }));
  show(0);
}

function bindCustomerDraft(form) {
  if (!form || form.querySelector('[name="id"]')) return;
  try {
    const draft = JSON.parse(localStorage.getItem(CUSTOMER_REG_DRAFT_KEY) || "null");
    if (draft?.name && !form.querySelector('[name="name"]')?.value) {
      ["name", "phone", "ghanaCard", "email", "homeAddress", "occupation", "employer", "nextOfKin", "businessType", "town"].forEach((key) => {
        if (draft[key] && form.elements[key]) form.elements[key].value = draft[key];
      });
    }
  } catch { /* ignore */ }
  form.addEventListener("input", () => {
    try {
      const draft = customerRegistrationDraftFromFormData(new FormData(form));
      localStorage.setItem(CUSTOMER_REG_DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
    } catch {
      try { localStorage.removeItem(CUSTOMER_REG_DRAFT_KEY); } catch { /* ignore */ }
    }
  });
}

function bindCustomerMessagePreview() {
  const form = document.querySelector("#customerMessageForm");
  if (!form) return;
  const select = form.querySelector('[name="templateId"]');
  const body = form.querySelector('[name="body"]');
  const link = document.querySelector("#customerWhatsAppLink");
  const customer = state.customers.find((item) => item.id === sessionStorage.getItem("detail_customer_id"));
  const sync = () => {
    const template = CRM_MESSAGE_TEMPLATES.find((item) => item.id === select.value);
    if (template && body && !body.dataset.touched) body.value = template.body;
    if (link && customer) link.href = whatsappLink(customer.whatsapp || customer.phone, body?.value || "") || "#";
  };
  body?.addEventListener("input", () => { body.dataset.touched = "1"; sync(); });
  select?.addEventListener("change", sync);
  sync();
}

function printDailyInputLog() {
  const selectedDate = sessionStorage.getItem("log_date") || today();
  openPrintWindow(renderCollectorSheet({
    date: selectedDate,
    rows: buildCollectorRows(state.collections, state.customers, customerBalance, money, selectedDate)
  }));
}

async function importFileRecords(file, kind, groupId) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
    return importWorkbook(file, groupId);
  }
  const text = await extractDocumentText(file);
  const rows = rowsFromText(text);
  if (!rows.length) throw new Error("No readable table rows were found.");
  if (kind === "savings") return importSavingsRows(rows, groupId, "PDF/DOCX savings import");
  if (kind === "loans") return importLoanRows(rows, groupId, "PDF/DOCX loan import");
  if (kind === "log") return importLogRows(rows, groupId, "PDF/DOCX log import");
  return importSavingsRows(rows, groupId, "Auto text import treated as savings");
}

async function importWorkbook(file, groupId) {
  if (!window.XLSX) throw new Error("Excel parser is not ready.");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const result = { savings: 0, loans: 0, logs: 0, note: "Excel sheets were detected by sheet name." };
  workbook.SheetNames.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
    const key = sheetName.toLowerCase();
    if (key.includes("loan")) {
      const imported = importLoanRows(rows, groupId, sheetName);
      result.loans += imported.loans;
    } else if (key.includes("log")) {
      const imported = importLogRows(rows, groupId, sheetName);
      result.logs += imported.logs;
    } else {
      const imported = importSavingsRows(rows, groupId, sheetName);
      result.savings += imported.savings;
    }
  });
  return result;
}

async function ensurePdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  const pdfjsLib = await import("./vendor/pdf.min.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";
  window.pdfjsLib = pdfjsLib;
  return pdfjsLib;
}

async function extractDocumentText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    if (!window.mammoth) throw new Error("Word parser is not ready.");
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (name.endsWith(".pdf")) {
    const pdfjsLib = await ensurePdfJs();
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return pages.join("\n");
  }
  return file.text();
}

function rowsFromText(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitImportLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitImportLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
  });
}

function splitImportLine(line) {
  return line.split(/\t|,|\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
}

function importSavingsRows(rows, groupId, source) {
  let count = 0;
  rows.forEach((row) => {
    const amount = numberValue(row, ["amount", "contribution", "paid", "payment"]);
    const total = numberValue(row, ["total", "total amount", "total contributed", "balance"]);
    const value = amount || total;
    const name = textValue(row, ["name", "full name", "member", "customer"]);
    if (!name || !value) return;
    const customer = ensureCustomerFromRow(row, groupId, value);
    const date = dateValue(row) || today();
    const collection = {
      id: uid("col"),
      customerId: customer.id,
      groupId,
      contributionNo: nextContributionNo(customer.id),
      amount: value,
      date,
      status: "Paid",
      note: `Imported from ${source}`,
      userId: currentUser().id
    };
    state.collections.push(collection);
    addTransaction("Susu Deposit", customer.id, value, collection.id, date);
    createPaymentMessage(customer.id, value, date);
    count += 1;
  });
  return { savings: count, loans: 0, logs: 0, note: `${count} savings rows imported.` };
}

function importLoanRows(rows, groupId, source) {
  let count = 0;
  rows.forEach((row) => {
    const principal = numberValue(row, ["principal", "amount", "loan", "borrowed"]);
    const name = textValue(row, ["name", "full name", "member", "customer"]);
    if (!name || !principal) return;
    const customer = ensureCustomerFromRow(row, groupId, 0);
    const group = groupById(groupId);
    const interest = numberValue(row, ["interest", "rate", "percentage"]) || group?.interest || state.settings.loanInterest;
    const interestMonths = numberValue(row, ["interest months", "months", "interest period"]) || 1;
    const totalDue = numberValue(row, ["total", "total due", "repay", "repayment"]) || principal + ((principal * interest) / 100) * interestMonths;
    const amountPaid = numberValue(row, ["paid", "amount paid", "repaid"]) || 0;
    const date = dateValue(row) || today();
    const loan = {
      id: uid("loan"),
      customerId: customer.id,
      groupId,
      principal,
      interest,
      termDays: interestMonths * 30,
      interestMonths,
      purpose: `Imported from ${source}`,
      totalDue,
      amountPaid,
      status: amountPaid >= totalDue ? "Completed" : "Active",
      date,
      approvedBy: currentUser().id
    };
    state.loans.push(loan);
    addTransaction("Loan Disbursement", customer.id, principal, loan.id, date);
    if (amountPaid > 0) addTransaction("Loan Repayment", customer.id, amountPaid, loan.id, date);
    count += 1;
  });
  return { savings: 0, loans: count, logs: 0, note: `${count} loan rows imported.` };
}

function importLogRows(rows, groupId, source) {
  let count = 0;
  rows.forEach((row) => {
    const action = textValue(row, ["action", "activity", "type", "log"]) || "Imported log";
    const details = textValue(row, ["details", "description", "note", "remarks"]) || textValue(row, ["name", "member", "customer"]);
    recordAuditEvent(state, {
      action,
      details: `${details || ""} (${source})`,
      userId: currentUser().id,
      groupIds: [groupId],
      date: dateValue(row) || new Date().toLocaleString(),
      createdAt: new Date().toISOString()
    }, uid);
    count += 1;
  });
  return { savings: 0, loans: 0, logs: count, note: `${count} log rows imported.` };
}

function ensureCustomerFromRow(row, groupId, amount) {
  const name = textValue(row, ["name", "full name", "member", "customer"]);
  const phone = textValue(row, ["phone", "telephone", "mobile", "contact"]);
  const nhis = textValue(row, ["nhis", "nhis number", "health insurance"]);
  let customer = state.customers.find((item) => item.groupId === groupId && item.name.toLowerCase() === name.toLowerCase());
  if (!customer) {
    customer = {
      id: uid("cust"),
      accountNo: nextAccountNo(groupId),
      name,
      phone,
      nhis,
      address: "",
      groupId,
      dailyAmount: amount || groupById(groupId)?.defaultAmount || 0,
      collectorId: currentUser().id,
      active: true,
      createdAt: new Date().toISOString()
    };
    state.customers.push(customer);
  }
  return customer;
}

function textValue(row, names) {
  const match = Object.keys(row).find((key) => names.includes(normalizeHeader(key)));
  return match ? String(row[match]).trim() : "";
}

function numberValue(row, names) {
  const raw = textValue(row, names).replace(/[^\d.-]/g, "");
  return Number(raw) || 0;
}

function dateValue(row) {
  const raw = textValue(row, ["date", "day", "created", "payment date"]);
  if (!raw) return "";
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? String(raw) : date.toISOString().slice(0, 10);
}

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function visibleClosings() {
  if (isKBA()) return state.closings || [];
  const groups = visibleGroupIds();
  return (state.closings || []).filter((closing) => groups.includes(closing.groupId));
}

function expectedCashForDate(date) {
  const types = ["Susu Deposit", "Loan Repayment", "Interest Payment"];
  return visibleTransactions()
    .filter((tx) => tx.date === date && types.includes(tx.type))
    .filter((tx) => {
      if (tx.type !== "Susu Deposit") return true;
      const collection = state.collections.find((item) => item.id === tx.ref);
      if (!collection) return true;
      return collectionPaymentMethod(collection) === "Cash" && collectionVerificationStatus(collection) === "Verified";
    })
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

function backupDoneToday() {
  return String(state.settings.lastBackupAt || "").slice(0, 10) === today();
}

function groupById(id) {
  return state.groups.find((group) => group.id === id);
}

function groupName(id) {
  return groupById(id)?.name || "No location";
}

function groupSummary(groupId) {
  const members = state.customers.filter((customer) => customer.groupId === groupId);
  const contributed = state.transactions
    .filter((tx) => tx.type === "Susu Deposit" && members.some((member) => member.id === tx.customerId))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const group = groupById(groupId);
  const target = group?.targetContributions || state.settings.collectionDays;
  const expected = members.reduce((sum, member) => sum + perSittingAmount(member) * target, 0);
  return { members: members.length, contributed, expected };
}

function memberProgress(customerId) {
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return "-";
  if (!customerHasSusuAccount(customer)) {
    const balance = personalSavingsBalance(customerId, { collections: state.collections, transactions: state.transactions });
    return balance > 0 ? money(balance) : "-";
  }
  const summary = memberSittingSummary(customerId);
  if (!summary.isSusu) return "-";
  return `${summary.paid} / ${summary.target} sittings`;
}

function memberSittingSummary(customerId) {
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer || !customerHasSusuAccount(customer)) {
    return {
      isSusu: false,
      target: 0,
      paid: 0,
      remaining: 0,
      perSitting: 0,
      expectedAmount: 0,
      paidAmount: 0,
      remainingAmount: 0
    };
  }
  const group = groupById(customer.groupId);
  const target = Number(customer.collectionDays) || group?.targetContributions || state.settings.collectionDays;
  const paid = state.collections
    .filter((item) => item.customerId === customerId && Number(item.amount) > 0 && Number(item.sittingsPaid || 0) > 0)
    .reduce((sum, item) => sum + Number(item.sittingsPaid || 0), 0);
  const perSitting = perSittingAmount(customer);
  const remaining = Math.max(0, target - paid);
  return {
    isSusu: true,
    target,
    paid,
    remaining,
    perSitting,
    expectedAmount: target * perSitting,
    paidAmount: paid * perSitting,
    remainingAmount: remaining * perSitting
  };
}

function printClosingById(id) {
  const closing = state.closings.find((item) => item.id === id);
  if (closing) printClosing(closing.date, closing);
}

function printClosing(date, row = null) {
  const closing = row || visibleClosings().find((item) => item.date === date);
  const txs = buildControlRows(visibleTransactions(), money, date);
  if (closing) {
    txs.push({
      date,
      details: `Daily closing - expected ${money(closing.expected ?? expectedCashForDate(date))}, counted ${money(closing.counted || 0)}`,
      debit: Number(closing.counted || 0) < Number(closing.expected ?? expectedCashForDate(date)) ? money(Number(closing.expected ?? expectedCashForDate(date)) - Number(closing.counted || 0)) : "",
      credit: Number(closing.counted || 0) > Number(closing.expected ?? expectedCashForDate(date)) ? money(Number(closing.counted || 0) - Number(closing.expected ?? expectedCashForDate(date))) : ""
    });
  }
  openPrintWindow(renderControlSheet({ date, transactions: txs }));
}

function nextContributionNo(customerId) {
  const paid = state.collections
    .filter((item) => item.customerId === customerId && Number(item.amount) > 0)
    .reduce((sum, item) => sum + Number(item.sittingsPaid || item.contributionNo || 0), 0);
  return paid + 1;
}

function calculateSittingsPaid(customer, amount) {
  const sitting = perSittingAmount(customer);
  if (!sitting) return 0;
  return Math.max(0, Math.floor(Number(amount || 0) / sitting));
}

function groupSelect(name, selectedId = "", includeBlank = false) {
  const active = visibleGroups().filter((group) => group.active);
  const blank = includeBlank ? `<option value="">Unassigned</option>` : "";
  if (!active.length) return `<select name="${name}" ${includeBlank ? "" : "required"}><option value="">Create a susu location first</option></select>`;
  return `<select name="${name}" ${includeBlank ? "" : "required"}>${blank}${active.map((group) => `<option value="${group.id}" ${group.id === selectedId ? "selected" : ""}>${escapeHtml(group.name)} · every ${group.intervalDays} day(s)</option>`).join("")}</select>`;
}

function adminSelect(name, selectedId = "") {
  const admins = state.users.filter((user) => user.active && ["Admin", "Collector"].includes(user.role));
  if (!admins.length) return `<select name="${name}" required><option value="">Create a staff user first</option></select>`;
  return `<select name="${name}" required>${admins.map((user) => `<option value="${user.id}" ${user.id === selectedId ? "selected" : ""}>${escapeHtml(user.name)} · ${user.role}</option>`).join("")}</select>`;
}

function customerSelect(name, selectedId = "") {
  const active = visibleCustomers().filter((c) => c.active);
  if (!active.length) return `<select name="${name}" required><option value="">No customers yet</option></select>`;
  return `<select name="${name}" required>${active.map((c) => `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${escapeHtml(c.accountNo)} · ${escapeHtml(c.name)} · ${escapeHtml(groupName(c.groupId))}</option>`).join("")}</select>`;
}

function userSelect(name, includeBlank = false) {
  const staff = listUsersForActor(state.users, currentUser()).filter((u) => u.active && ["SystemOwner", "Admin", "Collector"].includes(u.role) && !isSystemDeveloperAccount(u));
  return `<select name="${name}">${includeBlank ? `<option value="">Unassigned</option>` : ""}${staff.map((u) => `<option value="${u.id}">${escapeHtml(u.name)} · ${u.role}</option>`).join("")}</select>`;
}

function loanSelect(name, selected = "") {
  const activeLoans = visibleLoans().filter((loan) => loanAcceptsRepayment(loan.status));
  const selectedLoan = selected ? visibleLoans().find((loan) => loan.id === selected) : null;
  const loans = selectedLoan && !activeLoans.some((loan) => loan.id === selectedLoan.id) ? [selectedLoan, ...activeLoans] : activeLoans;
  if (!loans.length) return `<select name="${name}" required><option value="">No active loans</option></select>`;
  return `<select name="${name}" required>${loans.map((loan) => `<option value="${loan.id}" ${selected === loan.id ? "selected" : ""}>${escapeHtml(customerName(loan.customerId))} - Balance ${money(loan.totalDue - loan.amountPaid)}</option>`).join("")}</select>`;
}

function customerName(id) {
  return state.customers.find((c) => c.id === id)?.name || "Unknown";
}

function userName(id) {
  return displayUserNameForActor(state.users, id, currentUser(), "Unassigned");
}

function exportCsv(type) {
  const rows = {
    groups: visibleGroups(),
    collections: visibleCollections(),
    loans: visibleLoans(),
    repayments: visibleTransactions().filter((tx) => tx.type === "Loan Repayment"),
    transactions: visibleTransactions(),
    messages: visibleMessages(),
    audit: visibleAudit(),
    closings: visibleClosings(),
    arrears: arrearsRows(),
    dailyLog: dailyMoneyLogRows(),
    dailyInputs: dailyInputLogRows(),
    memberReport: memberFinancialReportRows(),
    distribution: distributionRows()
  }[type];
  if (!rows?.length) {
    toast("Nothing to export");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(","))].join("\n");
  download(`${type}-${today()}.csv`, csv, "text/csv");
}

function exportBackup() {
  state.settings.lastBackupAt = new Date().toISOString();
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  download(`smile-trust-backup-${today()}.json`, JSON.stringify(state, null, 2), "application/json");
  createBackupSet(state, { type: "full", source: "manual_export" }, currentUser(), uid);
  saveState();
}

function restoreBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = normalizeState(mergeStates(state, JSON.parse(reader.result)));
      sessionStorage.removeItem(SESSION_USER_KEY);
      sessionUserId = null;
      toast("Backup merged");
      render();
    } catch {
      toast("Could not restore this backup file");
    }
  };
  reader.readAsText(file);
}

let cloudPushInFlight = false;
let cloudPushQueued = false;
let lastBackgroundSyncNotice = "";

async function pushCloudBackup(silent = false) {
  if (cloudUploadsPaused()) {
    if (!silent) toast("Cloud uploads are paused on this device after the initial cloud snapshot. Close and reopen the app before syncing.");
    return false;
  }
  if (cloudPushInFlight || syncBusy) {
    cloudPushQueued = true;
    if (!cloudPushInFlight) queueCloudBackup();
    return false;
  }
  cloudPushInFlight = true;
  // The push swaps in a merged copy of state; edits made while it is uploading
  // land on this object and must be merged back or they are silently lost.
  const localState = state;
  const localStamp = localState.updatedAt;
  let pushed = false;
  syncToApp();
  try {
    pushed = Boolean(await pushRemoteBackup(silent));
    syncFromApp();
    lastBackgroundSyncNotice = "";
    if (!silent) {
      logAudit("Cloud backup pushed", businessId());
      toast("Cloud backup saved");
    }
  } catch (error) {
    syncFromApp();
    if (!silent) toast(error.code === CLOUD_BOOTSTRAP_REQUIRED ? error.message : `Cloud backup failed: ${error.message}`);
    else if ((error.code === CLOUD_UPDATE_REFUSED || error.code === CLOUD_UPDATE_CONFLICT) && error.message !== lastBackgroundSyncNotice) {
      lastBackgroundSyncNotice = error.message;
      toast(`Cloud sync stopped: ${error.message}`);
    }
  } finally {
    cloudPushInFlight = false;
    const editedDuringPush = localState !== state && localState.updatedAt !== localStamp;
    if (editedDuringPush) {
      const merged = mergeStates(localState, state);
      merged.users = restoreUsersFromCloud(localState.users, merged.users);
      state = normalizeState(merged);
      saveState();
      syncToApp();
    } else if (cloudPushQueued) {
      queueCloudBackup();
    }
    cloudPushQueued = false;
  }
  return pushed;
}

async function pullCloudBackup() {
  if (!confirm("Merge cloud backup with local data?")) return;
  try {
    await restoreCloudBackupFromCloud();
    toast("Cloud backup merged");
    render();
  } catch (error) {
    toast(`Cloud restore failed: ${error.message}`);
  }
}

async function replaceCloudBackup() {
  if (!confirm("Replace this device with cloud data? This will keep a hidden local backup but the app will show the cloud/EXE data.")) return;
  try {
    await replaceFromCloud({ keepView: true });
    localStorage.setItem(ANDROID_CLOUD_PRIMARY_KEY, "true");
    toast("This device now uses cloud data");
    render();
  } catch (error) {
    toast(`Cloud replace failed: ${error.message}`);
  }
}

async function createInitialCloudSnapshotFlow() {
  if (!canWriteSnapshot(currentUser()?.role)) {
    toast("Only a manager can create the initial cloud snapshot");
    return;
  }
  syncToApp();
  let summary;
  try {
    toast("Loading business data from the database...");
    summary = await loadVerifiedBootstrap(state);
  } catch (error) {
    toast(`Initial cloud snapshot not created: ${error.message}`);
    return;
  }
  const explanation = [
    `Create the first authoritative cloud copy of ${summary.businessCode}?`,
    "",
    "It is built only from the database load just completed:",
    `members ${summary.members}, staff ${summary.staff}, groups ${summary.groups}, collections ${summary.collections}, savings products ${summary.savingsProducts}.`,
    "",
    "Data already on this device is NOT uploaded. This device will switch to the new cloud copy (a local backup is kept).",
    "Every device will synchronize from this copy afterwards."
  ].join("\n");
  if (!confirm(explanation)) {
    discardVerifiedBootstrap();
    return;
  }
  const typed = prompt(`Type ${summary.businessCode} to create the initial cloud snapshot.`);
  if (typed === null) {
    discardVerifiedBootstrap();
    return;
  }
  try {
    const result = await createInitialCloudSnapshot({ confirmation: typed.trim() }, state);
    try {
      localStorage.setItem("smile_trust_susu_local_backup_before_bootstrap", JSON.stringify(state));
    } catch {
      // The device copy is replaced below either way; the cloud copy is now authoritative.
    }
    state = normalizeState(deviceStateAfterBootstrap(state, result.state));
    applyUnifiedCloudDefaults(state, getAppConfig());
    state.settings.lastSyncedAt = result.savedAt;
    logAudit("Initial cloud snapshot created", `${summary.businessCode}: ${summary.members} members, ${summary.staff} staff`, { skipSave: true });
    clearTimeout(syncTimer);
    saveState();
    localSavePending = false;
    syncToApp();
    toast("Initial cloud snapshot created. Cloud uploads stay paused on this device until the app is reopened.");
    render();
  } catch (error) {
    toast(`Initial cloud snapshot not created: ${error.message}`);
  }
}





async function latestCloudSnapshot() {
  syncToApp();
  const snapshot = await latestRemoteSnapshot();
  syncFromApp();
  return snapshot;
}

async function restoreCloudBackupFromCloud(options = {}) {
  syncToApp();
  const snapshot = await restoreRemoteBackup(options);
  syncFromApp();
  return snapshot;
}

async function replaceFromCloud(options = {}) {
  syncToApp();
  const snapshot = await replaceFromCloudRemote(options);
  syncFromApp();
  return snapshot;
}

async function connectLoginSync() {
  syncToApp();
  const notice = document.querySelector("#loginSyncNotice");
  if (notice) notice.innerHTML = `<div class="notice">Syncing business data...</div>`;
  try {
    await loadUnifiedBusinessData();
    syncToApp();
    if (notice) notice.innerHTML = `<div class="notice good">Business data synced. Sign in with your account.</div>`;
    render();
  } catch (error) {
    if (notice) notice.innerHTML = `<div class="notice">Sync failed: ${escapeHtml(error.message)}</div>`;
  }
}

async function replaceLoginSync() {
  syncToApp();
  const ok = await replaceLoginSyncRemote();
  syncFromApp();
  if (ok) {
    localStorage.setItem(ANDROID_CLOUD_PRIMARY_KEY, "true");
    toast("Device data replaced from cloud");
    render();
  }
}

async function syncNow() {
  try {
    await flushOfflineQueueNow();
    await loadUnifiedBusinessData();
    syncToApp();
    await pushCloudBackup(false);
    syncFromApp();
    toast("Local and cloud data synced");
    render();
  } catch (error) {
    toast(`Sync failed: ${error.message}`);
  }
}

async function loadUnifiedBusinessData() {
  applyUnifiedCloudDefaults(state, getAppConfig());
  const before = JSON.stringify({
    customers: state.customers?.length || 0,
    collections: state.collections?.length || 0,
    users: state.users?.length || 0
  });
  try {
    const snapshot = await latestCloudSnapshot();
    if (snapshot?.payload) {
      const merged = mergeStates(state, snapshot.payload);
      merged.users = restoreUsersFromCloud(state.users, merged.users);
      state = normalizeState(merged);
      state.settings.lastSyncedAt = snapshot.saved_at || new Date().toISOString();
    }
  } catch {
    // Cloud unavailable; continue with local/postgres data.
  }
  if (postgresSourceEnabled(state)) {
    try {
      await loadStateFromRelational(state);
      state = normalizeState(state);
    } catch {
      // PostgreSQL enrich is optional when cloud snapshot exists.
    }
  }
  applyUnifiedCloudDefaults(state, getAppConfig());
  const shrunk = await shrinkStateMedia(state);
  await persistStateWithMediaShrink();
  localSavePending = shrunk > 0;
  if (shrunk) queueCloudBackup();
  const after = JSON.stringify({
    customers: state.customers?.length || 0,
    collections: state.collections?.length || 0,
    users: state.users?.length || 0
  });
  return before !== after;
}

async function autoCloudMerge() {
  if (syncBusy || cloudPushInFlight || isFormInteractionActive()) return;
  if (localSavePending) {
    await pushCloudBackup(true);
    return;
  }
  syncBusy = true;
  try {
    const changed = await loadUnifiedBusinessData();
    syncToApp();
    if (changed && currentUser() && !isFormInteractionActive()) render();
  } catch {
    // Offline or cloud unavailable; local data remains usable.
  } finally {
    syncBusy = false;
    if (isAndroidRuntime()) processPhoneGatewayQueue();
  }
  try {
    if (await ingestPendingPortalRequests() && currentUser() && !isFormInteractionActive()) render();
  } catch {
    // Portal requests stay pending on the server and are retried next cycle.
  }
}

const PORTAL_INGEST_INTERVAL_MS = 60000;
let lastPortalIngestAt = 0;

async function ingestPendingPortalRequests() {
  const user = currentUser();
  if (!user || !hasStaffCloudSession(user.id)) return false;
  if (Date.now() - lastPortalIngestAt < PORTAL_INGEST_INTERVAL_MS) return false;
  lastPortalIngestAt = Date.now();
  const result = await ingestPortalRequests(state, (row, withdrawalId) => {
    const customer = state.customers.find((item) => item.id === row.customer_id);
    const created = createWithdrawalRequest(state, {
      customerId: customer.id,
      groupId: customer.groupId,
      amount: Number(row.amount_pesewas || 0) / 100,
      amountPesewas: Number(row.amount_pesewas || 0),
      availableBalance: portalAccountBalance(state, customer.id),
      reason: row.reason || "",
      requestedBy: customer.id,
      date: String(row.created_at || "").slice(0, 10) || today()
    }, () => withdrawalId);
    if (!created.error) {
      queueNotification(state, {
        event: "withdrawal_approved",
        channel: "In-App",
        customerId: customer.id,
        vars: { name: customer.name, amount: (Number(row.amount_pesewas || 0) / 100).toFixed(2) },
        uid
      });
    }
    return created;
  });
  if (!result.ok || !result.ids.length) return false;
  if (result.created) saveState();
  // The server copy must contain these requests before they leave the pending queue.
  if (!(await pushCloudBackup(true))) return result.created > 0;
  await markPortalRequestsIngested(state, result.ids);
  return result.created > 0;
}

async function ensureWave4ShellReady() {
  try {
    ensureWave4SyncState(state);
    await initCapacitorShell(state, {
      fingerprint: typeof deviceFingerprint === "function" ? deviceFingerprint() : "",
      agentId: currentUser()?.id || "",
      screenshotProtection: true
    });
    await initElectronShell(state, {
      fingerprint: typeof deviceFingerprint === "function" ? deviceFingerprint() : "",
      agentId: currentUser()?.id || "",
      appVersion: state?.settings?.appVersion || ""
    });
    if (typeof window !== "undefined") {
      window.__SMILE_TRUST_BACKGROUND_SYNC__ = () => { void flushOfflineQueueNow(); };
    }
  } catch {
    /* shell optional on web */
  }
}

function startAutoCloudSync() {
  void ensureWave4ShellReady();
  startRemoteAutoSync(autoCloudMerge);
  autoSyncTimer = App.autoSyncTimer;
}

function download(filename, content, type) {
  if (isElectronRuntime()) {
    void desktopExportFile({ filename, content, type }).then((res) => {
      if (res && res.ok === false && !res.cancelled) {
        // Fall through to browser download if bridge refuses
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }
    });
    return;
  }
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

async function seedFromPackagedBackup() {
  if (hasBusinessData() || localStorage.getItem(SEED_LOADED_KEY) === "true") return;
  try {
    const response = await fetch("assets/seed-data.json", { cache: "no-store" });
    if (!response.ok) throw new Error("No seed data");
    const payload = await response.json();
    const seeded = normalizeState(payload.data || payload);
    if (!hasBusinessData(seeded)) return;
    state = seeded;
    localStorage.setItem(SEED_LOADED_KEY, "true");
  } catch {
    localStorage.setItem(SEED_LOADED_KEY, "true");
  }
}

async function bootstrapFromCloud() {
  await loadUnifiedBusinessData();
}

async function finishStartupTasks() {
  try {
    applyUnifiedCloudDefaults(state, getAppConfig());
    await persistStateWithMediaShrink();
    const unified = unifiedCloudEnabled(state, getAppConfig());
    if (!unified) {
      await seedFromPackagedBackup();
    }
    if (unified || postgresSourceEnabled(state)) {
      await loadUnifiedBusinessData();
      syncToApp();
    } else if (!hasBusinessData()) {
      try {
        await restoreCloudBackupFromCloud();
      } catch {
        // Login page still offers manual cloud restore.
      }
    } else {
      await bootstrapFromCloud();
    }
    if (hasBusinessData()) queueCloudBackup();
    if (isAndroidRuntime()) {
      processPhoneGatewayQueue();
      if (!gatewayTimer) gatewayTimer = setInterval(processPhoneGatewayQueue, 8000);
    }
    const cancelled = cancelPendingMessagesOnce();
    if (cancelled) {
      saveState();
      pushCloudBackup(true);
    }
    await flushOfflineQueueNow();
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => { void flushOfflineQueueNow(); });
    }
    render();
  } catch (error) {
    console.error("Startup background tasks failed:", error);
  }
}

async function initializeApp() {
  try {
    await loadAppConfig();
    const backend = enforceBackendIdentity({ storage: localStorage, sessionStore: sessionStorage, config: getAppConfig() });
    if (backend.blocked) {
      throw new Error("This device holds data from a different SMILE TRUST server and there is not enough storage to set it aside safely. Cloud sync is off. Free up storage on this device or contact your administrator.");
    }
    if (backend.quarantined) {
      state = normalizeState(structuredClone(defaultState));
      sessionUserId = null;
    }
    captureLegacySyncKey(state);
    applyOwnerLoginDefaults();
    applyUnifiedCloudDefaults(state, getAppConfig());
    await persistStateWithMediaShrink();
    App.root = document.querySelector("#app") || app;
    syncToApp();
    render();
    if (takeQuarantineNotice(localStorage)) {
      toast("This device now uses the SMILE TRUST main server. Data from the previous server was set aside on this device and will not be uploaded.");
    }
    startAutoCloudSync();
    void finishStartupTasks();
  } catch (error) {
    console.error(error);
    const root = document.querySelector("#app") || app;
    if (root) {
      root.dataset.ready = "true";
      root.innerHTML = `<main class="auth"><section class="login-panel"><h2>Unable to start</h2><p class="notice">${escapeHtml(error.message || "Unknown startup error")}</p></section></main>`;
    }
  }
}

initializeApp();
