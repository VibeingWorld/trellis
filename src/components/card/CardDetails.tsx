"use client";

import { CardDetailPanel } from "./CardDetailPanel";
import type { CardDetailCallbacks, CardDetailData, CardTag } from "./types";

export type CardDetailsProps = Omit<CardDetailCallbacks, "onUploadImages" | "onArchiveEverywhere"> & {
  open: boolean;
  card: Omit<CardDetailData, "availableTags">;
  availableTags: CardTag[];
  onUpload?: CardDetailCallbacks["onUploadImages"];
  onArchive?: CardDetailCallbacks["onArchiveEverywhere"];
};

/** Reusable, data-source agnostic card details surface. */
export function CardDetails({ card, availableTags, onUpload, onArchive, ...props }: CardDetailsProps) {
  return (
    <CardDetailPanel
      {...props}
      card={{ ...card, availableTags }}
      onUploadImages={onUpload}
      onArchiveEverywhere={onArchive}
    />
  );
}

