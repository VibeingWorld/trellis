export type MaybePromise<T> = T | Promise<T>;

export type CardTag = {
  id: string;
  name: string;
  color: string;
};

export type CardLink = {
  id: string;
  label: string;
  url: string;
};

export type CardAttachment = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size?: number | null;
  width?: number | null;
  height?: number | null;
};

export type CardPlacementSummary = {
  id: string;
  boardId: string;
  boardName: string;
  columnName: string;
  isCurrent?: boolean;
};

export type CardDetailData = {
  id: string;
  cardNumber?: number;
  title: string;
  description: string;
  dueDate?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  workspaceName?: string;
  tags: CardTag[];
  availableTags: CardTag[];
  links: CardLink[];
  attachments: CardAttachment[];
  placements: CardPlacementSummary[];
  coverAttachmentId?: string | null;
  permalink?: string;
  github?: {configured:boolean;owner?:string|null;repo?:string|null;link?:{issueNumber:number;issueTitle:string;issueUrl:string;inProject:boolean}|null};
  aiRun?: {status:string;threadId?:string|null;error?:string|null;createdAt:number}|null;
};

export type CardContentDraft = Pick<CardDetailData, "title" | "description" | "dueDate" | "scheduledStart" | "scheduledEnd">;

export type NewCardLink = {
  label: string;
  url: string;
};

export type CardDetailCallbacks = {
  onClose: () => void;
  onSave?: (draft: CardContentDraft) => MaybePromise<void>;
  onToggleTag?: (tagId: string, attached: boolean) => MaybePromise<void>;
  onCreateTag?: (tag: Omit<CardTag, "id">) => MaybePromise<void>;
  onAddLink?: (link: NewCardLink) => MaybePromise<void>;
  onRemoveLink?: (linkId: string) => MaybePromise<void>;
  onCreateGithubIssue?: () => MaybePromise<void>;
  onLinkGithubIssue?: (url:string) => MaybePromise<void>;
  onUnlinkGithubIssue?: () => MaybePromise<void>;
  onUploadImages?: (files: File[]) => MaybePromise<void>;
  onRemoveAttachment?: (attachmentId: string) => MaybePromise<void>;
  onSetCover?: (attachmentId: string | null) => MaybePromise<void>;
  onNavigatePlacement?: (placement: CardPlacementSummary) => MaybePromise<void>;
  onRemovePlacement?: (placementId: string) => MaybePromise<void>;
  onArchiveEverywhere?: () => MaybePromise<void>;
};
