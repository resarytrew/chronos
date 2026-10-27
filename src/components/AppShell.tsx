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
              <b>Начать показ</b> — сначала проверьте предпросмотр. После завершения откройте ответы по одному.
            </li>
          </ol>
          <p className="mt-3 text-[1.02rem]">Для запоминания дат откройте в сценарии блок «Изучение дат»: выберите «По хронологии» или «Вперемешку» и нажмите «Изучать даты». Нажимайте на строки, чтобы раскрывать и скрывать даты. Этот режим также доступен в библиотеке.</p>
          <p className="mt-3 text-[1.02rem]">Для понятий выберите тип «Терминологический диктант» и создайте новую тему. Заполните пары «Понятие — определение» или вставьте список из таблицы. Диктант может показывать понятие или его определение; кнопка «Изучать понятия» сразу открывает список со скрытыми определениями, последовательно или вперемешку.</p>
          <h3 className="label-mute mt-6 mb-3">Другие занятия</h3>
          <p className="text-[1.02rem]">На странице «Сценарии» выберите тип нового занятия и нажмите «Новая тема»: последовательность событий, вопрос — ответ, выбор ответа или историческое изображение. Один набор содержит один тип заданий.</p>
          <p className="mt-3 text-[1.02rem]">В последовательности учитель задаёт правильный порядок карточек. Ученики меняют порядок у доски стрелками или перетаскиванием. Ответы и пояснения открываются отдельной кнопкой проверки.</p>
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
            <li>В диктанте шкала оценок считается из количества вопросов. Приложение не хранит индивидуальные оценки учеников.</li>
            <li>Во время разбора ответов отмечайте трудные события флажком — в «Истории» из них собирается «Работа над ошибками».</li>
            <li>Варианты А и Б печатаются с ключом для учителя на отдельной странице.</li>
            <li>Поиск учитывает содержимое заданий; класс, раздел и избранное помогают быстро найти набор.</li>
            <li>Экспорт набора включает изображения. Полная резервная копия также содержит историю и незавершённое занятие.</li>
            <li>Перед отключением сети дождитесь «Готово к работе без интернета». Обновление устанавливается по вашей команде после закрытия показа.</li>
            <li>При переходе в другую вкладку показ ставится на паузу. После перезагрузки можно продолжить с прежнего места.</li>
          </ul>
        </section>
      </div>
    </Dialog>
  );
}
