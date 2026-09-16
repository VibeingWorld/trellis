"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type FormEvent } from "react";
import { MarkdownPreview } from "./MarkdownPreview";
import type { CardDetailCallbacks, CardDetailData, NewCardLink } from "./types";
import styles from "./card-detail.module.css";

type CardDetailPanelProps = CardDetailCallbacks & {
  open: boolean;
  card: CardDetailData;
};

type AsyncAction = () => void | Promise<void>;

function Icon({ name }: { name: "close" | "link" | "image" | "tag" | "board" | "trash" | "external" | "pdf" | "copy" }) {
  const paths = {
    close: <path d="m6 6 12 12M18 6 6 18" />,
    link: <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" />,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    tag: <path d="M20.6 13.6 13.7 20.5a2 2 0 0 1-2.8 0l-7.4-7.4A2 2 0 0 1 3 11.7V5a2 2 0 0 1 2-2h6.7a2 2 0 0 1 1.4.6l7.5 7.2a2 2 0 0 1 0 2.8ZM8 8h.01" />,
    board: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 8v8M16 8v5" /></>,
    trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />,
    external: <path d="M14 4h6v6M20 4l-9 9M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />,
    pdf: <><path d="M6 2h8l5 5v15H6z"/><path d="M14 2v6h5M8 16h8M8 12h5"/></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function validateExternalUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function toDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
const uploadTypes=["image/jpeg","image/png","image/webp","image/gif","application/pdf","text/plain","text/csv","application/json","application/zip","application/msword","application/vnd.ms-excel","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.openxmlformats-officedocument.presentationml.presentation"];
const canUploadFile=(file:File)=>uploadTypes.includes(file.type)||/\.(txt|md|csv|json|zip|doc|docx|xls|xlsx|ppt|pptx)$/i.test(file.name);

export function CardDetailPanel({ open, card, onClose, onSave, onToggleTag, onCreateTag, onAddLink, onRemoveLink, onCreateGithubIssue, onLinkGithubIssue, onUnlinkGithubIssue, onUploadImages, onRemoveAttachment, onSetCover, onNavigatePlacement, onRemovePlacement, onArchiveEverywhere }: CardDetailPanelProps) {
  const titleId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [dueDate, setDueDate] = useState(card.dueDate || "");
  const [scheduledStart, setScheduledStart] = useState(toDateTimeInput(card.scheduledStart));
  const [scheduledEnd, setScheduledEnd] = useState(toDateTimeInput(card.scheduledEnd));
  const [editorMode, setEditorMode] = useState<"write" | "preview">("write");
  const [linkDraft, setLinkDraft] = useState<NewCardLink>({ label: "", url: "" });
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [githubUrl,setGithubUrl]=useState("");
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#38bdf8");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = title.trim() !== card.title || description !== card.description || dueDate !== (card.dueDate || "") || scheduledStart !== toDateTimeInput(card.scheduledStart) || scheduledEnd !== toDateTimeInput(card.scheduledEnd);

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description);
    setDueDate(card.dueDate || "");
    setScheduledStart(toDateTimeInput(card.scheduledStart));
    setScheduledEnd(toDateTimeInput(card.scheduledEnd));
    setMessage(null);
  }, [card.id, card.title, card.description, card.dueDate, card.scheduledStart, card.scheduledEnd]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && dirty) void save();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function run(label: string, action: AsyncAction, success?: string) {
    setBusy(label);
    setMessage(null);
    try {
      await action();
      if (success) setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if(!onSave)return;
    if (!title.trim()) {
      setMessage("Give this card a title before saving.");
      return;
    }
    if (scheduledStart && scheduledEnd && new Date(scheduledEnd) <= new Date(scheduledStart)) {
      setMessage("End time must be after start time.");
      return;
    }
    await run("save", () => onSave({ title: title.trim(), description, dueDate: scheduledStart ? scheduledStart.slice(0, 10) : dueDate || null, scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : null, scheduledEnd: scheduledEnd ? new Date(scheduledEnd).toISOString() : null }), "Card saved");
  }

  async function addLink(event: FormEvent) {
    event.preventDefault();
    const url = linkDraft.url.trim();
    if (!validateExternalUrl(url)) {
      setMessage("Enter a complete http:// or https:// link.");
      return;
    }
    if (!onAddLink) return;
    await run("link", async () => {
      await onAddLink({ label: linkDraft.label.trim() || new URL(url).hostname, url });
      setLinkDraft({ label: "", url: "" });
      setShowLinkForm(false);
    }, "Link added");
  }

  async function createTag(event: FormEvent) {
    event.preventDefault();
    if (!newTagName.trim() || !onCreateTag) return;
    await run("tag-create", async () => {
      await onCreateTag({ name: newTagName.trim(), color: newTagColor });
      setNewTagName("");
      setShowNewTag(false);
    }, "Tag created");
  }

  function selectAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter(canUploadFile);
    if (!files.length || !onUploadImages) return;
    void run("upload", () => onUploadImages(files), `${files.length} attachment${files.length === 1 ? "" : "s"} uploaded`);
    event.target.value = "";
  }

  function dropAttachments(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files).filter(canUploadFile);
    if (files.length && onUploadImages) void run("upload", () => onUploadImages(files), "Attachments uploaded");
  }

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <span className={styles.eyebrow}>{card.workspaceName ? `${card.workspaceName} · ` : ""}{card.cardNumber?`Card #${card.cardNumber}`:"Card details"}</span>
            <input id={titleId} className={styles.titleInput} value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Card title" autoFocus disabled={!onSave}/>
          </div>
          <button className={styles.iconButton} type="button" onClick={onClose} aria-label="Close card details"><Icon name="close" /></button>
        </header>

        <div className={styles.body}>
          <main className={styles.main}>
            {card.tags.length > 0 && <div className={styles.tagRow} aria-label="Card tags">{card.tags.map((tag) => <span className={styles.tagPill} key={tag.id} style={{ "--tag-color": tag.color } as CSSProperties}>{tag.name}</span>)}</div>}

            <section className={styles.section} aria-labelledby={`${titleId}-description`}>
              <div className={styles.sectionHeading}>
                <div><span className={styles.sectionIndex}>01</span><h2 id={`${titleId}-description`}>Description</h2></div>
                <div className={styles.tabs} role="tablist" aria-label="Description mode">
                  <button type="button" role="tab" aria-selected={editorMode === "write"} className={editorMode === "write" ? styles.activeTab : ""} onClick={() => setEditorMode("write")}>Write</button>
                  <button type="button" role="tab" aria-selected={editorMode === "preview"} className={editorMode === "preview" ? styles.activeTab : ""} onClick={() => setEditorMode("preview")}>Preview</button>
                </div>
              </div>
              {editorMode === "write" ? (
                <div className={styles.editorWrap}>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add context, checklists, links, and notes…" aria-label="Card description in Markdown" disabled={!onSave}/>
                  <span className={styles.editorHint}>Markdown supported · ⌘ Enter to save</span>
                </div>
              ) : <MarkdownPreview source={description} className={styles.preview} />}
            </section>

            <section className={styles.section} aria-labelledby={`${titleId}-attachments`}>
              <div className={styles.sectionHeading}><div><span className={styles.sectionIndex}>02</span><h2 id={`${titleId}-attachments`}>Attachments</h2></div><span className={styles.count}>{card.attachments.length}</span></div>
              {card.attachments.length > 0 && (
                <div className={styles.gallery}>
                  {card.attachments.map((attachment) => (
                    <figure className={styles.attachment} key={attachment.id}>
                      {attachment.mimeType.startsWith("image/") ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={attachment.url} alt={attachment.name} /></> : <a className={styles.pdfPreview} href={attachment.url} target="_blank" rel="noreferrer"><Icon name="pdf" /><strong>{attachment.mimeType==="application/pdf"?"PDF":"FILE"}</strong><span>{attachment.mimeType==="application/pdf"?"Open document":"Download file"}</span></a>}
                      <figcaption><span title={attachment.name}>{attachment.name}</span><div>
                        {onSetCover && attachment.mimeType.startsWith("image/") && <button type="button" onClick={() => void run("cover", () => onSetCover(card.coverAttachmentId === attachment.id ? null : attachment.id))}>{card.coverAttachmentId === attachment.id ? "Cover ✓" : "Make cover"}</button>}
                        {onRemoveAttachment && <button className={styles.dangerText} type="button" aria-label={`Remove ${attachment.name}`} onClick={() => void run("attachment-remove", () => onRemoveAttachment(attachment.id))}>Remove</button>}
                      </div></figcaption>
                    </figure>
                  ))}
                </div>
              )}
              {onUploadImages && <div className={styles.dropzone} onDragOver={(event) => event.preventDefault()} onDrop={dropAttachments}>
                <Icon name="image" /><div><strong>Drop files here</strong><span>Images, PDF, Office, text or ZIP · up to 20 MB</span></div>
                <button type="button" onClick={() => fileInput.current?.click()} disabled={busy === "upload"}>{busy === "upload" ? "Uploading…" : "Browse"}</button>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.txt,.md,.csv,.json,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx" multiple hidden onChange={selectAttachments} />
              </div>}
            </section>

            <section className={styles.section} aria-labelledby={`${titleId}-links`}>
              <div className={styles.sectionHeading}><div><span className={styles.sectionIndex}>03</span><h2 id={`${titleId}-links`}>Links</h2></div>{onAddLink && <button className={styles.textButton} type="button" onClick={() => setShowLinkForm((value) => !value)}>+ Add link</button>}</div>
              {showLinkForm && <form className={styles.inlineForm} onSubmit={addLink}>
                <label><span>Label</span><input value={linkDraft.label} onChange={(event) => setLinkDraft((draft) => ({ ...draft, label: event.target.value }))} placeholder="Design file" /></label>
                <label className={styles.grow}><span>URL</span><input value={linkDraft.url} onChange={(event) => setLinkDraft((draft) => ({ ...draft, url: event.target.value }))} placeholder="https://…" required /></label>
                <button type="submit" disabled={busy === "link"}>Add</button>
              </form>}
              <div className={styles.linkList}>{card.links.length === 0 ? <p className={styles.empty}>Keep useful references with the card.</p> : card.links.map((link) => (
                <article className={styles.linkItem} key={link.id}><div className={styles.linkIcon}><Icon name="link" /></div><div><strong>{link.label}</strong><a href={link.url} target="_blank" rel="noreferrer">{link.url}<Icon name="external" /></a></div>{onRemoveLink && <button className={styles.iconButton} type="button" onClick={() => void run("link-remove", () => onRemoveLink(link.id))} aria-label={`Remove ${link.label}`}><Icon name="trash" /></button>}</article>
              ))}</div>
            </section>

            <section className={styles.section} aria-labelledby={`${titleId}-github`}>
              <div className={styles.sectionHeading}><div><span className={styles.sectionIndex}>04</span><h2 id={`${titleId}-github`}>GitHub</h2></div>{card.github?.link?.inProject&&<span className={styles.count}>In project</span>}</div>
              {!card.github?.configured?<p className={styles.empty}>Connect a repository from Workspace → Integrations & AI.</p>:card.github.link?<article className={styles.linkItem}><div className={styles.linkIcon}><Icon name="link" /></div><div><strong>#{card.github.link.issueNumber} · {card.github.link.issueTitle}</strong><a href={card.github.link.issueUrl} target="_blank" rel="noreferrer">Open GitHub issue<Icon name="external" /></a></div>{onUnlinkGithubIssue&&<button className={styles.iconButton} type="button" onClick={()=>void run("github-unlink",onUnlinkGithubIssue,"GitHub issue unlinked")} aria-label="Unlink GitHub issue"><Icon name="trash" /></button>}</article>:<div className={styles.githubSetup}><p>Create an issue in <strong>{card.github.owner}/{card.github.repo}</strong>, or link an existing one.</p><div><button className={styles.primaryButton} type="button" disabled={!onCreateGithubIssue||busy==="github-create"} onClick={()=>onCreateGithubIssue&&void run("github-create",onCreateGithubIssue,"GitHub issue created")}>Create issue</button></div><form className={styles.inlineForm} onSubmit={(event)=>{event.preventDefault();if(!validateExternalUrl(githubUrl)){setMessage("Enter a complete GitHub issue URL.");return;}if(onLinkGithubIssue)void run("github-link",async()=>{await onLinkGithubIssue(githubUrl);setGithubUrl("");},"GitHub issue linked");}}><label className={styles.grow}><span>Existing issue URL</span><input type="url" value={githubUrl} onChange={event=>setGithubUrl(event.target.value)} placeholder={`https://github.com/${card.github.owner}/${card.github.repo}/issues/1`} required /></label><button type="submit" disabled={!onLinkGithubIssue||busy==="github-link"}>Link</button></form></div>}
            </section>
          </main>

          <aside className={styles.sidebar}>
            <section className={styles.sideSection}>
              <h2><Icon name="board" />Schedule</h2>
              <div className={styles.dateField}><input type="date" value={dueDate} disabled={!onSave} onChange={(event) => { setDueDate(event.target.value); setScheduledStart(""); setScheduledEnd(""); }} aria-label="All-day date" />{onSave&&(dueDate || scheduledStart) && <button type="button" onClick={() => { setDueDate(""); setScheduledStart(""); setScheduledEnd(""); }}>Clear</button>}</div>
              <label className={styles.scheduleField}><span>Starts</span><input type="datetime-local" value={scheduledStart} disabled={!onSave} onChange={(event) => { const value = event.target.value; setScheduledStart(value); if (value) { setDueDate(value.slice(0, 10)); if (!scheduledEnd || new Date(scheduledEnd) <= new Date(value)) { const end = new Date(new Date(value).getTime() + 60 * 60 * 1000); setScheduledEnd(new Date(end.getTime() - end.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)); } } }} /></label>
              <label className={styles.scheduleField}><span>Ends</span><input type="datetime-local" value={scheduledEnd} min={scheduledStart} onChange={(event) => setScheduledEnd(event.target.value)} disabled={!onSave||!scheduledStart} /></label>
              <p className={styles.sharedNote}>Drag this card directly from any board column onto a day or hour in Calendar.</p>
            </section>
            {card.permalink && <section className={styles.sideSection}>
              <h2><Icon name="link" />Card URL</h2>
              <div className={styles.permalink}><a href={card.permalink} target="_blank" rel="noreferrer">Open shareable card URL</a><button type="button" aria-label="Copy card URL" onClick={() => void navigator.clipboard.writeText(new URL(card.permalink!, window.location.origin).href).then(() => setMessage("Card URL copied"))}><Icon name="copy" /></button></div>
            </section>}
            {card.aiRun&&<section className={styles.sideSection}><h2><Icon name="board" />Codex task</h2><div className={styles.aiStatus}><strong>{card.aiRun.status.replaceAll("_"," ")}</strong><span>{card.aiRun.threadId?`Task ${card.aiRun.threadId}`:card.aiRun.error||"Waiting for the desktop monitor…"}</span></div></section>}
            <section className={styles.sideSection}>
              <h2><Icon name="tag" />Tags</h2>
              <button className={styles.selectButton} type="button" onClick={() => setShowTags((value) => !value)}>{card.tags.length ? `${card.tags.length} selected` : "Select tags"}<span>⌄</span></button>
              {showTags && <div className={styles.tagMenu}>{card.availableTags.map((tag) => {
                const selected = card.tags.some((item) => item.id === tag.id);
                return <label key={tag.id}><input type="checkbox" checked={selected} onChange={() => onToggleTag && void run("tag", () => onToggleTag(tag.id, !selected))} disabled={!onToggleTag} /><span className={styles.colorDot} style={{ background: tag.color }} />{tag.name}</label>;
              })}{onCreateTag && <button className={styles.textButton} type="button" onClick={() => setShowNewTag((value) => !value)}>+ Create a tag</button>}
              {showNewTag && <form className={styles.newTagForm} onSubmit={createTag}><input type="color" value={newTagColor} onChange={(event) => setNewTagColor(event.target.value)} aria-label="Tag color" /><input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="Tag name" required /><button type="submit">Add</button></form>}</div>}
            </section>

            <section className={styles.sideSection}>
              <h2><Icon name="board" />Appears on</h2>
              <div className={styles.placementList}>{card.placements.map((placement) => <article key={placement.id} className={placement.isCurrent ? styles.currentPlacement : undefined}>
                <button type="button" onClick={() => onNavigatePlacement && void onNavigatePlacement(placement)} disabled={!onNavigatePlacement || placement.isCurrent}><strong>{placement.boardName}</strong><span>{placement.columnName}{placement.isCurrent ? " · Here" : ""}</span></button>
                {onRemovePlacement && !placement.isCurrent && <button className={styles.removePlacement} type="button" onClick={() => void run("placement-remove", () => onRemovePlacement(placement.id))} aria-label={`Remove from ${placement.boardName}`}>×</button>}
              </article>)}</div>
              {card.placements.length > 1 && <p className={styles.sharedNote}>Content edits are shared. Each board keeps its own column position.</p>}
            </section>

            {onArchiveEverywhere && <section className={`${styles.sideSection} ${styles.dangerZone}`}><button type="button" onClick={() => void run("archive", onArchiveEverywhere)}><Icon name="trash" />Archive everywhere</button></section>}
          </aside>
        </div>

        <footer className={styles.footer}>
          <div aria-live="polite" className={message?.includes("wrong") || message?.startsWith("Enter") || message?.startsWith("Give") ? styles.error : styles.status}>{message}</div>
          <div><button className={styles.secondaryButton} type="button" onClick={onClose}>Close</button>{onSave&&<button className={styles.primaryButton} type="button" onClick={() => void save()} disabled={!dirty || busy === "save"}>{busy === "save" ? "Saving…" : "Save changes"}</button>}</div>
        </footer>
      </section>
    </div>
  );
}
