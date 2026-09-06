import { useEffect, useState } from "react";
import { Loader2, Zap, Plus, Trash2, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadError } from "@/components/AsyncState";

const ROOM_TYPE_SUGGESTIONS = ["Deluxe Room", "Super Deluxe Room", "Suite", "Premium Suite", "Standard Room", "Executive Room"];

function ServiceRow({ service, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 bg-white group">
      <div className="flex-1 min-w-0">
        <Input
          placeholder="Service name (e.g. Haircut)"
          value={service.name}
          onChange={(e) => onChange({ ...service, name: e.target.value })}
          className="h-8 text-sm border-0 p-0 focus-visible:ring-0 font-medium"
        />
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-zinc-400 text-sm">₹</span>
        <Input
          type="number"
          placeholder="Price"
          value={service.price_inr || ""}
          onChange={(e) => onChange({ ...service, price_inr: parseFloat(e.target.value) || 0 })}
          className="h-8 w-24 text-sm"
        />
      </div>
      <button
        onClick={onRemove}
        className="text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
        title="Remove"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function RoomRateRow({ rate, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 bg-white group">
      <div className="flex-1 min-w-0">
        <Input
          placeholder="Room type (e.g. Deluxe Room)"
          value={rate.room_type}
          onChange={(e) => onChange({ ...rate, room_type: e.target.value })}
          className="h-8 text-sm border-0 p-0 focus-visible:ring-0 font-medium"
        />
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-zinc-400 text-sm">₹</span>
        <Input
          type="number"
          placeholder="Rate"
          value={rate.rate_inr || ""}
          onChange={(e) => onChange({ ...rate, rate_inr: parseFloat(e.target.value) || 0 })}
          className="h-8 w-28 text-sm"
        />
        <span className="text-zinc-400 text-xs">/night</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={rate.available !== false}
            onChange={(e) => onChange({ ...rate, available: e.target.checked })}
            className="rounded"
          />
          Available
        </label>
        {rate.available !== false && (
          <Input
            type="number"
            placeholder="Units"
            value={rate.available_units || ""}
            onChange={(e) => onChange({ ...rate, available_units: parseInt(e.target.value) || null })}
            className="h-8 w-16 text-sm"
            title="Available rooms"
          />
        )}
      </div>
      <button
        onClick={onRemove}
        className="text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
        title="Remove"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function BusinessData() {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  // Until the tenant's business type is known, default to "hotel" so the
  // existing hotel screen never flashes the generic form first.
  const [businessType, setBusinessType] = useState("hotel");
  const isHotel = businessType === "hotel";

  const [loadError, setLoadError] = useState(null);

  const loadData = () => {
    setLoadError(null);
    api.get("/tenant/live-data")
      .then((r) => setData(r.data))
      // Previously this fell back to a blank form on failure, so a failed load
      // looked exactly like an empty one — and pressing Save then wrote those
      // blanks over whatever was really stored.
      .catch((e) => {
        if (e?.response?.status !== 401) {
          setLoadError(formatApiErrorDetail(e?.response?.data?.detail));
        }
      });
    api.get("/tenant/profile").then((r) => setBusinessType(r.data?.business_type || "hotel")).catch(() => {});
  };

  useEffect(() => { loadData(); }, []);

  const setField = (k, v) => setData((p) => ({ ...p, [k]: v }));

  const addRoom = () =>
    setData((p) => ({
      ...p,
      room_rates: [...(p.room_rates || []), { room_type: "", rate_inr: 0, available: true, available_units: null }],
    }));

  const updateRoom = (idx, val) =>
    setData((p) => ({ ...p, room_rates: (p.room_rates || []).map((r, i) => (i === idx ? val : r)) }));

  const removeRoom = (idx) =>
    setData((p) => ({ ...p, room_rates: (p.room_rates || []).filter((_, i) => i !== idx) }));

  const addService = () =>
    setData((p) => ({ ...p, services: [...(p.services || []), { name: "", price_inr: 0 }] }));

  const updateService = (idx, val) =>
    setData((p) => ({ ...p, services: (p.services || []).map((s, i) => (i === idx ? val : s)) }));

  const removeService = (idx) =>
    setData((p) => ({ ...p, services: (p.services || []).filter((_, i) => i !== idx) }));

  // Fields this screen owns. The list is explicit so clearing one actually
  // saves: the old payload only included TRUTHY values, and the backend drops
  // nulls — so emptying a policy sent nothing, and the next render pulled the
  // old text straight back. Deleting a room rate had the same problem.
  const LIVE_FIELDS = [
    "room_rates", "check_in_time", "check_out_time",
    "buffet_breakfast", "buffet_lunch", "buffet_dinner",
    "cancellation_policy", "refund_policy", "active_offer", "seasonal_note",
    "catalogue_url", "services", "business_hours",
  ];

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      for (const k of LIVE_FIELDS) {
        const v = data[k];
        // undefined/null means "this screen has nothing to say about it" —
        // an empty string or empty list is a real, intentional value.
        if (v === undefined || v === null) continue;
        payload[k] = v;
      }
      const r = await api.patch("/tenant/live-data", payload);
      setData(r.data);
      toast.success("Live data updated — your AI will use these on the next call");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <LoadError error={loadError} onRetry={loadData} />;
  if (!data)
    return (
      <div className="p-10 grid place-items-center">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
      </div>
    );

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-amber-500" />
          <h1 className="text-xl font-semibold text-zinc-900">Business Data (Manual Entry)</h1>
        </div>
        <p className="text-sm text-zinc-500">
          Manage your property's rates, operating hours, and standard policies. These values are read directly by your AI employee during calls.
        </p>
        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Data Source Note:</strong> This is a manual dashboard data source managed directly by you. When your property integrates an external PMS/POS system, real-time inventory and booking operations will flow directly through that system's connector.
          </p>
        </div>
      </div>


      {isHotel && (
      <>
      {/* Room Rates */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-zinc-800">Room Rates & Availability</Label>
          <Button variant="outline" size="sm" onClick={addRoom} className="gap-1.5 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Room Type
          </Button>
        </div>
        {(!data.room_rates || data.room_rates.length === 0) ? (
          <div className="border border-dashed border-zinc-300 rounded-xl p-6 text-center text-sm text-zinc-400">
            No room types added yet. Click "Add Room Type" to configure live rates.
          </div>
        ) : (
          <div className="space-y-2">
            {(data.room_rates || []).map((rate, idx) => (
              <RoomRateRow key={idx} rate={rate} onChange={(v) => updateRoom(idx, v)} onRemove={() => removeRoom(idx)} />
            ))}
          </div>
        )}
        {data.room_rates?.length > 0 && (
          <p className="text-xs text-zinc-400">Tip: Uncheck "Available" to tell your AI the room is sold out without removing it.</p>
        )}
      </section>

      {/* Timings */}
      <section className="space-y-4">
        <Label className="text-sm font-semibold text-zinc-800">Check-in / Check-out Timings</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-500">Check-in Time</Label>
            <Input
              placeholder="e.g. 12:00 PM"
              value={data.check_in_time || ""}
              onChange={(e) => setField("check_in_time", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-500">Check-out Time</Label>
            <Input
              placeholder="e.g. 11:00 AM"
              value={data.check_out_time || ""}
              onChange={(e) => setField("check_out_time", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Buffet/Meal Timings */}
      <section className="space-y-4">
        <Label className="text-sm font-semibold text-zinc-800">Buffet / Meal Timings</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: "buffet_breakfast", label: "Breakfast", placeholder: "7:00 AM – 10:30 AM" },
            { key: "buffet_lunch", label: "Lunch", placeholder: "12:30 PM – 3:00 PM" },
            { key: "buffet_dinner", label: "Dinner", placeholder: "7:00 PM – 10:30 PM" },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs text-zinc-500">{label}</Label>
              <Input
                placeholder={placeholder}
                value={data[key] || ""}
                onChange={(e) => setField(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>
      </>
      )}

      {!isHotel && (
      <>
      {/* Services & Pricing (generic, non-hotel business types) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-zinc-800">Services & Pricing</Label>
          <Button variant="outline" size="sm" onClick={addService} className="gap-1.5 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Service
          </Button>
        </div>
        {(!data.services || data.services.length === 0) ? (
          <div className="border border-dashed border-zinc-300 rounded-xl p-6 text-center text-sm text-zinc-400">
            No services added yet. Click "Add Service" to list what you offer and their price.
          </div>
        ) : (
          <div className="space-y-2">
            {(data.services || []).map((service, idx) => (
              <ServiceRow key={idx} service={service} onChange={(v) => updateService(idx, v)} onRemove={() => removeService(idx)} />
            ))}
          </div>
        )}
      </section>

      {/* Business Hours */}
      <section className="space-y-4">
        <Label className="text-sm font-semibold text-zinc-800">Business Hours</Label>
        <div className="space-y-1.5">
          <Input
            placeholder="e.g. Mon–Sat, 10:00 AM – 8:00 PM. Closed Sundays."
            value={data.business_hours || ""}
            onChange={(e) => setField("business_hours", e.target.value)}
          />
        </div>
      </section>
      </>
      )}

      {/* Policies */}
      <section className="space-y-4">
        <Label className="text-sm font-semibold text-zinc-800">Policies</Label>
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-500">Cancellation Policy</Label>
          <Textarea
            placeholder="e.g. Free cancellation up to 24 hours before check-in. After that, 1 night charge applies."
            value={data.cancellation_policy || ""}
            onChange={(e) => setField("cancellation_policy", e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-500">Refund Policy</Label>
          <Textarea
            placeholder="e.g. Refunds processed within 5–7 business days to original payment method."
            value={data.refund_policy || ""}
            onChange={(e) => setField("refund_policy", e.target.value)}
            rows={2}
          />
        </div>
      </section>

      {/* Offers */}
      <section className="space-y-4">
        <Label className="text-sm font-semibold text-zinc-800">Active Offers & Special Notes</Label>
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-500">Active Offer / Promotion</Label>
          <Input
            placeholder="e.g. 20% off on Deluxe rooms this weekend. Use code WEEKEND20."
            value={data.active_offer || ""}
            onChange={(e) => setField("active_offer", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-500">Seasonal Note</Label>
          <Input
            placeholder="e.g. Diwali special package — complimentary breakfast included."
            value={data.seasonal_note || ""}
            onChange={(e) => setField("seasonal_note", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-500">Catalogue or brochure URL</Label>
          <Input
            placeholder="https://…"
            value={data.catalogue_url || ""}
            onChange={(e) => setField("catalogue_url", e.target.value)}
          />
          <p className="text-[11px] text-zinc-400">Stored for your AI to share. WhatsApp sending stays with the conversation engine.</p>
        </div>
      </section>

      {/* Last Updated */}
      {data.updated_at && (
        <p className="text-xs text-zinc-400">
          Last updated: {new Date(data.updated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}

      {/* Save */}
      <div className="pt-2 border-t border-zinc-100">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Save Live Data"}
        </Button>
      </div>
    </div>
  );
}
