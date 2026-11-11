// Sample payloads for mock mode (WM_MOCK=1). These are illustrative shapes so
// the UI and tools work end-to-end with no live WM calls. They are NOT real
// responses or real customer data — replace with verified schemas once the
// live API is reachable.
export const MOCK_CUSTOMER_ID = "0000123456789";

type Fixture = (params: Record<string, string | number | undefined>) => unknown;

export const FIXTURES: Record<string, Fixture> = {
  __helloworld: () => ({
    request_tracking_id: "mock",
    message: "Hello, Welcome to Waste Management REST API (MOCK)",
  }),

  BALANCE: (p) => ({
    customerId: p.customerId ?? MOCK_CUSTOMER_ID,
    currency: "USD",
    currentBalance: 184.52,
    pastDue: 0,
    dueDate: "2026-11-25",
    lastPaymentAmount: 184.52,
    lastPaymentDate: "2026-10-24",
  }),

  INVOICE: (p) => ({
    customerId: p.customerId ?? MOCK_CUSTOMER_ID,
    invoices: [
      { invoiceNum: "INV-2026-0098", date: "2026-10-01", amount: 184.52, status: "PAID" },
      { invoiceNum: "INV-2026-0087", date: "2026-09-01", amount: 184.52, status: "PAID" },
      { invoiceNum: "INV-2026-0076", date: "2026-08-01", amount: 179.10, status: "PAID" },
    ],
  }),

  INVOICE_CHARGE_DETAILS: (p) => ({
    customerId: p.customerId ?? MOCK_CUSTOMER_ID,
    invoiceNum: p.invoiceNum ?? "INV-2026-0098",
    lineItems: [
      { description: "Commercial 4yd Dumpster - Monthly", amount: 142.0 },
      { description: "Fuel/Environmental Charge", amount: 31.52 },
      { description: "Administrative Fee", amount: 11.0 },
    ],
    total: 184.52,
  }),

  PAYMENT_HISTORY: (p) => ({
    customerId: p.customerId ?? MOCK_CUSTOMER_ID,
    payments: [
      { date: "2026-10-24", amount: 184.52, method: "ACH", confirmation: "PAY-5521" },
      { date: "2026-09-23", amount: 184.52, method: "ACH", confirmation: "PAY-5410" },
    ],
  }),

  PENDING_CHARGES: (p) => ({
    customerId: p.customerId ?? MOCK_CUSTOMER_ID,
    pending: [{ description: "Extra Pickup 2026-11-08", amount: 45.0, postedDate: null }],
  }),

  CUSTOMER_SERVICES: (p) => ({
    customerId: p.customerId ?? MOCK_CUSTOMER_ID,
    services: [
      {
        serviceId: "SVC-001",
        type: "Commercial Front Load",
        containerSize: "4 yard",
        frequency: "2x per week",
        pickupDays: ["TUE", "FRI"],
        status: "ACTIVE",
      },
      {
        serviceId: "SVC-002",
        type: "Commercial Recycling",
        containerSize: "2 yard",
        frequency: "1x per week",
        pickupDays: ["FRI"],
        status: "ACTIVE",
      },
    ],
  }),

  GUEST_PICKUP_INFO: (p) => ({
    customerId: p.customerId ?? MOCK_CUSTOMER_ID,
    serviceId: p.serviceId ?? "SVC-001",
    nextPickup: "2026-11-13",
    lastPickup: "2026-11-10",
    frequency: "2x per week",
    alerts: [],
  }),

  GET_SERVICE_HISTORY: (p) => ({
    customerId: p.customerId ?? MOCK_CUSTOMER_ID,
    serviceId: p.serviceId ?? "SVC-001",
    history: [
      { date: "2026-11-10", status: "COMPLETED", ticket: "TKT-88210" },
      { date: "2026-11-07", status: "COMPLETED", ticket: "TKT-88102" },
    ],
  }),

  HOLIDAYS_GUEST_BY_CUSTOMER_ID: () => ({
    holidays: [{ holiday: "Thanksgiving", date: "2026-11-26", impact: "1-day delay" }],
  }),

  NOTIFICATIONS_BY_CUSTOMER_ID_GUEST: () => ({ alerts: [] }),

  CONTACT_INFO_GUEST_BY_CUSTOMER_ID: (p) => ({
    customerId: p.customerId ?? MOCK_CUSTOMER_ID,
    facility: {
      name: "WM - Houston Hauling",
      phone: "800-555-0100",
      hours: "Mon-Fri 7:00-17:00",
    },
  }),
};

// Fallback for any catalog endpoint without a specific fixture.
export function mockFor(name: string, params: Record<string, string | number | undefined>) {
  const fx = FIXTURES[name];
  if (fx) return fx(params);
  return { _mock: true, endpoint: name, params, note: "No fixture defined; echoing params." };
}
