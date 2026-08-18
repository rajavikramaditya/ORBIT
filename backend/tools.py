"""Tool runner — the safe boundary between the AI Employee and a customer's live
business system.

Flow: AI Employee -> Tool -> authorization -> connector -> external system -> result.

Safety guarantees:
- READ tools may run automatically when the backing integration is connected.
- ACTION tools (create/modify/cancel/pay) require explicit `confirmed=True`.
- If the integration is not connected (or live mode has no real connector), we
  return `unavailable` and NEVER invent data.
- Every invocation is logged to `tool_invocation_log`; actions also write audit.
- The LLM never touches the database directly — only through this runner.
"""
from db import db, write_audit
from models import gen_id, now_iso
from connectors import get_mock_connector, get_live_connector, connector_supports


async def run_tool(tool: dict, tenant_id: str, args: dict | None = None,
                   confirmed: bool = False, actor: dict | None = None) -> dict:
    args = args or {}
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0, "environment": 1})
    environment = (tenant or {}).get("environment", "demo")

    integration = None
    if tool.get("integration_id"):
        integration = await db.business_integrations.find_one(
            {"id": tool["integration_id"], "tenant_id": tenant_id}, {"_id": 0}
        )

    if not tool.get("enabled"):
        result = {"status": "disabled", "message": "This tool is disabled."}
    elif not integration or integration.get("status") != "connected":
        result = {"status": "unavailable",
                  "message": f"{tool.get('name', 'This')} integration is not connected."}
    else:
        connector_key = integration.get("connector_key") or integration.get("provider")
        mode = integration.get("mode", "mock")
        # HARD RULE: a production tenant must NEVER be served mock data.
        if environment == "production" and mode == "mock":
            result = {"status": "unavailable",
                      "message": "Production tenant cannot use mock data. Connect a real business system."}
        else:
            connector = get_mock_connector(connector_key) if mode == "mock" else get_live_connector(connector_key)
            if connector is None:
                result = {"status": "unavailable",
                          "message": "No real business system connected yet. AI is in limited informational mode."}
            elif not connector_supports(connector_key, tool["key"], tool["kind"]):
                result = {"status": "unavailable",
                          "message": "This capability is not supported by the connected system."}
            elif tool["kind"] == "action" and not confirmed:
                result = {"status": "confirmation_required",
                          "message": "This action needs explicit confirmation before it runs."}
            else:
                try:
                    data = connector.act(tool["key"], args) if tool["kind"] == "action" else connector.read(tool["key"], args)
                    result = {"status": "ok", "mode": mode, "mock": bool(data.get("mock")), "data": data.get("result")}
                except Exception:
                    # Never fabricate success when the external system fails.
                    result = {"status": "error",
                              "message": "The business system could not complete this request. Please try again or contact support."}

    await db.tool_invocation_log.insert_one({
        "id": gen_id("ti_"),
        "tenant_id": tenant_id,
        "tool_id": tool.get("id"),
        "tool_key": tool.get("key"),
        "kind": tool.get("kind"),
        "args": args,
        "status": result["status"],
        "mode": result.get("mode"),
        "environment": environment,
        "created_at": now_iso(),
    })
    if tool.get("kind") == "action" and result["status"] == "ok":
        await write_audit(actor, "tool.action", tool.get("id"), tenant_id,
                          {"tool": tool.get("key"), "mode": result.get("mode")})
    return result
