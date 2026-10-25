"use client";

import { memo, type KeyboardEvent } from "react";
import type { EventItem } from "@/lib/types";
import { ERAS, ERA_MAP } from "@/lib/eras";
import { Icons, Menu } from "@/components/ui";

interface Props {
  item: EventItem;
  index: number;
  total: number;
  warn: boolean;
  dragging: boolean;
  over: boolean;
  onChange: (id: string, patch: Partial<EventItem>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onEnter: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: (id: string) => void;
  onDragEnd: () => void;
}

function EventRowInner({
  item,
  index,
  total,
  warn,
  dragging,
  over,
  onChange,
  onDelete,
  onMove,
  onEnter,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const era = item.era ? ERA_MAP[item.era] : null;

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter(item.id);
    }
  };

  return (
    <div
      className="event-row"
      data-warn={warn}
      data-dragging={dragging}
      data-over={over}
      data-event-id={item.id}
      style={{ ["--era" as string]: era?.color ?? "transparent" }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(item.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(item.id);
      }}
    >
      <div
        className="drag-handle"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", item.id);
          onDragStart(item.id);
        }}
        onDragEnd={onDragEnd}
        title="Перетащите, чтобы изменить порядок"
        aria-label="Перетащить"
      >
        <Icons.Grip />
      </div>
      <div className="text-center text-[1.05rem] tabular-nums text-mute">{index + 1}</div>
      <input
        className="field field-sm font-medium tabular-nums"
        value={item.dateText}
        placeholder="Дата"
        aria-label="Дата"
        onChange={(e) => onChange(item.id, { dateText: e.target.value })}
        onKeyDown={onKey}
        data-field="date"
      />
      <input
        className="field field-sm col-title"
        value={item.title}
        placeholder="Событие"
        aria-label="Событие"
        onChange={(e) => onChange(item.id, { title: e.target.value })}
        onKeyDown={onKey}
        data-field="title"
      />
      <div className="flex items-center gap-0.5">
        <Menu
          trigger={
            <button type="button" className="btn btn-ghost btn-icon btn-sm" title={era ? `Эпоха: ${era.label}` : "Эпоха не задана"} aria-label="Эпоха">
              <span
                className="inline-block h-4 w-4 rounded-full border"
                style={{ background: era?.color ?? "transparent", borderColor: era ? era.color : "#b9b9b5" }}
              />
            </button>
          }
          items={[
            { label: "Без эпохи", icon: <span className="inline-block h-3.5 w-3.5 rounded-full border border-line" />, onClick: () => onChange(item.id, { era: null }) },
            ...ERAS.map((e) => ({
              label: (
                <span className="flex flex-col leading-tight">
                  <span>{e.label}</span>
                  <span className="text-xs text-mute">{e.short}</span>
                </span>
              ),
              icon: <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ background: e.color }} />,
              onClick: () => onChange(item.id, { era: e.key }),
            })),
          ]}
        />
        <div className="hidden sm:flex">
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onMove(item.id, -1)} disabled={index === 0} aria-label="Выше">
            <Icons.Up size={18} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onMove(item.id, 1)} disabled={index === total - 1} aria-label="Ниже">
            <Icons.Down size={18} />
          </button>
        </div>
        <button type="button" className="btn btn-ghost btn-icon btn-sm btn-danger" onClick={() => onDelete(item.id)} aria-label="Удалить">
          <Icons.Trash size={19} />
        </button>
      </div>
    </div>
  );
}

const EventRow = memo(EventRowInner);
export default EventRow;
