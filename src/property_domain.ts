export type PropertyAction =
  | { kind: "maintenance_request"; title: string; details: string; priority: "low" | "normal" | "urgent" }
  | { kind: "tenant_document"; documentType: "lease" | "income-proof" | "id"; fileName: string }
  | { kind: "inspection_reminder"; inspectionDate: string; window: string };

export type TenantSession = {
  phone: string;
  verifiedAt: string;
};

export type MaintenanceRequest = {
  id: string;
  phone: string;
  title: string;
  details: string;
  priority: "low" | "normal" | "urgent";
  status: "submitted" | "queued_dispatch";
};

export type TenantDocument = {
  id: string;
  phone: string;
  documentType: "lease" | "income-proof" | "id";
  fileName: string;
  status: "pending_review";
};

export type InspectionReminder = {
  id: string;
  phone: string;
  inspectionDate: string;
  window: string;
  status: "scheduled" | "sent";
};

export type PropertyState = {
  sessions: Map<string, TenantSession>;
  maintenanceRequests: MaintenanceRequest[];
  tenantDocuments: TenantDocument[];
  inspectionReminders: InspectionReminder[];
};

export function createPropertyState(): PropertyState {
  return {
    sessions: new Map(),
    maintenanceRequests: [],
    tenantDocuments: [],
    inspectionReminders: [],
  };
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function markPhoneVerified(state: PropertyState, phone: string, now = new Date()): TenantSession {
  const session = { phone, verifiedAt: now.toISOString() };
  state.sessions.set(phone, session);
  return session;
}

export function isTenantVerified(state: PropertyState, phone: string): boolean {
  return state.sessions.has(phone);
}

export function applyTenantAction(state: PropertyState, phone: string, action: PropertyAction) {
  if (!isTenantVerified(state, phone)) {
    return {
      accepted: false as const,
      reason: "phone_not_verified",
    };
  }

  if (action.kind === "maintenance_request") {
    const request: MaintenanceRequest = {
      id: makeId("mr"),
      phone,
      title: action.title,
      details: action.details,
      priority: action.priority,
      status: action.priority === "urgent" ? "queued_dispatch" : "submitted",
    };
    state.maintenanceRequests.push(request);
    return {
      accepted: true as const,
      entity: "maintenance_request" as const,
      record: request,
    };
  }

  if (action.kind === "tenant_document") {
    const document: TenantDocument = {
      id: makeId("doc"),
      phone,
      documentType: action.documentType,
      fileName: action.fileName,
      status: "pending_review",
    };
    state.tenantDocuments.push(document);
    return {
      accepted: true as const,
      entity: "tenant_document" as const,
      record: document,
    };
  }

  const reminder: InspectionReminder = {
    id: makeId("insp"),
    phone,
    inspectionDate: action.inspectionDate,
    window: action.window,
    status: "scheduled",
  };
  state.inspectionReminders.push(reminder);
  return {
    accepted: true as const,
    entity: "inspection_reminder" as const,
    record: reminder,
  };
}
