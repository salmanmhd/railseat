export type OddsLabel = "RAC" | "Good" | "Fair" | "Low" | "Unlikely" | "Unknown";

export interface WaitlistOdds {
  label: OddsLabel;
  /** Short explanation shown next to the label. */
  detail: string;
  /** Higher is better; used for sorting. */
  score: number;
}

const BANDS: { min: number; label: OddsLabel; score: number }[] = [
  { min: 70, label: "Good", score: 3 },
  { min: 40, label: "Fair", score: 2 },
  { min: 15, label: "Low", score: 1 },
  { min: 0, label: "Unlikely", score: 0 },
];

/**
 * A rough guide to whether a waitlisted ticket may confirm. It uses IRCTC's own
 * percentage when the response carries one, otherwise the current waitlist
 * position. It is not a guarantee, and does not know the train's cancellation history.
 */
export function waitlistOdds(status: string, prediction?: number): WaitlistOdds {
  if (prediction !== undefined && Number.isFinite(prediction)) {
    const band = BANDS.find((b) => prediction >= b.min)!;
    return { label: band.label, detail: `${Math.round(prediction)}% chance, estimated by IRCTC`, score: band.score + 0.5 };
  }

  const upper = status.toUpperCase();
  if (upper.includes("RAC")) {
    return { label: "RAC", detail: "You can travel, sharing a berth until others cancel", score: 3.5 };
  }

  // "GNWL12/WL8": the last WL number is the current position.
  const positions = [...upper.matchAll(/WL\s*(\d+)/g)].map((m) => parseInt(m[1], 10));
  if (positions.length === 0) return { label: "Unknown", detail: "No waitlist position given", score: -1 };

  const pos = positions[positions.length - 1];
  if (pos <= 5) return { label: "Good", detail: `Waitlist ${pos}, near the front`, score: 3 };
  if (pos <= 15) return { label: "Fair", detail: `Waitlist ${pos}`, score: 2 };
  if (pos <= 35) return { label: "Low", detail: `Waitlist ${pos}, needs many cancellations`, score: 1 };
  return { label: "Unlikely", detail: `Waitlist ${pos}, far from confirming`, score: 0 };
}
