"use client";

import { action, type AppState } from "../board/api";
import { CardDetailPanel } from "./CardDetailPanel";
import type { CardDetailData } from "./types";
import { appPath } from "@/lib/app-path";

export type CardDetailProps = {
  cardId: string;
  placementId: string;
  state: AppState;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onNavigateBoard?: (boardId: string, cardId?: string) => void;
};

function getUploadUrl(attachment: AppState["attachments"][number]) {
  return appPath(attachment.url || `/api/uploads/${attachment.id}`);
}

/** App adapter used by the board. The reusable UI lives in CardDetailPanel. */
export function CardDetail({ cardId, placementId, state, onClose, onRefresh, onNavigateBoard }: CardDetailProps) {
  const card = state.cards.find((item) => item.id === cardId);
  const currentPlacement = state.placements.find((item) => item.id === placementId);
  if (!card || !currentPlacement) return null;

  const workspace = state.workspaces.find((item) => item.id === card.workspaceId);
  const attachedTagIds = new Set(state.cardTags.filter((item) => item.cardId === cardId).map((item) => item.tagId));
  const availableTags = state.tags.filter((tag) => tag.workspaceId === card.workspaceId);
  const placements = state.placements.filter((item) => item.cardId === cardId);
  const isAdmin=state.currentUser?.role==="admin",permissions=state.permissionsByWorkspace?.[card.workspaceId]||[];
  const canEdit=isAdmin||permissions.includes("editCard"),canMove=isAdmin||permissions.includes("moveCard"),canUpload=isAdmin||permissions.includes("uploadFiles");

  const detail: CardDetailData = {
    id: card.id,
    cardNumber: card.cardNumber,
    title: card.title,
    description: card.description || "",
    dueDate: card.dueDate || null,
    scheduledStart: card.scheduledStart || null,
    scheduledEnd: card.scheduledEnd || null,
    workspaceName: workspace?.name,
    permalink: appPath(`/cards/${encodeURIComponent(card.id)}`),
    tags: availableTags.filter((tag) => attachedTagIds.has(tag.id)),
    availableTags,
    links: state.links.filter((link) => link.cardId === cardId).map((link) => ({ id: link.id, label: link.title || link.label || "Link", url: link.url })),
    attachments: state.attachments.filter((attachment) => attachment.cardId === cardId).map((attachment) => ({
      id: attachment.id,
      name: attachment.name || attachment.originalName || attachment.filename || "Image",
      url: getUploadUrl(attachment),
      mimeType: attachment.mimeType || "image/*",
      size: attachment.size,
    })),
    coverAttachmentId: state.attachments.find((attachment) => attachment.url === card.cover)?.id || null,
    placements: placements.map((placement) => {
      const board = state.boards.find((item) => item.id === placement.boardId);
      const column = state.columns.find((item) => item.id === placement.columnId);
      return {
        id: placement.id,
        boardId: placement.boardId,
        boardName: board?.name || "Unknown board",
        columnName: column?.name || "Unknown column",
        isCurrent: placement.id === placementId,
      };
    }),
  };

  async function mutate(name: string, payload: Record<string, unknown>) {
    await action(name, payload);
    await onRefresh();
  }

  return (
    <CardDetailPanel
      open
      card={detail}
      onClose={onClose}
      onSave={canEdit?({ title, description, dueDate, scheduledStart, scheduledEnd }) => mutate("updateCard", { id: cardId, title, description, dueDate: dueDate || null, scheduledStart: scheduledStart || null, scheduledEnd: scheduledEnd || null, version: card.version }):undefined}
      onCreateTag={canEdit?({ name, color }) => mutate("createTag", { workspaceId: card.workspaceId, name, color }):undefined}
      onToggleTag={canEdit?(tagId) => mutate("toggleTag", { cardId, tagId }):undefined}
      onAddLink={canEdit?({ label, url }) => mutate("addLink", { cardId, title: label, url }):undefined}
      onRemoveLink={canEdit?(id) => mutate("deleteLink", { id }):undefined}
      onUploadImages={canUpload?async (files) => {
        for (const file of files) {
          const form = new FormData();
          form.append("file", file);
          form.append("cardId", cardId);
          const response = await fetch(appPath("/api/uploads"), { method: "POST", body: form });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Could not upload ${file.name}.`);
          }
        }
        await onRefresh();
      }:undefined}
      onRemoveAttachment={canUpload?(id) => mutate("deleteAttachment", { id }):undefined}
      onSetCover={canEdit?(attachmentId) => mutate("updateCard", { id: cardId, cover: attachmentId ? state.attachments.find((item) => item.id === attachmentId)?.url || `/api/uploads/${attachmentId}` : null, version: card.version }):undefined}
      onNavigatePlacement={(placement) => {
        if (placement.id === placementId) return;
        if (onNavigateBoard) onNavigateBoard(placement.boardId, cardId);
        else window.location.hash = `board=${encodeURIComponent(placement.boardId)}&card=${encodeURIComponent(cardId)}`;
      }}
      onRemovePlacement={canMove?(id) => mutate("removePlacement", { id, archiveIfLast: false }):undefined}
      onArchiveEverywhere={canEdit?() => mutate("updateCard", { id: cardId, archived: true, version: card.version }).then(onClose):undefined}
    />
  );
}

export default CardDetail;
