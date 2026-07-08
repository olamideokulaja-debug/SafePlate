# SafePlate — Security Design Document

Lagos State Ministry of Health · SafePlate Platform · Classification: Official

This document describes the security architecture of SafePlate for review by LSMoH, the nominated Data Protection Officer, and any assurance or audit party. It maps the controls in the codebase to the requirements in the Developer Specification (§8) and to the Nigeria Data Protection Act 2023 (NDPA) and GDPR principles.

## 1. Overview and threat model

SafePlate processes personal data and special-category health data (laboratory test results) for food handlers in Lagos State. The primary risks we design against are: unauthorised access to another person's health results; forgery of certificates; tampering with escrow or approvals; and loss or exposure of data at rest or in transit. The design principle is least privilege with defence in depth: the browser is never trusted for a privileged action, and every sensitive write passes through a server that re-checks the caller.

## 2. Identity and roles

Authentication is handled by Supabase Auth. Each account carries a role in its JWT (`user_metadata.role`), and regulators additionally carry an `agency` (LSMoH, LASEPA, HEFAMAA); laboratory users carry a `lab`. LSMoH is the platform administrator with elevated read across workspaces, encoded in the database (not only the UI). Privileged roles (regulator, Sterling Bank) require a second factor at login.

## 3. Data-access control (RLS)

Row Level Security is deny-by-default on every table (`supabase/schema_hardened.sql`). Access is scoped by claims and ownership:

- Food handlers read and write only their own row (`user_id = auth.uid()`) and can read only their own orders and certificate.
- A laboratory reads and updates only orders for its own `lab`.
- Regulators read for oversight; LSMoH (admin) reads across all workspaces.
- Sterling Bank reads escrow only and never sees results or medical data.
- `certificates`, `escrow`, `escrow_releases`, encrypted results, and `audit_log` are never written by the browser; only the service role (Edge Functions) writes them.

## 4. Privileged operations (Edge Functions)

The operations that must not be client-trusted run through a single Supabase Edge Function ("safeplate"), routed by an action parameter, using the service role and re-verifying the caller's JWT and role before acting (`supabase/functions/safeplate/index.ts`):

- `submit-result` — a laboratory submits results; the payload is encrypted before storage; accreditation mismatch quarantines the order.
- `approve-result` — LSMoH approves, flags, or rejects; approval mints the LSMoH certificate number, issues the certificate, and instructs escrow release, atomically.
- `approve-water` — LASEPA approves water results and issues the water certificate with the 80/10/5/5 disbursement.
- `release-escrow` — Sterling releases only against an approved instruction, disbursing the full waterfall.
- `revoke-certificate` — LSMoH revokes a certificate.
- `decrypt-result` — returns plaintext results only to the Ministry or the owning food handler, and logs the access.
- `send-otp` / `verify-otp` — real 2FA over Termii.

Payment-funded escrow is created only by `/api/paystack-verify` after Paystack confirms the transaction, again with the service role.

## 5. Encryption

Test results are encrypted with AES-256-GCM at the application layer inside Edge Functions (`_shared/crypto.ts`); the 32-byte key is held in Supabase Vault and injected as `RESULT_ENC_KEY`, so plaintext health data never touches the database and the key never sits in a table. All transport is HTTPS/TLS. Result PDFs live in a private Storage bucket (`results`) and are reachable only through short-lived signed URLs minted after a role check, never a permanent public link.

## 6. Certificate integrity

Each certificate carries an LSMoH number (`LSH-YYYY-NNNNNN`) and a QR that encodes a server-signed token. The public verification portal validates status server-side, and expired or revoked certificates always return INVALID regardless of the token, so a copied URL cannot be reused to assert validity.

## 7. Session management and 2FA

Sessions time out on inactivity: 15 minutes for Ministry and Sterling, 30 minutes for other roles. Privileged logins require an SMS OTP via Termii (`send-otp` / `verify-otp`), with codes stored only as hashes, a five-minute expiry, and a five-attempt cap. Failed-login lockout is tracked in `login_attempts` for enforcement at the auth layer.

## 8. Audit trail

`audit_log` is append-only at the database level (UPDATE and DELETE revoked). Every privileged action (result submission, approval, escrow release, revocation, accreditation change, decryption/view, sign-in, and public verification) writes an entry with actor, role, subject, IP, and timestamp, and LSMoH can export it as a tamper-evident report.

## 9. Data protection (NDPA 2023 / GDPR)

Lawful basis is the performance of a public-health task and legal obligation under the NAFDAC Food Hygiene Regulation 2019, with explicit consent for health data captured at registration. Data is minimised, retained for six years after last certification then anonymised (subject to legal confirmation), and never shared beyond the defined institutional partners without lawful basis. Data-subject rights (access, rectification, erasure, restriction, portability, objection) are supported, and a Data Protection Officer is nominated before go-live. A consent banner and a full privacy notice are presented in-product.

## 10. Deployment prerequisites and residual items

Before go-live: run `schema.sql` then `schema_hardened.sql`; deploy all Edge Functions; set the service role key, `RESULT_ENC_KEY` (Vault), Termii, and Paystack secrets; create the `results` bucket; and ensure privileged accounts carry a `phone` claim and laboratory accounts a `lab` claim in their metadata. Residual hardening to schedule: WAF/rate limiting at the edge, refresh-token rotation policy, concurrent-session flagging enforcement, and a formal penetration test before statewide launch.
