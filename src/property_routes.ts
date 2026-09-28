import express from "express";
import { z } from "zod";
import { infrai, InfraiError } from "./infrai.js";
import { applyTenantAction, createPropertyState, markPhoneVerified } from "./property_domain.js";

const otpStartSchema = z.object({
  phone: z.string().min(8),
  tenantName: z.string().min(1),
});

const otpVerifySchema = z.object({
  phone: z.string().min(8),
  code: z.string().min(4),
});

const tenantActionSchema = z.object({
  phone: z.string().min(8),
  action: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("maintenance_request"),
      title: z.string().min(3),
      details: z.string().min(5),
      priority: z.enum(["low", "normal", "urgent"]),
    }),
    z.object({
      kind: z.literal("tenant_document"),
      documentType: z.enum(["lease", "income-proof", "id"]),
      fileName: z.string().min(3),
    }),
    z.object({
      kind: z.literal("inspection_reminder"),
      inspectionDate: z.string().min(8),
      window: z.string().min(3),
    }),
  ]),
});

const inspectionSendSchema = z.object({
  phone: z.string().min(8),
  inspectionDate: z.string().min(8),
  window: z.string().min(3),
});

export const propertyState = createPropertyState();
export const propertyRoutes = express.Router();

propertyRoutes.post("/auth/send-code", async (req, res) => {
  const parsed = otpStartSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const idempotencyKey = `otp-${parsed.data.phone}`;
    const reply = await infrai.sms.otp(
      { to: parsed.data.phone },
      { "Idempotency-Key": idempotencyKey },
    );

    return res.json({
      status: "code_sent",
      phone: parsed.data.phone,
      tenantName: parsed.data.tenantName,
      provider: reply.metadata ?? null,
    });
  } catch (error) {
    return mapInfraiError(res, error);
  }
});

propertyRoutes.post("/auth/verify-code", async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    await infrai.sms.verify(
      { to: parsed.data.phone, code: parsed.data.code },
      { "Idempotency-Key": `verify-${parsed.data.phone}-${parsed.data.code}` },
    );
    const session = markPhoneVerified(propertyState, parsed.data.phone);
    return res.json({ status: "verified", session });
  } catch (error) {
    return mapInfraiError(res, error);
  }
});

propertyRoutes.post("/tenant/action", (req, res) => {
  const parsed = tenantActionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const result = applyTenantAction(propertyState, parsed.data.phone, parsed.data.action);
  if (!result.accepted) {
    return res.status(403).json(result);
  }

  return res.json(result);
});

propertyRoutes.post("/inspections/send-reminder", async (req, res) => {
  const parsed = inspectionSendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const message = `Reminder: your property inspection is booked for ${parsed.data.inspectionDate} during ${parsed.data.window}. Reply if you need to reschedule.`;
    const reply = await infrai.sms.send(
      { to: parsed.data.phone, body: message },
      { "Idempotency-Key": `inspection-${parsed.data.phone}-${parsed.data.inspectionDate}-${parsed.data.window}` },
    );

    return res.json({
      status: "sent",
      phone: parsed.data.phone,
      inspectionDate: parsed.data.inspectionDate,
      sms: reply.data,
      metadata: reply.metadata ?? null,
    });
  } catch (error) {
    return mapInfraiError(res, error);
  }
});

function mapInfraiError(res: express.Response, error: unknown) {
  if (error instanceof InfraiError) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 502;
    return res.status(status).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  return res.status(500).json({
    error: {
      message: error instanceof Error ? error.message : "unknown error",
    },
  });
}
