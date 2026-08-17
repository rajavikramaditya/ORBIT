# ORBIT Auth Testing Playbook

Auth uses httpOnly cookies. JWT email/password sets `access_token`; Emergent Google sets `session_token`. Both are also accepted as `Authorization: Bearer <token>`.

## Accounts (see /app/memory/test_credentials.md)
- Platform admin: `admin@orbit.ai` / `OrbitAdmin@2026`
- Taj owner: `owner@tajpalace.in` / `Hotel@2026` (tenant `tenant_taj_palace`, live)
- Leela owner: `owner@leela.in` / `Hotel@2026` (tenant `tenant_leela_blr`, onboarding)

## API smoke test
```
curl -c ck.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@orbit.ai","password":"OrbitAdmin@2026"}'
curl -b ck.txt http://localhost:8001/api/auth/me
curl -b ck.txt http://localhost:8001/api/admin/stats
```

## Tenant isolation (must pass)
1. Login as Taj owner, list `/api/tenant/conversations`, grab a conversation id.
2. Login as Leela owner. Request `/api/tenant/conversations/<taj_id>` → must return 404.
3. Leela `/api/tenant/conversations` must NOT contain Taj conversations.
4. There is no request field to override tenant_id anywhere; it is resolved from the session only.

## Webhook tenant resolution
- `POST /api/webhooks/elevenlabs/post-call` needs header `X-Orbit-Signature` = HMAC-SHA256(WEBHOOK_SECRET, raw_body).
- Known `agent_id` (`agent_taj_aria_001`) → captured under Taj. Unknown agent_id → quarantined (visible in `/api/admin/quarantine`).
- Same `conversation_id` twice → second is `duplicate` (idempotent).
