"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* ---------- icons (stroke 2, 24px grid) ---------- */

type IconProps = { size?: number; className?: string; strokeWidth?: number };

function I({ d, size = 22, className, strokeWidth = 2, children }: IconProps & { d?: string; children?: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {d ? <path d={d} /> : children}
    </svg>
  );
}

export const Icons = {
  Logo: (p: IconProps) => (
    <I {...p}>
      <path d="M3 21h18M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M12 3 3 8h18L12 3Z" />
    </I>
  ),
  Doc: (p: IconProps) => (
    <I {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </I>
  ),
  Book: (p: IconProps) => (
    <I {...p}>
      <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2V4ZM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7V4Z" />
    </I>
  ),
  History: (p: IconProps) => (
    <I {...p}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </I>
  ),
  Help: (p: IconProps) => (
    <I {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01" />
    </I>
  ),
  Menu: (p: IconProps) => <I {...p} d="M4 7h16M4 12h16M4 17h16" />,
  Plus: (p: IconProps) => <I {...p} d="M12 5v14M5 12h14" />,
  Paste: (p: IconProps) => (
    <I {...p}>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2M9 12h6M9 16h6" />
    </I>
  ),
  Trash: (p: IconProps) => (
    <I {...p}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </I>
  ),
  Grip: (p: IconProps) => (
    <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" fill="currentColor" className={p.className} aria-hidden="true">
      <circle cx="9" cy="6" r="1.7" />
      <circle cx="15" cy="6" r="1.7" />
      <circle cx="9" cy="12" r="1.7" />
      <circle cx="15" cy="12" r="1.7" />
      <circle cx="9" cy="18" r="1.7" />
      <circle cx="15" cy="18" r="1.7" />
    </svg>
  ),
  Play: (p: IconProps) => (
    <svg width={p.size ?? 22} height={p.size ?? 22} viewBox="0 0 24 24" fill="currentColor" className={p.className} aria-hidden="true">
      <path d="M7 4.5v15l12-7.5-12-7.5Z" />
    </svg>
  ),
  Pause: (p: IconProps) => (
    <svg width={p.size ?? 22} height={p.size ?? 22} viewBox="0 0 24 24" fill="currentColor" className={p.className} aria-hidden="true">
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </svg>
  ),
  Prev: (p: IconProps) => <I {...p} d="M15 5l-7 7 7 7" />,
  Next: (p: IconProps) => <I {...p} d="M9 5l7 7-7 7" />,
  Up: (p: IconProps) => <I {...p} d="M5 15l7-7 7 7" />,
  Down: (p: IconProps) => <I {...p} d="M5 9l7 7 7-7" />,
  Speaker: (p: IconProps) => (
    <I {...p}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
    </I>
  ),
  Close: (p: IconProps) => <I {...p} d="M6 6l12 12M18 6 6 18" />,
  Check: (p: IconProps) => <I {...p} d="M5 12.5l4.5 4.5L19 7.5" />,
  Flag: (p: IconProps) => <I {...p} d="M5 21V4h11l-1.5 4L16 12H5" />,
  Print: (p: IconProps) => (
    <I {...p}>
      <path d="M7 8V3h10v5M7 17H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-3" />
      <path d="M7 14h10v7H7z" />
    </I>
  ),
  Copy: (p: IconProps) => (
    <I {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </I>
  ),
  Shuffle: (p: IconProps) => (
    <I {...p}>
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </I>
  ),
  Sort: (p: IconProps) => <I {...p} d="M4 6h16M7 12h10M10 18h4" />,
  Sparkle: (p: IconProps) => <I {...p} d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  Eye: (p: IconProps) => (
    <I {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </I>
  ),
  Moon: (p: IconProps) => <I {...p} d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  Download: (p: IconProps) => <I {...p} d="M12 4v11M7 10l5 5 5-5M4 20h16" />,
  Upload: (p: IconProps) => <I {...p} d="M12 15V4M7 9l5-5 5 5M4 20h16" />,
  More: (p: IconProps) => (
    <svg width={p.size ?? 22} height={p.size ?? 22} viewBox="0 0 24 24" fill="currentColor" className={p.className} aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  ),
  Repeat: (p: IconProps) => <I {...p} d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />,
  Expand: (p: IconProps) => <I {...p} d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />,
  Duplicate: (p: IconProps) => (
    <I {...p}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2M14 12v4M12 14h4" />
    </I>
  ),
  Columns: (p: IconProps) => (
    <I {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16" />
    </I>
  ),
  Monitor: (p: IconProps) => (
    <I {...p}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </I>
  ),
  Alert: (p: IconProps) => (
    <I {...p}>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 10v4M12 17.5h.01" />
    </I>
  ),
  Shade: (p: IconProps) => (
    <I {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 4v6" />
    </I>
  ),
  Mic: (p: IconProps) => (
    <I {...p}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </I>
  ),
  Filter: (p: IconProps) => <I {...p} d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" />,
};

/* ---------- toggle ---------- */

export function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="row-setting cursor-pointer select-none">
      <span className="flex flex-col">
        <span className="text-[1.02rem]">{label}</span>
        {hint && <span className="text-sm text-mute">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className="toggle"
        data-on={on}
        onClick={() => onChange(!on)}
      />
    </label>
  );
}

/* ---------- segmented ---------- */

export function Seg<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`seg ${className ?? ""}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          data-active={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- dialog ---------- */

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" style={wide ? { maxWidth: 960 } : undefined} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
          <h2 className="text-[1.45rem] font-semibold tracking-tight">{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Закрыть">
            <Icons.Close />
          </button>
        </div>
        <div className="px-6 pb-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-3 px-6 pb-6">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- dropdown menu ---------- */

export function Menu({
  trigger,
  items,
  align = "right",
}: {
  trigger: ReactNode;
  items: { label: ReactNode; icon?: ReactNode; onClick: () => void; danger?: boolean }[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div className="menu" style={align === "left" ? { left: 0, right: "auto" } : undefined}>
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              className={it.danger ? "text-[#8c3f3f]" : ""}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.icon && <span className="text-mute">{it.icon}</span>}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- confirm ---------- */

export function Confirm({
  open,
  title,
  text,
  confirmLabel = "Удалить",
  extraAction,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel?: string;
  extraAction?: { label: string; onClick: () => void; danger?: boolean };
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          {extraAction && (
            <button
              type="button"
              className={extraAction.danger ? "btn text-[#8c3f3f]" : "btn"}
              onClick={() => {
                extraAction.onClick();
                onClose();
              }}
            >
              {extraAction.label}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {text && <p className="text-ink-2">{text}</p>}
    </Dialog>
  );
}
