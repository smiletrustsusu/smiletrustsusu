/**
 * Savings product catalog — separates group susu from personal everyday savings.
 * All amounts in pesewas internally; display via money.js helpers.
 */
import { toPesewas, fromPesewas, sumPesewas } from "./money.js";

export const PRODUCT_TYPES = {
  GROUP_SUSU: "group_susu",
  PERSONAL_DAILY: "personal_daily",
  PERSONAL_WEEKLY: "personal_weekly",
  PERSONAL_MONTHLY: "personal_monthly",
  PERSONAL_FLEXIBLE: "personal_flexible",
  TARGET_SAVINGS: "target_savings",
  FIXED_DEPOSIT: "fixed_deposit",
  CHILD_EDUCATION: "child_education",
  BUSINESS_SAVINGS: "business_savings",
  FUNERAL_SAVINGS: "funeral_savings",
  HOLIDAY_SAVINGS: "holiday_savings",
  EMERGENCY_SAVINGS: "emergency_savings",
  INVESTMENT_SAVINGS: "investment_savings",
  CUSTOM_SAVINGS: "custom_savings"
};

export const FREQUENCIES = ["Daily", "Weekly", "Biweekly", "Monthly", "Flexible"];

export const COLLECTION_TYPES = {
  SUSU_GROUP: "susu_group",
  PERSONAL: "personal"
};

export function defaultSavingsProducts() {
  const now = new Date().toISOString();
  return [
    {
      id: "prod-susu-group",
      code: "SUSU-GROUP",
      name: "Group Susu Savings",
      type: PRODUCT_TYPES.GROUP_SUSU,
      collectionType: COLLECTION_TYPES.SUSU_GROUP,
      frequency: "Daily",
      minAmountPesewas: 100,
      defaultAmountPesewas: 0,
      feePesewas: 0,
      interestRate: 0,
      withdrawalRule: "End of cycle with group approval",
      missedPaymentRule: "Track as arrears; notify group leader",
      approvalRule: "Manager or Assistant Manager",
      active: true,
      createdAt: now
    },
    {
      id: "prod-daily",
      code: "PERS-DAILY",
      name: "Daily Personal Savings",
      type: PRODUCT_TYPES.PERSONAL_DAILY,
      collectionType: COLLECTION_TYPES.PERSONAL,
      frequency: "Daily",
      minAmountPesewas: 100,
      defaultAmountPesewas: 500,
      feePesewas: 0,
      interestRate: 0,
      withdrawalRule: "Manager approval with ID verification",
      missedPaymentRule: "Mark missed day; resume on next payment",
      approvalRule: "Manager",
      active: true,
      createdAt: now
    },
    {
      id: "prod-weekly",
      code: "PERS-WEEKLY",
      name: "Weekly Personal Savings",
      type: PRODUCT_TYPES.PERSONAL_WEEKLY,
      collectionType: COLLECTION_TYPES.PERSONAL,
      frequency: "Weekly",
      minAmountPesewas: 500,
      defaultAmountPesewas: 2000,
      feePesewas: 0,
      interestRate: 0,
      withdrawalRule: "Manager approval with ID verification",
      missedPaymentRule: "Mark missed week",
      approvalRule: "Manager",
      active: true,
      createdAt: now
    },
    {
      id: "prod-flex",
      code: "PERS-FLEX",
      name: "Flexible Personal Savings",
      type: PRODUCT_TYPES.PERSONAL_FLEXIBLE,
      collectionType: COLLECTION_TYPES.PERSONAL,
      frequency: "Flexible",
      minAmountPesewas: 100,
      defaultAmountPesewas: 0,
      feePesewas: 0,
      interestRate: 0,
      withdrawalRule: "Balance check required",
      missedPaymentRule: "No fixed schedule",
      approvalRule: "Collector records; Manager approves withdrawals",
      active: true,
      createdAt: now
    },
    {
      id: "prod-target",
      code: "PERS-TARGET",
      name: "Target / Fixed Savings",
      type: PRODUCT_TYPES.TARGET_SAVINGS,
      collectionType: COLLECTION_TYPES.PERSONAL,
      frequency: "Flexible",
      minAmountPesewas: 500,
      defaultAmountPesewas: 0,
      feePesewas: 0,
      interestRate: 2.5,
      targetAmountPesewas: 0,
      lockUntilTarget: true,
      withdrawalRule: "Withdraw after target reached or with Manager approval",
      missedPaymentRule: "Flexible schedule toward target",
      approvalRule: "Manager approval for early withdrawal",
      active: true,
      createdAt: now
    },
    {
      id: "prod-monthly",
      code: "PERS-MONTHLY",
      name: "Monthly Savings",
      type: PRODUCT_TYPES.PERSONAL_MONTHLY,
      collectionType: COLLECTION_TYPES.PERSONAL,
      frequency: "Monthly",
      minAmountPesewas: 2000,
      defaultAmountPesewas: 10000,
      maxAmountPesewas: 0,
      feePesewas: 0,
      interestRate: 1.5,
      penaltyPesewas: 0,
      withdrawalRule: "Branch Manager approval after 30 days",
      missedPaymentRule: "Mark missed month; notify agent",
      approvalRule: "Branch Manager",
      active: true,
      createdAt: now
    },
    {
      id: "prod-fixed",
      code: "PERS-FIXED",
      name: "Fixed Deposit",
      type: PRODUCT_TYPES.FIXED_DEPOSIT,
      collectionType: COLLECTION_TYPES.PERSONAL,
      frequency: "Flexible",
      minAmountPesewas: 10000,
      defaultAmountPesewas: 0,
      feePesewas: 0,
      interestRate: 8,
      lockUntilTarget: true,
      maturityMonths: 6,
      withdrawalRule: "Locked until maturity; early exit with penalty",
      missedPaymentRule: "Single deposit at opening",
      approvalRule: "Managing Director for early break",
      active: true,
      createdAt: now
    },
    {
      id: "prod-child",
      code: "PERS-CHILD",
      name: "Child Education Savings",
      type: PRODUCT_TYPES.CHILD_EDUCATION,
      collectionType: COLLECTION_TYPES.PERSONAL,
      frequency: "Weekly",
      minAmountPesewas: 500,
      defaultAmountPesewas: 2000,
      feePesewas: 0,
      interestRate: 3,
      withdrawalRule: "Withdraw for school fees with Branch Manager approval",
      missedPaymentRule: "Mark missed week",
      approvalRule: "Branch Manager + KYC on guardian",
      active: true,
      createdAt: now
    },
    {
      id: "prod-biz",
      code: "PERS-BIZ",
      name: "Business Savings",
      type: PRODUCT_TYPES.BUSINESS_SAVINGS,
      collectionType: COLLECTION_TYPES.PERSONAL,
      frequency: "Daily",
      minAmountPesewas: 500,
      defaultAmountPesewas: 2000,
      feePesewas: 0,
      interestRate: 0,
      withdrawalRule: "Same-day withdrawal up to daily limit; larger amounts next day",
      missedPaymentRule: "Flexible daily business collection",
      approvalRule: "Agent records; Cashier pays withdrawals",
      active: true,
      createdAt: now
    },
    {
      id: "prod-funeral",
      code: "PERS-FUNERAL",
      name: "Funeral Savings",
      type: PRODUCT_TYPES.FUNERAL_SAVINGS,
      collectionType: COLLECTION_TYPES.PERSONAL,
      frequency: "Monthly",
      minAmountPesewas: 1000,
      defaultAmountPesewas: 5000,
      feePesewas: 0,
      interestRate: 0,
      withdrawalRule: "Payable to nominated beneficiary on claim",
      missedPaymentRule: "Arrears tracked against welfare rules",
      approvalRule: "Branch Manager + next of kin documents",
      active: true,
      createdAt: now
    },
    {
      id: "prod-holiday",
      code: "PERS-HOLIDAY",
      name: "Holiday Savings",
      type: PRODUCT_TYPES.HOLIDAY_SAVINGS,
      collectionType: COLLECTION_TYPES.PERSONAL,
      frequency: "Weekly",
      minAmountPesewas: 500,
      defaultAmountPesewas: 2000,
      feePesewas: 0,
      interestRate: 1,
      lockUntilTarget: true,
      withdrawalRule: "Payout in December or at target date",
      missedPaymentRule: "Flexible toward holiday target",
      approvalRule: "Branch Manager for early payout",
      active: true,
      createdAt: now
    },
    {
      id: "prod-emergency",
      code: "PERS-EMERG",
      name: "Emergency Savings",
      type: PRODUCT_TYPES.EMERGENCY_SAVINGS,
      collectionType: COLLECTION_TYPES.PERSONAL,
      frequency: "Flexible",
      minAmountPesewas: 100,
      defaultAmountPesewas: 0,
      feePesewas: 0,
      interestRate: 0,
      withdrawalRule: "Fast-track verification; same-day if under limit",
      missedPaymentRule: "No fixed schedule",
      approvalRule: "Customer Service verifies; Cashier pays",
      active: true,
      createdAt: now
    },
    {
      id: "prod-invest",
      code: "PERS-INVEST",
      name: "Investment Savings",
      type: PRODUCT_TYPES.INVESTMENT_SAVINGS,
      collectionType: COLLECTION_TYPES.PERSONAL,
      frequency: "Monthly",
      minAmountPesewas: 20000,
      defaultAmountPesewas: 0,
      feePesewas: 0,
      interestRate: 10,
      maturityMonths: 12,
      lockUntilTarget: true,
      withdrawalRule: "Locked for investment term; interest at maturity",
      missedPaymentRule: "Optional monthly top-up",
      approvalRule: "Managing Director",
      active: true,
      createdAt: now
    },
    {
      id: "prod-custom",
      code: "PERS-CUSTOM",
      name: "Custom Savings Product",
      type: PRODUCT_TYPES.CUSTOM_SAVINGS,
      collectionType: COLLECTION_TYPES.PERSONAL,
      frequency: "Flexible",
      minAmountPesewas: 100,
      defaultAmountPesewas: 0,
      maxAmountPesewas: 0,
      feePesewas: 0,
      interestRate: 0,
      penaltyPesewas: 0,
      withdrawalRule: "Configured per product",
      missedPaymentRule: "Configured per product",
      approvalRule: "Manager",
      active: true,
      createdAt: now
    }
  ];
}

export function ensureSavingsProducts(state) {
  if (!state.savingsProducts?.length) {
    state.savingsProducts = defaultSavingsProducts();
    return state.savingsProducts;
  }
  const codes = new Set(state.savingsProducts.map((item) => item.code));
  defaultSavingsProducts().forEach((product) => {
    if (!codes.has(product.code)) state.savingsProducts.push(product);
  });
  return state.savingsProducts;
}

export function productById(products, id) {
  return (products || []).find((item) => item.id === id) || null;
}

export function productByType(products, type) {
  return (products || []).find((item) => item.type === type && item.active !== false) || null;
}

export function personalProducts(products = []) {
  return products.filter((item) => item.collectionType === COLLECTION_TYPES.PERSONAL && item.active !== false);
}

export function groupProducts(products = []) {
  return products.filter((item) => item.collectionType === COLLECTION_TYPES.SUSU_GROUP && item.active !== false);
}

export function validateProductInput(data) {
  if (!String(data.name || "").trim()) return "Product name is required";
  if (!String(data.code || "").trim()) return "Product code is required";
  if (Number(data.minAmount || 0) < 0) return "Minimum amount cannot be negative";
  return "";
}

export function upsertProduct(products, data, uid) {
  const code = String(data.code || "").trim().toUpperCase();
  const duplicate = products.find((item) => item.code === code && item.id !== data.id);
  if (duplicate) return { error: "Product code already exists" };
  const minAmountPesewas = toPesewas(Number(data.minAmount || 0));
  const payload = {
    name: String(data.name || "").trim(),
    code,
    type: data.type || PRODUCT_TYPES.PERSONAL_FLEXIBLE,
    collectionType: data.collectionType || COLLECTION_TYPES.PERSONAL,
    frequency: data.frequency || "Flexible",
    minAmountPesewas,
    defaultAmountPesewas: toPesewas(Number(data.defaultAmount || 0)),
    maxAmountPesewas: toPesewas(Number(data.maxAmount || 0)),
    feePesewas: toPesewas(Number(data.fee || 0)),
    interestRate: Number(data.interestRate || 0),
    penaltyPesewas: toPesewas(Number(data.penalty || 0)),
    targetAmountPesewas: toPesewas(Number(data.targetAmount || 0)),
    lockUntilTarget: Boolean(data.lockUntilTarget),
    maturityMonths: Number(data.maturityMonths || 0),
    withdrawalRule: String(data.withdrawalRule || "").trim(),
    missedPaymentRule: String(data.missedPaymentRule || "").trim(),
    approvalRule: String(data.approvalRule || "").trim(),
    active: data.active !== false,
    updatedAt: new Date().toISOString()
  };
  if (data.id) {
    const existing = products.find((item) => item.id === data.id);
    if (!existing) return { error: "Product not found" };
    Object.assign(existing, payload);
    return { product: existing };
  }
  const product = {
    id: uid("prod"),
    ...payload,
    createdAt: new Date().toISOString()
  };
  products.push(product);
  return { product };
}

/** Balance for personal savings only (excludes susu group pool). */
export function personalSavingsBalance(customerId, { collections = [], transactions = [], ledgerEntries = [] } = {}) {
  const personalCollections = collections.filter((item) =>
    item.customerId === customerId
    && !item.reversed
    && !item.susuGroupId
    && (item.savingsProductId || item.collectionType === COLLECTION_TYPES.PERSONAL || !item.susuGroupId)
  );
  const depositPesewas = sumPesewas(personalCollections.map((item) => toPesewas(item.amount)));
  const withdrawals = transactions.filter((tx) =>
    tx.customerId === customerId
    && tx.type === "Withdrawal"
    && !tx.reversed
    && (!tx.susuGroupId)
  );
  const withdrawalPesewas = sumPesewas(withdrawals.map((tx) => toPesewas(tx.amount)));
  return fromPesewas(depositPesewas - withdrawalPesewas);
}

/** Balance credited to susu group memberships for a customer. */
export function susuGroupContributionBalance(customerId, { collections = [], susuGroupId = "" } = {}) {
  const scoped = collections.filter((item) =>
    item.customerId === customerId
    && !item.reversed
    && item.susuGroupId
    && (!susuGroupId || item.susuGroupId === susuGroupId)
  );
  return fromPesewas(sumPesewas(scoped.map((item) => toPesewas(item.amount))));
}

export function productPerformance(product, { collections = [], customers = [], date = "" } = {}) {
  const memberIds = new Set(
    customers.filter((c) => c.savingsProductId === product.id && c.active !== false).map((c) => c.id)
  );
  const dayCollections = collections.filter((item) =>
    memberIds.has(item.customerId)
    && item.savingsProductId === product.id
    && !item.susuGroupId
    && !item.reversed
    && (!date || item.date === date)
  );
  const actualPesewas = sumPesewas(dayCollections.map((item) => toPesewas(item.amount)));
  const expectedPesewas = date && product.defaultAmountPesewas
    ? product.defaultAmountPesewas * memberIds.size
    : 0;
  const paidCount = new Set(dayCollections.filter((item) => Number(item.amount) > 0).map((item) => item.customerId)).size;
  return {
    productId: product.id,
    members: memberIds.size,
    expected: fromPesewas(expectedPesewas),
    actual: fromPesewas(actualPesewas),
    paidMembers: paidCount,
    missedMembers: Math.max(0, memberIds.size - paidCount),
    expectedPesewas,
    actualPesewas
  };
}
