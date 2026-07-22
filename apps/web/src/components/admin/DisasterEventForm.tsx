"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@mboyo/ui";

/**
 * Event Bencana creation form (BLOCK 27) — name + optional starts_at +
 * optional geofence as raw GeoJSON Polygon text. A dedicated map-drawing
 * geofence editor is out of this block's scope (no such UI exists
 * anywhere in this codebase yet) — accepting GeoJSON text directly is the
 * honest, functional minimum: create_disaster_event() converts it via
 * st_geomfromgeojson server-side, so a caller who has geofence
 * coordinates (e.g. from an external GIS tool) can still set one.
 */
export function DisasterEventForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [geofenceGeoJson, setGeofenceGeoJson] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          geofenceGeoJson: geofenceGeoJson.trim().length > 0 ? geofenceGeoJson.trim() : undefined,
        }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Gagal membuat event bencana.");
        return;
      }
      setName("");
      setGeofenceGeoJson("");
      router.refresh();
    } catch {
      setError("Gagal menghubungi server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-brand-border bg-surface-container-lowest p-4">
      <div className="flex flex-col gap-1">
        <label className="font-sans text-xs font-semibold text-on-surface">Nama Event</label>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Gempa Cianjur 2026" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-sans text-xs font-semibold text-on-surface">Geofence (GeoJSON Polygon, opsional)</label>
        <Textarea
          value={geofenceGeoJson}
          onChange={(event) => setGeofenceGeoJson(event.target.value)}
          placeholder='{"type":"Polygon","coordinates":[[[106.8,-6.2],...]]}'
        />
      </div>

      {error ? <p className="font-sans text-xs text-brand-critical-red">{error}</p> : null}

      <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting || name.trim().length === 0} className="self-start">
        {isSubmitting ? "Membuat..." : "Buat Event Bencana"}
      </Button>
    </div>
  );
}
