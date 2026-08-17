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
from connectors import get_mock_connector, get_live_connector


async def run_tool(tool: dict, tenant_id: str, args: dict | None = None,
                   confirmed: bool = False, actor: dict | None = None) -> dict:
    args = args or {}
    integration = None
    if tool.get("integration_id"):
        integration = await db.business_integrations.find_one(
            {"id": tool["integration_id"], "tenant_id": tenant_id}, {"_id": 0}
        )

    if not tool.get("enabled"):
        result = {"status": "disabled", "message": "This tool is disabled."}
    elif not integration or integration.get("status") != "connected":
        result = {"status": "unavailable",
                  "message": f"Live {tool.get('name', 'business')} integration not connected."}
    else:
        mode = integration.get("mode", "mock")
        connector = get_mock_connector(integration["provider"]) if mode == "mock" else get_live_connector(integration["provider"])
        if connector is None:
            # e.g. mode == "live" but no real connector wired yet — do NOT fake data.
            result = {"status": "unavailable",
                      "message": "No real data source connected yet. AI is in limited informational mode."}
        elif tool["kind"] == "action":
            if not confirmed:
                result = {"status": "confirmation_required",
                          "message": "This action needs explicit confirmation before it runs."}
            else:
                data = connector.act(tool["key"], args)
                result = {"status": "ok", "mode": mode, "mock": bool(data.get("mock")), "data": data.get("result")}
        else:
            data = connector.read(tool["key"], args)
            result = {"status": "ok", "mode": mode, "mock": bool(data.get("mock")), "data": data.get("result")}

    await db.tool_invocation_log.insert_one({
        "id": gen_id("ti_"),
        "tenant_id": tenant_id,
        "tool_id": tool.get("id"),
        "tool_key": tool.get("key"),
        "kind": tool.get("kind"),
        "args": args,
        "status": result["status"],
        "mode": result.get("mode"),
        "created_at": now_iso(),
    })
    if tool.get("kind") == "action" and result["status"] == "ok":
        await write_audit(actor, "tool.action", tool.get("id"), tenant_id,
                          {"tool": tool.get("key"), "mode": result.get("mode")})
    return result
