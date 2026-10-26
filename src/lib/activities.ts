import type { ActivityTask, ActivityType, RunPlan, ScenarioFull } from './types';
import { buildRunPlan, shuffle, uid } from './utils';
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  dictation: 'Хронологический диктант', sequence: 'Хронологическая последовательность',
  qa: 'Вопрос — ответ', choice: 'Выбор ответа', image: 'Историческое изображение',
};
// Each new exercise is enabled only after its own acceptance checks.
export const ENABLED_ACTIVITIES: ActivityType[] = ['dictation','sequence','qa'];

export function taskError(task: ActivityTask): string | null {
  if (!task.id || !task.prompt?.trim()) return 'Заполните вопрос';
  if (task.type === 'sequence') {
    if (!Array.isArray(task.cards) || task.cards.length < 3 || task.cards.length > 8) return 'Нужно от 3 до 8 карточек';
    if (task.cards.some(c => !c.id || !c.text?.trim()) || new Set(task.cards.map(c => c.id)).size !== task.cards.length) return 'Заполните все карточки';
  } else if (task.type === 'choice') {
    if (!Array.isArray(task.options) || task.options.length < 2 || task.options.length > 4 || task.options.some(o => typeof o !== 'string' || !o.trim())) return 'Нужно от 2 до 4 заполненных вариантов';
    if (!Number.isInteger(task.correctIndex) || task.correctIndex < 0 || task.correctIndex >= task.options.length) return 'Выберите правильный ответ';
    if (new Set(task.options.map(o => o.trim().toLowerCase())).size !== task.options.length) return 'Варианты ответа должны отличаться';
  } else if (task.type === 'qa' || task.type === 'image') {
    if (typeof task.answer !== 'string' || !task.answer.trim()) return 'Заполните ответ';
    if (task.type === 'image' && (!task.imageId || !task.alt?.trim())) return 'Добавьте изображение и его описание';
    if (task.type === 'image' && task.source && !/^https?:\/\//i.test(task.source)) return 'Источник должен начинаться с https:// или http://';
  } else return 'Неизвестный тип задания';
  return null;
}
export function taskAnswer(task: ActivityTask): string {
  if (task.type === 'sequence') return task.cards.map((c,i) => (i + 1) + '. ' + c.text).join('; ');
  if (task.type === 'choice') return task.options[task.correctIndex] || '';
  return task.answer;
}
export function newTask(type: Exclude<ActivityType,'dictation'>): ActivityTask {
  const base = {id: uid(), prompt: '', explanation: ''};
  if (type === 'sequence') return {...base, type, prompt:'Расположите события в хронологическом порядке', cards: [1,2,3].map(() => ({id:uid(), text:''}))};
  if (type === 'choice') return {...base,type,options:['',''],correctIndex:0};
  if (type === 'image') return {...base,type,answer:'',imageId:'',alt:'',caption:'',source:''};
  return {...base,type,answer:''};
}
export function scenarioPlan(s: ScenarioFull): RunPlan {
  if (!s.activityType || s.activityType === 'dictation') return buildRunPlan({scenarioId:s.id,title:s.title,events:s.events,settings:s.settings,selection:{type:'all'}});
  const tasks = s.tasks ?? [];
  if (!tasks.length || tasks.some(t => taskError(t))) throw new Error('Заполните все задания перед показом');
  const ordered = s.settings.shuffle ? shuffle(tasks) : tasks;
  return {scenarioId:s.id,title:s.title,settings:{...s.settings,mode:'manual',direction:'event-to-date',voice:false},items:ordered.map(task => ({id:task.id,title:task.prompt,dateText:taskAnswer(task),era:null,ask:'date',task:structuredClone(task)}))};
}
export function initialOrder(task: ActivityTask): string[] {
  if (task.type !== 'sequence') return [];
  const correct = task.cards.map(c=>c.id);
  const order = shuffle(correct);
  return order.every((id,i)=>id === correct[i]) ? [...order.slice(1),order[0]] : order;
}
