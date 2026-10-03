"use client";
import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Heart,
  MapPin,
  ArrowUpRight,
  BookOpen,
  Users,
  Plus,
} from "lucide-react";
import type { Person, Memory } from "@/lib/types";
import { initials, fmtDate } from "@/lib/utils";
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={"modal-content " + (wide ? "modal-wide" : "")}
          onOpenAutoFocus={() => {
            previousFocus.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (previousFocus.current?.isConnected)
              previousFocus.current.focus({ preventScroll: true });
            else
              document
                .querySelector<HTMLElement>(".main-content")
                ?.focus({ preventScroll: true });
          }}
        >
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description
                className={description ? "modal-description" : "sr-only"}
              >
                {description || title}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button"
                aria-label="Schließen"
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Avatar({
  person,
  size = "normal",
}: {
  person: Pick<Person, "name" | "avatarId">;
  size?: string;
}) {
  const color =
    person.name.split("").reduce((n, c) => n + c.charCodeAt(0), 0) % 6;
  return (
    <span className={`avatar avatar-${size} color-${color}`}>
      {person.avatarId ? (
        <img src={`/api/attachments/${person.avatarId}?thumb=1`} alt="" />
      ) : (
        initials(person.name)
      )}
    </span>
  );
}
export function Empty({
  kind = "memory",
  title,
  description,
  action,
  onAction,
}: {
  kind?: string;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        {kind === "person" ? (
          <Users size={27} />
        ) : kind === "map" ? (
          <MapPin size={27} />
        ) : (
          <BookOpen size={27} />
        )}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="button primary" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}
export function MemoryCard({
  memory,
  onOpen,
  onFavorite,
}: {
  memory: Memory;
  onOpen: () => void;
  onFavorite: () => void;
}) {
  return (
    <article className="memory-card">
      <div className="memory-photo">
        <button
          className="photo-open"
          onClick={onOpen}
          aria-label={memory.title}
        >
          {memory.attachments[0] ? (
            <img
              src={`/api/attachments/${memory.attachments[0].id}?thumb=1`}
              alt={memory.title}
              loading="lazy"
            />
          ) : (
            <div className={"memory-cover cover-" + memory.type}>
              <BookOpen size={32} />
              <span>{memory.type}</span>
            </div>
          )}
        </button>
        <span className="photo-tag">{memory.type}</span>
        <button
          className={
            "favorite-button " + (memory.favorite ? "is-favorite" : "")
          }
          aria-label={
            memory.favorite ? "Aus Favoriten entfernen" : "Als Favorit merken"
          }
          aria-pressed={memory.favorite}
          onClick={onFavorite}
        >
          <Heart size={16} fill={memory.favorite ? "currentColor" : "none"} />
        </button>
        {memory.draft && <span className="draft-badge">Entwurf</span>}
      </div>
      <div className="memory-card-body">
        <div className="memory-date">
          {fmtDate(memory.startAt)}
          <span>·</span>
          {memory.mood}
        </div>
        <button className="title-button" onClick={onOpen}>
          {memory.title}
        </button>
        <div className="memory-location">
          <MapPin size={13} />
          {memory.place?.name || "Ein Moment für dich"}
        </div>
        <div className="memory-card-footer">
          <div className="avatar-stack">
            {memory.people.slice(0, 3).map((p) => (
              <Avatar key={p.id} person={p} size="tiny" />
            ))}
          </div>
          <span>
            {memory.people.length
              ? memory.people
                  .map((p) => p.name.split(" ")[0])
                  .slice(0, 2)
                  .join(" & ") +
                (memory.people.length > 2
                  ? ` +${memory.people.length - 2}`
                  : "")
              : "Nur du"}
          </span>
          <button
            onClick={onOpen}
            className="card-arrow"
            aria-label={`${memory.title} öffnen`}
          >
            <ArrowUpRight size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}
