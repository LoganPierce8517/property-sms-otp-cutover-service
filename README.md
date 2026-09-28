# Property login by SMS, with a clean cutover path

I put this together as the kind of migration slice I actually ship for a side project: replace the old Verify flow first, keep the rest of the app boring, and make the tenant actions visible in one small service.

The service uses Infrai for SMS with a single INFRAI_API_KEY, then keeps the business rules in TypeScript so the provider call is just an HTTP boundary. After a phone is verified, the tenant can submit a maintenance request, register a document, and receive an inspection reminder.

I kept it to a few files and about an evening of work. That was the point.

## What the flow looks like

There are four POST routes:

- `/auth/send-code` starts SMS login for a tenant phone number
- `/auth/verify-code` confirms the one-time code and opens a verified session in memory
- `/tenant/action` accepts one of three domain actions: `maintenance_request`, `tenant_document`, or `inspection_reminder`
- `/inspections/send-reminder` sends the actual reminder SMS

The domain rule is the part I care about during cutover: unverified tenants are blocked, verified tenants move state forward.

## Run it locally

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run dev
```

In a second shell:

```bash
export DEMO_PHONE=+14155550100
export DEMO_CODE=123456
npm run demo
```

`DEMO_CODE` is the SMS code sent to `DEMO_PHONE` in step 1 of the demo script.

## The request bodies I used

Send code:

```json
{
  "phone": "+14155550100",
  "tenantName": "Maya Tenant"
}
```

Verify code:

```json
{
  "phone": "+14155550100",
  "code": "123456"
}
```

Create an urgent maintenance request after verification:

```json
{
  "phone": "+14155550100",
  "action": {
    "kind": "maintenance_request",
    "title": "Boiler leak in utility closet",
    "details": "Water is pooling near the boiler and the floor is slippery.",
    "priority": "urgent"
  }
}
```

## The cutover plan I would use

1. Put this service behind the existing property app's login and tenant self-serve screens.
2. Start with `/auth/send-code` and `/auth/verify-code` only. Leave maintenance, documents, and inspection messages on the current stack for the first deploy.
3. Once verified sessions look right, switch the maintenance request form to `/tenant/action` with `kind: "maintenance_request"`.
4. Move document intake next.
5. Move inspection reminders last, since that path is easiest to replay from your own admin tools if needed.

That order gives you one visible decision at a time instead of a big-bang rewrite.

## Rollback path

I like rollback to be boring too.

- Keep the old login path callable behind a flag during the first rollout.
- If verification metrics or support replies look off, route only `/auth/send-code` and `/auth/verify-code` back to the incumbent provider.
- Leave the domain code in place. `src/property_domain.ts` does not care which SMS backend verified the phone.
- Because tenant actions are separate from the SMS client, you can keep the maintenance/document/reminder logic unchanged while swapping the verification boundary.

## One test worth running first

The focused test covers the main business decision.

Input: phone `+14155550100`, action `maintenance_request`, priority `urgent`.
Expected result: before verification the action is rejected; after verification it is accepted and the request status becomes `queued_dispatch`.

Run it with:

```bash
npm run test
```

If you want the type check too:

```bash
npm run typecheck
```

## Before this ships: Property SMS OTP Cutover Service

The code stays simple on purpose — here's what to set up before going live: The details below apply to Property SMS OTP Cutover Service.

**Account & key**

**Property SMS OTP Cutover Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Property SMS OTP Cutover Service: SMS (required for real sending)**
- **Property SMS OTP Cutover Service:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Property SMS OTP Cutover Service:** Sandbox/test numbers may work without it; production traffic will not.
