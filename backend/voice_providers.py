"""Voice AI provider adapter layer — mirrors connectors.py's registry pattern.

ORBIT's conversational execution (voice, WhatsApp replies, catalogue send, live
call transfer) is owned by whichever voice AI platform is configured for an
AI Employee (see channel_adapters.py / connectors.py docstrings). Today that
is exclusively ElevenLabs, and several call sites used to hardcode that fact
(a literal "elevenlabs" string, an inline `requests.get` to api.elevenlabs.io,
and inline parsing of ElevenLabs' specific webhook JSON shapes).

This module gives that a seam: a `VoiceProviderAdapter` interface plus a
registry (`VOICE_PROVIDER_REGISTRY`), the same shape as `connectors.py`'s
`BusinessConnector` / `MOCK_REGISTRY` / `LIVE_REGISTRY` / `CONNECTOR_META`.
Adding a second provider (Vapi, Retell, ...) later means writing one new
adapter class and adding one registry entry — no route, webhook, or database
schema changes required.

`ElevenLabsVoiceProvider` below is a pure relocation of the existing inline
logic (routes_admin.py's verify_voice GET call, routes_webhooks.py's
_parse_tool_call, ingest.py's post-call field extraction) — behavior,
field names, and response shapes are unchanged for the currently-live
ElevenLabs integration.
"""
import os
import logging

import requests

from security import verify_elevenlabs_signature

logger = logging.getLogger("orbit.voice_providers")


class VoiceProviderAdapter:
    """Universal base class for all voice AI platform integrations."""
    key = "base"

    def verify_agent(self, agent_id: str) -> dict:
        """Check the agent still exists / is reachable with configured credentials.
        Returns {"ok": bool}. Never raises — callers treat exceptions as failure."""
        raise NotImplementedError

    def verify_webhook_signature(self, raw_body: bytes, header: str, secret: str) -> bool:
        raise NotImplementedError

    def parse_post_call(self, raw_payload: dict) -> dict:
        """Normalize a provider-specific post-call webhook body into ORBIT's
        canonical shape (the same keys ingest.ingest_post_call already builds
        its `conversations` document from)."""
        raise NotImplementedError

    def parse_tool_call(self, raw_payload: dict) -> dict:
        """Normalize a provider-specific live tool-call webhook body into
        {"agent_id", "tool_name", "parameters", "conversation_id", "tool_call_id"}."""
        raise NotImplementedError


class ElevenLabsVoiceProvider(VoiceProviderAdapter):
    """Relocated, behavior-identical wrapper around ElevenLabs' Conversational AI API."""
    key = "elevenlabs"

    def verify_agent(self, agent_id: str) -> dict:
        try:
            r = requests.get(
                f"https://api.elevenlabs.io/v1/convai/agents/{agent_id}",
                headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]}, timeout=10,
            )
            return {"ok": r.status_code == 200}
        except Exception:
            return {"ok": False}

    def verify_webhook_signature(self, raw_body: bytes, header: str, secret: str) -> bool:
        return verify_elevenlabs_signature(raw_body, header or "", secret or "")

    def parse_tool_call(self, payload: dict) -> dict:
        """Accept both flat and ElevenLabs-wrapped tool-call bodies.

        Tenant is NEVER taken from the payload. conversation_id is copied from the
        envelope so capture_lead can link to the later post-call record.
        (Moved verbatim from routes_webhooks.py's former _parse_tool_call.)
        """
        inner = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        tool_obj = None
        if isinstance(inner.get("tool_call"), dict):
            tool_obj = inner["tool_call"]
        elif isinstance(inner.get("tool"), dict):
            tool_obj = inner["tool"]
        elif isinstance(inner.get("tool_calls"), list) and inner["tool_calls"] and isinstance(inner["tool_calls"][0], dict):
            tool_obj = inner["tool_calls"][0]
        agent_id = inner.get("agent_id") or payload.get("agent_id")
        if not agent_id and isinstance(inner.get("agent"), dict):
            agent_id = inner["agent"].get("id") or inner["agent"].get("agent_id")
        tool_name = inner.get("tool_name") or payload.get("tool_name")
        if not tool_name and isinstance(inner.get("tool"), str):
            tool_name = inner.get("tool")
        if not tool_name and tool_obj:
            tool_name = tool_obj.get("tool_name") or tool_obj.get("name") or tool_obj.get("tool")
        parameters = inner.get("parameters") or inner.get("args") or inner.get("arguments") or payload.get("parameters")
        if not isinstance(parameters, dict) and tool_obj:
            parameters = tool_obj.get("parameters") or tool_obj.get("args") or tool_obj.get("arguments")
        if not isinstance(parameters, dict):
            parameters = {}
        conversation_id = inner.get("conversation_id") or payload.get("conversation_id")
        tool_call_id = (
            inner.get("tool_call_id") or payload.get("tool_call_id")
            or inner.get("request_id") or payload.get("request_id")
        )
        if not tool_call_id and tool_obj:
            tool_call_id = tool_obj.get("tool_call_id") or tool_obj.get("id")
        return {
            "agent_id": agent_id,
            "tool_name": tool_name,
            "parameters": parameters,
            "conversation_id": conversation_id,
            "tool_call_id": tool_call_id,
        }

    def parse_post_call(self, data: dict) -> dict:
        """Normalize ElevenLabs' post-call payload into the canonical shape
        ingest.ingest_post_call() builds its `conversations` doc from.
        (Moved verbatim from ingest.py's former inline field extraction.)
        """
        def _as_int(value, default: int = 0) -> int:
            try:
                if value is None or value == "":
                    return default
                return int(float(value))
            except (TypeError, ValueError):
                return default

        def _clean_str(value):
            if value is None:
                return None
            if isinstance(value, str):
                text = value.strip()
                return text or None
            return None

        def _eval_flag(eval_criteria: dict, key: str) -> bool:
            val = (eval_criteria or {}).get(key)
            if isinstance(val, dict):
                result = str(val.get("result") or "").lower()
                return result in ("success", "true", "yes")
            if val is True:
                return True
            if isinstance(val, str):
                return val.strip().lower() in ("true", "yes", "1", "success")
            return False

        def _recording_ref(data: dict, meta: dict):
            candidates = (
                meta.get("recording_url"), meta.get("audio_url"), meta.get("recording_ref"),
                data.get("recording_url"), data.get("audio_url"), data.get("recording_ref"),
            )
            for raw in candidates:
                text = _clean_str(raw)
                if text:
                    return text
            return None

        def _transcript(data: dict) -> list:
            raw = data.get("transcript")
            return raw if isinstance(raw, list) else []

        def _derive_outcome(follow_up: bool, call_success, custom_data: dict):
            if follow_up:
                return "follow_up_required"
            if call_success == "failure" or call_success is False:
                return "unresolved"
            if call_success == "success" or call_success is True:
                return "resolved"
            intent = _clean_str((custom_data or {}).get("intent"))
            return intent.lower() if intent else None

        def _external_number(meta: dict):
            phone = meta.get("phone_call") if isinstance(meta.get("phone_call"), dict) else {}
            wa = meta.get("whatsapp") if isinstance(meta.get("whatsapp"), dict) else {}
            return (
                _clean_str(phone.get("external_number"))
                or _clean_str(wa.get("user_id"))
                or _clean_str(wa.get("from"))
                or _clean_str(wa.get("external_number"))
                or _clean_str(meta.get("user_id"))
            )

        def _direction(meta: dict) -> str:
            phone = meta.get("phone_call") if isinstance(meta.get("phone_call"), dict) else {}
            wa = meta.get("whatsapp") if isinstance(meta.get("whatsapp"), dict) else {}
            return phone.get("direction") or wa.get("direction") or "inbound"

        agent_id = data.get("agent_id")
        conv_id = data.get("conversation_id")
        meta = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
        analysis = data.get("analysis") if isinstance(data.get("analysis"), dict) else {}
        duration = _as_int(meta.get("call_duration_secs"), 0)

        custom_data = analysis.get("custom_analysis_data") or analysis.get("data_collection_results") or {}
        if not isinstance(custom_data, dict):
            custom_data = {}
        eval_criteria = analysis.get("evaluation_criteria_results") or {}
        if not isinstance(eval_criteria, dict):
            eval_criteria = {}
        follow_up = bool(custom_data.get("follow_up_required")) or _eval_flag(eval_criteria, "follow_up_required")
        if isinstance(custom_data.get("follow_up_required"), str):
            follow_up = custom_data.get("follow_up_required").strip().lower() in ("true", "yes", "1")
        call_success = analysis.get("call_successful")
        outcome = _derive_outcome(follow_up, call_success, custom_data)
        summary = analysis.get("transcript_summary")
        if not isinstance(summary, str):
            summary = ""
        title = analysis.get("call_summary_title")
        if not isinstance(title, str) or not title.strip():
            title = "Conversation"

        return {
            "agent_id": agent_id,
            "conversation_id": conv_id,
            "provider": self.key,
            "meta": meta,
            "direction": _direction(meta),
            "external_number": _external_number(meta),
            "caller_name": _clean_str(custom_data.get("caller_name") or analysis.get("caller_name")),
            "status": data.get("status") or "done",
            "call_successful": call_success,
            "outcome": outcome,
            "follow_up_required": follow_up,
            "duration_secs": duration,
            "transcript": _transcript(data),
            "summary_title": title,
            "summary": summary,
            "custom_analysis": custom_data,
            "recording_ref": _recording_ref(data, meta),
            "raw": data,
        }


VOICE_PROVIDER_REGISTRY: dict[str, VoiceProviderAdapter] = {
    "elevenlabs": ElevenLabsVoiceProvider(),
}


def get_voice_provider(key: str | None) -> VoiceProviderAdapter:
    return VOICE_PROVIDER_REGISTRY.get(key or "elevenlabs") or VOICE_PROVIDER_REGISTRY["elevenlabs"]


def list_voice_providers() -> list[dict]:
    """Admin-console catalogue, same idea as connectors.list_connectors()."""
    return [{"key": "elevenlabs", "label": "ElevenLabs (Conversational AI)"}]
