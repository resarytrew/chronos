"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { loadPref, savePref } from "@/lib/client";
import { useApp } from "./AppProvider";
import { Dialog, Icons } from "./ui";

const NAV = [
  { href: "/", label: "Сценарии", icon: Icons.Doc, match: (p: string) => p === "/" || p.startsWith("/scenarios") },
  { href: "/library", label: "Библиотека", icon: Icons.Book, match: (p: string) => p.startsWith("/library") },
  { href: "/history", label: "История", icon: Icons.History, match: (p: string) => p.startsWith("/history") },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { openHelp, helpOpen, closeHelp } = useApp();

  useEffect(() => {
    setOpen(loadPref("sidebar-open", false));
  }, []);

  const toggle = () => {
    setOpen((v) => {
      savePref("sidebar-open", !v);
      return !v;
    });
  };

  return (
    <div className="app">
      <aside className="sidebar" data-open={open} aria-label="Навигация">
        <div className="mb-4 flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-icon" onClick={toggle} aria-label={open ? "Свернуть панель" : "Развернуть панель"} title={open ? "Свернуть" : "Развернуть"}>
            <Icons.Menu />
          </button>
          <Link href="/" className="nav-label flex items-center gap-2 text-[1.35rem] font-bold tracking-tight">
            <Icons.Logo size={26} />
            Хронос
          </Link>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="nav-item" data-active={n.match(pathname)} title={!open ? n.label : undefined}>
              <n.icon />
              <span className="nav-label">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <div className="hr mb-2" />
          <button type="button" className="nav-item" onClick={openHelp} title={!open ? "Помощь" : undefined}>
            <Icons.Help />
            <span className="nav-label">Помощь</span>
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
      <HelpDialog open={helpOpen} onClose={closeHelp} />
    </div>
  );
}

function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Помощь" wide>
      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h3 className="label-mute mb-3">Быстрый старт</h3>
          <ol className="list-decimal space-y-2 pl-5 text-[1.02rem]">
            <li>
              Нажмите <b>Быстрый диктант</b> и вставьте список из документа — по строке на событие: «1613 — Воцарение Михаила Романова».
            </li>
            <li>Проверьте список: редактор подсветит пустые строки и повторы, отсортирует по дате, подберёт эпохи.</li>
            <li>Справа выберите направление, режим смены (авто/вручную) и выборку на урок.</li>
            <li>
              <b>Начать показ</b> — доска откроется на весь экран. После «Диктант завершён» откройте ответы по одному.
            </li>
          </ol>
          <h3 className="label-mute mt-6 mb-3">Форматы строк при вставке</h3>
          <ul className="space-y-1 text-[0.98rem] text-ink-2">
            <li><code>1380 — Куликовская битва</code></li>
            <li><code>1670–1671 Восстание Степана Разина</code></li>
            <li><code>Крещение Руси — 988</code></li>
            <li><code>14 декабря 1825 г. Восстание декабристов</code></li>
            <li><code>IX век — образование государства Русь</code></li>
            <li><code>776 до н. э.	Первые Олимпийские игры</code> (через табуляцию)</li>
          </ul>
        </section>
        <section>
          <h3 className="label-mute mb-3">Горячие клавиши на доске</h3>
          <table className="w-full text-[1rem]">
            <tbody className="[&_td]:py-1.5 [&_td:first-child]:w-40">
              <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Предыдущий / следующий вопрос</td></tr>
              <tr><td><kbd>Пробел</kbd></td><td>Начать · пауза (авто) · следующий (вручную) · открыть ответ</td></tr>
              <tr><td><kbd>A</kbd> / <kbd>Ф</kbd></td><td>Переключить авто ↔ вручную</td></tr>
              <tr><td><kbd>R</kbd> / <kbd>К</kbd></td><td>Повторить вопрос голосом</td></tr>
              <tr><td><kbd>B</kbd> / <kbd>И</kbd></td><td>Шторка (затемнить экран)</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>Прервать показ / выйти</td></tr>
            </tbody>
          </table>
          <h3 className="label-mute mt-6 mb-3">Полезные мелочи</h3>
          <ul className="space-y-1.5 text-[0.98rem] text-ink-2">
            <li>Голосовой диктор озвучивает вопрос — удобно, если доска стоит далеко.</li>
            <li>Экран не гаснет во время показа (Wake Lock).</li>
            <li>Шкала оценок считается автоматически из количества вопросов.</li>
            <li>Во время разбора ответов отмечайте трудные события флажком — в «Истории» из них собирается «Работа над ошибками».</li>
            <li>Варианты А и Б печатаются с ключом для учителя на отдельной странице.</li>
            <li>Экспорт и импорт JSON — перенос сценариев между компьютерами.</li>
          </ul>
        </section>
      </div>
    </Dialog>
  );
}
