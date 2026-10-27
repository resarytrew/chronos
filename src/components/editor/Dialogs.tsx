"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RunItem } from "@/lib/types";
import { copyText, itemsToText, makeVariants, parsePasted, questionText, type ParsedLine, type Variants } from "@/lib/utils";
import { printVariants } from "@/lib/client";
import { Dialog, Icons, Seg } from "@/components/ui";
import LocalImage,{useImageSources} from "../LocalImage";

/* ---------- quick paste ---------- */

const EXAMPLE = `1613 — Воцарение Михаила Романова
1649 — Соборное уложение
1654 — Переяславская рада
1670–1671 — Восстание Степана Разина
1682 — Начало правления Петра I
1689 — Нерчинский договор`;

export function QuickPasteDialog({
  open,
  onClose,
  hasEvents,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  hasEvents: boolean;
  onApply: (rows: ParsedLine[], mode: "append" | "replace") => void;
}) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"append" | "replace">(hasEvents ? "append" : "replace");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setMode(hasEvents ? "append" : "replace");
      setTimeout(() => ref.current?.focus(), 50);
    }
  }, [open, hasEvents]);

  const rows = useMemo(() => parsePasted(text), [text]);
  const noDate = rows.filter((r) => !r.dateText).length;
  const duplicates=new Set(rows.filter((r,i)=>rows.findIndex(x=>x.title.trim().toLowerCase()===r.title.trim().toLowerCase())!==i).map(r=>r.title.trim().toLowerCase()));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Быстрая вставка списка"
      wide
      footer={
        <>
          {hasEvents && (
            <Seg
              value={mode}
              onChange={setMode}
              options={[
                { value: "append", label: "Добавить к списку" },
                { value: "replace", label: "Заменить список" },
              ]}
              className="mr-auto"
            />
          )}
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={rows.length === 0}
            onClick={() => {
              onApply(rows, mode);
              onClose();
            }}
          >
            <Icons.Check />
            Добавить {rows.length > 0 ? rows.length : ""}
          </button>
        </>
      }
    >
      <p className="mb-3 text-ink-2">
        Скопируйте список из документа — по одному событию в строке. Дата может стоять в начале или в конце строки:
        «1380 — Куликовская битва», «Крещение Руси — 988», «1670–1671 Восстание Разина».
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <textarea
            ref={ref}
            className="field"
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            spellCheck={false}
          />
          <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setText(EXAMPLE)}>
            Вставить пример
          </button>
        </div>
        <div className="card max-h-[360px] overflow-auto p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="label-mute">Предпросмотр</span>
            <span className="text-sm text-mute">
              {rows.length} стр.{noDate > 0 ? ` · без даты: ${noDate}` : ""}{duplicates.size ? " · возможные повторы: "+duplicates.size : ""}
            </span>
          </div>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-mute">Здесь появятся распознанные события</p>
          ) : (
            <table className="w-full text-[0.95rem]">
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-line-2">
                    <td className="w-8 py-1.5 pr-2 text-mute tabular-nums">{i + 1}</td>
                    <td className={`w-32 py-1.5 pr-3 font-medium tabular-nums ${r.dateText ? "" : "text-[#9a6a1a]"}`}>{r.dateText || "— нет даты"}</td>
                    <td className="py-1.5">{r.title || "— нет события"}{duplicates.has(r.title.trim().toLowerCase()) && <span className="ml-2 text-[#9a6a1a]">Возможный повтор</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/* ---------- variants А / Б ---------- */

export function VariantsDialog({
  open,
  onClose,
  title,
  baseItems,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  baseItems: RunItem[];
  toast: (m: string) => void;
}) {
  const [variants, setVariants] = useState<Variants>({ a: [], b: [] });
  const sources=useImageSources(baseItems);

  useEffect(() => {
    if (open) setVariants(makeVariants(baseItems));
  }, [open, baseItems]);

  const column = (label: string, items: RunItem[]) => (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[1.25rem] font-semibold">Вариант {label}</h3>
        <button
          type="button"
          className="btn btn-sm"
          onClick={async () => {
            const ok = await copyText(`${title} — Вариант ${label}\n` + itemsToText(items, false));
            toast(ok ? `Вариант ${label} скопирован` : "Не удалось скопировать");
          }}
        >
          <Icons.Copy size={18} />
          Копировать
        </button>
      </div>
      <ol className="space-y-1.5 text-[0.98rem]">
        {items.map((it, i) => (
          <li key={`${it.id}-${i}`} className="flex gap-2">
            <span className="w-6 text-right tabular-nums text-mute">{i + 1}.</span>
            <div className="min-w-0 flex-1">{it.questionDisplay==="image"&&it.illustration?<LocalImage id={it.illustration.imageId} alt={it.illustration.alt}/>:questionText(it)}</div>
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Варианты А и Б"
      wide
      footer={
        <>
          <button type="button" className="btn mr-auto" onClick={() => setVariants(makeVariants(baseItems))}>
            <Icons.Shuffle size={18} />
            Перегенерировать
          </button>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const ok = await copyText(
                `${title}\n\nВариант А\n${itemsToText(variants.a, false)}\n\nВариант Б\n${itemsToText(variants.b, false)}\n\nКлюч А\n${itemsToText(variants.a, true)}\n\nКлюч Б\n${itemsToText(variants.b, true)}`,
              );
              toast(ok ? "Оба варианта с ключом скопированы" : "Не удалось скопировать");
            }}
          >
            <Icons.Copy size={18} />
            Копировать всё с ключом
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (!printVariants(title, variants.a, variants.b,sources)) toast("Разрешите всплывающие окна для печати");
            }}
          >
            <Icons.Print size={18} />
            Печать раздатки с ключом
          </button>
        </>
      }
    >
      <p className="mb-4 text-ink-2">
        Один и тот же набор в разном порядке — для соседей по парте. На печать уходят два варианта по два экземпляра на лист и ключ для учителя на отдельной странице.
      </p>
      {baseItems.length === 0 ? (
        <p className="py-10 text-center text-mute">Нет событий для вариантов — проверьте выборку.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {column("А", variants.a)}
          {column("Б", variants.b)}
        </div>
      )}
    </Dialog>
  );
}
