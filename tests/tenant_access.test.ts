import test from "node:test";
import assert from "node:assert/strict";
import { applyTenantAction, createPropertyState, markPhoneVerified } from "../src/property_domain.js";

test("tenant must verify phone before creating a maintenance request", () => {
  const state = createPropertyState();
  const blocked = applyTenantAction(state, "+14155550100", {
    kind: "maintenance_request",
    title: "No heat in bedroom",
    details: "The radiator stays cold all night.",
    priority: "urgent",
  });

  assert.equal(blocked.accepted, false);
  assert.equal(state.maintenanceRequests.length, 0);

  markPhoneVerified(state, "+14155550100", new Date("2026-01-05T10:00:00.000Z"));
  const accepted = applyTenantAction(state, "+14155550100", {
    kind: "maintenance_request",
    title: "No heat in bedroom",
    details: "The radiator stays cold all night.",
    priority: "urgent",
  });

  assert.equal(accepted.accepted, true);
  if (accepted.accepted) {
    assert.equal(accepted.entity, "maintenance_request");
    assert.equal(accepted.record.status, "queued_dispatch");
  }
  assert.equal(state.maintenanceRequests.length, 1);
});
