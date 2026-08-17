"""Provider interface layer. Real ElevenLabs / Exotel / WhatsApp calls are MOCKED
for the preview environment; swap implementations to wire real keys later.
Secrets stay server-side only and are never returned to the client."""
import random
from models import gen_id, now_iso


class TelephonyProvider:
    name = "generic"

    def connect_number(self, tenant_id: str, number: str) -> dict:
        raise NotImplementedError


class ExotelProvider(TelephonyProvider):
    """MOCKED Exotel telephony provider."""
    name = "exotel"

    def connect_number(self, tenant_id: str, number: str) -> dict:
        return {"status": "connected", "provider": "exotel", "number": number, "connected_at": now_iso()}

    def initiate_call(self, from_number: str, to_number: str, agent_id: str, direction: str) -> dict:
        return {"provider_call_id": gen_id("exocall_"), "status": "initiated", "direction": direction}


_SCENARIOS = [
    {
        "title": "Room booking enquiry",
        "summary": "Guest asked about deluxe room availability for this weekend and was quoted tariff with GST. Booking held for 30 minutes.",
        "turns": [
            ("agent", "Good afternoon, thank you for calling The Taj Palace. This is Riya, how may I help you today?"),
            ("user", "Hi, do you have a deluxe room available this Saturday night?"),
            ("agent", "Let me check for you. Yes, we have a Deluxe King available this Saturday at ₹14,500 plus GST. Would you like me to hold it?"),
            ("user", "Yes please, hold it under Rohan Mehta."),
            ("agent", "Done. I've held a Deluxe King for Rohan Mehta for Saturday. You'll receive a confirmation on WhatsApp shortly. Anything else?"),
            ("user", "No that's all, thank you."),
            ("agent", "My pleasure. We look forward to welcoming you."),
        ],
    },
    {
        "title": "Wake-up call request",
        "summary": "In-house guest in room 412 requested a 6:00 AM wake-up call and early breakfast.",
        "turns": [
            ("agent", "Good evening, The Taj Palace front desk, Riya speaking."),
            ("user", "This is room 412, can I get a wake-up call at 6 AM tomorrow?"),
            ("agent", "Absolutely, a 6:00 AM wake-up call is set for room 412. Would you like breakfast arranged early as well?"),
            ("user", "Yes, 6:30 would be great."),
            ("agent", "Noted, breakfast at 6:30 AM. Have a restful night."),
        ],
    },
    {
        "title": "Restaurant reservation",
        "summary": "Guest reserved a table for four at the rooftop restaurant for 8 PM, noting one vegetarian preference.",
        "turns": [
            ("agent", "Thank you for calling The Taj Palace, this is Riya."),
            ("user", "I'd like to book a table for four at your rooftop restaurant tonight."),
            ("agent", "Wonderful. What time would suit you?"),
            ("user", "Around 8 PM. One of us is vegetarian."),
            ("agent", "A table for four at 8:00 PM with a vegetarian note is confirmed. See you this evening!"),
        ],
    },
    {
        "title": "Checkout and billing query",
        "summary": "Guest requested a late checkout at 2 PM and a copy of the GST invoice by email.",
        "turns": [
            ("agent", "The Taj Palace, Riya here. How can I assist?"),
            ("user", "Can I get a late checkout tomorrow, and my GST invoice on email?"),
            ("agent", "I can offer a 2:00 PM late checkout at no charge. Your GST invoice will be emailed to the address on file. Anything else?"),
            ("user", "That's perfect, thanks."),
            ("agent", "Glad to help. Enjoy the rest of your stay."),
        ],
    },
]


class ElevenLabsProvider:
    """MOCKED ElevenLabs voice-agent provider. provider_agent_id is stored abstractly."""
    name = "elevenlabs"

    def build_post_call_event(self, agent_id: str, direction: str = "inbound", external_number: str | None = None) -> dict:
        scenario = random.choice(_SCENARIOS)
        duration = random.randint(45, 210)
        transcript = []
        offset = 0
        step = max(3, duration // max(1, len(scenario["turns"])))
        for role, message in scenario["turns"]:
            transcript.append({"role": role, "message": message, "time_offset_secs": offset})
            offset += step
        number = external_number or f"+9198{random.randint(10000000, 99999999)}"
        return {
            "type": "post_call_transcription",
            "event_timestamp": int(offset),
            "data": {
                "agent_id": agent_id,
                "conversation_id": gen_id("conv_"),
                "status": "done",
                "transcript": transcript,
                "metadata": {
                    "call_duration_secs": duration,
                    "phone_call": {"direction": direction, "external_number": number},
                },
                "analysis": {
                    "call_summary_title": scenario["title"],
                    "transcript_summary": scenario["summary"],
                },
            },
        }


class WhatsAppProvider:
    """MOCKED ElevenLabs-supported WhatsApp provider (managed onboarding)."""
    name = "elevenlabs_whatsapp"


exotel = ExotelProvider()
elevenlabs = ElevenLabsProvider()
whatsapp = WhatsAppProvider()
