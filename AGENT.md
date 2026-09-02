# ORBIT — Agent Rules

1. Preserve the existing ORBIT UI and visual design.
   Do not redesign, restyle, or replace the current professional theme.
   Make only minimal UI changes when required for a functional fix.

2. Do not rebuild working architecture.
   Prefer small, controlled changes over rewrites.

3. ORBIT is a generic multi-tenant AI Employee platform.
   Hotels are the first vertical, not the only vertical.

4. Never expose ElevenLabs or other provider branding/credentials in the customer-facing product.
   Providers remain internal infrastructure.

5. Never trust tenant_id from the client.
   Resolve tenant identity from authenticated server-side context.
   Maintain strict tenant isolation.

6. Never expose secrets, API keys, provider IDs, internal configuration, or internal margins to customers.

7. Never fake live business data.
   Mock data is only for local/demo/testing environments and must never silently appear as real production data.

8. AI business actions must go through authorized ORBIT tools/connectors.
   The AI must not directly modify the database.
   Sensitive ACTION operations require confirmation.

9. Preserve the existing provider abstraction and connector architecture.
   Do not introduce unnecessary providers, services, frameworks, or infrastructure.

10. Local development and testing should be preferred over Emergent.
    Keep real credentials out of the repository and use environment variables.

11. Before changing existing functionality:
    inspect the current implementation, make the smallest safe change, and run relevant tests.

12. Do not add features or make cosmetic improvements unless explicitly requested.
    Priority is reliability, security, real customer onboarding, and production readiness.

13. Never claim something is live unless it has been verified with the real external service.

14. When uncertain, preserve the existing behavior and ask before making a large architectural or design change.