const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

async function post(path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    json: await response.json(),
  };
}

const phone = process.env.DEMO_PHONE;
if (!phone) {
  throw new Error("DEMO_PHONE is required");
}

console.log("1) send login code");
console.log(
  await post("/auth/send-code", {
    phone,
    tenantName: "Maya Tenant",
  }),
);

console.log("2) verify code with the SMS code you received");
const code = process.env.DEMO_CODE;
if (!code) {
  throw new Error("DEMO_CODE is required after you receive the SMS code");
}
console.log(
  await post("/auth/verify-code", {
    phone,
    code,
  }),
);

console.log("3) create an urgent maintenance request");
console.log(
  await post("/tenant/action", {
    phone,
    action: {
      kind: "maintenance_request",
      title: "Boiler leak in utility closet",
      details: "Water is pooling near the boiler and the floor is slippery.",
      priority: "urgent",
    },
  }),
);

console.log("4) register a tenant document");
console.log(
  await post("/tenant/action", {
    phone,
    action: {
      kind: "tenant_document",
      documentType: "id",
      fileName: "maya-passport.pdf",
    },
  }),
);

console.log("5) send an inspection reminder");
console.log(
  await post("/inspections/send-reminder", {
    phone,
    inspectionDate: "2026-02-14",
    window: "9am-11am",
  }),
);
