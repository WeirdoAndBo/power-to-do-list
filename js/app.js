/* ============================================================================
   Meine Power-Liste – die gesamte App-Logik in einer Datei.
   Eine Übersicht für Menschen, die hier etwas ändern wollen, steht in DEVELOPING.md.

   Grundprinzip: Der ganze Zustand liegt im Objekt `state`. Jede Änderung läuft so ab:
     state verändern → save() (speichert im Browser) → render() (baut die Ansicht neu).
   Die Ansichten sind Funktionen, die HTML als Text zurückgeben. Sie enden auf „Html“,
   z. B. cardHtml(). Texte von Nutzer*innen immer mit esc(...) einsetzen,
   sonst kann fremdes HTML eingeschleust werden.

   Wörter: Im Code heißen Dinge so wie in der App (Bereich, Kategorie, Ziel, Vorher-To-Do).
   Nur die Felder im GESPEICHERTEN Datenformat haben noch ihre alten, kurzen Namen.
   Die bleiben so, damit gespeicherte Listen und Sicherungsdateien weiter laden:
     state.cats           = die Bereiche (z. B. Arbeit, Privat)
     bereich.subs         = die Kategorien eines Bereichs (z. B. Akquise, Finanzen)
     task.t               = Titel eines To-Dos
     task.cat / task.area = eigener Bereich / eigene Kategorie eines To-Dos (IDs)
     task.needs           = Vorher-To-Dos „geht sonst nicht“ (sperren)
     task.soft            = Vorher-To-Dos „würde nur helfen“ (sperren nicht)
     state.view           = 'heute' (Tab Heute), 'baum' (Tab Übersicht), 'jetzt' (Übersicht mit Schalter „Machbar“ an)
     state.machbar        = Schalter „Machbar“ an/aus (merkt ihn sich auch, während „Heute“ offen ist)
     state.openCat        = ID des aufgeklappten Bereichs

   Aufbau der Datei (Abschnitte mit „----------“ markiert):
     Einstellungen → Hilfen → Laden/Speichern → Datenlogik → Ort (Bereich/Kategorie)
     → Ansichten → Seite aufbauen → Popup & Hinweis → Vorher-Liste im Popup
     → Ziehen mit Maus/Finger → Abläufe (Dialoge) → Datensicherung → Ereignisse → Start
   ============================================================================ */
// Die geschweifte Klammer hält alle Namen dieser Datei privat (nichts landet in „window“).
{
/* ---------- Einstellungen ---------- */
// Unter diesem Schlüssel liegt die Liste im Speicher des Browsers (localStorage). Nie ändern,
// sonst sind die gespeicherten Daten „weg“.
const STORAGE_KEY = 'powerliste-b-v1';
// APP_VERSION = Stand der App (immer gleich wie VERSION in sw.js).
// FORMAT = Version des gespeicherten Datenformats. Nur erhöhen, wenn sich die Datenstruktur
// ändert, und dann in migrate() nachziehen.
const APP_VERSION = '1.0.38-c';
const FORMAT = 1;
// Kennung in Sicherungsdateien
const BACKUP_APP_NAME = 'power-liste';
// Farben, die beim Anlegen eines Bereichs zur Auswahl stehen.
const COLORS = ['#5b8def', '#e0a03a', '#9b7fd1', '#4fae8c', '#e07a6a', '#3fa3b5', '#d27fb0', '#8a96a3'];
// Grau für alles ohne Bereich
const GRAY = '#8a96a3';
// Ein „Tag“ beginnt morgens um 4 Uhr, damit späte Abende noch zum Vortag zählen.
const DAY_STARTS_AT_HOUR = 4;
const ONE_HOUR = 60 * 60 * 1000; // in Millisekunden

// Kleine SVG-Symbole
const ICON_TICK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
const ICON_TRASH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
const ICON_DOTS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
const ICON_EYE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_EYE_OFF = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
const ICON_PEN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
const ICON_GRIP = '<svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor"><circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/><circle cx="3" cy="10" r="1.5"/><circle cx="9" cy="10" r="1.5"/><circle cx="3" cy="16" r="1.5"/><circle cx="9" cy="16" r="1.5"/></svg>';
const ICON_GRIP_WIDE = '<svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor"><circle cx="4" cy="4" r="1.6"/><circle cx="10" cy="4" r="1.6"/><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="4" cy="16" r="1.6"/><circle cx="10" cy="16" r="1.6"/></svg>';
const ICON_CHEVRON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>';
const ICON_CLOSE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/* ---------- Hilfen ---------- */
// $ = ein Element per CSS-Selektor finden
const $ = selector => document.querySelector(selector);
// esc = Text sicher in HTML einsetzen (macht aus < ein &lt; usw.)
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
// uid = neue zufällige ID, z. B. „k3j9x0a“
const uid = () => Math.random().toString(36).slice(2, 9);
// pluralS(3) = 's', pluralS(1) = '' – für „1 Vorher-To-Do“ / „3 Vorher-To-Dos“
const pluralS = count => count > 1 ? 's' : '';
// Rechnet zwei Ereignis-Listener auf einmal ab: on/off für pointermove, pointerup, pointercancel
function trackPointer(onMove, onUp) {
 const stop = event => {
  removeEventListener('pointermove', onMove);
  removeEventListener('pointerup', stop);
  removeEventListener('pointercancel', stop);
  onUp(event);
 };
 addEventListener('pointermove', onMove);
 addEventListener('pointerup', stop);
 addEventListener('pointercancel', stop);
}

/* ---------- Zustand ---------- */
// Wird gespeichert:
let state;                      // die ganze Liste (siehe seed() und DEVELOPING.md)
// Gilt nur für diese Sitzung (wird NICHT gespeichert):
let undoSnapshot = null;        // Kopie von state als Text, für „Rückgängig“
let toastTimer;                 // Timer des Hinweises unten
let currentColumn = 0;          // Nummer der sichtbaren Kategorie-Spalte
let columnJumpUntil = 0;        // bis wann gerade per Kategorie-Navigation gescrollt wird
let lastRenderedBereich;        // welcher Bereich beim letzten render() offen war
let ignoreClicksUntil = 0;      // Zeitpunkt, bis zu dem Klicks ignoriert werden (direkt nach dem Ziehen)
const treeOpen = new Map();     // auf-/zugeklappte Äste in der Übersicht
const openBacklogs = new Set(); // aufgeklappte Backlog-Abschnitte (Version C: sonst zu)
const openChains = new Set();   // aufgeklappte Ziel-Ketten auf Karten
let editingBereichName = null;  // Handy: ID des Bereichs, dessen Name gerade im Kopf bearbeitet wird

/* ---------- Tag ---------- */
// Mitternacht des Tages, in dem der Zeitpunkt liegt
function midnightOf(timestamp) {
 const date = new Date(timestamp);
 date.setHours(0, 0, 0, 0);
 return date.getTime();
}
// Beginn des aktuellen Tages (heute 4 Uhr, oder gestern 4 Uhr, wenn es noch vor 4 Uhr ist)
function dayStart() {
 const shift = DAY_STARTS_AT_HOUR * ONE_HOUR;
 return midnightOf(Date.now() - shift) + shift;
}
// Ist seit dem letzten Öffnen ein neuer Tag angebrochen? Dann wird „Heute“ geleert.
// Gibt true zurück, wenn dabei noch offene To-Dos in „Heute“ lagen.
function startNewDayIfNeeded() {
 if (state.day === undefined) state.day = dayStart();
 if (state.day === dayStart()) return false;
 const hadOpenToday = allTasks().some(task => task.today && !task.done);
 allTasks().forEach(task => { task.today = false; });
 state.day = dayStart();
 save();
 return hadOpenToday;
}

/* ---------- Laden, Speichern, Beispieldaten ----------
   seed() liefert die Beispieldaten beim ersten Start (und für „Beispiel wiederherstellen“).
   Gleichzeitig ist es die beste Beschreibung des Datenmodells, siehe DEVELOPING.md. */
function seed() {
 const now = Date.now();
 // Ein To-Do: id, t (Titel), needs/soft (IDs der Vorher-To-Dos), done/doneAt, goal (ist ein Ziel),
 // cat/area (eigener Bereich/eigene Kategorie, sonst geerbt), prio (höher = weiter oben), created,
 // optional: today, todayBy (wer es nach „Heute“ mitgenommen hat), todayOrder (Reihenfolge in Heute), backlog
 const task = (id, title, extra = {}) => ({
  id, t: title, needs: [], soft: [], done: false, goal: false, cat: null, prio: 0, created: now, doneAt: null, ...extra
 });
 // Startzustand: nur je eine Beispielkarte in der ersten Kategorie jedes Bereichs.
 const list = [
  task('bsp1', 'Beispiel To-Do', { goal: true, cat: 'arbeit', area: 'verw' }),
  task('bsp2', 'Beispiel To-Do', { goal: true, cat: 'privat', area: 'hobso' })
 ];
 const tasks = {};
 list.forEach(t => { tasks[t.id] = t; });
 // Animationen aus, wenn das Gerät „Bewegung reduzieren“ eingestellt hat
 let anim = true;
 try { anim = !matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
 return {
  name: 'Meine Power-Liste',
  tasks,
  cats: [ // Bereiche, jeweils mit ihren Kategorien (subs)
   { id: 'arbeit', name: 'Arbeit', color: '#5b8def',
     sammlung: true, subs: [newSammlung(), { id: 'verw', name: 'Verwaltung' }, { id: 'akq', name: 'Akquise & Marketing' }, { id: 'daily', name: 'Daily business' }] },
   { id: 'privat', name: 'Privat', color: '#e0a03a',
     sammlung: true, subs: [newSammlung(), { id: 'hobso', name: 'Hobby & Sozial' }, { id: 'alltag', name: 'Alltag & Lebensorga' }, { id: 'proj', name: 'Projekte' }] }
  ],
  openCat: 'arbeit',
  view: 'jetzt',
  machbar: true,
  inbox: [],
  anim,
  day: dayStart(),
  format: FORMAT
 };
}
/* Version C: „Sammlung“ = voreingestellte Kategorie in jedem Bereich zum schnellen Notieren, ohne Zeitnah und
   Backlog (kategorie.inbox). Sie lässt sich umbenennen und löschen und mit dem Auge im Kategorie-Knopf ein- und
   ausblenden (kategorie.hidden). bereich.sammlung merkt sich, dass sie schon einmal angelegt wurde, damit sie
   nach dem Löschen nicht wiederkommt. */
const newSammlung = () => ({ id: uid(), name: 'Sammlung', icon: 'inbox', inbox: true });
function addSammlung(bereich) {
 if (bereich.sammlung) return;
 bereich.subs.unshift(newSammlung());
 bereich.sammlung = true;
}
// Bringt gespeicherte oder importierte Daten auf das aktuelle Format.
// Daten ohne Formatnummer stammen aus dem Prototyp (= Format 1).
function migrate(data) {
 data.inbox = data.inbox || [];
 data.cats.forEach(bereich => { bereich.subs = bereich.subs || []; addSammlung(bereich); });
 if (data.openCat === undefined) data.openCat = data.cats[0] ? data.cats[0].id : null;
 // Version C: „Machbar“ ist kein eigener Tab mehr, sondern ein Schalter in der Übersicht.
 // Wer bisher im Tab „Machbar“ war (view 'jetzt'), landet in der Übersicht mit Schalter an.
 if (typeof data.machbar !== 'boolean') data.machbar = data.view === 'jetzt';
 Object.values(data.tasks).forEach(task => {
  task.needs = task.needs || [];
  task.soft = task.soft || [];
 });
 data.format = FORMAT;
 return data;
}
// Liest die Liste aus dem Browser-Speicher. Gibt es keine (oder ist sie kaputt): Beispieldaten.
function load() {
 try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
   const data = JSON.parse(saved);
   if (data && data.tasks && data.cats) return migrate(data);
  }
 } catch (e) {}
 return seed();
}
// Schreibt die Liste in den Browser-Speicher. Fehler (z. B. voller Speicher) werden still ignoriert.
function save() {
 try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}
// Momentaufnahme des Zustands als Text, für „Rückgängig“
const snapshot = () => JSON.stringify(state);

/* ---------- Datenlogik: wer gehört zu wem ----------
   Die To-Dos bilden ein Netz: needs = geht ohne das nicht (sperrt), soft = hilft nur.
   Ein Vorher-To-Do kann zu mehreren To-Dos gehören. „Eltern“ eines To-Dos sind die To-Dos,
   vor denen es erledigt werden soll. */
const getTask = id => state.tasks[id];
const getBereich = id => state.cats.find(bereich => bereich.id === id);
const allTasks = () => Object.values(state.tasks);
// Noch offene „geht sonst nicht“-Vorher-To-Dos (IDs). Leer = das To-Do ist machbar.
const openNeeds = task => task.needs.filter(id => getTask(id) && !getTask(id).done);
// Alle To-Dos, vor denen id kommt (needs und soft) bzw. nur die, die id brauchen (needs)
const parentsOf = id => allTasks().filter(parent => parent.needs.includes(id) || parent.soft.includes(id));
const parentsNeeding = id => allTasks().filter(parent => parent.needs.includes(id));

// Alle Ziele, zu denen ein To-Do gehört, auch über mehrere Ebenen
function goalsOf(id) {
 const goals = [];
 const seen = new Set();
 const toVisit = [id];
 while (toVisit.length) {
  const current = toVisit.pop();
  if (seen.has(current) || !getTask(current)) continue;
  seen.add(current);
  if (getTask(current).goal && current !== id) goals.push(getTask(current));
  parentsOf(current).forEach(parent => toVisit.push(parent.id));
 }
 return goals;
}
// Das To-Do selbst plus alle seine Vorher-To-Dos, alle Ebenen (als Set von IDs)
function taskAndAllBefore(id) {
 const seen = new Set();
 const toVisit = [id];
 while (toVisit.length) {
  const current = toVisit.pop();
  if (seen.has(current) || !getTask(current)) continue;
  seen.add(current);
  toVisit.push(...getTask(current).needs, ...getTask(current).soft);
 }
 return seen;
}
// Alle Wege vom To-Do hoch bis zu einem Ziel (bei geteilten Schritten mehrere).
// Jeder Weg ist eine Liste von IDs, beginnend mit dem To-Do selbst.
function pathsToGoals(id, seen = new Set()) {
 if (seen.has(id)) return [];
 const isStart = seen.size === 0;
 const seenWithMe = new Set(seen).add(id);
 const task = getTask(id);
 const parents = parentsOf(id);
 if (!parents.length || (task.goal && !isStart)) return [[id]];
 return parents.flatMap(parent => pathsToGoals(parent.id, seenWithMe).map(path => [id, ...path]));
}
// Anteil erledigter Vorher-To-Dos eines Ziels in Prozent (Balken in der Übersicht)
function progress(goal) {
 const ids = [...taskAndAllBefore(goal.id)].filter(id => id !== goal.id);
 const doneCount = ids.filter(id => getTask(id).done).length;
 return ids.length ? Math.round(doneCount / ids.length * 100) : 0;
}
// Welche To-Dos als Vorher-To-Do (canPrecede) bzw. als Ziel (canFollow) verknüpft werden dürfen,
// ohne dass ein Kreis entsteht
function canPrecede(parentId) {
 const parent = getTask(parentId);
 return allTasks().filter(t => !t.done && t.id !== parentId && !taskAndAllBefore(t.id).has(parentId)
  && !parent.needs.includes(t.id) && !parent.soft.includes(t.id));
}
function canFollow(id) {
 return allTasks().filter(t => !t.done && t.id !== id && !taskAndAllBefore(id).has(t.id)
  && !t.needs.includes(id) && !t.soft.includes(id));
}
// Macht task zum Vorher-To-Do von parent. kind: 'hard' = geht sonst nicht, 'help' = würde nur helfen.
// Bei „geht sonst nicht“ rutscht task in der Sortierung über parent.
function linkBefore(parent, task, kind) {
 if (kind === 'help') {
  parent.soft.push(task.id);
 } else {
  parent.needs.push(task.id);
  task.prio = Math.max(task.prio, parent.prio + 1);
 }
}
// Legt ein neues To-Do an und gibt es zurück (speichert noch nicht)
function createTask(title, extra = {}) {
 const task = {
  id: uid(), t: title, needs: [], soft: [], done: false, goal: false, cat: null, prio: 0,
  created: Date.now(), doneAt: null, ...extra
 };
 state.tasks[task.id] = ensureList(task);
 return task;
}
/* Version C: Listen. Beginnt der Text eines To-Dos mit „Liste:“, hat es eine einfache Abhak-Liste (task.list,
   Einträge {id, t, done}). Die Einträge sind keine eigenen To-Dos. Nimmt man „Liste:“ wieder weg, ist die Liste
   ausgeblendet, aber nicht gelöscht; mit „Liste:“ ist sie wieder da. */
const LIST_PATTERN = /^\s*liste\s*:\s*/i;
const isList = task => !!task && LIST_PATTERN.test(task.t);
const shownTitle = task => isList(task) ? task.t.replace(LIST_PATTERN, '') || 'Liste' : task.t;
function ensureList(task) {
 if (isList(task) && !Array.isArray(task.list)) task.list = [];
 return task;
}
// Sortierung: höhere prio zuerst, sonst das ältere zuerst
const byPrio = (a, b) => b.prio - a.prio || a.created - b.created;

// „Heute“ an/aus. Beim Anschalten kommen alle offenen Vorher-To-Dos (alle Ebenen) mit;
// sie merken sich in todayBy, wer sie mitgenommen hat. Beim Ausschalten gehen nur die
// mit raus, die mitgenommen wurden – selbst markierte bleiben. Gibt die Anzahl der
// mitgenommenen bzw. mit entfernten Vorher-To-Dos zurück.
const nextTodayOrder = () => Math.max(0, ...allTasks().map(t => t.todayOrder || 0)) + 1;
function setToday(id, on) {
 const task = getTask(id);
 let count = 0;
 if (on && !task.today) task.todayOrder = nextTodayOrder();
 task.today = on;
 task.todayBy = null;
 if (on) task.backlog = false;
 taskAndAllBefore(id).forEach(otherId => {
  if (otherId === id) return;
  const other = getTask(otherId);
  if (other.done) return;
  if (on && !other.today) {
   other.today = true;
   other.todayBy = id;
   other.todayOrder = nextTodayOrder();
   other.backlog = false;
   count++;
  } else if (!on && other.today && other.todayBy === id) {
   other.today = false;
   other.todayBy = null;
   count++;
  }
 });
 return count;
}

/* ---------- Ort: in welchem Bereich und welcher Kategorie ein To-Do steht ----------
   Ein eigener Bereich (task.cat) gewinnt. Ohne eigenen erbt das To-Do Bereich und Kategorie
   von seinen Zielen. Orte werden als Text „bereichId|kategorieId“ weitergereicht,
   z. B. „arbeit|akq“. Leer („|“) = „Ohne Bereich“. */

// In welchem Bereich (oder welchen Bereichen) ein To-Do angezeigt wird (Liste von IDs)
function bereicheOf(task) {
 if (task.cat && getBereich(task.cat)) return [task.cat];
 const found = new Set();
 goalsOf(task.id).forEach(goal => {
  if (goal.cat && getBereich(goal.cat)) found.add(goal.cat);
 });
 return [...found];
}
// In welcher Kategorie eines Bereichs ein To-Do angezeigt wird:
// die eigene, sonst die vom Ziel geerbte, sonst die erste des Bereichs
function kategorieIn(task, bereichId, seen = new Set()) {
 const bereich = getBereich(bereichId);
 if (!bereich || !bereich.subs.length) return '';
 const firstKategorie = (bereich.subs.find(k => !k.inbox) || bereich.subs[0]).id;
 if (seen.has(task.id)) return firstKategorie;
 seen.add(task.id);
 if (task.cat === bereichId && bereich.subs.some(k => k.id === task.area)) return task.area;
 if (task.cat !== bereichId) {
  for (const parent of parentsOf(task.id)) {
   if (bereicheOf(parent).includes(bereichId)) return kategorieIn(parent, bereichId, seen);
  }
 }
 return firstKategorie;
}
// Gehört ein To-Do in diesen Bereich (und, falls angegeben, diese Kategorie)?
// bereichId '' = „Ohne Bereich“
function isIn(task, bereichId, kategorieId = '') {
 if (!bereichId) return !bereicheOf(task).length;
 return bereicheOf(task).includes(bereichId) && (!kategorieId || kategorieIn(task, bereichId) === kategorieId);
}
// Die Spalten eines Bereichs: seine Kategorien, oder eine einzige Spalte, wenn er keine hat
function columnsOf(bereich) {
 const shown = bereich && bereich.subs ? bereich.subs.filter(k => !k.hidden) : [];
 if (shown.length) return shown;
 return [{ id: '', name: bereich ? bereich.name : '' }];
}
// Alle Bereiche, dazu „Ohne Bereich“, falls es To-Dos ohne Bereich gibt
function visibleBereiche() {
 const list = state.cats.map(bereich => ({ ...bereich }));
 if (allTasks().some(task => !bereicheOf(task).length)) {
  list.push({ id: '', name: 'Ohne Bereich', color: GRAY, subs: [] });
 }
 return list;
}
// Ort eines To-Dos als Text „bereichId|kategorieId“
function placeOf(task) {
 const bereichId = bereicheOf(task)[0] || '';
 return bereichId + '|' + (bereichId ? kategorieIn(task, bereichId) : '');
}
// Lesbarer Name eines Orts, z. B. „Arbeit · Akquise“
// Version C: Kategorien können ein Symbol vor dem Namen haben (kategorie.icon, optional).
// Dezente Linien-Symbole (SVG, 24er-Raster), sie nehmen die Farbe des Bereichs an.
const KATEGORIE_ICONS = {
 briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
 mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
 phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
 money: '<circle cx="12" cy="12" r="9"/><path d="M15 9a3.5 3.5 0 1 0 0 6M8 11h5M8 13h5"/>',
 chart: '<path d="M4 4v16h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
 pen: '<path d="M14 4l6 6L9 21H3v-6z"/><path d="M12 6l6 6"/>',
 calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 checklist: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>',
 megaphone: '<path d="M3 10v4l12 5V5z"/><path d="M15 9a3 3 0 0 1 0 6M6 15l1 5h3l-1-4"/>',
 bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
 wrench: '<path d="M15 4a5 5 0 0 0-4.6 6.9L4 17.3V20h2.7l6.4-6.4A5 5 0 0 0 20 9l-3 1-2-2 1-3z"/>',
 laptop: '<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M3 19h18"/>',
 receipt: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
 box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
 home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10M10 20v-6h4v6"/>',
 sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>',
 cart: '<path d="M3 4h2l2.5 11h11L21 8H6.5"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
 pot: '<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M2 10h20M9 4v3M12 3v4M15 4v3"/>',
 leaf: '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15"/><path d="M5 19l8-8"/>',
 heart: '<path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20z"/>',
 activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
 pill: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M9.5 9.5l5 5"/>',
 people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
 gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z"/>',
 pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
 book: '<path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0 0 4h13v-2"/>',
 palette: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-1.2-1-1.5-1-2.5s.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
 music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
 camera: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.5" r="3.5"/>',
 star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
 inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>'
};
// Früher gewählte Emojis zeigen das passende Linien-Symbol (gespeichert bleibt, was da ist)
const EMOJI_ICONS = { '💼': 'briefcase', '📞': 'phone', '💰': 'money', '📊': 'chart', '📝': 'pen', '📅': 'calendar', '📣': 'megaphone',
 '💡': 'bulb', '🛠️': 'wrench', '💻': 'laptop', '🏠': 'home', '🧹': 'sparkle', '🛒': 'cart', '🍳': 'pot', '🌱': 'leaf', '🐾': 'heart',
 '❤️': 'heart', '🏃': 'activity', '🧘': 'heart', '💊': 'pill', '👨‍👩‍👧': 'people', '🎉': 'gift', '✈️': 'pin', '🚗': 'pin', '📚': 'book',
 '🎨': 'palette', '🎵': 'music', '📷': 'camera', '⚽': 'activity', '🧾': 'receipt', '📦': 'box', '📥': 'inbox' };
const iconKey = kategorie => kategorie && kategorie.icon ? (KATEGORIE_ICONS[kategorie.icon] ? kategorie.icon : EMOJI_ICONS[kategorie.icon] || '') : '';
const iconSvg = key => `<svg class="kico" viewBox="0 0 24 24" aria-hidden="true">${KATEGORIE_ICONS[key]}</svg>`;
const katName = kategorie => kategorie.name;
// Name mit Symbol davor, für Reiter und Spaltenkopf (HTML)
const katLabelHtml = kategorie => (iconKey(kategorie) ? iconSvg(iconKey(kategorie)) : '') + esc(kategorie.name);
function iconPickerHtml(selected = '', color = '') {
 const key = iconKey({ icon: selected });
 return `<div class="icons" role="radiogroup" aria-label="Symbol"${color ? ` style="--c:${color}"` : ''}>`
  + `<label class="noicon" title="Kein Symbol"><input type="radio" name="icon" value=""${key ? '' : ' checked'}>–</label>`
  + Object.keys(KATEGORIE_ICONS).map(k => `<label title="${k}"><input type="radio" name="icon" value="${k}"${k === key ? ' checked' : ''}>${iconSvg(k)}</label>`).join('')
  + '</div>';
}
function placeName(bereichId, kategorieId) {
 const bereich = getBereich(bereichId);
 if (!bereich) return 'Ohne Bereich';
 const kategorie = bereich.subs.find(k => k.id === kategorieId);
 return bereich.name + (kategorie ? ' · ' + katName(kategorie) : '');
}
// Der gerade sichtbare Ort, als Vorbelegung für „Neues To-Do“
function currentPlace() {
 const bereichId = state.openCat ?? (state.cats[0] ? state.cats[0].id : '');
 const bereich = getBereich(bereichId);
 const kategorie = bereich && bereich.subs.length
  ? columnsOf(bereich)[Math.min(currentColumn, columnsOf(bereich).length - 1)]
  : null;
 return (bereichId || '') + '|' + (kategorie && kategorie.id ? kategorie.id : '');
}
// Farbe eines To-Dos = Farbe seines Bereichs (grau ohne Bereich)
function colorOf(task) {
 const bereich = getBereich(bereicheOf(task)[0]);
 return bereich ? bereich.color : GRAY;
}
// Text unter dem Titel: „Das ist ein Ziel“ oder „Ziel: …“ (schon HTML-sicher)
// Version C: Ziel und To-Do werden in der Bedienung nicht mehr unterschieden (Idee zurückgestellt).
// Intern bleibt goal: true für To-Dos ganz oben, damit Fortschritt und „Gehört zu“ funktionieren.
function goalHint(task) {
 const goals = goalsOf(task.id);
 if (task.goal) return '';
 return goals.length ? 'Gehört zu: ' + goals.map(goal => esc(goal.t)).join(' · ') : '';
}

/* ---------- Bausteine für Auswahlfelder ---------- */
// <option>-Liste von To-Dos, Ziele mit ◆ davor
function taskOptionsHtml(tasks, selectedId) {
 return tasks.map(task => `<option value="${task.id}"${task.id === selectedId ? ' selected' : ''}>`
  + `${task.goal ? '◆ ' : ''}${esc(task.t)}</option>`).join('');
}
// <option>-Liste der Kategorien eines Bereichs
function kategorieOptionsHtml(bereichId, selectedId) {
 const bereich = getBereich(bereichId);
 if (!bereich) return '';
 return bereich.subs.map(k => `<option value="${k.id}"${k.id === selectedId ? ' selected' : ''}>${esc(katName(k))}</option>`).join('');
}
// Auswahl „Wohin“: erst Bereich, dann Kategorie (nur die des gewählten Bereichs;
// ohne Kategorien wird die zweite Auswahl ausgeblendet). Das Ergebnis steht im
// versteckten Feld name="place" als „bereichId|kategorieId“.
function placePickerHtml(selected) {
 const [bereichId, kategorieId] = selected.split('|');
 const bereich = getBereich(bereichId);
 const bereichOptions = state.cats.map(b => `<option value="${b.id}"${b.id === bereichId ? ' selected' : ''}>${esc(b.name)}</option>`).join('')
  + `<option value=""${!bereich ? ' selected' : ''}>Ohne Bereich</option>`;
 const showKategorie = bereich && bereich.subs.length;
 return `<div class="pick"><input type="hidden" name="place" value="${esc(selected)}">`
  + `<label class="lbl">Bereich</label><select class="field" data-pick="cat">${bereichOptions}</select>
 <div class="pkat"${showKategorie ? '' : ' hidden'}><label class="lbl">Kategorie</label>`
  + `<select class="field" data-pick="kat">${kategorieOptionsHtml(bereichId, kategorieId)}</select></div></div>`;
}
// Auswahl „Geht sonst nicht“ (hard) / „Würde nur helfen“ (help)
function kindChoiceHtml(preselected = 'hard') {
 return `<div class="seg" role="radiogroup" aria-label="Wie wichtig vorher?">`
  + `<label><input type="radio" name="kind" value="hard"${preselected === 'hard' ? ' checked' : ''}>Geht sonst nicht</label>`
  + `<label><input type="radio" name="kind" value="help"${preselected === 'help' ? ' checked' : ''}>Würde nur helfen</label></div>`;
}

/* ---------- Ansichten ----------
   Jede Funktion hier gibt ein Stück HTML als Text zurück. Die Variable `color` ist
   die Farbe des Bereichs; sie landet als CSS-Variable --c im HTML. */

// Runder Abhak-Knopf
function checkButtonHtml(task, color) {
 return `<button class="check" role="checkbox" aria-checked="${!!task.done}"`
  + ` aria-label="${task.done ? 'Wieder öffnen' : 'Abhaken'}: ${esc(task.t)}"`
  + ` data-act="check" data-id="${task.id}" style="--c:${color}">${ICON_TICK}</button>`;
}
// Schalter „Heute“ auf Karten und (klein, mini = true) in der Übersicht
function todaySwitchHtml(task, mini) {
 return `<button class="today${mini ? ' tmini' : ''}" role="switch" aria-checked="${!!task.today}"`
  + ` data-act="today" data-id="${task.id}" aria-label="${esc(task.t)}: für heute"`
  + ` title="Für heute – mit allen Vorher-To-Dos"><i></i><span>Heute</span></button>`;
}
// Aufklappbare Ziel-Kette auf einer Karte: „Ziel: …“ und darunter die Wege bis zum Ziel
function chainBoxHtml(task) {
 const hint = goalHint(task);
 if (!hint) return '';
 if (task.goal) return `<p class="goal">${hint}</p>`;
 const paths = pathsToGoals(task.id).slice(0, 6);
 const pathsHtml = paths.map(path => '<ol>' + path.map((id, i) =>
  `<li class="${i === 0 ? 'me' : ''}${getTask(id).goal ? ' g' : ''}">${esc(getTask(id).t)}</li>`).join('') + '</ol>').join('');
 return `<details class="chain" data-id="${task.id}"${openChains.has(task.id) ? ' open' : ''}>`
  + `<summary>${hint}</summary>${pathsHtml}</details>`;
}
// Karte. options.grip = Griff zum Sortieren (in „Heute“), options.move = Griff und Menü zum Verschieben
// (in der Übersicht, mit Schalter „Machbar“ an und aus).
// Aufbau: Kopf mit Griff, Heute-Schalter, Bearbeiten/Verschieben/Löschen.
// Darunter Häkchen + Titel, Ziel-Kette, „Erst noch: …“ und unten der Knopf „+ Vorher-To-Do“.
// Version C: Dieselbe Karte steht auch in der Übersicht mit Schalter „Machbar“ aus. Dort kommen über
// options.tree der Fortschritt und die aufklappbaren Vorher-To-Dos dazu, und die Karte ist ein <li> im Baum
// (options.tag, options.attrs), damit das Umsortieren der Unter-To-Dos weiter funktioniert.
function cardHtml(task, color, options = {}) {
 const title = esc(task.t);
 // Version C: Gezogen wird die ganze Karte (Abschnitt „Ziehen“). Der Griff ist nur noch für die Tastatur da
 // und erst sichtbar, wenn er mit Tab angesteuert wird.
 let grip = '';
 if (options.grip) {
  grip = `<button class="cgrip" data-act="grip" data-id="${task.id}" aria-label="${title} verschieben (Pfeiltasten hoch/runter)">${ICON_GRIP}</button>`;
 } else if (options.move) {
  grip = `<button class="cgrip mgrip" data-act="mgrip" data-id="${task.id}" aria-label="${title} verschieben">${ICON_GRIP}</button>`;
 }
 const moveButton = options.move
  ? `<button class="hbtn" data-act="move" data-id="${task.id}" aria-label="${title}: Backlog oder verschieben" title="Backlog / Verschieben nach …">${ICON_DOTS}</button>`
  : '';
 const waiting = openNeeds(task);
 const waitingHtml = waiting.length
  ? `<p class="wait">Erst noch: ${waiting.map(id => esc(getTask(id).t)).join(', ')}</p>`
  : '';
 const tag = options.tag || 'article';
 return `<${tag} class="card${options.cls || ''}" data-id="${task.id}" ${options.attrs || ''} style="--c:${color}">
 <div class="chead">${grip}${task.done ? '' : todaySwitchHtml(task)}<span class="sp"></span>${listCountHtml(task)}${options.headExtra || ''}${moveButton}</div>
 <div class="cbody">${checkButtonHtml(task, color)}<div class="ctext"><h3>${titleHtml(task)}</h3>${options.tree === undefined ? chainBoxHtml(task) + waitingHtml : ''}</div><span class="cacts">${taskActionsHtml(task)}</span></div>
 ${listHtml(task, color)}${options.tree === undefined ? (task.done ? '' : insertHtml(task.id, '', color)) : options.tree}</${tag}>`;
}
// Titel eines To-Dos. Antippen = direkt hier bearbeiten (Enter speichert, Escape bricht ab), siehe startRename.
function titleHtml(task) {
 const listMark = isList(task) ? `<span class="lmark" title="Liste">Liste</span>` : '';
 return `${listMark}<span class="t" data-act="rename" data-id="${task.id}" tabindex="0" role="button" aria-label="${esc(task.t)} – Text bearbeiten">${esc(shownTitle(task))}</span>`;
}
// Abhak-Liste unter einem Listen-To-Do: offene Punkte oben, erledigte blass darunter, ganz unten ein Feld für
// den nächsten Punkt (Enter = hinzufügen und gleich weiter). Punkt antippen = Text bearbeiten (leer = löschen).
function listHtml(task, color) {
 if (!isList(task)) return '';
 const items = [...(task.list || [])].sort((a, b) => a.done - b.done);
 const itemsHtml = items.map(item => `<div class="litem${item.done ? ' ldone' : ''}">`
  + `<button class="lcheck" role="checkbox" aria-checked="${!!item.done}" data-act="lcheck" data-id="${task.id}" data-i="${item.id}" aria-label="${esc(item.t)} ${item.done ? 'wieder öffnen' : 'abhaken'}">${ICON_TICK}</button>`
  + `<span class="lt" data-act="lren" data-id="${task.id}" data-i="${item.id}" tabindex="0" role="button" aria-label="${esc(item.t)} – Text bearbeiten">${esc(item.t)}</span>`
  + `<button class="mini del ldel" data-act="ldel" data-id="${task.id}" data-i="${item.id}" aria-label="${esc(item.t)} aus der Liste löschen" title="Löschen">${ICON_TRASH}</button></div>`).join('');
 const add = task.done ? '' : `<input class="tinput linput" data-id="${task.id}" placeholder="+ Punkt" aria-label="Neuer Punkt in ${esc(shownTitle(task))}" autocomplete="off">`;
 return `<div class="llist" data-act="none" style="--c:${color}">${itemsHtml}${add}</div>`;
}
// „3/7“ im Kopf einer Listen-Karte
function listCountHtml(task) {
 if (!isList(task) || !(task.list || []).length) return '';
 const done = task.list.filter(item => item.done).length;
 return `<small class="lcount" title="${done} von ${task.list.length} abgehakt">${done}/${task.list.length}</small>`;
}
const listItem = (task, itemId) => (task && task.list || []).find(item => item.id === itemId);
function focusListInput(taskId) {
 const input = document.querySelector(`.linput[data-id="${taskId}"]`);
 if (input) input.focus();
 return !!input;
}
function addListItem(task, text) {
 ensureList(task);
 task.list.push({ id: uid(), t: text, done: false });
}
function toggleListItem(taskId, itemId) {
 const item = listItem(getTask(taskId), itemId);
 if (!item) return;
 undoSnapshot = snapshot();
 item.done = !item.done;
 save();
 render();
}
function deleteListItem(taskId, itemId) {
 const task = getTask(taskId);
 if (!listItem(task, itemId)) return;
 undoSnapshot = snapshot();
 task.list = task.list.filter(item => item.id !== itemId);
 save();
 render();
 toast('Punkt gelöscht.', true);
}
// Punkt direkt bearbeiten: Enter speichert, Escape bricht ab, leer = löschen
function startItemEdit(el) {
 const task = getTask(el.dataset.id);
 const item = listItem(task, el.dataset.i);
 if (!item || el.querySelector('input')) return;
 const input = document.createElement('input');
 input.className = 'tinput';
 input.value = item.t;
 input.setAttribute('aria-label', 'Punkt bearbeiten');
 input.setAttribute('autocomplete', 'off');
 el.textContent = '';
 el.append(input);
 input.focus();
 let finished = false;
 const finish = keep => {
  if (finished) return;
  finished = true;
  const text = input.value.trim();
  if (keep && text !== item.t) {
   undoSnapshot = snapshot();
   if (text) item.t = text;
   else task.list = task.list.filter(x => x !== item);
   save();
  }
  render();
 };
 input.addEventListener('keydown', event => {
  event.stopPropagation();
  if (event.key === 'Enter') { event.preventDefault(); finish(true); }
  if (event.key === 'Escape') { event.preventDefault(); finish(false); }
 });
 input.addEventListener('blur', () => finish(true));
 input.addEventListener('click', event => event.stopPropagation());
}
// Feld „+ Punkt“: Enter fügt hinzu und bleibt im Feld, Escape oder Enter im leeren Feld beendet
document.addEventListener('keydown', event => {
 const input = event.target;
 if (!input.classList || !input.classList.contains('linput')) return;
 event.stopPropagation();
 if (event.key === 'Escape') { input.value = ''; input.blur(); return; }
 if (event.key !== 'Enter') return;
 event.preventDefault();
 const text = input.value.trim();
 const task = getTask(input.dataset.id);
 if (!text || !task) { input.blur(); return; }
 input.value = '';
 undoSnapshot = snapshot();
 addListItem(task, text);
 save();
 render();
 focusListInput(task.id);
}, true);
document.addEventListener('focusout', event => {
 const input = event.target;
 if (!input.classList || !input.classList.contains('linput')) return;
 const text = input.value.trim();
 const task = getTask(input.dataset.id);
 if (!text || !task) return;
 input.value = '';
 undoSnapshot = snapshot();
 addListItem(task, text);
 save();
 setTimeout(render);
});
// Version C: hinter jedem To-Do der kleine Mülleimer (und in Zeilen davor der Heute-Schalter).
// Neue To-Dos kommen über das „+“, das zwischen den To-Dos erscheint (insertHtml).
function taskActionsHtml(task) {
 return `<button class="mini del" data-act="del" data-id="${task.id}" aria-label="${esc(task.t)} löschen" title="Löschen">${ICON_TRASH}</button>`;
}
// Version C: Backlog-Abschnitt einer Spalte, wie „Zeitnah“ aufgebaut (gleiche Karten), aber einklappbar.
// Karten lassen sich zwischen Zeitnah und Backlog hin und her ziehen (auch auf die zugeklappte Überschrift).
function backlogSectionHtml(bereich, kategorie, count, inner) {
 const key = bereich.id + '|' + kategorie.id;
 return `<details class="blsec zone" data-drop="zone" data-cat="${bereich.id}" data-area="${kategorie.id}" data-bl="1" data-k="${esc(key)}"${openBacklogs.has(key) ? ' open' : ''}>`
  + `<summary class="zlabel">Backlog · ${count}</summary>${inner}</details>`;
}
// Unsichtbarer Streifen zwischen den Karten einer Spalte: neues To-Do ganz oben (eigene Karte) an dieser Stelle.
// Version C: Die Frage aus dem Eingabefeld steht beim Drüberfahren klein neben dem „+“ (insertLabelHtml).
const ROOT_QUESTION = 'Neues To-Do';
// Version C 1.0.34: Am Handy gibt es das Wort „zeitnah“ nicht. Was nicht im Backlog liegt, ist einfach dran.
// wideNarrow(a, b) zeigt a am Desktop und b am Handy (CSS-Klassen .wide/.narrow, Grenze 600px).
const wideNarrow = (wide, narrow) => `<span class="wide">${wide}</span>` + (narrow ? `<span class="narrow">${narrow}</span>` : '');
const BACK_FROM_BACKLOG = wideNarrow('in Zeitnah', 'aus dem Backlog');
const insertQuestion = parent => parent && parent.goal ? 'Was gehört dazu?' : 'Was muss vorher passieren?';
const insertLabelHtml = question => `<span aria-hidden="true">+</span><em aria-hidden="true">${esc(question)}</em>`;
// last = Linie unter dem Hinweis einer leeren Liste (Zeitnah, Sammlung): immer sichtbar
function insertRootHtml(bereich, kategorie, afterId, tag = 'div', backlog = false, last = false) {
 return `<${tag} class="insroot${last ? ' last' : ''}"><button class="ins" data-act="insroot" data-cat="${bereich.id}" data-area="${kategorie.id}" data-bl="${backlog ? 1 : 0}" data-after="${afterId || ''}"`
  + ` style="--c:${bereich.color}" aria-label="Hier ein neues To-Do in ${esc(kategorie.name || bereich.name)} anlegen">${insertLabelHtml(ROOT_QUESTION)}</button></${tag}>`;
}
// Unsichtbarer Streifen zwischen To-Dos. Mit der Maus darüber erscheint „+“; Klick = hier ein neues To-Do eintippen.
// parentId = das To-Do, vor dem das neue kommt; afterId = steht danach direkt hinter diesem (leer = ganz vorn).
// intoId = zwischen parentId und sein einziges Vorher-To-Do intoId (Kette): das neue kommt mitten in die Kette.
function insertHtml(parentId, afterId, color, cls = '', intoId = '', question = '') {
 question = question || insertQuestion(getTask(parentId));
 return `<button class="ins${cls}" data-act="ins" data-p="${parentId}" data-after="${afterId || ''}"${intoId ? ` data-into="${intoId}"` : ''} style="--c:${color}"`
  + ` aria-label="Hier einfügen: ${esc(question)}">${insertLabelHtml(question)}</button>`;
}
// Kleiner Papierkorb-Knopf für Listenzeilen (Erledigt, Heute geschafft, Danach dran)
function deleteMiniHtml(task) {
 return `<button class="mini del" data-act="del" data-id="${task.id}" aria-label="${esc(task.t)} löschen">${ICON_TRASH}</button>`;
}
// Aufklappbarer Kasten „Erledigt · N“
function doneBoxHtml(tasks, color) {
 if (!tasks.length) return '';
 const rows = tasks.map(task => `<div class="drow">${checkButtonHtml(task, color)}<span>${esc(task.t)}</span>`
  + `${deleteMiniHtml(task)}</div>`).join('');
 return `<details class="done"><summary>Erledigt · ${tasks.length}</summary>${rows}</details>`;
}
// Eine Zeile im Backlog-Kasten
function backlogRowHtml(task, color) {
 const openBefore = [...taskAndAllBefore(task.id)].filter(id => id !== task.id && !getTask(id).done).length;
 const title = esc(task.t);
 return `<div class="brow" data-id="${task.id}" style="--c:${color}">`
  + `<span class="btext">${titleHtml(task)}${openBefore ? `<small>mit ${openBefore} Vorher-To-Do${pluralS(openBefore)}</small>` : ''}</span>`
  + `<button class="mini" data-act="tozeit" data-id="${task.id}" title="Nach Zeitnah holen" aria-label="${title} nach Zeitnah holen">↑</button>`
  + `<button class="mini" data-act="move" data-id="${task.id}" aria-label="${title} verschieben" title="Verschieben nach …">${ICON_DOTS}</button>`
  + `${deleteMiniHtml(task)}</div>`;
}
// Schalter „Machbar“ an: eine Kategorie-Spalte mit Zeitnah (nicht gesperrt), Backlog und Erledigt
function machbarColumnHtml(bereich, kategorie) {
 const here = task => isIn(task, bereich.id, kategorie.id);
 const doable = allTasks().filter(t => !t.done && !t.backlog && !openNeeds(t).length && here(t)).sort(byPrio);
 const backlogAll = allTasks().filter(t => !t.done && t.backlog && here(t));
 // Im Backlog nur die „obersten“ zeigen: nicht die, deren Ziel selbst schon im Backlog liegt
 const backlogTop = backlogAll.filter(t => !parentsOf(t.id).some(p => p.backlog && !p.done && here(p))).sort(byPrio);
 const done = allTasks().filter(t => t.done && here(t)).sort((a, b) => b.doneAt - a.doneAt);
 // Ablageziel fürs Ziehen
 const dropTarget = `data-drop="zone" data-cat="${bereich.id}" data-area="${kategorie.id}"`;
 const doableHtml = insertRootHtml(bereich, kategorie, '') + (doable.length
  ? doable.map(t => cardHtml(t, bereich.color, { move: true }) + insertRootHtml(bereich, kategorie, t.id)).join('')
  : `<div class="empty" style="--c:${bereich.color}">Hier ist gerade nichts zu tun.</div>` + insertRootHtml(bereich, kategorie, '', 'div', false, true));
 const backlogHtml = `<div class="list">${insertRootHtml(bereich, kategorie, '', 'div', true)}`
  + (backlogTop.length
   ? backlogTop.map(t => cardHtml(t, bereich.color, { move: true }) + insertRootHtml(bereich, kategorie, t.id, 'div', true)).join('')
   : `<div class="empty" style="--c:${bereich.color}">Leer. Zieh To-Dos hierher, die gerade nicht dran sind.</div>` + insertRootHtml(bereich, kategorie, '', 'div', true)) + '</div>';
 return `<p class="zlabel zsoon">Zeitnah</p><div class="list zone" ${dropTarget} data-bl="0">${doableHtml}</div>
 ${backlogSectionHtml(bereich, kategorie, backlogAll.length, backlogHtml)}${doneBoxHtml(done, bereich.color)}`;
}
// Tab „Übersicht“: ein Knoten im Baum, ruft sich für seine Vorher-To-Dos selbst auf.
// path = Weg im Baum (für auf/zu), level = Tiefe (0 = Ziel ganz oben), viaSoft = hängt über „hilft nur“ dran,
// parentId = das To-Do darüber in dieser Karte (nur dann gibt es den Griff zum Umsortieren).
// Ein Ziel ganz oben (level 0) ist dieselbe Karte wie mit Schalter „Machbar“ an (cardHtml), darunter
// Fortschritt und die aufklappbaren Vorher-To-Dos.
// Unter-To-Dos haben keinen Papierkorb (kein Platz): Löschen über Tippen auf den Titel → „Bearbeiten“ → „Löschen“.
// linked = hängt als einziges Vorher-To-Do am To-Do darüber: Teil einer Kette (Strich nach oben, nicht eingerückt).
function treeNodeHtml(task, color, path, level, viaSoft, parentId = null, inCard = false, linked = false) {
 const children = [
  ...task.needs.map(id => [getTask(id), 0]),
  ...task.soft.map(id => [getTask(id), 1])
 ].filter(([child]) => child).sort((a, b) => a[0].done - b[0].done);
 const key = path + '/' + task.id;
 const title = esc(task.t);
 const inBacklog = task.backlog && !task.done;
 if (level === 0) {
  // Version C: EIN Pfeil im Kartenkopf klappt alles auf oder zu. Aufgeklappt sieht man alle Ebenen,
  // die Ebenen zeigen die senkrechten Linien. Zwischen den To-Dos erscheint beim Drüberfahren „+“.
  const isOpen = treeOpen.get(key) === true;
  const all = taskAndAllBefore(task.id).size - 1;
  const chevron = children.length
   ? `<button class="hbtn cardtog" data-act="tog" data-k="${esc(key)}" data-l="0" aria-expanded="${isOpen}"`
    + ` aria-label="${isOpen ? 'Alles zuklappen' : `Alles aufklappen: ${all} Vorher-To-Do${pluralS(all)}`}" title="${isOpen ? 'Alles zuklappen' : 'Alles aufklappen'}">`
    + `<small>${all}</small>${ICON_CHEVRON}</button>`
   : '';
  const childList = children.length && isOpen
   ? `<ul data-act="none">${children.map(([child, soft]) => treeNodeHtml(child, color, key, 1, soft, task.id, true)).join('')}</ul>`
   : '';
  const bar = task.done ? '' : `<div class="pbar" data-act="none" aria-hidden="true"><i style="width:${progress(task)}%"></i></div>`;
  return cardHtml(task, color, {
   move: !task.done, tag: 'li', cls: ' tcard',
   attrs: `data-tid="${task.id}" data-k="${esc(key)}" data-l="0"`,
   headExtra: chevron,
   tree: `${children.length ? bar : ''}${task.done ? '' : insertHtml(task.id, '', color)}${childList}`
  });
 }
 // In einer Karte: alles offen, kein eigener Pfeil. Sonst (z. B. „Erreichte Ziele“): Pfeil pro Zeile wie früher.
 const isOpen = inCard || (treeOpen.has(key) ? treeOpen.get(key) : true);
 let toggle = '';
 if (!inCard) {
  toggle = children.length
   ? `<button class="mini chev" data-act="tog" data-k="${esc(key)}" data-l="${level}" aria-expanded="${isOpen}" aria-label="${isOpen ? 'Zuklappen' : 'Aufklappen'}">${ICON_CHEVRON}</button>`
   : '<span class="mini"></span>';
 }
 // Griff nur für die Tastatur (gezogen wird die ganze Zeile)
 const grip = parentId
  ? `<button class="cgrip tgrip" aria-label="${title} umsortieren (Pfeiltasten: hoch/runter = Reihenfolge, rechts/links = Ebene)">${ICON_GRIP}</button>`
  : '';
 // Version C: Ketten. Hat ein To-Do genau EIN Vorher-To-Do, steht dieses direkt darunter, nicht eingerückt und mit
 // einem Strich verbunden (.down / .up). Nur das letzte Glied einer Kette (das, womit man anfängt) ist kräftig,
 // die anderen leicht ausgegraut. Mehrere Vorher-To-Dos sind parallel: eingerückt, ohne Strich.
 const chainDown = inCard && children.length === 1;
 const chainClass = `${chainDown ? ' down' : ''}${linked ? ' up' : ''}${linked && viaSoft ? ' upsoft' : ''}`;
 const row = `<div class="row${task.done ? ' isdone' : ''}${inBacklog ? ' inbl' : ''}${chainClass}">${grip}${checkButtonHtml(task, color)}`
  + `<span class="tw">${titleHtml(task)}${inBacklog ? ' <span class="tag bl" title="Liegt im Backlog">Backlog</span>' : ''}</span>`
  + `${viaSoft ? '<span class="tag">hilft</span>' : ''}
 ${task.done ? '' : todaySwitchHtml(task, 1)}${inCard ? taskActionsHtml(task) : ''}${toggle}</div>`;
 const childList = children.length && isOpen
  ? `<ul data-act="none"${chainDown ? ' class="chainul"' : ''}>${children.map(([child, soft]) => treeNodeHtml(child, color, key, level + 1, soft, task.id, inCard, chainDown)).join('')}</ul>`
  : '';
 // Einfüge-Streifen: direkt unter der Zeile = kommt als Erstes vor dieses To-Do (eine Ebene tiefer),
 // ganz am Ende = kommt danach auf derselben Ebene
 // In einer Kette: der Streifen zwischen zwei Gliedern fügt mitten in die Kette ein
 const insertFirst = !inCard || task.done ? ''
  : chainDown ? insertHtml(task.id, '', color, ' inchain', children[0][0].id)
  : insertHtml(task.id, '', color, ' deeper');
 // Innerhalb einer Kette kein eigener „danach“-Streifen (sonst stapeln sich leere Streifen am Kettenende)
 const insertAfter = inCard && parentId && !linked ? insertHtml(parentId, task.id, color) : '';
 // Oben an einer Kette (nur ein Vorher-To-Do): am Ende der Kette ein „+“ für eine zweite, parallele Kette
 const insertParallel = inCard && chainDown && !linked && !task.done
  ? insertHtml(task.id, children[0][0].id, color, ' deeper parallel', '', 'Was muss parallel vorher passieren?')
  : '';
 // Handy, „+ danach“: neues To-Do kommt in die Kette zwischen dieses To-Do und das darüber
 // (darüber braucht dann das neue, das neue braucht dieses). Streifen bleibt unsichtbar, nur die Leiste klickt ihn.
 const insertChainAfter = inCard && parentId
  ? insertHtml(parentId, '', color, ' chainafter', task.id, 'Was kommt danach?')
  : '';
 return `<li data-tid="${task.id}" data-k="${esc(key)}" data-l="${level}" style="--c:${color}">${row}
 ${listHtml(task, color)}${insertFirst}${childList}${insertParallel}${insertAfter}${insertChainAfter}</li>`;
}
// Schalter „Machbar“ aus: eine Kategorie-Spalte mit den Zielen als Wurzeln
function uebersichtColumnHtml(bereich, kategorie) {
 const inThisBereich = t => bereich.id ? t.cat === bereich.id : !t.cat || !getBereich(t.cat);
 const roots = allTasks().filter(t => (t.goal || !parentsOf(t.id).length) && inThisBereich(t)
  && (!kategorie.id || kategorieIn(t, bereich.id) === kategorie.id));
 const soon = roots.filter(t => !t.done && !t.backlog).sort(byPrio);
 const backlog = roots.filter(t => !t.done && t.backlog).sort(byPrio);
 const done = roots.filter(t => t.done);
 const nodes = (tasks, level) => tasks.map(t => treeNodeHtml(t, bereich.color, bereich.id, level)).join('');
 const emptyText = backlog.length ? `Gerade nichts ${wideNarrow('zeitnah', 'dran')}.` : `Noch nichts in ${esc(kategorie.name || bereich.name)}.`;
 // Ablageflächen fürs Ziehen von Karten (wie mit Schalter „Machbar“ an)
 const dropTarget = `data-drop="zone" data-cat="${bereich.id}" data-area="${kategorie.id}"`;
 const soonHtml = soon.length
  ? `<ul class="tree">${insertRootHtml(bereich, kategorie, '', 'li')}${soon.map(t => treeNodeHtml(t, bereich.color, bereich.id, 0) + insertRootHtml(bereich, kategorie, t.id, 'li')).join('')}</ul>`
  : insertRootHtml(bereich, kategorie, '') + `<div class="empty" style="--c:${bereich.color}">${emptyText}</div>` + insertRootHtml(bereich, kategorie, '', 'div', false, true);
 const backlogHtml = backlogSectionHtml(bereich, kategorie, backlog.length, backlog.length
  ? `<ul class="tree">${insertRootHtml(bereich, kategorie, '', 'li', true)}${backlog.map(t => treeNodeHtml(t, bereich.color, bereich.id, 0) + insertRootHtml(bereich, kategorie, t.id, 'li', true)).join('')}</ul>`
  : insertRootHtml(bereich, kategorie, '', 'div', true) + `<div class="empty" style="--c:${bereich.color}">Leer. Zieh To-Dos hierher, die gerade nicht dran sind.</div>` + insertRootHtml(bereich, kategorie, '', 'div', true));
 const doneHtml = done.length
  ? `<details class="done"><summary>Erledigt · ${done.length}</summary><ul class="tree">${nodes(done, 1)}</ul></details>`
  : '';
 return `<p class="zlabel zsoon">Zeitnah</p><div class="list zone tzone" ${dropTarget} data-bl="0">${soonHtml}</div>
 ${backlogHtml}${doneHtml}`;
}
// Spalte „Sammlung“: alle offenen To-Dos dieser Kategorie als Karten, ohne Zeitnah/Backlog. Neues über „+“.
function sammlungColumnHtml(bereich, kategorie) {
 const here = t => isIn(t, bereich.id, kategorie.id);
 const roots = allTasks().filter(t => here(t) && (t.goal || !parentsOf(t.id).some(here)));
 const open = roots.filter(t => !t.done).sort(byPrio);
 const done = roots.filter(t => t.done).sort((a, b) => b.doneAt - a.doneAt);
 const dropTarget = `data-drop="zone" data-cat="${bereich.id}" data-area="${kategorie.id}" data-bl="0"`;
 const card = t => state.view === 'baum' ? treeNodeHtml(t, bereich.color, bereich.id, 0) : cardHtml(t, bereich.color, { move: true });
 const tag = state.view === 'baum' ? 'li' : 'div';
 const items = open.length
  ? open.map(t => card(t) + insertRootHtml(bereich, kategorie, t.id, tag)).join('')
  : '';
 const inner = state.view === 'baum'
  ? `<ul class="tree">${insertRootHtml(bereich, kategorie, '', 'li')}${items}</ul>`
  : insertRootHtml(bereich, kategorie, '') + items;
 const empty = open.length ? '' : `<div class="empty" style="--c:${bereich.color}">Hier schnell notieren, einsortieren später.</div>`;
 return `<div class="list zone sammlung${state.view === 'baum' ? ' tzone' : ''}" ${dropTarget}>${inner}${empty}${open.length ? '' : insertRootHtml(bereich, kategorie, '', 'div', false, true)}</div>${doneBoxHtml(done, bereich.color)}`;
}
// Tab „Heute“: freie To-Dos (ziehbar), „Danach dran“ (noch gesperrt) und „Heute geschafft“
function heuteViewHtml() {
 const byTodayOrder = (a, b) => (a.todayOrder ?? 1e12) - (b.todayOrder ?? 1e12) || byPrio(a, b);
 const free = allTasks().filter(t => t.today && !t.done && !openNeeds(t).length).sort(byTodayOrder);
 const waiting = allTasks().filter(t => t.today && !t.done && openNeeds(t).length).sort(byPrio);
 const doneToday = allTasks().filter(t => t.today && t.done && t.doneAt >= dayStart()).sort((a, b) => b.doneAt - a.doneAt);
 const date = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
 const emptyText = waiting.length ? 'Gerade ist nichts frei.' : 'Noch nichts für heute.<br>Hake in der Übersicht bei einem To-Do „Heute“ an.';
 const freeHtml = free.length
  ? free.map(t => cardHtml(t, colorOf(t), { grip: true })).join('')
  : `<div class="empty">${emptyText}</div>`;
 const waitingHtml = waiting.length
  ? `<details class="done"><summary>Danach dran · ${waiting.length}</summary>`
   + waiting.map(t => `<div class="drow wrow"><span>${titleHtml(t)}<small>erst: ${openNeeds(t).map(id => esc(getTask(id).t)).join(', ')}</small></span>${deleteMiniHtml(t)}</div>`).join('')
   + '</details>'
  : '';
 const doneHtml = doneToday.length
  ? `<details class="done"><summary>Heute geschafft · ${doneToday.length}</summary>`
   + doneToday.map(t => `<div class="drow">${checkButtonHtml(t, colorOf(t))}<span>${titleHtml(t)}</span>${deleteMiniHtml(t)}</div>`).join('')
   + '</details>'
  : '';
 return `<section class="col daywrap" style="--c:${GRAY}"><p class="dayhead">${date}</p>
 <div class="list" id="daylist">${freeHtml}</div>
 ${waitingHtml}
 ${doneHtml}</section>`;
}
// „3 zeitnah · 2 im Backlog“ für die Leiste eines Bereichs
function bereichCountsText(bereich) {
 const open = allTasks().filter(t => !t.done && isIn(t, bereich.id));
 const soon = open.filter(t => !t.backlog).length;
 const inBacklog = open.length - soon;
 // &nbsp; = geschütztes Leerzeichen: „2 im Backlog“ bricht auf dem Handy nicht mitten durch
 return `${soon}&nbsp;zeitnah${inBacklog ? ` · ${inBacklog}&nbsp;im&nbsp;Backlog` : ''}`;
}
// Bereich zugeklappt: eine Leiste
function bereichBarHtml(bereich) {
 return `<button class="catbar" data-act="opencat" data-cat="${bereich.id}" data-drop="cat" style="--c:${bereich.color}" aria-expanded="false">`
  + `<b>${esc(bereich.name)}</b><small>${bereichCountsText(bereich)}</small>${ICON_CHEVRON}</button>`;
}
// Schalter „Machbar“ im Kopf eines aufgeklappten Bereichs. An = nur To-Dos, die man jetzt tun kann.
// Gilt für alle Bereiche gleich (bleibt an, wenn man einen anderen Bereich aufklappt).
function machbarSwitchHtml(bereich) {
 const on = state.view === 'jetzt';
 return `<button class="mswitch" role="switch" aria-checked="${on}" data-act="machbar" style="--c:${bereich.color}"`
  + ` title="${on ? 'Wieder alles zeigen' : 'Nur zeigen, was du jetzt tun kannst'}"><span class="lg">Nur startklare To-Dos anzeigen</span><span class="sm">Nur Startklares</span><i></i></button>`;
}
// Bereich aufgeklappt: Kopf, Kategorie-Navigation (kleine Knöpfe) und die Spalten nebeneinander
function bereichOpenHtml(bereich) {
 const name = esc(bereich.name);
 const editButton = bereich.id
  ? `<button class="iconbtn" data-act="editcat" data-id="${bereich.id}" aria-label="Bereich ${name} bearbeiten">${ICON_PEN}</button>`
  : '';
 // Handy (Version C 1.0.34): kein Stift. Punkt antippen = Farbe wählen, Name antippen = Name bearbeiten.
 // Beim Bearbeiten steht rechts, deutlich abgesetzt, „Bereich löschen“ (mit Sicherheitsfrage).
 // Am Desktop bleibt alles wie vorher (.ct zum Zuklappen, Stift öffnet das Popup).
 const editing = bereich.id && editingBereichName === bereich.id;
 const mobileTitle = !bereich.id ? ''
  : editing
   ? `<div class="ctm"><i></i><input class="cnamein" data-catname="${bereich.id}" value="${name}" aria-label="Name des Bereichs" autocomplete="off" enterkeyhint="done"></div>`
    + `<span class="csep" aria-hidden="true"></span><button class="cdel" data-act="catdel" data-id="${bereich.id}" aria-label="Ganzen Bereich ${name} löschen">${ICON_TRASH}<span>Bereich löschen</span></button>`
   : `<div class="ctm"><button class="cdot" data-act="catcolor" data-id="${bereich.id}" aria-label="Farbe von ${name} ändern" title="Farbe ändern"><i></i></button>`
    + `<button class="cname" data-act="catname" data-id="${bereich.id}" aria-label="Name von ${name} ändern" title="Name ändern">${name}</button></div>`;
 const head = `<div class="cathead${editing ? ' editing' : ''}"><button class="ct${bereich.id ? '' : ' keep'}" data-act="opencat" data-cat="${bereich.id}" aria-expanded="true" title="Zuklappen">`
  + `<i></i>${name} <small>${bereichCountsText(bereich)}</small></button>${mobileTitle}${editing ? '' : machbarSwitchHtml(bereich) + editButton}`
  // Version C: Pfeil zum Auf- und Zuklappen ganz rechts außen
  + (editing ? '' : `<button class="iconbtn cattog" data-act="opencat" data-cat="${bereich.id}" aria-expanded="true" aria-label="Bereich ${name} zuklappen" title="Zuklappen">${ICON_CHEVRON}</button>`) + `</div>`;
 const tabs = bereich.id
  ? `<nav class="subtabs" aria-label="Kategorien von ${name}">`
   + bereich.subs.map(k => {
    const i = columnsOf(bereich).indexOf(k);
    const eye = k.inbox
     ? `<span class="eye" data-act="eye" data-id="${bereich.id}" data-s="${k.id}" role="button" tabindex="0" aria-label="${esc(k.name)} ${k.hidden ? 'einblenden' : 'ausblenden'}" title="${k.hidden ? 'Einblenden' : 'Ausblenden'}">${k.hidden ? ICON_EYE_OFF : ICON_EYE}</span>`
     : '';
    if (k.hidden) return `<button class="tab off" data-act="eye" data-id="${bereich.id}" data-s="${k.id}" style="--c:${bereich.color}" aria-label="${esc(k.name)} einblenden">${katLabelHtml(k)}${eye}</button>`;
    return `<button class="tab" data-act="gocol" data-i="${i}" data-drop="zone" data-cat="${bereich.id}" data-area="${k.id}"`
     + ` style="--c:${bereich.color}" aria-current="${i === currentColumn}">${katLabelHtml(k)}${eye}</button>`;
   }).join('')
   + `<button class="tab new" data-act="newsub" data-id="${bereich.id}">+ Kategorie</button></nav>`
  : '';
 // Handy: statt der Kategorie-Knöpfe dezente Pfeile links und rechts neben den Spalten.
 // Kurz tippen = eine Spalte weiter, lange drücken = Menü mit allen Kategorien (siehe openKatMenu).
 const arrow = (dir, label) => bereich.id
  ? `<button class="colarrow ${dir > 0 ? 'next' : 'prev'}" data-act="colstep" data-d="${dir}" data-id="${bereich.id}" aria-haspopup="menu"`
   + ` aria-label="${label} (lange drücken: alle Kategorien)" title="${label} · lange drücken: alle Kategorien">${ICON_CHEVRON}</button>`
  : '';
 const columns = columnsOf(bereich).map(kategorie => {
  // Griff zum Umsortieren der Spalten, nur wenn es mehr als eine Spalte gibt
  const columnGrip = columnsOf(bereich).length > 1
   ? `<button class="colgrip" data-cat="${bereich.id}" data-s="${kategorie.id}" aria-label="Kategorie ${esc(kategorie.name)} verschieben, mit Pfeil links oder rechts">${ICON_GRIP}</button>`
   : '';
  // 1.0.38: Die Sammlung hat oben ein Auge zum Ausblenden. Wieder einblenden: Pfeil lange drücken → Menü.
  const hideEye = kategorie.inbox
   ? `<button class="iconbtn ceye" data-act="eye" data-id="${bereich.id}" data-s="${kategorie.id}" aria-label="${esc(kategorie.name)} ausblenden" title="Ausblenden (wieder einblenden: Pfeil lange drücken)">${ICON_EYE}</button>`
   : '';
  const columnHead = bereich.subs.length
   ? `<div class="colhead">${columnGrip}<h2 style="--c:${bereich.color}">${katLabelHtml(kategorie)}</h2>${hideEye}<button class="iconbtn" data-act="editsub" data-id="${bereich.id}" data-s="${kategorie.id}"`
    + ` aria-label="Kategorie ${esc(kategorie.name)} bearbeiten">${ICON_PEN}</button></div>`
   : '';
  const content = kategorie.inbox ? sammlungColumnHtml(bereich, kategorie)
   : state.view === 'baum' ? uebersichtColumnHtml(bereich, kategorie) : machbarColumnHtml(bereich, kategorie);
  return `<section class="col${kategorie.inbox ? ' colsammlung' : ''}" aria-label="${esc(kategorie.name)}">${columnHead}${content}</section>`;
 }).join('')
  // Handy (Version C 1.0.35): nach der letzten Spalte eine leere Spalte mit „+“ für eine neue Kategorie
  + (bereich.id ? `<section class="col coladd" aria-label="Neue Kategorie"><button class="addcol" data-act="newsub" data-id="${bereich.id}">`
   + `<span aria-hidden="true">+</span>Neue Kategorie</button></section>` : '');
 return `<section class="cat open" style="--c:${bereich.color}" aria-label="${name}">
 ${head}
 ${tabs}
 <div class="colwrap${bereich.id ? '' : ' noarrows'}">${arrow(-1, 'Vorherige Kategorie')}<div class="cols" id="cols">${columns}</div>${arrow(1, 'Nächste Kategorie')}</div></section>`;
}

/* ---------- Seite aufbauen ---------- */
// Baut die ganze Seite aus state neu auf. Nach jeder Änderung an state aufrufen (nach save()).
function render() {
 closeKatMenu();
 document.body.classList.toggle('noanim', !state.anim);
 const nameField = $('#name');
 if (document.activeElement !== nameField) nameField.value = state.name;
 document.title = state.name || 'Meine Liste';
 // Tab „Übersicht“ ist gedrückt, egal ob der Schalter „Machbar“ an oder aus ist
 document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === (state.view === 'heute' ? 'heute' : 'baum')));
 $('#inboxSlot').innerHTML = state.inbox.length
  ? `<button class="inbox" data-act="inbox">Später einsortieren · <b>${state.inbox.length}</b></button>`
  : '';
 if (state.view === 'heute') {
  $('#acc').innerHTML = heuteViewHtml();
  lastRenderedBereich = undefined;
  updateQuickBar();
  return;
 }
 // Übersicht (Schalter „Machbar“ an oder aus): Bereiche untereinander, einer davon aufgeklappt
 const bereiche = visibleBereiche();
 if (state.openCat !== null && !bereiche.some(b => b.id === state.openCat)) {
  state.openCat = bereiche[0] ? bereiche[0].id : null;
 }
 const openBereich = bereiche.find(b => b.id === state.openCat);
 currentColumn = Math.max(0, Math.min(currentColumn, columnsOf(openBereich).length - 1));
 const scrollBefore = $('#cols')?.scrollLeft || 0;
 $('#acc').innerHTML = bereiche.map(b => b === openBereich ? bereichOpenHtml(b) : bereichBarHtml(b)).join('')
  + `<button class="catbar new" data-act="newcat">+ Bereich</button>`;
 // Seitliche Position der Spalten wiederherstellen (gleicher Bereich) oder zur aktuellen Spalte springen
 const cols = $('#cols');
 if (cols) {
  if (lastRenderedBereich === state.openCat) {
   cols.scrollLeft = scrollBefore;
  } else if (currentColumn) {
   const column = cols.children[currentColumn];
   if (column) cols.scrollLeft = column.offsetLeft - cols.offsetLeft;
  }
 }
 lastRenderedBereich = state.openCat;
 updateColumnEdges();
 markTouchStrips();
 updateQuickBar();
}
/* Version C, Handy (ohne Maus, kein Drüberfahren): Statt aller „+“-Linien ist pro Stelle nur eine zu sehen
   (Klasse .tvis): die unterste einer Spalten-Liste und die unterste in jeder Karte. Antippt man eine Zeile
   in einer Karte (nicht den Text), erscheinen genau ihre „+“ (Klasse .tsel am <li>). */
function markTouchStrips() {
 // Im Backlog bleibt das „+“ versteckt (wie am Desktop)
 document.querySelectorAll('#acc [data-drop="zone"]:not([data-bl="1"])').forEach(zone => {
  const strips = [...zone.querySelectorAll('.insroot')].filter(x => x.closest('[data-drop="zone"]') === zone);
  if (strips.length) strips.at(-1).classList.add('tvis');
 });
 document.querySelectorAll('#acc .card').forEach(card => {
  const own = [...card.querySelectorAll(`.ins[data-p="${card.dataset.id}"]:not(.chainafter)`)];
  if (own.length) own.at(-1).classList.add('tvis');
 });
}
document.addEventListener('click', event => {
 if (matchMedia('(hover:hover)').matches) return;
 const row = event.target.closest && event.target.closest('.tcard li > .row');
 const act = event.target.closest('[data-act]');
 if (!row || event.target.closest('button, input, .t') || (act && act.dataset.act !== 'none')) return;
 const li = row.parentElement;
 const wasSelected = li.classList.contains('tsel');
 document.querySelectorAll('.tsel').forEach(x => x.classList.remove('tsel'));
 document.querySelectorAll('.mbar').forEach(x => x.remove());
 if (wasSelected) return;
 li.classList.add('tsel');
 // Eine Linie mit bis zu drei „+“ nebeneinander: davor / parallel / danach.
 // Jedes „+“ klickt den passenden (versteckten) Streifen, dort erscheint dann Frage und Eingabefeld.
 // „danach“ = in die Kette nach diesem To-Do (.chainafter), nicht als weiteres Unter-To-Do daneben
 let strips = [...li.children].filter(x => x.classList.contains('ins'));
 if (strips.some(x => x.classList.contains('chainafter'))) {
  strips = strips.filter(x => x.classList.contains('chainafter') || x.classList.contains('parallel') || x.classList.contains('deeper') || x.classList.contains('inchain'));
 }
 const kindOf = strip => strip.classList.contains('parallel') ? 1 : strip.classList.contains('deeper') || strip.classList.contains('inchain') ? 0 : 2;
 const labels = ['davor', 'parallel', 'danach'];
 strips.sort((a, b) => kindOf(a) - kindOf(b));
 if (!strips.length) return;
 const bar = document.createElement('div');
 bar.className = 'mbar';
 bar.dataset.act = 'none';
 strips.forEach(strip => {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = `<span aria-hidden="true">+</span>${labels[kindOf(strip)]}`;
  b.setAttribute('aria-label', strip.getAttribute('aria-label'));
  b.addEventListener('click', e => {
   e.stopPropagation();
   bar.remove();
   strip.style.display = 'block';
   strip.click();
  });
  bar.append(b);
 });
 row.after(bar);
}, true);
// Blendet die Kanten der Spalten aus, wenn man seitlich weiterwischen kann (CSS-Klassen ovf, ovf-l, ovf-r)
function updateColumnEdges() {
 const cols = $('#cols');
 if (!cols) return;
 const bereichEl = cols.closest('.cat');
 const overflows = cols.scrollWidth > cols.clientWidth + 4;
 bereichEl.classList.toggle('ovf', overflows);
 bereichEl.classList.toggle('ovf-r', overflows && cols.scrollLeft < cols.scrollWidth - cols.clientWidth - 4);
 bereichEl.classList.toggle('ovf-l', overflows && cols.scrollLeft > 4);
}
// Markiert den Knopf der Kategorie-Spalte Nr. index in der Kategorie-Navigation als aktuell
function markCurrentTab(index) {
 document.querySelectorAll('.tab[data-i]').forEach(b => b.setAttribute('aria-current', +b.dataset.i === index));
 updateQuickBar();
}
// Zu Kategorie-Spalte Nr. index wischen/scrollen. Mit highlight leuchtet die Spalte kurz auf
// (Klick in der Kategorie-Navigation), damit man sieht, wo man gelandet ist.
function goToColumn(index, highlight = false) {
 currentColumn = index;
 const cols = $('#cols');
 const column = cols && cols.children[index];
 if (column) {
  // Während des Scrollens die Markierung nicht vom Scroll-Ereignis umsetzen lassen
  // (die letzte Spalte kann oft nicht ganz nach links rutschen)
  columnJumpUntil = Date.now() + 800;
  cols.scrollTo({ left: column.offsetLeft - cols.offsetLeft, behavior: state.anim ? 'smooth' : 'auto' });
  if (highlight) {
   column.classList.remove('jump');
   void column.offsetWidth; // Animation neu starten, auch bei zweitem Klick
   column.classList.add('jump');
   setTimeout(() => column.classList.remove('jump'), 1100);
  }
 }
 markCurrentTab(index);
}
addEventListener('resize', updateColumnEdges);

/* ---------- Handy: Pfeile neben den Spalten und Menü mit allen Kategorien (Version C 1.0.34) ----------
   Kurz tippen auf ‹ oder › = eine Spalte weiter (am Ende geht es vorne wieder los).
   Lange drücken (oder Rechtsklick) = kleines Menü mit allen Kategorien, ausgeblendeten zum Einblenden
   und „+ Kategorie“. Die Einträge sind normale Knöpfe mit data-act und laufen durch den Klick-Verteiler unten. */
const LONG_PRESS_MS = 450;
let longPress = null;          // { timer, x, y, button } solange ein Pfeil gedrückt gehalten wird
let swallowArrowClick = false; // Loslassen nach langem Drücken ist kein Klick
function stepColumn(direction, button) {
 const count = columnsOf(visibleBereiche().find(b => b.id === state.openCat)).length;
 if (count < 2) { openKatMenu(button); return; }
 goToColumn((currentColumn + direction + count) % count, true);
}
function closeKatMenu() {
 const menu = document.querySelector('.ctxmenu');
 if (menu) menu.remove();
}
// Kleines Menü neben einem Knopf (anchor). html = Inhalt. Links vom Bildschirm-Mittelpunkt öffnet es nach rechts.
function openPopMenu(anchor, html, label) {
 closeKatMenu();
 const menu = document.createElement('div');
 menu.className = 'ctxmenu';
 menu.setAttribute('role', 'menu');
 menu.setAttribute('aria-label', label);
 const bereichEl = anchor.closest('.cat');
 if (bereichEl) menu.style.setProperty('--c', bereichEl.style.getPropertyValue('--c'));
 menu.innerHTML = html;
 document.body.append(menu);
 const r = anchor.getBoundingClientRect();
 const width = menu.offsetWidth;
 const left = r.left + r.width / 2 < innerWidth / 2 ? r.right + 6 : r.left - width - 6;
 menu.style.left = Math.max(8, Math.min(left, innerWidth - width - 8)) + 'px';
 const top = Math.max(8, Math.min(r.top, innerHeight - menu.offsetHeight - 8));
 menu.style.top = top + 'px';
 menu.querySelector('button')?.focus({ preventScroll: true });
}
function openKatMenu(anchor) {
 const bereich = getBereich(anchor.dataset.id);
 if (!bereich) return;
 const columns = columnsOf(bereich);
 const items = bereich.subs.map(k => {
  const i = columns.indexOf(k);
  return k.hidden
   ? `<button role="menuitem" class="off" data-act="eye" data-id="${bereich.id}" data-s="${k.id}">${katLabelHtml(k)}<small>einblenden</small></button>`
   : `<button role="menuitem" data-act="gocol" data-i="${i}"${i === currentColumn ? ' aria-current="true"' : ''}>${katLabelHtml(k)}</button>`;
 }).join('') + `<hr><button role="menuitem" class="new" data-act="newsub" data-id="${bereich.id}">+ Kategorie</button>`;
 openPopMenu(anchor, items, `Kategorien von ${bereich.name}`);
 if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {}
}
// Farbe des Bereichs: Punkt im Kopf antippen → Farbfelder
function openColorMenu(anchor) {
 const bereich = getBereich(anchor.dataset.id);
 if (!bereich) return;
 openPopMenu(anchor, `<div class="cmswatch">` + COLORS.map((color, i) => `<button role="menuitemradio" data-act="setcolor" data-id="${bereich.id}" data-color="${color}"`
  + ` style="--c:${color}" aria-checked="${color === bereich.color}" aria-label="Farbe ${i + 1}"></button>`).join('') + `</div>`, `Farbe von ${bereich.name}`);
}
function setBereichColor(id, color) {
 const bereich = getBereich(id);
 if (!bereich || !COLORS.includes(color) || bereich.color === color) return;
 undoSnapshot = snapshot();
 bereich.color = color;
 save();
 render();
}
document.addEventListener('pointerdown', event => {
 // Tippen außerhalb des Menüs schließt es
 const menu = document.querySelector('.ctxmenu');
 if (menu && !menu.contains(event.target)) closeKatMenu();
 const arrow = event.target.closest && event.target.closest('.colarrow, .qarrow');
 if (!arrow || event.button > 0 || !arrow.dataset.id) return;
 swallowArrowClick = false;
 clearTimeout(longPress?.timer);
 longPress = {
  x: event.clientX, y: event.clientY, button: arrow,
  timer: setTimeout(() => { swallowArrowClick = true; longPress = null; openKatMenu(arrow); }, LONG_PRESS_MS)
 };
}, true);
document.addEventListener('pointermove', event => {
 if (longPress && Math.hypot(event.clientX - longPress.x, event.clientY - longPress.y) > 10) { clearTimeout(longPress.timer); longPress = null; }
}, true);
['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, () => {
 if (longPress) { clearTimeout(longPress.timer); longPress = null; }
}, true));
// Rechtsklick oder Kontextmenü-Taste auf einem Pfeil: gleiches Menü. Am Handy kein Browser-Menü beim langen Drücken.
document.addEventListener('contextmenu', event => {
 const arrow = event.target.closest && event.target.closest('.colarrow, .qarrow');
 if (!arrow || !arrow.dataset.id) return;
 event.preventDefault();
 if (!document.querySelector('.ctxmenu')) { swallowArrowClick = event.pointerType === 'touch' || !!longPress; openKatMenu(arrow); }
});
// Menü mit Escape schließen, mit Pfeiltasten durch die Einträge gehen
document.addEventListener('keydown', event => {
 const menu = document.querySelector('.ctxmenu');
 if (!menu) return;
 if (event.key === 'Escape') { event.stopPropagation(); closeKatMenu(); return; }
 if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
  const items = [...menu.querySelectorAll('button')];
  const i = items.indexOf(document.activeElement);
  const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
  items[(i + step + items.length) % items.length]?.focus();
  event.preventDefault();
  event.stopPropagation();
 }
}, true);

/* ---------- Version C 1.0.35, Handy: Schnelleingabe unten ----------
   Statt des Knopfs „+ Neues To-Do“ steht unten eine Eingabezeile. Was man dort tippt, landet mit Enter in
   der Spalte, die gerade zu sehen ist (deren Name steht klein darüber), unten an der Liste. Das Feld bleibt
   offen, man kann gleich das nächste tippen.
   Links und rechts davon runde Pfeile: eine Kategorie weiter (ausgegraut am Anfang/Ende), lange drücken =
   Menü mit allen Kategorien. Der kleine Pfeil darunter fährt den Block nach oben aus: Dort stellt man selbst
   ein, wohin es geht (Bereich, Kategorie, oben/unten, Backlog). Solange ausgefahren, gilt diese Wahl.
   „Mit davor/danach …“ öffnet das große Popup mit dem getippten Text. Nur am Handy (bis 600 px). */
let quickOpen = false;   // Einsortier-Optionen ausgefahren?
function quickTargetPlace() {
 return quickOpen ? $('#qopts [name=place]').value : currentPlace();
}
// Name der Ziel-Spalte über der Zeile, Pfeile aus/an
function updateQuickBar() {
 const bar = $('#qbar');
 if (!bar) return;
 const heute = state.view === 'heute';
 const [bereichId, kategorieId] = quickTargetPlace().split('|');
 const bereich = getBereich(bereichId);
 const backlog = quickOpen && $('#qopts [name=bl]')?.checked;
 // Version C 1.0.36: Wohin es geht, steht im Hinweistext des Felds (kein Schild mehr darüber)
 const kategorie = bereich && bereich.subs.find(k => k.id === kategorieId);
 const where = kategorie ? kategorie.name : placeName(bereichId, kategorieId);
 // 1.0.37: kurz halten, das Feld ist schmal. Für Vorlesehilfen steht es ausführlich im aria-label.
 const hint = heute && !quickOpen ? '+ für „Heute“' : `+ in „${where}“${backlog ? ' · Backlog' : ''}`;
 const input = $('#qin');
 input.placeholder = hint;
 input.setAttribute('aria-label', heute && !quickOpen ? 'Neues To-Do für Heute' : `Neues To-Do in ${where}${backlog ? ', Backlog' : ''}`);
 bar.style.setProperty('--c', bereich ? bereich.color : GRAY);
 const open = visibleBereiche().find(b => b.id === state.openCat);
 const count = open && !heute ? columnsOf(open).length : 0;
 bar.querySelectorAll('.qarrow').forEach(arrow => {
  const d = +arrow.dataset.d;
  // Nicht disabled: lange drücken (Menü mit allen Kategorien) soll auch am Ende gehen
  const off = !count || (d < 0 ? currentColumn <= 0 : currentColumn >= count - 1);
  arrow.classList.toggle('off', off);
  arrow.setAttribute('aria-disabled', off);
  arrow.dataset.id = open && open.id ? open.id : '';
 });
 syncDockHeight();
}
// Höhe der Leiste unten als CSS-Variable --dockh: Der Hinweis (Toast) steht immer knapp darüber
function syncDockHeight() {
 const dock = document.querySelector('.dock');
 if (dock) document.documentElement.style.setProperty('--dockh', dock.offsetHeight + 'px');
}
addEventListener('resize', syncDockHeight);
// Version C 1.0.37: Tastatur. Der Viewport-Tag (interactive-widget=resizes-visual) sorgt dafür, dass die Tastatur
// die Seite nicht neu anordnet (Spalten bleiben, wie sie sind), aber der sichtbare Teil (visualViewport) kleiner
// wird. Daraus berechnet die App, wie viel die Tastatur verdeckt, und schiebt die Leiste unten (und Popups)
// genau darüber. --kb = verdeckte Höhe. (1.0.36 hatte overlays-content: Dann meldet Android die Tastatur gar
// nicht, und sie lag über dem Feld.)
function placeDockAboveKeyboard() {
 const view = window.visualViewport;
 const dock = document.querySelector('.dock');
 if (!view || !dock) return;
 const covered = Math.max(0, Math.round(innerHeight - view.height - view.offsetTop));
 // 1.0.38: Nur wenn das eigene Feld (oder die Optionen) aktiv ist, rutscht die Leiste über die Tastatur.
 // Tippt man woanders (Titel, Popup …), bleibt sie unten und ist ausgeblendet.
 const own = covered && dock.contains(document.activeElement);
 dock.style.transform = own ? `translateY(${-covered}px)` : '';
 dock.classList.toggle('kbhide', !!covered && !own);
 document.documentElement.style.setProperty('--kb', covered + 'px');
}
window.visualViewport?.addEventListener('resize', placeDockAboveKeyboard);
window.visualViewport?.addEventListener('scroll', placeDockAboveKeyboard);
// Manche Handys melden die Tastatur erst etwas später: nach dem Antippen eines Felds noch ein paar Mal nachsehen
['focusin', 'focusout'].forEach(type => document.addEventListener(type, () => {
 [50, 200, 400, 700].forEach(ms => setTimeout(placeDockAboveKeyboard, ms));
}));
// Haken in der Eingabezeile: Tippen soll die Tastatur nicht schließen
document.addEventListener('pointerdown', event => {
 if (event.target.closest && event.target.closest('.qok')) event.preventDefault();
});
function quickStep(direction) {
 const open = visibleBereiche().find(b => b.id === state.openCat);
 const count = open ? columnsOf(open).length : 0;
 const to = currentColumn + direction;
 if (to < 0 || to >= count) return;
 goToColumn(to, true);
 updateQuickBar();
}
function setQuickOpen(on) {
 quickOpen = on;
 const bar = $('#qbar');
 bar.classList.toggle('open', on);
 bar.querySelector('.qmore').setAttribute('aria-expanded', on);
 const opts = $('#qopts');
 if (on) {
  opts.innerHTML = placePickerHtml(currentPlace())
   + `<div class="qline"><div class="seg qpos" role="radiogroup" aria-label="Wo in der Spalte?">`
   + `<label><input type="radio" name="qpos" value="top">Oben</label><label><input type="radio" name="qpos" value="bottom" checked>Unten</label></div>`
   + `<label class="opt"><input type="checkbox" name="bl"> Backlog</label></div>`
   + `<button type="button" class="link qfull" data-act="qfull">Mehrere mit davor/danach …</button>`;
 }
 opts.inert = !on;
 updateQuickBar();
 setTimeout(syncDockHeight, 320); // nach dem Ausfahren
}
// Ausgefahrene Optionen einklappen (z. B. mit der Zurück-Taste). true = war offen.
function closeQuickOptions() {
 if (!quickOpen) return false;
 setQuickOpen(false);
 return true;
}
function quickAdd() {
 const input = $('#qin');
 const text = input.value.trim();
 if (!text) { input.focus({ preventScroll: true }); return; }
 const [cat, area] = quickTargetPlace().split('|');
 const today = state.view === 'heute' && !quickOpen;
 const backlog = quickOpen && $('#qopts [name=bl]').checked;
 const top = quickOpen && $('#qopts [name=qpos]:checked')?.value === 'top';
 undoSnapshot = snapshot();
 // Reihenfolge in der Spalte: höhere prio zuerst, bei gleicher prio das ältere zuerst
 const prios = allTasks().filter(t => !t.done && !!t.backlog === backlog && isIn(t, cat, area) && !parentsOf(t.id).length).map(t => t.prio);
 const prio = top ? Math.max(0, ...prios) + 1 : Math.min(0, ...prios);
 const task = createTask(text, { goal: true, cat: cat || null, area: area || null, backlog, today, prio });
 input.value = '';
 save();
 render();
 const kategorie = getBereich(cat)?.subs.find(k => k.id === area);
 toast(`„${esc(shownTitle(task))}“ in ${esc(kategorie ? kategorie.name : placeName(cat, area))}${backlog ? ' · Backlog' : ''}.`, true);
 input.focus({ preventScroll: true });
}
document.addEventListener('keydown', event => {
 if (event.target.id !== 'qin') return;
 if (event.key === 'Enter') { event.preventDefault(); quickAdd(); }
 if (event.key === 'Escape') { event.preventDefault(); if (!closeQuickOptions()) event.target.blur(); }
});
document.addEventListener('change', event => {
 if (event.target.closest && event.target.closest('#qopts')) setTimeout(updateQuickBar, 0);
});
/* ---------- Handy: Name des Bereichs direkt im Kopf bearbeiten (Version C 1.0.34) ---------- */
let nameCommitTimer;
function startBereichRename(id) {
 editingBereichName = id;
 render();
 const field = document.querySelector('.cnamein');
 if (field) { field.focus(); field.select(); }
}
// Übernimmt den Namen aus dem Feld (leer = alter Name bleibt) und beendet das Bearbeiten
function commitBereichRename(keep = true) {
 clearTimeout(nameCommitTimer);
 const field = document.querySelector('.cnamein');
 const bereich = getBereich(editingBereichName);
 editingBereichName = null;
 if (keep && field && bereich) {
  const value = field.value.trim();
  if (value && value !== bereich.name) {
   undoSnapshot = snapshot();
   bereich.name = value;
   save();
  }
 }
 render();
}
document.addEventListener('keydown', event => {
 if (!event.target.matches || !event.target.matches('.cnamein')) return;
 if (event.key === 'Enter') { event.preventDefault(); commitBereichRename(true); }
 if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); commitBereichRename(false); }
}, true);
// Verlässt man das Feld, wird der Name kurz danach übernommen. Kurz danach, damit ein Tipp auf
// „Bereich löschen“ noch ankommt, bevor die Seite neu aufgebaut wird.
document.addEventListener('focusout', event => {
 if (!event.target.matches || !event.target.matches('.cnamein')) return;
 clearTimeout(nameCommitTimer);
 nameCommitTimer = setTimeout(() => { if (editingBereichName && !deletingBereich) commitBereichRename(true); }, 250);
});
let deletingBereich = false;
// Beim Wischen durch die Spalten den passenden Knopf in der Kategorie-Navigation markieren
// (14 = Abstand zwischen Spalten in px, siehe .cat .cols in app.css)
document.addEventListener('scroll', event => {
 const cols = event.target;
 if (!cols || cols.id !== 'cols') return;
 updateColumnEdges();
 if (Date.now() < columnJumpUntil) return;
 const columnWidth = cols.firstElementChild?.offsetWidth || 1;
 const index = Math.round(cols.scrollLeft / (columnWidth + 14));
 if (index !== currentColumn) {
  currentColumn = index;
  markCurrentTab(index);
 }
}, { capture: true, passive: true });
// Desktop: die zuletzt angetippte Spalte gilt als aktuelle Kategorie (z. B. als Vorbelegung bei „Neues To-Do“)
document.addEventListener('pointerdown', event => {
 const column = event.target.closest && event.target.closest('#cols > .col');
 if (column) currentColumn = [...column.parentElement.children].indexOf(column);
}, true);

/* ---------- Popup & Hinweis ---------- */
// buttonHtml(wert, beschriftung, art): Knopf für Popups. art 'pri' = Hauptknopf, 'ghost' = unauffällig
const buttonHtml = (value, label, kind = '') => `<button type="button" class="btn ${kind}" data-v="${value}">${label}</button>`;

// Liest alle Felder mit name="…" aus dem Popup, dazu unter _pre die Einträge der Vorher-Liste
function readModalValues(modalEl) {
 const values = {
  _pre: [...modalEl.querySelectorAll('.prerow')]
   .map(row => ({ t: row.querySelector('input').value.trim(), l: +row.dataset.l }))
   .filter(entry => entry.t)
 };
 modalEl.querySelectorAll('[name]').forEach(field => {
  if (field.type === 'radio') {
   if (field.checked) values[field.name] = field.value;
  } else if (field.type === 'checkbox') {
   values[field.name] = field.checked;
  } else {
   values[field.name] = field.value.trim();
  }
 });
 return values;
}
/* ---------- Zurück-Taste (Android, auch in der installierten App) ----------
   Ist ein Popup offen, legt die App einen eigenen Eintrag in den Verlauf („popup“).
   Die Zurück-Taste nimmt dann diesen Eintrag weg: Das schließt das Popup (wie „Abbrechen“).
   Wird ein Popup auf anderem Weg geschlossen (Knopf, Escape), nimmt die App ihren Eintrag selbst wieder weg.
   Version C 1.0.35: Am Handy fliegt man mit „Zurück“ nicht mehr aus der App. Unter allem liegen zwei eigene
   Einträge: „base“ und darüber „home“. Zurück ohne offenes Popup landet auf „base“, die App legt „home“
   sofort wieder darauf. Ist die Schnelleingabe ausgefahren, klappt sie zuerst ein. Zweimal schnell
   hintereinander fragt die App „App verlassen?“. Ja = die App geht wirklich zurück (bzw. schließt sich). */
let closeOpenModal = null;   // schließt das gerade offene Popup (wie Abbrechen)
let backGuard = false;       // liegt gerade ein eigener Eintrag im Verlauf?
let ignoreNextPop = false;   // nächstes popstate kommt von uns selbst (history.back), nichts tun
let leaving = false;         // „App verlassen?“ mit Ja beantwortet: alle eigenen Einträge überspringen
let lastHomeBack = 0;        // wann zuletzt „Zurück“ ohne offenes Popup gedrückt wurde
const EXIT_DOUBLE_MS = 700;  // so schnell hintereinander gilt als Doppeldruck
const layerOpen = () => !$('#modal').hidden;
// Nur am Handy bzw. als installierte App. Am Desktop-Browser bleibt „Zurück“ normal.
const exitGuardWanted = () => matchMedia('(hover:none)').matches || matchMedia('(display-mode: standalone)').matches;
function armExitGuard() {
 if (!exitGuardWanted()) return;
 try {
  const kind = history.state?.powerliste;
  if (kind === 'home') return;
  // Nach einem Neuladen mit offenem Popup: Der Eintrag wird zu „home“
  if (kind === 'popup') { history.replaceState({ powerliste: 'home' }, ''); return; }
  if (kind !== 'base') history.replaceState({ powerliste: 'base' }, '');
  history.pushState({ powerliste: 'home' }, '');
 } catch (e) {}
}
// Erst nach einem Moment prüfen: Oft folgt auf ein geschlossenes Popup sofort das nächste.
function syncBackGuard() {
 setTimeout(() => {
  if (layerOpen() && !backGuard) {
   try { history.pushState({ powerliste: 'popup' }, ''); backGuard = true; } catch (e) {}
  } else if (!layerOpen() && backGuard) {
   backGuard = false;
   ignoreNextPop = true;
   history.back();
  }
 }, 0);
}
addEventListener('popstate', () => {
 const kind = history.state?.powerliste;
 if (leaving) { if (kind === 'base' || kind === 'home') history.back(); return; }
 if (ignoreNextPop) {
  ignoreNextPop = false;
  // Wurde inzwischen schon das nächste Popup geöffnet, braucht es wieder einen Eintrag
  if (kind !== 'popup') { backGuard = false; syncBackGuard(); }
  return;
 }
 if (backGuard) {
  backGuard = false;
  if (!$('#modal').hidden && closeOpenModal) closeOpenModal(null);
  if (kind === 'base') armExitGuard();
  syncBackGuard();
  return;
 }
 if (kind === 'base') { armExitGuard(); backAtHome(); }
});
// „Zurück“ gedrückt, ohne dass ein Popup offen ist
function backAtHome() {
 if (closeQuickOptions()) return;
 const now = Date.now();
 if (now - lastHomeBack < EXIT_DOUBLE_MS) { lastHomeBack = 0; askLeave(); return; }
 lastHomeBack = now;
 toast('Zum Verlassen zweimal schnell „Zurück“ drücken.');
}
async function askLeave() {
 const r = await modal(`<h2>App verlassen?</h2><p>Deine Liste ist gespeichert.</p>`
  + `<div class="btns">${buttonHtml('', 'Nein', 'ghost')}${buttonHtml('yes', 'Ja', 'pri')}</div>`);
 if (r.v !== 'yes') return;
 // Erst den Eintrag des Popups wegnehmen lassen (syncBackGuard), dann über „home“ und „base“ zurück
 setTimeout(() => {
  leaving = true;
  history.back();
  // Ging es nicht weiter zurück (die App war der erste Eintrag), bleibt die App offen:
  // Dann schließt die nächste Zurück-Taste sie, ohne zu fragen.
  setTimeout(() => {
   if (document.visibilityState !== 'visible') return;
   leaving = false;
   try { window.close(); } catch (e) {}
   if (history.state?.powerliste !== 'base') return;
   toast('Noch einmal „Zurück“ drücken zum Schließen.');
  }, 700);
 }, 150);
}

// modal(html): zeigt ein Popup und wartet, bis es geschlossen wird. Ergebnis: {v, vals}
//   v = data-v des gedrückten Knopfs (null bei Escape/Klick daneben)
//   vals = Werte aller Felder mit name="…" im Popup, _pre = Einträge der Vorher-Liste
// Benutzung: const r = await modal(`<h2>…</h2> … ${buttonHtml('ok', 'Fertig', 'pri')}`); if (r.v === 'ok') …
function modal(html) {
 return new Promise(resolve => {
  const modalEl = $('#modal');
  const previousFocus = document.activeElement;
  $('#toast').hidden = true;
  modalEl.innerHTML = `<div class="box" role="dialog" aria-modal="true">${html}</div>`;
  modalEl.hidden = false;
  (modalEl.querySelector('input.field') || modalEl.querySelector('.btn.pri') || modalEl.querySelector('button'))?.focus();

  const close = value => {
   if (closeOpenModal === close) closeOpenModal = null;
   const vals = readModalValues(modalEl);
   modalEl.hidden = true;
   modalEl.innerHTML = '';
   modalEl.onclick = null;
   document.removeEventListener('keydown', onKeyDown);
   previousFocus?.focus?.();
   resolve({ v: value, vals });
   syncBackGuard();
  };
  closeOpenModal = close;
  syncBackGuard();
  // Escape schließt. Enter im Titel oder in einer Vorher-Zeile fügt eine neue Vorher-Zeile an,
  // sonst drückt Enter den Hauptknopf.
  const onKeyDown = event => {
   if (event.key === 'Escape') close(null);
   if (event.key !== 'Enter' || !event.target.matches('input.field')) return;
   event.preventDefault();
   const preList = modalEl.querySelector('.prelist');
   if (preList && event.target.name === 'text') { addPreRow(preList, null, 0); return; }
   if (preList && event.target.matches('.pre') && event.target.value.trim()) {
    const row = event.target.closest('.prerow');
    addPreRow(preList, row, +row.dataset.l);
    return;
   }
   const mainButton = modalEl.querySelector('.btn.pri');
   if (mainButton) close(mainButton.dataset.v);
  };
  document.addEventListener('keydown', onKeyDown);
  modalEl.onclick = event => {
   const rowButton = event.target.closest('[data-row]');
   if (rowButton) { preRowAction(rowButton); return; }
   const button = event.target.closest('[data-v]');
   if (button) close(button.dataset.v);
   else if (event.target === modalEl) close(null);
  };
 });
}
// toast: kurzer Hinweis unten, verschwindet nach 7 Sekunden.
// withUndo = true zeigt „Rückgängig“ (setzt state auf undoSnapshot zurück).
function toast(message, withUndo) {
 const toastEl = $('#toast');
 clearTimeout(toastTimer);
 toastEl.innerHTML = `<span>${message}</span>${withUndo ? '<button id="undo">Rückgängig</button>' : ''}`;
 toastEl.hidden = false;
 if (withUndo) {
  $('#undo').onclick = () => {
   state = JSON.parse(undoSnapshot);
   save();
   render();
   toastEl.hidden = true;
  };
 }
 toastTimer = setTimeout(() => toastEl.hidden = true, 7000);
}

/* ---------- Vorher-Liste im Popup „Neues To-Do“ ----------
   Jede Zeile ist ein Vorher-To-Do. Einrückung (data-l = Ebene) heißt: kommt vor dem Eintrag darüber. */
const prePlaceholder = level => level ? 'Und davor?' : 'z. B. Einkaufen';
function preRowHtml(level) {
 return `<div class="prerow" data-l="${level}" style="--l:${level}">`
  + `<span class="grip" aria-hidden="true" title="Ziehen: hoch/runter = Reihenfolge, links/rechts = Ebene">${ICON_GRIP_WIDE}</span>`
  + `<input class="field pre" placeholder="${prePlaceholder(level)}" autocomplete="off" aria-label="Vorher-To-Do">`
  + `<button type="button" class="mini" data-row="ind" title="Kommt davor (einrücken)" aria-label="Kommt vor dem Eintrag darüber">↳</button>`
  + `<button type="button" class="mini" data-row="up" aria-label="Nach oben">↑</button>`
  + `<button type="button" class="mini" data-row="rm" aria-label="Entfernen">×</button></div>`;
}
// Der Teil im Popup mit Frage, Vorher-Liste und Hinweis. Bei einem Ziel: „Was gehört dazu?“
// (ein Ziel ist erreicht, wenn alle To-Dos erledigt sind). Bei einem To-Do: „Muss etwas anderes vorher passieren?“
function preListHtml() {
 return `<label class="lbl only-goal">Was gehört dazu? Welche To-Dos braucht es, damit das Ziel erreicht ist?</label>`
  + `<label class="lbl only-sub">Muss etwas anderes vorher passieren?</label><div class="prelist"></div>`
  + `<button type="button" class="link preadd" data-row="add"><span class="only-goal">+ To-Do</span><span class="only-sub">+ Vorher-To-Do</span></button>`
  + `<p class="prehint"><span class="only-goal">Das Ziel ist erreicht, wenn alles davon erledigt ist. </span>`
  + `Darf leer bleiben. Ziehen am Griff oder ↳: ein Eintrag muss vor dem darüber passieren.</p>`;
}
// Sorgt dafür, dass jede Zeile höchstens eine Ebene tiefer ist als die darüber
function fixLevels(list) {
 let previous = -1;
 list.querySelectorAll('.prerow').forEach(row => {
  const level = Math.min(+row.dataset.l, previous + 1);
  row.dataset.l = level;
  row.style.setProperty('--l', level);
  row.querySelector('input').placeholder = prePlaceholder(level);
  previous = level;
 });
}
// Neue Zeile einfügen (nach der Zeile `after`, sonst am Ende)
function addPreRow(list, after, level) {
 const temp = document.createElement('div');
 temp.innerHTML = preRowHtml(level);
 const row = temp.firstElementChild;
 if (after) after.after(row);
 else list.append(row);
 fixLevels(list);
 row.querySelector('input').focus();
}
// Knöpfe an den Zeilen: add = neue Zeile, rm = entfernen, up = nach oben, ind = einrücken
function preRowAction(button) {
 const list = $('#modal .prelist');
 const row = button.closest('.prerow');
 const action = button.dataset.row;
 if (action === 'add') { addPreRow(list, null, 0); return; }
 if (action === 'rm') {
  const neighbour = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  fixLevels(list);
  (neighbour?.querySelector('input') || $('#modal .preadd'))?.focus();
  return;
 }
 if (action === 'up') {
  const previous = row.previousElementSibling;
  if (previous) { previous.before(row); fixLevels(list); }
  row.querySelector('input').focus();
  return;
 }
 if (action === 'ind') {
  const previous = row.previousElementSibling;
  const maxLevel = previous ? +previous.dataset.l + 1 : 0;
  const level = +row.dataset.l;
  row.dataset.l = level < maxLevel ? level + 1 : 0;
  fixLevels(list);
  row.querySelector('input').focus();
 }
}
// Legt die im Popup eingetippten Vorher-To-Dos an. Eingerückte Zeilen kommen vor die Zeile darüber.
function createPreTasks(root, entries, today) {
 const stack = [root];
 entries.forEach(({ t: title, l: level }) => {
  const depth = Math.min(level, stack.length - 1);
  const task = createTask(title, { today, backlog: !!root.backlog });
  linkBefore(stack[depth], task, 'hard');
  stack.length = depth + 1;
  stack.push(task);
 });
}

/* ---------- Version C: Popup „Neues To-Do“ wie eine Karte ----------
   Oben Bereich, Kategorie und „Erst mal ins Backlog“. Darunter eine Karte: Titel und Unter-To-Dos.
   Enter = nächstes Unter-To-Do (Enter in einer leeren Zeile legt alles an), Tab = kommt davor (eine Ebene
   tiefer), Umschalt+Tab = eine Ebene zurück, Rücktaste in leerer Zeile = Zeile weg.
   „+“ zwischen den Zeilen wie auf der Karte. Die Zeilen sind .prerow, readModalValues liest sie als _pre. */
function newRowHtml(level) {
 return `<div class="prerow nrow" data-l="${level}" style="--l:${level}"><span class="ncheck" aria-hidden="true"></span>`
  + `<input class="field pre" placeholder="Unter-To-Do" autocomplete="off" aria-label="Unter-To-Do">`
  + `<button type="button" class="mini del" data-nrow="rm" aria-label="Zeile entfernen">${ICON_TRASH}</button></div>`;
}
// Ebenen in Ordnung bringen und die „+“-Streifen neu setzen
function refreshNewRows(list) {
 list.querySelectorAll('.nins').forEach(x => x.remove());
 const rows = [...list.querySelectorAll('.nrow')];
 let previous = -1;
 rows.forEach(row => {
  const level = Math.max(0, Math.min(+row.dataset.l, previous + 1));
  row.dataset.l = level;
  row.style.setProperty('--l', level);
  previous = level;
 });
 const strip = level => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ins nins';
  b.dataset.nlevel = level;
  b.style.setProperty('--l', level);
  b.setAttribute('aria-label', 'Hier ein Unter-To-Do einfügen');
  b.innerHTML = insertLabelHtml('Unter-To-Do');
  return b;
 };
 list.prepend(strip(0));
 rows.forEach((row, i) => {
  const level = +row.dataset.l;
  row.after(strip(level + 1));             // direkt darunter: kommt davor (eine Ebene tiefer)
  let j = i;
  while (j + 1 < rows.length && +rows[j + 1].dataset.l > level) j++;
  let anchor = rows[j];
  while (anchor.nextElementSibling && anchor.nextElementSibling.classList.contains('nins')) anchor = anchor.nextElementSibling;
  anchor.after(strip(level));               // nach allem, was dazugehört: gleiche Ebene
 });
}
function addNewRow(list, where, level) {
 const temp = document.createElement('div');
 temp.innerHTML = newRowHtml(level);
 const row = temp.firstElementChild;
 if (where && where.classList.contains('nins')) where.replaceWith(row);
 else if (where) where.after(row);
 else list.append(row);
 refreshNewRows(list);
 row.querySelector('input').focus();
 return row;
}
/* ---------- Version C 1.0.35, Handy: Popup „Neues To-Do“ für mehrere To-Dos ----------
   Enter legt kein Unter-To-Do an, sondern ein weiteres To-Do (eigene Karte). Unter der Zeile, in der man
   gerade tippt, steht eine Leiste „+ davor / + danach“:
   davor  = neue Zeile eine Ebene tiefer direkt darunter (muss vorher passieren),
   danach = neue Zeile an die Stelle dieser Zeile, die Zeile selbst rutscht eine Ebene tiefer
            (das neue To-Do braucht dann dieses). Bei der obersten Zeile wird das neue zum Titel der Karte.
   Enter in einer leeren Zeile = fertig (Anlegen). Rücktaste in einer leeren Zeile = Zeile weg.
   Gilt am Handy (bis 600 px). Am Desktop bleibt das Popup wie bisher (newTaskDialog). */
const isNarrow = () => matchMedia('(max-width:600px)').matches;
const M_PLACEHOLDER = { top: 'Was ist zu tun?', before: 'Was muss vorher passieren?', after: 'Was kommt danach?' };
function mRowHtml(level, kind = level ? 'before' : 'top') {
 return `<div class="mrow" data-l="${level}" style="--l:${level}"><span class="ncheck" aria-hidden="true"></span>`
  + `<input class="field mrin" placeholder="${M_PLACEHOLDER[kind]}" autocomplete="off" enterkeyhint="next" aria-label="${level ? 'Unter-To-Do' : 'To-Do'}">`
  + `<button type="button" class="mini del" data-mrow="rm" aria-label="Zeile entfernen">${ICON_TRASH}</button></div>`;
}
const mCardHtml = () => `<div class="ncard mcard">${mRowHtml(0)}</div>`;
// Rows einer Karte: die oberste (Ebene 0) ist der Titel, darunter die Unter-To-Dos mit Ebenen
const mRows = card => [...card.querySelectorAll('.mrow')];
function mSetLevel(row, level) {
 row.dataset.l = level;
 row.style.setProperty('--l', level);
 row.querySelector('input').setAttribute('aria-label', level ? 'Unter-To-Do' : 'To-Do');
}
// Die Zeile und alles, was zu ihr gehört (die tieferen Zeilen direkt darunter)
function mSubtree(row) {
 const rows = mRows(row.closest('.mcard'));
 const i = rows.indexOf(row);
 const level = +row.dataset.l;
 let j = i;
 while (j + 1 < rows.length && +rows[j + 1].dataset.l > level) j++;
 return rows.slice(i, j + 1);
}
// Leiste „+ davor / + danach“ unter die Zeile setzen, in der man gerade ist
function mShowBar(row) {
 const box = row.closest('.mcards');
 box.querySelectorAll('.mbar').forEach(x => x.remove());
 box.querySelectorAll('.mrow.cur').forEach(x => x.classList.remove('cur'));
 row.classList.add('cur');
 const bar = document.createElement('div');
 bar.className = 'mbar nbar';
 bar.style.marginLeft = `calc(30px + ${+row.dataset.l} * 22px)`;
 bar.innerHTML = '<button type="button" data-madd="before"><span aria-hidden="true">+</span>davor</button>'
  + '<button type="button" data-madd="after"><span aria-hidden="true">+</span>danach</button>';
 row.after(bar);
}
function mFocus(row) {
 const input = row.querySelector('input');
 input.focus();
 mShowBar(row);
}
function mAdd(row, where) {
 const temp = document.createElement('div');
 const level = +row.dataset.l;
 if (where === 'before') {
  temp.innerHTML = mRowHtml(level + 1, 'before');
  row.after(temp.firstElementChild);
  mFocus(row.nextElementSibling.classList.contains('mbar') ? row.nextElementSibling.nextElementSibling : row.nextElementSibling);
  return;
 }
 // danach: neue Zeile an diese Stelle, die Zeile mit allem darunter eine Ebene tiefer
 const subtree = mSubtree(row);
 temp.innerHTML = mRowHtml(level, level ? 'after' : 'top');
 const fresh = temp.firstElementChild;
 if (!level) fresh.querySelector('input').placeholder = M_PLACEHOLDER.after;
 row.before(fresh);
 subtree.forEach(r => mSetLevel(r, +r.dataset.l + 1));
 mFocus(fresh);
}
// Neue Karte (weiteres To-Do) nach der Karte von row
function mAddCard(afterCard) {
 const temp = document.createElement('div');
 temp.innerHTML = mCardHtml();
 const card = temp.firstElementChild;
 afterCard.after(card);
 mFocus(card.querySelector('.mrow'));
 card.scrollIntoView({ block: 'nearest' });
}
function mRemove(row) {
 const card = row.closest('.mcard');
 const rows = mRows(card);
 const i = rows.indexOf(row);
 const cards = [...card.parentElement.querySelectorAll('.mcard')];
 let target;
 if (rows.length === 1) {
  if (cards.length === 1) { row.querySelector('input').value = ''; mFocus(row); return; }
  const k = cards.indexOf(card);
  const neighbour = cards[k - 1] || cards[k + 1];
  card.remove();
  target = mRows(neighbour).at(-1);
 } else {
  // Was darunter hing, rückt eine Ebene hoch (nichts geht verloren)
  mSubtree(row).slice(1).forEach(r => mSetLevel(r, Math.max(0, +r.dataset.l - 1)));
  row.remove();
  const rest = mRows(card);
  if (+rest[0].dataset.l !== 0) mSetLevel(rest[0], 0);
  target = rest[Math.max(0, i - 1)];
 }
 card.parentElement?.querySelectorAll('.mbar').forEach(x => x.remove());
 mFocus(target);
}
// Liest alle Karten: [{ t, pre: [{ t, l }] }]. Leere Zeilen fallen weg, die Ebenen bleiben stimmig.
function mReadCards(box) {
 return [...box.querySelectorAll('.mcard')].map(card => {
  let entries = mRows(card).map(row => ({ t: row.querySelector('input').value.trim(), l: +row.dataset.l })).filter(e => e.t);
  if (!entries.length) return null;
  const top = entries[0];
  const base = top.l;
  entries = entries.slice(1).map(e => ({ t: e.t, l: Math.max(0, e.l - base - 1) }));
  return { t: top.t, pre: entries };
 }).filter(Boolean);
}
async function newTasksDialogMobile(text = '', place = currentPlace()) {
 const bereich = getBereich(place.split('|')[0]);
 let result = [];
 const pending = modal(`<h2>Neues To-Do</h2>
  ${placePickerHtml(place)}
  <label class="opt"><input type="checkbox" name="bl"> Erst mal ins Backlog</label>
  <div class="mcards" style="--c:${bereich ? bereich.color : GRAY}">${mCardHtml()}</div>
  <p class="prehint">Enter: nächstes To-Do · „+ davor“ / „+ danach“ unter der Zeile: was vorher oder danach passiert · Enter in leerer Zeile: fertig</p>
  <div class="btns">${buttonHtml('', 'Abbrechen', 'ghost')}${buttonHtml('ok', 'Anlegen', 'pri')}</div>`);
 const modalEl = $('#modal');
 const box = modalEl.querySelector('.mcards');
 const first = box.querySelector('.mrow');
 first.querySelector('input').value = text;
 mFocus(first);
 const listening = new AbortController();
 const once = { signal: listening.signal };
 modalEl.querySelector('[data-pick=cat]').addEventListener('change', event => {
  const chosen = getBereich(event.target.value);
  box.style.setProperty('--c', chosen ? chosen.color : GRAY);
 });
 // Vor dem Schließen die Karten lesen (danach ist das Popup leer)
 modalEl.addEventListener('click', event => {
  if (event.target.closest('.btn.pri')) result = mReadCards(box);
  const add = event.target.closest('[data-madd]');
  if (add) { event.stopPropagation(); mAdd(box.querySelector('.mrow.cur') || mRows(box).at(-1), add.dataset.madd); return; }
  const remove = event.target.closest('[data-mrow="rm"]');
  if (remove) { event.stopPropagation(); mRemove(remove.closest('.mrow')); }
 }, { capture: true, signal: listening.signal });
 // Tippen auf „+ davor/danach“ soll die Tastatur nicht erst zu- und dann wieder aufklappen
 modalEl.addEventListener('pointerdown', event => { if (event.target.closest('[data-madd]')) event.preventDefault(); }, once);
 modalEl.addEventListener('focusin', event => {
  const row = event.target.closest && event.target.closest('.mrow');
  if (row && !row.classList.contains('cur')) mShowBar(row);
 }, once);
 modalEl.addEventListener('keydown', event => {
  const input = event.target;
  const row = input.closest && input.closest('.mrow');
  if (!row) return;
  if (event.key === 'Enter') {
   event.preventDefault();
   event.stopPropagation();
   if (!input.value.trim()) { modalEl.querySelector('.btn.pri').click(); return; }
   mAddCard(row.closest('.mcard'));
  } else if (event.key === 'Backspace' && !input.value) {
   event.preventDefault();
   mRemove(row);
  }
 }, once);
 const r = await pending;
 listening.abort();
 if (r.v !== 'ok' || !result.length) return false;
 undoSnapshot = snapshot();
 const today = state.view === 'heute';
 const [cat, area] = r.vals.place.split('|');
 const now = Date.now();
 let subs = 0;
 result.forEach((entry, i) => {
  // created + i: die To-Dos stehen in der Spalte in der Reihenfolge, in der sie getippt wurden
  const created = createTask(entry.t, { goal: true, cat: cat || null, area: area || null, today, backlog: !!r.vals.bl && !today, created: now + i });
  if (isList(created)) entry.pre.forEach(e => addListItem(created, e.t));
  else createPreTasks(created, entry.pre, today);
  subs += entry.pre.length;
 });
 save();
 render();
 const n = result.length;
 toast((n === 1 ? 'Angelegt' : `${n} To-Dos angelegt`) + (subs ? ` – mit ${subs} weiteren davor/danach.` : '.'), true);
 return true;
}
async function newTaskDialog(text = '', place = currentPlace()) {
 if (isNarrow()) return newTasksDialogMobile(text, place);
 const bereich = getBereich(place.split('|')[0]);
 const pending = modal(`<h2>Neues To-Do</h2>
  ${placePickerHtml(place)}
  <label class="opt"><input type="checkbox" name="bl"> Erst mal ins Backlog</label>
  <div class="ncard" style="--c:${bereich ? bereich.color : GRAY}">
   <div class="nhead"><span class="ncheck" aria-hidden="true"></span><input class="field ntitle" name="text" value="${esc(text)}" placeholder="Was ist zu tun?" autocomplete="off" aria-label="Titel"></div>
   <div class="nlist"></div>
  </div>
  <p class="prehint">Enter: nächstes Unter-To-Do · Tab: kommt davor (eine Ebene tiefer) · Umschalt+Tab: zurück · Enter in leerer Zeile: fertig</p>
  <div class="btns">${buttonHtml('', 'Abbrechen', 'ghost')}${buttonHtml('ok', 'Anlegen', 'pri')}</div>`);
 const modalEl = $('#modal');
 const list = modalEl.querySelector('.nlist');
 refreshNewRows(list);
 // Die Zuhörer gelten nur für dieses Popup (sonst sammeln sie sich bei jedem Öffnen an)
 const listening = new AbortController();
 const once = { signal: listening.signal };
 // Farbe der Karte folgt dem gewählten Bereich
 modalEl.querySelector('[data-pick=cat]').addEventListener('change', event => {
  const chosen = getBereich(event.target.value);
  modalEl.querySelector('.ncard').style.setProperty('--c', chosen ? chosen.color : GRAY);
 });
 modalEl.addEventListener('click', event => {
  const strip = event.target.closest('.nins');
  if (strip) { event.stopPropagation(); addNewRow(list, strip, +strip.dataset.nlevel); return; }
  const remove = event.target.closest('[data-nrow="rm"]');
  if (remove) {
   event.stopPropagation();
   const row = remove.closest('.nrow');
   row.remove();
   refreshNewRows(list);
  }
 }, { capture: true, signal: listening.signal });
 modalEl.addEventListener('keydown', event => {
  const input = event.target;
  if (input.name === 'text' && event.key === 'Enter') {
   event.preventDefault();
   event.stopPropagation();
   const first = list.querySelector('.nrow input');
   if (first) first.focus();
   else addNewRow(list, list.querySelector('.nins'), 0);
   return;
  }
  const row = input.closest && input.closest('.nrow');
  if (!row) return;
  const level = +row.dataset.l;
  if (event.key === 'Enter') {
   event.preventDefault();
   event.stopPropagation();
   if (!input.value.trim()) { modalEl.querySelector('.btn.pri').click(); return; }
   // Neue Zeile auf gleicher Ebene, hinter allem, was zu dieser Zeile gehört
   const rows = [...list.querySelectorAll('.nrow')];
   let j = rows.indexOf(row);
   while (j + 1 < rows.length && +rows[j + 1].dataset.l > level) j++;
   addNewRow(list, rows[j], level);
  } else if (event.key === 'Tab') {
   event.preventDefault();
   event.stopPropagation();
   row.dataset.l = event.shiftKey ? Math.max(0, level - 1) : level + 1;
   refreshNewRows(list);
   input.focus();
  } else if (event.key === 'Backspace' && !input.value) {
   event.preventDefault();
   const rows = [...list.querySelectorAll('.nrow')];
   const previous = rows[rows.indexOf(row) - 1];
   row.remove();
   refreshNewRows(list);
   (previous ? previous.querySelector('input') : modalEl.querySelector('.ntitle')).focus();
  }
 }, once);
 const r = await pending;
 listening.abort();
 if (r.v !== 'ok' || !r.vals.text) return false;
 undoSnapshot = snapshot();
 // Im Tab „Heute“ angelegte To-Dos kommen gleich nach „Heute“
 const today = state.view === 'heute';
 const [cat, area] = r.vals.place.split('|');
 const created = createTask(r.vals.text, { goal: true, cat: cat || null, area: area || null, today, backlog: !!r.vals.bl && !today });
 const count = r.vals._pre.length;
 // Titel „Liste: …“: die Zeilen werden Punkte der Liste statt Unter-To-Dos
 if (isList(created)) r.vals._pre.forEach(entry => addListItem(created, entry.t));
 else createPreTasks(created, r.vals._pre, today);
 save();
 render();
 toast(!count ? 'Angelegt.' : isList(created) ? `Liste angelegt – mit ${count} Punkt${count === 1 ? '' : 'en'}.` : `Angelegt – mit ${count} Unter-To-Do${pluralS(count)}.`, true);
 return true;
}

/* ---------- Ziehen mit Maus oder Finger ---------- */
// Findet das erste Element in `items`, über dessen Mitte der Zeiger (Höhe y) steht
function itemBelow(items, dragged, y) {
 for (const item of items) {
  if (item === dragged) continue;
  const box = item.getBoundingClientRect();
  if (y < box.top + box.height / 2) return item;
 }
 return null;
}

// 1) Vorher-Liste im Popup: senkrecht = Reihenfolge, waagerecht = Ebene (kommt davor)
document.addEventListener('pointerdown', event => {
 const grip = event.target.closest('#modal .grip');
 if (!grip) return;
 event.preventDefault();
 const row = grip.closest('.prerow');
 const list = row.parentElement;
 const startX = event.clientX;
 const startLevel = +row.dataset.l;
 row.classList.add('dragging');
 trackPointer(moveEvent => {
  const target = itemBelow(list.querySelectorAll('.prerow'), row, moveEvent.clientY);
  if (target) target.before(row);
  else list.append(row);
  // 26 px nach rechts = eine Ebene tiefer
  row.dataset.l = Math.max(0, startLevel + Math.round((moveEvent.clientX - startX) / 26));
  fixLevels(list);
 }, () => {
  row.classList.remove('dragging');
  fixLevels(list);
 });
});

// 2) Tab „Heute“: Karten per Griff ziehen oder mit Pfeiltasten verschieben
// Merkt sich die Reihenfolge der Karten in „Heute“
function saveDayOrder() {
 const list = $('#daylist');
 if (!list) return;
 [...list.querySelectorAll('.card')].forEach((cardEl, i) => { getTask(cardEl.dataset.id).todayOrder = i + 1; });
 save();
}
function dragDayCard(event, grip) {
 const cardEl = grip.closest('.card');
 const list = cardEl.parentElement;
 cardEl.classList.add('dragging');
 const startY = event.clientY;
 let moved = false;
 trackPointer(moveEvent => {
  if (!moved && Math.abs(moveEvent.clientY - startY) < 4) return;
  moved = true;
  const target = itemBelow(list.querySelectorAll('.card'), cardEl, moveEvent.clientY);
  if (target) {
   if (target.previousElementSibling !== cardEl) target.before(cardEl);
  } else if (list.lastElementChild !== cardEl) {
   list.append(cardEl);
  }
 }, () => {
  cardEl.classList.remove('dragging');
  // Nur neu aufbauen, wenn wirklich gezogen wurde. Sonst ginge der Klick (z. B. Text bearbeiten) verloren.
  if (!moved) return;
  saveDayOrder();
  render();
 });
}
document.addEventListener('keydown', event => {
 const grip = event.target.closest && event.target.closest('#daylist .cgrip');
 if (!grip || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
 event.preventDefault();
 const cardEl = grip.closest('.card');
 if (event.key === 'ArrowUp' && cardEl.previousElementSibling) cardEl.previousElementSibling.before(cardEl);
 if (event.key === 'ArrowDown' && cardEl.nextElementSibling) cardEl.nextElementSibling.after(cardEl);
 saveDayOrder();
 render();
 document.querySelector(`.cgrip[data-id="${cardEl.dataset.id}"]`)?.focus();
});

// 3) Karte oder Backlog-Zeile am Griff ziehen (Übersicht, Schalter „Machbar“ an oder aus).
//    Ablageziele (data-drop im HTML): Zeitnah, Backlog, Knöpfe der Kategorie-Navigation, Bereich-Leisten.
//    In Zeitnah und Backlog zeigt eine farbige Linie, an welcher Stelle die Karte landet (Reihenfolge).
// Karten bzw. Backlog-Zeilen, die direkt in dieser Ablagefläche liegen (ohne die gezogene)
const dropItems = (zone, source) => [...zone.querySelectorAll('.card,.brow')]
 .filter(el => el !== source && el.closest('[data-drop]') === zone);
function dragCard(event, grip) {
 const id = grip.dataset.id;
 const source = grip.closest('.card,.brow');
 const box = source.getBoundingClientRect();
 // „Geist“: eine Kopie, die dem Zeiger folgt
 const ghost = source.cloneNode(true);
 ghost.classList.add('dragghost');
 // Ziel-Karte aus der Übersicht: nur die Karte selbst mitnehmen, ohne die aufgeklappten Vorher-To-Dos
 ghost.querySelectorAll(':scope > ul, :scope > .ttog').forEach(el => el.remove());
 Object.assign(ghost.style, { width: box.width + 'px', left: box.left + 'px', top: box.top + 'px', margin: 0 });
 const offsetX = event.clientX - box.left;
 const offsetY = event.clientY - box.top;
 const startX = event.clientX;
 const startY = event.clientY;
 let moved = false;
 let over = null;          // Ablageziel unter dem Zeiger
 let beforeEl = null;      // Karte, vor der die gezogene landet (null = ans Ende)
 let lastEdgeScroll = 0;   // wann zuletzt am Rand zur nächsten Spalte gewischt wurde
 const line = document.createElement('div');
 line.className = 'treeline';
 line.style.setProperty('--c', getComputedStyle(source).getPropertyValue('--c'));

 const onMove = moveEvent => {
  // Erst ab 6 px Bewegung zählt es als Ziehen (sonst ist es ein Klick)
  if (!moved) {
   if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;
   moved = true;
   document.body.append(ghost);
   source.classList.add('src-drag');
   document.body.classList.add('dnd');
  }
  ghost.style.left = moveEvent.clientX - offsetX + 'px';
  ghost.style.top = moveEvent.clientY - offsetY + 'px';
  const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('[data-drop]') || null;
  if (target !== over) {
   over?.classList.remove('over');
   over = target;
   over?.classList.add('over');
  }
  // Stelle in der Liste: Linie vor der Karte unter dem Zeiger bzw. hinter der letzten
  const items = over && over.dataset.bl !== undefined ? dropItems(over, source) : [];
  beforeEl = items.length ? itemBelow(items, source, moveEvent.clientY) : null;
  if (items.length) {
   const zoneBox = over.getBoundingClientRect();
   const y = beforeEl ? beforeEl.getBoundingClientRect().top - 5 : items[items.length - 1].getBoundingClientRect().bottom + 5;
   Object.assign(line.style, { left: zoneBox.left + 8 + 'px', width: zoneBox.width - 16 + 'px', top: y - 1 + 'px' });
   if (!line.isConnected) document.body.append(line);
  } else {
   line.remove();
  }
  // Am linken/rechten Rand: zur Nachbarspalte wischen (höchstens alle 0,7 Sekunden)
  const cols = $('#cols');
  const now = Date.now();
  if (cols && cols.scrollWidth > cols.clientWidth + 4 && now - lastEdgeScroll > 700) {
   if (moveEvent.clientX < 30 && currentColumn > 0) {
    lastEdgeScroll = now;
    goToColumn(currentColumn - 1);
   } else if (moveEvent.clientX > innerWidth - 30 && currentColumn < cols.children.length - 1) {
    lastEdgeScroll = now;
    goToColumn(currentColumn + 1);
   }
  }
  // Am oberen/unteren Rand: Seite scrollen
  if (moveEvent.clientY < 50) scrollBy(0, -14);
  else if (moveEvent.clientY > innerHeight - 50) scrollBy(0, 14);
 };
 const onUp = upEvent => {
  ghost.remove();
  line.remove();
  source.classList.remove('src-drag');
  document.body.classList.remove('dnd');
  over?.classList.remove('over');
  if (!moved) return;
  ignoreClicksUntil = Date.now() + 350;
  if (upEvent.type === 'pointercancel' || !over) return;
  const drop = over.dataset;
  if (drop.drop === 'cat') {
   // Auf eine Bereich-Leiste: in die erste Kategorie dieses Bereichs
   const bereich = getBereich(drop.cat);
   moveTo(id, { cat: drop.cat, area: bereich && bereich.subs.length ? bereich.subs[0].id : '' });
  } else if (drop.bl !== undefined) {
   // In Zeitnah oder Backlog einer Spalte: an die markierte Stelle
   const order = dropItems(over, source).map(el => el.dataset.id);
   const at = beforeEl ? order.indexOf(beforeEl.dataset.id) : order.length;
   order.splice(at, 0, id);
   dropCard(id, { cat: drop.cat, area: drop.area, bl: drop.bl === '1' }, order);
  } else {
   moveTo(id, { cat: drop.cat, area: drop.area });
  }
 };
 trackPointer(onMove, onUp);
}

// 4) Kategorie-Spalten am Griff im Spaltenkopf ziehen. Eine farbige Kante zeigt, wo die Spalte landet.
//    Erreicht der Zeiger den Rand der Spalten, wird automatisch seitlich gescrollt.
function dragColumn(event, grip) {
 const cols = $('#cols');
 const source = grip.closest('.col');
 const columns = [...cols.children].filter(c => !c.classList.contains('coladd'));
 const from = columns.indexOf(source);
 const kategorieId = grip.dataset.s;
 const bereichId = grip.dataset.cat;
 // „Geist“: ein Schild mit dem Namen der Spalte, das dem Zeiger folgt
 const ghost = document.createElement('div');
 ghost.className = 'colghost dragghost';
 ghost.textContent = source.querySelector('h2').textContent;
 ghost.style.setProperty('--c', getComputedStyle(source).getPropertyValue('--c'));
 const startX = event.clientX;
 const startY = event.clientY;
 let moved = false;
 let to = from;              // Zielstelle
 let pointerX = startX;
 let pointerY = startY;
 let frame = 0;              // für requestAnimationFrame
 // Zielstelle aus der Zeigerposition bestimmen und die Kante anzeigen
 const markTarget = () => {
  columns.forEach(c => c.classList.remove('dropl', 'dropr'));
  let before = columns.findIndex(c => {
   const box = c.getBoundingClientRect();
   return pointerX < box.left + box.width / 2;
  });
  if (before < 0) before = columns.length;   // hinter die letzte Spalte
  to = before > from ? before - 1 : before;
  if (to === from) return;
  if (before < columns.length) columns[before].classList.add('dropl');
  else columns[columns.length - 1].classList.add('dropr');
 };
 // Seitliches Mitscrollen am Rand, je näher am Rand, desto schneller
 const scrollAtEdge = () => {
  const box = cols.getBoundingClientRect();
  const zone = Math.min(60, box.width / 6);
  let speed = 0;
  if (pointerX < box.left + zone) speed = (pointerX - box.left - zone) / zone;
  else if (pointerX > box.right - zone) speed = (pointerX - box.right + zone) / zone;
  if (speed) {
   cols.scrollLeft += Math.max(-1, Math.min(1, speed)) * 12;
   markTarget();
  }
  frame = requestAnimationFrame(scrollAtEdge);
 };
 trackPointer(moveEvent => {
  pointerX = moveEvent.clientX;
  pointerY = moveEvent.clientY;
  if (!moved) {
   if (Math.hypot(pointerX - startX, pointerY - startY) < 6) return;
   moved = true;
   document.body.append(ghost);
   source.classList.add('lift');
   document.body.classList.add('coldrag');
   frame = requestAnimationFrame(scrollAtEdge);
  }
  ghost.style.left = Math.max(4, Math.min(pointerX - 24, innerWidth - ghost.offsetWidth - 4)) + 'px';
  ghost.style.top = pointerY - 20 + 'px';
  markTarget();
 }, upEvent => {
  cancelAnimationFrame(frame);
  ghost.remove();
  source.classList.remove('lift');
  document.body.classList.remove('coldrag');
  columns.forEach(c => c.classList.remove('dropl', 'dropr'));
  if (!moved) return;
  ignoreClicksUntil = Date.now() + 350;
  if (upEvent.type === 'pointercancel') return;
  moveKategorie(bereichId, kategorieId, to);
 });
}
// Tastatur: Griff im Spaltenkopf fokussieren, Pfeil links/rechts verschiebt die Spalte
document.addEventListener('keydown', event => {
 const grip = event.target.closest && event.target.closest('.colgrip');
 if (!grip || !$('#modal').hidden || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
 event.preventDefault();
 const { cat: bereichId, s: kategorieId } = grip.dataset;
 const bereich = getBereich(bereichId);
 if (!bereich) return;
 const index = columnsOf(bereich).findIndex(k => k.id === kategorieId);
 moveKategorie(bereichId, kategorieId, index + (event.key === 'ArrowRight' ? 1 : -1));
 document.querySelector(`.colgrip[data-cat="${bereichId}"][data-s="${kategorieId}"]`)?.focus({ preventScroll: true });
});

// 5) Tab „Übersicht“: Unter-To-Dos innerhalb einer Karte am Griff umsortieren – wie die Vorher-Liste
//    im Popup: hoch/runter = Reihenfolge, nach rechts = kommt vor das To-Do darüber (eine Ebene tiefer),
//    nach links = eine Ebene höher. Eine farbige Linie zeigt, wo und auf welcher Ebene es landet.
const TREE_INDENT = 18;   // so weit rückt die Linie beim Ziehen je Ebene ein (die Zeilen selbst sind nicht eingerückt)
// Das To-Do darüber in der Karte (li-Element) bzw. dessen ID
const treeParentLi = li => li.parentElement.closest('li');
// Wo das gezogene To-Do landen würde. rows = sichtbare Zeilen der Karte ohne das gezogene (mit Unterbaum),
// y = Zeiger, wantedLevel = gewünschte Ebene. Gibt { level, parentLi, afterLi, lineY } zurück.
function treeDropTarget(rows, y, wantedLevel) {
 let index = rows.findIndex((r, i) => i > 0 && y < r.box.top + r.box.height / 2);
 if (index < 0) index = rows.length;
 const above = rows[index - 1];
 const below = rows[index];
 const level = Math.max(1, below ? below.level : 1, Math.min(wantedLevel, above.level + 1));
 let parentLi = null;
 let afterLi = null;
 for (let i = index - 1; i >= 0; i--) {
  if (rows[i].level === level && !afterLi) afterLi = rows[i].li;
  if (rows[i].level === level - 1) { parentLi = rows[i].li; break; }
 }
 const lineY = below ? below.box.top : above.li.getBoundingClientRect().bottom;
 return { level, parentLi, afterLi, lineY };
}
// Hängt das To-Do `id` von oldParentId nach newParentId um, direkt hinter afterId
// (null = ganz nach vorn, undefined = ans Ende). Die Art (geht sonst nicht / hilft nur) bleibt.
// Gibt false zurück, wenn es nicht geht (es würde vor sich selbst kommen).
function moveInTree(id, oldParentId, newParentId, afterId) {
 const oldParent = getTask(oldParentId);
 const newParent = getTask(newParentId);
 if (!oldParent || !newParent) return false;
 if (newParentId === id || taskAndAllBefore(id).has(newParentId)) return false;
 const kind = oldParent.soft.includes(id) ? 'soft' : 'needs';
 oldParent[kind] = oldParent[kind].filter(x => x !== id);
 // Hing es schon auf anderem Weg am neuen To-Do, bleibt diese Verbindung, nur die Stelle ändert sich
 const otherKind = kind === 'soft' ? 'needs' : 'soft';
 const target = newParent[otherKind].includes(id) ? otherKind : kind;
 const list = newParent[target].filter(x => x !== id);
 let at = list.length;
 if (afterId === null) at = 0;
 else if (afterId !== undefined) {
  const i = list.indexOf(afterId);
  if (i >= 0) at = i + 1;
  else if (target === 'soft' && newParent.needs.includes(afterId)) at = 0; // „hilft nur“ steht immer hinter den anderen
 }
 list.splice(at, 0, id);
 newParent[target] = list;
 if (target === 'needs') getTask(id).prio = Math.max(getTask(id).prio, newParent.prio + 1);
 return true;
}
// Unter-To-Do aus seiner Karte lösen: wird ein eigenes To-Do (eigene Karte) an diesem Ort.
// Seine eigenen Vorher-To-Dos kommen mit. order = Reihenfolge der Karten in der Ablagefläche (oder null).
function makeOwnTask(id, oldParentId, { cat, area, bl }, order) {
 const task = getTask(id);
 const parent = getTask(oldParentId);
 if (!task || !parent) return;
 undoSnapshot = snapshot();
 parent.needs = parent.needs.filter(x => x !== id);
 parent.soft = parent.soft.filter(x => x !== id);
 task.goal = true;
 task.cat = cat || null;
 task.area = area || null;
 if (bl !== undefined) {
  // Backlog/Zeitnah gilt für die ganze Kette darunter
  [...taskAndAllBefore(id)].forEach(x => { if (!getTask(x).done) getTask(x).backlog = bl; });
 }
 if (order) order.forEach((x, i) => { if (getTask(x)) getTask(x).prio = order.length - i; });
 save();
 render();
 toast(`„${esc(task.t)}“ ist jetzt ein eigenes To-Do.`, true);
}
// Umhängen ausführen, neuen Ast aufklappen, speichern und Hinweis zeigen
function applyTreeMove(id, oldParentId, newParentLi, afterId, quiet) {
 const before = snapshot();
 const newParentId = newParentLi.dataset.tid;
 if (!moveInTree(id, oldParentId, newParentId, afterId)) {
  toast('Geht nicht: Das kommt schon vor diesem To-Do.');
  return null;
 }
 if (snapshot() === before) return null;
 treeOpen.set(newParentLi.dataset.k, true);
 undoSnapshot = before;
 save();
 render();
 if (!quiet) toast(oldParentId === newParentId ? 'Reihenfolge geändert.' : `Kommt jetzt vor „${esc(getTask(newParentId).t)}“.`, true);
 return newParentLi.dataset.k + '/' + id;
}
function dragTreeRow(event, grip) {
 const li = grip.closest('li');
 const card = li.closest('.tree > li');
 const id = li.dataset.tid;
 const oldParentId = treeParentLi(li).dataset.tid;
 const startLevel = +li.dataset.l;
 // Alle sichtbaren Zeilen der Karte, ohne das gezogene To-Do und seinen Unterbaum
 const rows = [card, ...card.querySelectorAll('li')]
  .filter(x => x !== li && !li.contains(x))
  .map(x => ({ li: x, level: +x.dataset.l, row: x.querySelector(':scope > .row, :scope > .cbody') }));
 const line = document.createElement('div');
 line.className = 'treeline';
 line.style.setProperty('--c', card.style.getPropertyValue('--c'));
 const ghost = document.createElement('div');
 ghost.className = 'colghost dragghost';
 ghost.textContent = getTask(id).t;
 ghost.style.setProperty('--c', card.style.getPropertyValue('--c'));
 const startX = event.clientX;
 const startY = event.clientY;
 let moved = false;
 let drop = null;
 let outside = null;     // Ablagefläche außerhalb der Karte unter dem Zeiger
 let beforeEl = null;    // dort: Karte, vor der es landet
 trackPointer(moveEvent => {
  if (!moved) {
   if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;
   moved = true;
   li.classList.add('tdrag');
   document.body.append(line, ghost);
   document.body.classList.add('treedrag');
  }
  ghost.style.left = Math.max(4, Math.min(moveEvent.clientX - 24, innerWidth - ghost.offsetWidth - 4)) + 'px';
  ghost.style.top = moveEvent.clientY - 20 + 'px';
  const wanted = startLevel + Math.round((moveEvent.clientX - startX) / 26);
  rows.forEach(r => { r.box = r.row.getBoundingClientRect(); });  // jedes Mal neu, falls die Seite gescrollt hat
  // Außerhalb der Karte: wird ein eigenes To-Do (Ablage in Zeitnah/Backlog einer Spalte, Kategorie-Knopf, Bereich)
  const under = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
  const target = under && !card.contains(under) ? under.closest('[data-drop]') : null;
  if (target !== outside) {
   outside?.classList.remove('over');
   outside = target;
   outside?.classList.add('over');
   document.body.classList.toggle('dnd', !!outside);
  }
  if (outside) {
   line.style.top = '-99px';
   const items = outside.dataset.bl !== undefined ? dropItems(outside, null) : [];
   beforeEl = items.length ? itemBelow(items, null, moveEvent.clientY) : null;
   return;
  }
  drop = treeDropTarget(rows, moveEvent.clientY, wanted);
  const cardBox = card.getBoundingClientRect();
  const left = cardBox.left + 10 + drop.level * TREE_INDENT;
  Object.assign(line.style, { left: left + 'px', width: Math.max(40, cardBox.right - 10 - left) + 'px', top: drop.lineY - 1 + 'px' });
  if (moveEvent.clientY < 50) scrollBy(0, -14);
  else if (moveEvent.clientY > innerHeight - 50) scrollBy(0, 14);
 }, upEvent => {
  line.remove();
  ghost.remove();
  li.classList.remove('tdrag');
  document.body.classList.remove('treedrag', 'dnd');
  outside?.classList.remove('over');
  if (!moved) return;
  ignoreClicksUntil = Date.now() + 350;
  if (upEvent.type === 'pointercancel') return;
  if (outside) {
   const place = outside.dataset;
   let order = null;
   if (place.bl !== undefined) {
    order = dropItems(outside, null).map(el => el.dataset.id);
    order.splice(beforeEl ? order.indexOf(beforeEl.dataset.id) : order.length, 0, id);
   }
   const bereich = getBereich(place.cat);
   const area = place.drop === 'cat' ? (bereich && bereich.subs.length ? bereich.subs[0].id : '') : place.area;
   makeOwnTask(id, oldParentId, { cat: place.cat, area, bl: place.bl === undefined ? undefined : place.bl === '1' }, order);
   return;
  }
  if (!drop || !drop.parentLi) return;
  applyTreeMove(id, oldParentId, drop.parentLi, drop.afterLi ? drop.afterLi.dataset.tid : null);
 });
}
// Tastatur am Griff: hoch/runter = Reihenfolge, rechts = kommt vor das To-Do darüber, links = eine Ebene höher
document.addEventListener('keydown', event => {
 const grip = event.target.closest && event.target.closest('.tree .tgrip');
 if (!grip || !$('#modal').hidden || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
 event.preventDefault();
 const li = grip.closest('li');
 const parentLi = treeParentLi(li);
 const id = li.dataset.tid;
 const previous = li.previousElementSibling;
 const next = li.nextElementSibling;
 let newKey = null;
 if (event.key === 'ArrowUp' && previous) {
  newKey = applyTreeMove(id, parentLi.dataset.tid, parentLi, previous.previousElementSibling ? previous.previousElementSibling.dataset.tid : null, true);
 } else if (event.key === 'ArrowDown' && next) {
  newKey = applyTreeMove(id, parentLi.dataset.tid, parentLi, next.dataset.tid, true);
 } else if (event.key === 'ArrowRight' && previous) {
  newKey = applyTreeMove(id, parentLi.dataset.tid, previous, undefined, true);
 } else if (event.key === 'ArrowLeft' && +li.dataset.l > 1) {
  newKey = applyTreeMove(id, parentLi.dataset.tid, treeParentLi(parentLi), parentLi.dataset.tid, true);
 }
 if (newKey) document.querySelector(`.tree li[data-k="${CSS.escape(newKey)}"] > .row .tgrip`)?.focus();
});

// 6) Version C: Gezogen wird, wo man anfasst – keine Griffe mehr.
//    Maus: drücken und bewegen. Finger: kurz halten (HOLD_MS), dann ziehen; wer gleich wischt, scrollt normal.
//    Knöpfe, Schalter, Häkchen und Eingabefelder starten kein Ziehen. Ein kurzer Klick auf den Text bearbeitet ihn.
const HOLD_MS = 320;
const NO_DRAG = 'button, input, select, textarea, summary, a, label, details.chain, .tinput';
let touchDragging = false;  // während des Ziehens mit dem Finger: Seite nicht scrollen lassen
document.addEventListener('touchmove', event => { if (touchDragging) event.preventDefault(); }, { passive: false });
// Was würde hier gezogen? Gibt [Funktion, Element] zurück oder null.
function dragTargetAt(target) {
 if (!target.closest || target.closest(NO_DRAG) || !target.closest('#acc')) return null;
 const li = target.closest('.tree li');
 if (li && !li.classList.contains('card')) {
  // Unter-To-Do in einer Ziel-Karte (nicht in „Erreichte Ziele“)
  return li.closest('.tcard') ? [dragTreeRow, li.querySelector(':scope > .row')] : null;
 }
 const dayCard = target.closest('#daylist .card');
 if (dayCard) return [dragDayCard, dayCard];
 const card = target.closest('.card, .brow');
 if (card) return [dragCard, card];
 const head = target.closest('.colhead');
 if (head && head.querySelector('.colgrip')) return [dragColumn, head.querySelector('.colgrip')];
 return null;
}
document.addEventListener('pointerdown', event => {
 if (event.button > 0 || !$('#modal').hidden) return;
 // Wird gerade ein Text bearbeitet: erst speichern (baut die Seite neu auf), nicht gleich ziehen
 if (document.activeElement && document.activeElement.classList.contains('tinput') && !document.activeElement.classList.contains('linput') && event.target !== document.activeElement) {
  document.activeElement.blur();
  return;
 }
 const found = dragTargetAt(event.target);
 if (!found) return;
 const [startDrag, element] = found;
 if (event.pointerType === 'mouse') {
  event.preventDefault();   // keine Textauswahl beim Ziehen; der Klick kommt trotzdem an
  startDrag(event, element);
  return;
 }
 // Finger oder Stift: erst nach kurzem Halten
 const lifted = element.closest('.card, .brow, li, .col');
 const startX = event.clientX;
 const startY = event.clientY;
 const stop = () => {
  clearTimeout(timer);
  removeEventListener('pointermove', onMove);
  removeEventListener('pointerup', stop);
  removeEventListener('pointercancel', stop);
 };
 const onMove = moveEvent => {
  if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 8) stop();
 };
 const timer = setTimeout(() => {
  stop();
  touchDragging = true;
  lifted?.classList.add('held');
  try { navigator.vibrate?.(12); } catch (e) {}
  const end = upEvent => {
   touchDragging = false;
   lifted?.classList.remove('held');
   ignoreClicksUntil = Date.now() + 350;  // Loslassen nach dem Halten ist kein Klick
   removeEventListener('pointerup', end);
   removeEventListener('pointercancel', end);
   // 1.0.38: Gehalten und ohne zu ziehen losgelassen = Menü der Karte (Backlog / Verschieben nach …).
   // Ersetzt am Handy die drei Punkte im Kartenkopf.
   const still = upEvent && upEvent.type === 'pointerup' && Math.hypot(upEvent.clientX - startX, upEvent.clientY - startY) < 10;
   const id = lifted && lifted.matches('.card') && lifted.querySelector(':scope > .chead [data-act="move"]') ? lifted.dataset.id : null;
   if (still && id) setTimeout(() => moveMenu(id), 30);
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
  startDrag(event, element);
 }, HOLD_MS);
 addEventListener('pointermove', onMove);
 addEventListener('pointerup', stop);
 addEventListener('pointercancel', stop);
});
// Langes Drücken soll auf dem Handy kein Kontextmenü öffnen
document.addEventListener('contextmenu', event => { if (touchDragging) event.preventDefault(); });

/* ---------- Abläufe (Dialoge) ---------- */
// „+“ zwischen To-Dos: Eingabefeld an dieser Stelle. Enter legt das To-Do an (geht sonst nicht) und öffnet
// gleich das nächste Feld dahinter; Escape oder leer lassen schließt es.
function startInsert(button) {
 if (button.dataset.act === 'insroot') { startInsertRoot(button); return; }
 const parent = getTask(button.dataset.p);
 if (!parent) return;
 const afterId = button.dataset.after || null;
 const intoId = button.dataset.into || null;
 const box = document.createElement('div');
 box.className = 'insrow';
 box.style.setProperty('--c', button.style.getPropertyValue('--c'));
 box.innerHTML = `<input class="tinput" placeholder="${esc(button.querySelector('em') ? button.querySelector('em').textContent : insertQuestion(parent))}" aria-label="Neues To-Do" autocomplete="off">`;
 button.replaceWith(box);
 const input = box.querySelector('input');
 input.focus();
 let finished = false;
 const finish = keep => {
  if (finished) return;
  finished = true;
  const text = input.value.trim();
  if (!keep || !text) { render(); return; }
  undoSnapshot = snapshot();
  const task = createTask(text, { backlog: !!parent.backlog });
  // In „hilft nur“ einfügen, wenn das To-Do davor dort steht; sonst bei „geht sonst nicht“
  const kind = (afterId && parent.soft.includes(afterId)) || (intoId && parent.soft.includes(intoId)) ? 'soft' : 'needs';
  const list = parent[kind];
  if (intoId && list.includes(intoId)) {
   // Kette A → B wird zu A → neu → B
   list.splice(list.indexOf(intoId), 1, task.id);
   task[kind].push(intoId);
  } else {
   list.splice(afterId ? list.indexOf(afterId) + 1 : 0, 0, task.id);
  }
  if (kind === 'needs') {
   task.prio = Math.max(task.prio, parent.prio + 1);
   if (parent.today) task.today = true;
  }
  // Die Karte bleibt offen
  document.querySelectorAll('.tcard').forEach(card => { if (card.contains(box)) treeOpen.set(card.dataset.k, true); });
  save();
  render();
  toast(`„${esc(shownTitle(task))}“ eingefügt.`, true);
  if (isList(task) && focusListInput(task.id)) return;
  // Gleich weiter: nächstes Feld direkt dahinter
  (button.classList.contains('chainafter')
   ? document.querySelector(`.ins.chainafter[data-p="${parent.id}"][data-into="${task.id}"]`)
   : intoId
   ? document.querySelector(`.ins[data-p="${task.id}"][data-into="${intoId}"]`)
   : document.querySelector(`.ins[data-p="${parent.id}"][data-after="${task.id}"]`))?.click();
 };
 input.addEventListener('keydown', event => {
  event.stopPropagation();
  if (event.key === 'Enter') { event.preventDefault(); finish(true); }
  if (event.key === 'Escape') { event.preventDefault(); finish(false); }
 });
 input.addEventListener('blur', () => finish(true));
 input.addEventListener('click', event => event.stopPropagation());
}
// „+“ zwischen den Karten einer Spalte: neues To-Do (eigene Karte) genau an dieser Stelle der Spalte.
function startInsertRoot(button) {
 const { cat, area, bl } = button.dataset;
 const afterId = button.dataset.after || null;
 const zone = button.closest('[data-drop]');
 const order = zone ? dropItems(zone, null).map(el => el.dataset.id) : [];
 const box = document.createElement('div');
 box.className = 'insrow insrowroot';
 box.style.setProperty('--c', button.style.getPropertyValue('--c'));
 box.innerHTML = `<input class="tinput" placeholder="${ROOT_QUESTION}" aria-label="Neues To-Do" autocomplete="off">`;
 button.replaceWith(box);
 const input = box.querySelector('input');
 input.focus();
 let finished = false;
 const finish = keep => {
  if (finished) return;
  finished = true;
  const text = input.value.trim();
  if (!keep || !text) { render(); return; }
  undoSnapshot = snapshot();
  const task = createTask(text, { goal: true, cat: cat || null, area: area || null, backlog: bl === '1', today: state.view === 'heute' && bl !== '1' });
  order.splice(afterId ? order.indexOf(afterId) + 1 : 0, 0, task.id);
  order.forEach((id, i) => { if (getTask(id)) getTask(id).prio = order.length - i; });
  save();
  render();
  toast(`„${esc(shownTitle(task))}“ angelegt.`, true);
  if (isList(task) && focusListInput(task.id)) return;
  document.querySelector(`.ins[data-act="insroot"][data-cat="${cat}"][data-area="${area}"][data-bl="${bl}"][data-after="${task.id}"]`)?.click();
 };
 input.addEventListener('keydown', event => {
  event.stopPropagation();
  if (event.key === 'Enter') { event.preventDefault(); finish(true); }
  if (event.key === 'Escape') { event.preventDefault(); finish(false); }
 });
 input.addEventListener('blur', () => finish(true));
 input.addEventListener('click', event => event.stopPropagation());
}
// Text eines To-Dos direkt an Ort und Stelle bearbeiten. Enter (oder woanders hintippen) speichert, Escape bricht ab.
function startRename(titleEl) {
 const task = getTask(titleEl.dataset.id);
 if (!task || titleEl.querySelector('input')) return;
 const input = document.createElement('input');
 input.className = 'tinput';
 input.value = task.t;
 input.setAttribute('aria-label', 'Text bearbeiten');
 input.setAttribute('autocomplete', 'off');
 titleEl.textContent = '';
 titleEl.append(input);
 // Version C: 🔗 im Bearbeitungsfeld öffnet die Verbindungen (kommt erst nach … / gehört auch zu …)
 const linkButton = document.createElement('button');
 linkButton.type = 'button';
 linkButton.className = 'linkbtn';
 linkButton.textContent = '🔗';
 linkButton.title = 'Verbindungen: kommt erst nach … / gehört auch zu …';
 linkButton.setAttribute('aria-label', 'Verbindungen bearbeiten');
 titleEl.append(linkButton);
 titleEl.classList.add('editing');
 input.focus();
 input.setSelectionRange(input.value.length, input.value.length);
 let finished = false;
 // Fokus im Feld lassen, damit das Antippen von 🔗 nicht erst das Feld schließt
 linkButton.addEventListener('mousedown', event => event.preventDefault());
 linkButton.addEventListener('pointerdown', event => event.stopPropagation());
 linkButton.addEventListener('click', event => {
  event.stopPropagation();
  finished = true;
  const text = input.value.trim();
  const before = snapshot();
  if (text && text !== task.t) { task.t = text; ensureList(task); save(); }
  render();
  connectionsDialog(task.id, before);
 });
 const finish = keep => {
  if (finished) return;
  finished = true;
  const text = input.value.trim();
  if (keep && text && text !== task.t) {
   undoSnapshot = snapshot();
   const becameList = !isList(task) && LIST_PATTERN.test(text);
   task.t = text;
   ensureList(task);
   save();
   render();
   toast(becameList ? 'Jetzt eine Liste. Punkte unten eintippen.' : 'Gespeichert.', true);
   if (becameList) focusListInput(task.id);
  } else {
   render();
  }
 };
 input.addEventListener('keydown', event => {
  event.stopPropagation();
  if (event.key === 'Enter') { event.preventDefault(); finish(true); }
  if (event.key === 'Escape') { event.preventDefault(); finish(false); }
 });
 input.addEventListener('blur', () => finish(true));
 input.addEventListener('click', event => event.stopPropagation());
}
// Abhaken oder wieder öffnen. Danach fragt die App für jedes To-Do, das dadurch frei wird: „Jetzt machen?“
async function toggleDone(id) {
 const task = getTask(id);
 undoSnapshot = snapshot();
 if (task.done) {
  task.done = false;
  task.doneAt = null;
  save();
  render();
  return;
 }
 // To-Dos, bei denen nur noch dieses eine fehlte
 const freed = parentsNeeding(id).filter(p => !p.done && openNeeds(p).length === 1);
 const cardEl = document.querySelector(`#acc .card[data-id="${id}"]`);
 if (cardEl && state.anim) {
  cardEl.querySelector('.check').setAttribute('aria-checked', 'true');
  cardEl.classList.add('leaving');
  await new Promise(resolve => setTimeout(resolve, 320));
 }
 task.done = true;
 task.doneAt = Date.now();
 save();
 render();
 for (const parent of freed) {
  if (parent.goal) {
   const r = await modal(`<div class="next" style="--c:${colorOf(parent)}"><p class="yay">Alles dafür erledigt!</p><h2>${esc(parent.t)}</h2>
    <div class="nbtns">${buttonHtml('', 'Noch nicht', 'ghost')}${buttonHtml('reached', 'Ziel erreicht!', 'pri')}${buttonHtml('more', '+ To-Do')}</div></div>`);
   if (r.v === 'reached') {
    undoSnapshot = snapshot();
    parent.done = true;
    parent.doneAt = Date.now();
    save();
    render();
    toast(`Ziel erreicht: ${esc(parent.t)}`, true);
   }
   if (r.v === 'more') await askBefore(parent.id);
   continue;
  }
  const r = await modal(`<div class="next" style="--c:${colorOf(parent)}"><p class="yay">Cool, geschafft! Next!</p><h2>${esc(parent.t)}</h2>
   <div class="nbtns">${buttonHtml('later', 'Später', 'ghost')}${buttonHtml('go', 'Jetzt machen', 'pri')}${buttonHtml('more', '+ Vorher-To-Do')}</div></div>`);
  if (r.v === 'go') { showCard(parent.id); break; }
  if (r.v === 'more') await askBefore(parent.id);
 }
}
// Zeigt die Karte eines To-Dos: hinscrollen und kurz aufleuchten lassen (z. B. nach „Jetzt machen“).
// Version C 1.0.35: ersetzt den Fokusmodus, bis der an passenden Stellen neu eingebaut wird.
function showCard(id) {
 const el = document.querySelector(`.card[data-id="${id}"], li[data-tid="${id}"] > .row`);
 if (!el) return;
 const column = el.closest('#cols > .col');
 if (column) goToColumn([...column.parentElement.children].indexOf(column));
 el.scrollIntoView({ block: 'center', behavior: state.anim ? 'smooth' : 'auto' });
 el.classList.remove('flash');
 void el.offsetWidth;
 el.classList.add('flash');
 setTimeout(() => el.classList.remove('flash'), 1400);
}
// Popup „Muss etwas anderes vorher passieren?“ (Knopf „+ Vorher-To-Do“ auf Karten)
async function askBefore(id) {
 const task = getTask(id);
 const existing = canPrecede(id);
 const pickExisting = existing.length
  ? `<details style="margin-top:10px"><summary class="link" style="cursor:pointer">Oder ein To-Do wählen, das schon da ist</summary>`
   + `<select class="field" name="link" style="margin-top:8px"><option value="">–</option>${taskOptionsHtml(existing)}</select></details>`
  : '';
 const r = await modal(`<h2>${task.goal ? 'Was gehört noch dazu?' : 'Muss etwas anderes vorher passieren?'}</h2><p>${task.goal ? 'Ziel' : 'Für'}: ${esc(task.t)}</p>
  <input class="field" name="text" placeholder="z. B. Erst klären, wer zuständig ist" autocomplete="off" aria-label="Muss etwas anderes vorher passieren?">
  ${pickExisting}
  ${kindChoiceHtml()}<div class="btns">${buttonHtml('', 'Nichts, ich kann loslegen', 'ghost')}${buttonHtml('ok', 'Hinzufügen', 'pri')}</div>`);
 if (r.v !== 'ok') return;
 const before = snapshot();
 // Entweder ein vorhandenes To-Do verknüpfen oder ein neues anlegen
 const other = r.vals.link ? getTask(r.vals.link) : r.vals.text ? createTask(r.vals.text) : null;
 if (!other) return;
 linkBefore(task, other, r.vals.kind);
 if (!r.vals.link) other.backlog = !!task.backlog;
 if (task.today && r.vals.kind !== 'help') other.today = true;
 undoSnapshot = before;
 save();
 render();
 toast(r.vals.kind === 'help' ? 'Notiert – sperrt nichts.' : 'Kommt vorher und steht jetzt oben.', true);
}
// Popup „Neues Ziel / Neues To-Do“ (Knopf + unten und + in jeder Spalte).
//   text = Vorbelegung des Titels, parent = To-Do, vor das das neue kommen soll,
//   mode = 'sub' öffnet direkt „Unter-To-Do“, place = vorbelegter Ort „bereichId|kategorieId“
//   (ohne: der gerade sichtbare Ort). Gibt true zurück, wenn etwas angelegt wurde.
async function addTask({ text = '', parent = null, mode = null, place = currentPlace() } = {}) {
 const openBereichId = place.split('|')[0];
 const context = parent;
 const candidates = allTasks().filter(t => !t.done);
 const asSub = mode ? mode === 'sub' : !!context;
 // Version C: Neues To-Do ohne Zusammenhang (weißer Knopf unten, „Später einsortieren“) = Popup wie eine Karte
 if (!asSub) return newTaskDialog(text, place);
 // Vorauswahl bei „Kommt vor“: das To-Do aus dem Zusammenhang, sonst das erste Ziel im offenen Bereich
 const preselected = context || (candidates.find(p => p.goal && isIn(p, openBereichId)) || {}).id;
 const parentTask = parent && getTask(parent);
 const betweenOption = parentTask && parentTask.needs.length
  ? `<label class="opt"><input type="checkbox" name="between"> Dazwischen einfügen – was bisher vor „${esc(parentTask.t)}“ kam, kommt dann vor das neue</label>`
  : '';
 // Die Klassen only-goal/only-sub blendet das CSS je nach gewählter Art aus
 const r = await modal(`<h2><span class="only-goal">Neues Ziel</span><span class="only-sub">Neues To-Do</span></h2>
  <input class="field" name="text" value="${esc(text)}" placeholder="${asSub ? 'Was ist zu tun?' : 'Was willst du erreichen? z. B. Neue Kund*innen gewinnen'}" autocomplete="off" aria-label="Titel">
  <div class="seg"><label><input type="radio" id="w-goal" name="what" value="goal"${asSub ? '' : ' checked'}>Neues Ziel</label><label><input type="radio" id="w-sub" name="what" value="sub"${asSub ? ' checked' : ''}>Unter-To-Do</label></div>
  <div class="only-goal">${placePickerHtml(place)}<label class="opt"><input type="checkbox" name="bl"> Erst mal ins Backlog</label></div>
  <div class="only-sub"><label class="lbl">Kommt vor</label><select class="field" name="parent">${taskOptionsHtml(candidates, preselected)}</select>
  ${betweenOption}</div>
  ${preListHtml()}
  <div class="btns">${buttonHtml('', 'Abbrechen', 'ghost')}${buttonHtml('ok', 'Hinzufügen', 'pri')}</div>`);
 if (r.v !== 'ok' || !r.vals.text) return false;
 undoSnapshot = snapshot();
 // Im Tab „Heute“ angelegte To-Dos kommen gleich nach „Heute“
 const today = state.view === 'heute';
 const preEntries = r.vals._pre;
 let created;
 if (r.vals.what === 'goal') {
  const [cat, area] = r.vals.place.split('|');
  created = createTask(r.vals.text, { goal: true, cat: cat || null, area: area || null, today, backlog: !!r.vals.bl && !today });
 } else {
  const before = getTask(r.vals.parent);
  if (!before) return false;
  created = createTask(r.vals.text, { today, backlog: !!before.backlog && !today });
  // „Dazwischen einfügen“: die bisherigen Vorher-To-Dos wandern zum neuen To-Do
  if (r.vals.between && before.id === parent) {
   created.needs.push(...before.needs);
   before.needs = [];
  }
  linkBefore(before, created, 'hard');
 }
 createPreTasks(created, preEntries, today);
 const count = preEntries.length;
 toast(count ? `Angelegt – mit ${count} Vorher-To-Do${pluralS(count)}.` : (r.vals.what === 'goal' ? 'Neues Ziel angelegt.' : 'Angelegt.'), true);
 save();
 render();
 return true;
}
// Liste „Später einsortieren“ abarbeiten (bleibt offen, bis „Fertig“ gedrückt wird)
async function sortInbox() {
 for (;;) {
  if (!state.inbox.length) return;
  const rows = state.inbox.map(item => `<div class="lrow"><span>${esc(item.t)}</span>`
   + `<button class="btn" data-v="sort:${item.id}" style="min-height:40px">Einsortieren</button>`
   + `<button class="mini" data-v="rm:${item.id}" aria-label="Löschen">×</button></div>`).join('');
  const r = await modal(`<h2>Später einsortieren</h2><p>Was dir zwischendurch eingefallen ist.</p>
   ${rows}
   <div class="btns">${buttonHtml('', 'Fertig', 'pri')}</div>`);
  if (!r.v) return;
  const [action, itemId] = r.v.split(':');
  const item = state.inbox.find(i => i.id === itemId);
  if (!item) continue;
  if (action === 'rm') {
   undoSnapshot = snapshot();
   state.inbox = state.inbox.filter(i => i !== item);
   save();
   render();
   continue;
  }
  const before = snapshot();
  if (await addTask({ text: item.t, parent: item.ctx && getTask(item.ctx) ? item.ctx : null })) {
   state.inbox = state.inbox.filter(i => i.id !== itemId);
   undoSnapshot = before;
   save();
   render();
  }
 }
}
// Popup „Bearbeiten“. Läuft in einer Schleife (nach jeder Änderung neu gezeigt),
// bis „Fertig“ oder „Löschen“ gedrückt wird.
async function editTask(id) {
 const before = snapshot();
 for (;;) {
  const task = getTask(id);
  if (!task) return;
  const r = await modal(editDialogHtml(task));
  if (r.vals.text) task.t = r.vals.text;
  // Knöpfe mit Wert „aktion:ID“, z. B. „rmk:abc123“
  const [action, otherId] = (r.v || '').split(':');
  if (action === 'kind') {
   toggleKind(task, otherId);
  } else if (action === 'rmk') {
   unlinkBefore(task, otherId);
  } else if (action === 'rmp') {
   unlinkBefore(getTask(otherId), id);
  } else if (action === 'addk' || action === 'addp') {
   await linkExisting(task, action === 'addk');
  } else if (action === 'move') {
   await moveMenu(id);
  } else if (action === 'del') {
   const q = await modal(`<h2>„${esc(task.t)}“ löschen?</h2><p>Unter-To-Dos, die nur dazu gehören, verschwinden mit.</p>`
    + `<div class="btns">${buttonHtml('', 'Behalten', 'ghost')}${buttonHtml('ok', 'Löschen', 'pri')}</div>`);
   if (q.v === 'ok') {
    deleteTask(id);
    save();
    render();
    undoSnapshot = before;
    toast('Gelöscht.', true);
    return;
   }
  } else {
   // „Fertig“, Escape oder Klick daneben
   save();
   render();
   if (snapshot() !== before) {
    undoSnapshot = before;
    toast('Gespeichert.', true);
   }
   return;
  }
  save();
  render();
 }
}
function editDialogHtml(task) {
 const before = [
  ...task.needs.map(id => [id, 0]),
  ...task.soft.map(id => [id, 1])
 ].filter(([id]) => getTask(id));
 const parents = parentsOf(task.id);
 const beforeRows = before.map(([id, soft]) => `<div class="lrow"><span>${esc(getTask(id).t)}</span>`
  + `<button class="link" data-v="kind:${id}" title="Umschalten">${soft ? 'hilft nur' : 'geht sonst nicht'}</button>`
  + `<button class="mini" data-v="rmk:${id}" aria-label="Verknüpfung lösen">×</button></div>`).join('');
 const parentRows = parents.length
  ? `<label class="lbl">Gehört zu</label>` + parents.map(p => `<div class="lrow"><span>${esc(p.t)}</span>`
   + `<button class="mini" data-v="rmp:${p.id}" aria-label="Verknüpfung lösen">×</button></div>`).join('')
  : '';
 return `<h2>Bearbeiten</h2>
   <input class="field" name="text" value="${esc(task.t)}" aria-label="Titel" autocomplete="off">
   <p>${esc(placeName(...placeOf(task).split('|')))} · ${task.backlog ? 'Backlog' : wideNarrow('Zeitnah', 'Aktuell')} <button class="link" data-v="move">Verschieben …</button></p>
   <label class="lbl">Kommt vorher</label>
   ${beforeRows}
   <button class="link" data-v="addk">+ Ein To-Do, das schon da ist, kommt vorher</button>
   ${parentRows}
   <div><button class="link" data-v="addp">+ Zahlt auch auf ein anderes To-Do ein</button></div>
   <div class="btns">${buttonHtml('del', 'Löschen', 'ghost')}${buttonHtml('ok', 'Fertig', 'pri')}</div>`;
}
// Popup „Verbindungen“ (über 🔗 im Bearbeitungsfeld): was kommt erst vorher, wozu gehört es noch.
// Vorhandene To-Dos lassen sich dazuholen (auch aus anderen Bereichen); × löst eine Verbindung.
async function connectionsDialog(id, before = snapshot()) {
 for (;;) {
  const task = getTask(id);
  if (!task) return;
  const r = await modal(connectionsHtml(task));
  const [action, otherId] = (r.v || '').split(':');
  if (action === 'kind') toggleKind(task, otherId);
  else if (action === 'rmk') unlinkBefore(task, otherId);
  else if (action === 'rmp') { unlinkBefore(getTask(otherId), id); if (!parentsOf(id).length) task.goal = true; }
  else if (action === 'addk' || action === 'addp') await linkExisting(task, action === 'addk');
  else {
   save();
   render();
   if (snapshot() !== before) { undoSnapshot = before; toast('Verbindungen gespeichert.', true); }
   return;
  }
  save();
  render();
 }
}
function connectionsHtml(task) {
 const beforeList = [...task.needs.map(x => [x, 0]), ...task.soft.map(x => [x, 1])].filter(([x]) => getTask(x));
 const parents = parentsOf(task.id);
 const row = (title, buttons) => `<div class="lrow"><span>${esc(title)}</span>${buttons}</div>`;
 const beforeRows = beforeList.length
  ? beforeList.map(([x, soft]) => row(shownTitle(getTask(x)),
   `<button class="link" data-v="kind:${x}" title="Umschalten">${soft ? 'hilft nur' : 'geht sonst nicht'}</button>`
   + `<button class="mini" data-v="rmk:${x}" aria-label="Verbindung lösen">×</button>`)).join('')
  : '<p class="prehint">Noch nichts.</p>';
 const parentRows = parents.length
  ? parents.map(parent => row(shownTitle(parent), `<button class="mini" data-v="rmp:${parent.id}" aria-label="Verbindung lösen">×</button>`)).join('')
  : '<p class="prehint">Zu keinem anderen To-Do.</p>';
 return `<h2>🔗 „${esc(shownTitle(task))}“</h2>
  <label class="lbl">Kommt erst nach …</label>${beforeRows}
  <button class="link" data-v="addk">+ Ein vorhandenes To-Do muss vorher erledigt sein</button>
  <label class="lbl">Gehört auch zu …</label>${parentRows}
  <button class="link" data-v="addp">+ Gehört auch zu einem anderen To-Do</button>
  <div class="btns">${buttonHtml('ok', 'Fertig', 'pri')}</div>`;
}
// Schaltet ein Vorher-To-Do zwischen „geht sonst nicht“ und „hilft nur“ um
function toggleKind(task, beforeId) {
 if (task.needs.includes(beforeId)) {
  task.needs = task.needs.filter(id => id !== beforeId);
  task.soft.push(beforeId);
 } else {
  task.soft = task.soft.filter(id => id !== beforeId);
  task.needs.push(beforeId);
 }
}
// Löst die Verbindung „beforeId kommt vor task“. Gehört das Vorher-To-Do danach
// zu nichts mehr, wird es zu einem eigenen Ziel.
function unlinkBefore(task, beforeId) {
 task.needs = task.needs.filter(id => id !== beforeId);
 task.soft = task.soft.filter(id => id !== beforeId);
 if (getTask(beforeId) && !parentsOf(beforeId).length) getTask(beforeId).goal = true;
}
// Ein vorhandenes To-Do verknüpfen: asBefore = true „kommt vorher“, sonst „zahlt auch ein auf“
async function linkExisting(task, asBefore) {
 const choices = asBefore ? canPrecede(task.id) : canFollow(task.id);
 const pending = modal(`<h2>${asBefore ? 'Was muss vorher erledigt sein?' : 'Wozu gehört es noch?'}</h2><p>Auch aus anderen Bereichen.</p>`
  + (choices.length ? `<label class="lbl">Bereich</label><select class="field" name="lb" aria-label="Bereich"></select>`
   + `<div class="lkat"><label class="lbl">Kategorie</label><select class="field" name="lk" aria-label="Kategorie"></select></div>`
   + `<label class="lbl">To-Do</label><select class="field" name="o" aria-label="To-Do"></select>${kindChoiceHtml()}` : '<p>Gerade passt nichts.</p>')
  + `<div class="btns">${buttonHtml('', 'Zurück', 'ghost')}${choices.length ? buttonHtml('ok', 'Verknüpfen', 'pri') : ''}</div>`);
 // Version C: Schritt für Schritt wählen – erst Bereich, dann Kategorie, dann das To-Do.
 // Es stehen nur Bereiche und Kategorien zur Wahl, in denen auch etwas Passendes liegt.
 const bereichSelect = $('#modal [name=lb]');
 const kategorieSelect = $('#modal [name=lk]');
 const taskSelect = $('#modal [name=o]');
 if (bereichSelect) {
  const option = (value, text, selected) => `<option value="${value}"${selected ? ' selected' : ''}>${esc(text)}</option>`;
  const [ownBereich, ownKategorie] = placeOf(task).split('|');
  const bereiche = visibleBereiche().filter(b => choices.some(t => isIn(t, b.id)));
  const fillTasks = () => {
   const bereich = getBereich(bereichSelect.value);
   const inPlace = choices.filter(t => isIn(t, bereichSelect.value, bereich && bereich.subs.length ? kategorieSelect.value : ''));
   taskSelect.innerHTML = taskOptionsHtml(inPlace);
  };
  const fillKategorien = preferred => {
   const bereich = getBereich(bereichSelect.value);
   const kategorien = bereich ? bereich.subs.filter(k => choices.some(t => isIn(t, bereich.id, k.id))) : [];
   const chosen = kategorien.find(k => k.id === preferred) || kategorien[0];
   kategorieSelect.innerHTML = kategorien.map(k => option(k.id, k.name, k === chosen)).join('');
   kategorieSelect.closest('.lkat').hidden = !kategorien.length;
   fillTasks();
  };
  const startBereich = bereiche.find(b => b.id === ownBereich) || bereiche[0];
  bereichSelect.innerHTML = bereiche.map(b => option(b.id, b.name, b === startBereich)).join('');
  fillKategorien(ownKategorie);
  bereichSelect.addEventListener('change', () => fillKategorien(''));
  kategorieSelect.addEventListener('change', fillTasks);
 }
 const q = await pending;
 if (q.v !== 'ok' || !q.vals.o || !getTask(q.vals.o)) return;
 if (asBefore) linkBefore(task, getTask(q.vals.o), q.vals.kind);
 else linkBefore(getTask(q.vals.o), task, q.vals.kind);
}
// Löschen mit Hinweis und „Rückgängig“ (Papierkorb-Knopf)
function deleteWithUndo(id) {
 const task = getTask(id);
 if (!task) return;
 undoSnapshot = snapshot();
 const idsBefore = new Set(Object.keys(state.tasks));
 deleteTask(id);
 save();
 render();
 const alsoGone = [...idsBefore].filter(x => !state.tasks[x]).length - 1;
 toast(`„${esc(task.t)}“ gelöscht${alsoGone > 0 ? ` – mit ${alsoGone} Unter-To-Do${pluralS(alsoGone)}` : ''}.`, true);
}
// Version C: Ein Unter-To-Do mitten aus einer Kette löschen, ohne den Rest zu verlieren. Seine Vorher-To-Dos
// rücken an seine Stelle (A → B → C, B löschen: A → C). „hilft nur“ bleibt „hilft nur“, wenn eine der beiden
// Verbindungen „hilft nur“ war.
function bridgeOver(id) {
 const task = getTask(id);
 if (!task) return;
 parentsOf(id).forEach(parent => {
  const kind = parent.needs.includes(id) ? 'needs' : 'soft';
  const list = parent[kind];
  const fill = [
   ...task.needs.map(child => [child, kind]),
   ...task.soft.map(child => [child, 'soft'])
  ].filter(([child]) => child !== parent.id && !parent.needs.includes(child) && !parent.soft.includes(child)
    && !taskAndAllBefore(child).has(parent.id));
  const here = fill.filter(([, k]) => k === kind).map(([child]) => child);
  list.splice(list.indexOf(id), 1, ...here);
  if (kind === 'needs') fill.filter(([, k]) => k === 'soft').forEach(([child]) => parent.soft.push(child));
  here.forEach(child => {
   if (kind === 'needs' && getTask(child)) getTask(child).prio = Math.max(getTask(child).prio, parent.prio + 1);
  });
 });
}
// Löscht das To-Do und alle Vorher-To-Dos, die danach zu nichts mehr gehören (und keine Ziele sind).
// Hängt das To-Do an einem anderen (Unter-To-Do), bleiben seine Vorher-To-Dos erhalten (bridgeOver).
function deleteTask(id) {
 if (parentsOf(id).length) bridgeOver(id);
 const remove = removeId => {
  delete state.tasks[removeId];
  allTasks().forEach(t => {
   t.needs = t.needs.filter(x => x !== removeId);
   t.soft = t.soft.filter(x => x !== removeId);
  });
 };
 remove(id);
 let changed = true;
 while (changed) {
  changed = false;
  allTasks().forEach(t => {
   if (!t.goal && !parentsOf(t.id).length) { remove(t.id); changed = true; }
  });
 }
}
// Bereich löschen, nach Sicherheitsfrage. Die To-Dos bleiben und stehen danach unter „Ohne Bereich“.
// Gibt true zurück, wenn gelöscht wurde.
async function deleteBereich(id) {
 const bereich = getBereich(id);
 if (!bereich) return false;
 const count = allTasks().filter(t => !t.done && isIn(t, id)).length;
 if (!await confirmDelete(`Ganzen Bereich „${esc(bereich.name)}“ löschen?`,
  `Der Bereich und alle Kategorien darin sind dann weg.${count === 1 ? ' Das offene To-Do bleibt und steht danach unter „Ohne Bereich“.' : count ? ` Die ${count} offenen To-Dos bleiben und stehen danach unter „Ohne Bereich“.` : ''}`)) return false;
 // Die To-Dos bleiben, sie stehen danach unter „Ohne Bereich“ (oder erben vom Ziel)
 undoSnapshot = snapshot();
 state.cats = state.cats.filter(b => b !== bereich);
 if (state.openCat === id) state.openCat = state.cats[0] ? state.cats[0].id : null;
 allTasks().forEach(t => { if (t.cat === id) t.cat = null; });
 save();
 render();
 toast('Bereich gelöscht. Die To-Dos sind noch da.', true);
 return true;
}
// Handy: „Bereich löschen“ im Kopf, während der Name bearbeitet wird
async function deleteBereichFromHead(id) {
 deletingBereich = true;
 clearTimeout(nameCommitTimer);
 const field = document.querySelector('.cnamein');
 const typed = field ? field.value : null;
 try {
  const deleted = await deleteBereich(id);
  if (!deleted) {
   // Abgebrochen: weiter im Bearbeiten, mit dem bisher Getippten
   editingBereichName = id;
   render();
   const again = document.querySelector('.cnamein');
   if (again) { if (typed !== null) again.value = typed; again.focus(); }
  } else editingBereichName = null;
 } finally { deletingBereich = false; }
}
// Bereich anlegen (ohne id) oder bearbeiten/löschen (mit id)
async function bereichDialog(id) {
 const bereich = id ? getBereich(id) : null;
 const currentColor = bereich ? bereich.color : COLORS[state.cats.length % COLORS.length];
 const colorChoices = COLORS.map((color, i) => `<label style="--c:${color}" aria-label="Farbe ${i + 1}">`
  + `<input type="radio" name="color" value="${color}"${currentColor === color ? ' checked' : ''}></label>`).join('');
 const r = await modal(`<h2>${bereich ? 'Bereich bearbeiten' : 'Neuer Bereich'}</h2>
  <input class="field" name="name" value="${esc(bereich ? bereich.name : '')}" placeholder="z. B. Freund*innen" aria-label="Name" autocomplete="off">
  <label class="lbl">Farbe</label><div class="swatches">${colorChoices}</div>
  <div class="btns">${bereich ? buttonHtml('del', 'Löschen', 'ghost') : buttonHtml('', 'Abbrechen', 'ghost')}${buttonHtml('ok', bereich ? 'Fertig' : 'Anlegen', 'pri')}</div>`);
 if (r.v === 'del') { await deleteBereich(id); return; }
 if (r.v !== 'ok' || !r.vals.name) return;
 undoSnapshot = snapshot();
 if (bereich) {
  bereich.name = r.vals.name;
  bereich.color = r.vals.color;
 } else {
  const created = { id: uid(), name: r.vals.name, color: r.vals.color, subs: [] };
  addSammlung(created);
  state.cats.push(created);
  state.openCat = created.id;
  currentColumn = 0;
 }
 save();
 render();
}
// Version C: Sicherheitsfrage vor dem Löschen eines Bereichs oder einer Kategorie. Nur „Löschen“ und „Abbrechen“.
async function confirmDelete(question, detail) {
 const r = await modal(`<h2>${question}</h2><p>${detail}</p>
  <div class="btns">${buttonHtml('', 'Abbrechen', 'ghost')}${buttonHtml('yes', 'Löschen', 'pri danger')}</div>`);
 return r.v === 'yes';
}
// Auswahl „Bereich“ und „Position“ für Verschieben und Duplizieren einer Kategorie.
// Position = Stelle in der Reihenfolge des Ziel-Bereichs (0 = ganz vorne / links).
function kategoriePositionOptions(bereichId, skipId, selectedIndex) {
 const others = getBereich(bereichId).subs.filter(k => k.id !== skipId);
 const options = [`<option value="0">Ganz vorne</option>`]
  .concat(others.map((k, i) => `<option value="${i + 1}">nach „${esc(katName(k))}“</option>`));
 const chosen = selectedIndex == null ? others.length : Math.min(selectedIndex, others.length);
 return options.map((o, i) => i === chosen ? o.replace('<option', '<option selected') : o).join('');
}
async function askKategorieTarget(title, bereichId, kategorie, keepIndex) {
 const bereichOptions = state.cats.map(b => `<option value="${b.id}"${b.id === bereichId ? ' selected' : ''}>${esc(b.name)}</option>`).join('');
 const pending = modal(`<h2>${title}</h2>
  <label class="lbl" for="kt-cat">Bereich</label><select class="field" id="kt-cat" name="tcat">${bereichOptions}</select>
  <label class="lbl" for="kt-pos">Position</label><select class="field" id="kt-pos" name="tpos">${kategoriePositionOptions(bereichId, kategorie.id, keepIndex)}</select>
  <div class="btns">${buttonHtml('', 'Abbrechen', 'ghost')}${buttonHtml('ok', 'Fertig', 'pri')}</div>`);
 const modalEl = $('#modal');
 modalEl.querySelector('[name=tcat]').addEventListener('change', event => {
  const same = event.target.value === bereichId;
  modalEl.querySelector('[name=tpos]').innerHTML = kategoriePositionOptions(event.target.value, kategorie.id, same ? keepIndex : null);
 });
 const r = await pending;
 if (r.v !== 'ok' || !getBereich(r.vals.tcat)) return null;
 return { bereichId: r.vals.tcat, index: +r.vals.tpos || 0 };
}
// Kategorie in einen (anderen) Bereich und an eine Stelle verschieben. Ihre To-Dos kommen mit.
function moveKategorieTo(fromBereichId, kategorieId, toBereichId, index) {
 const from = getBereich(fromBereichId);
 const to = getBereich(toBereichId);
 const kategorie = from.subs.find(k => k.id === kategorieId);
 undoSnapshot = snapshot();
 from.subs.splice(from.subs.indexOf(kategorie), 1);
 if (to !== from) {
  // Gibt es die Kennung im Ziel-Bereich schon, bekommt die Kategorie eine neue
  const oldId = kategorie.id;
  if (to.subs.some(k => k.id === oldId)) kategorie.id = uid();
  allTasks().forEach(t => {
   if (t.cat === fromBereichId && t.area === oldId) { t.cat = toBereichId; t.area = kategorie.id; }
  });
 }
 to.subs.splice(Math.min(index, to.subs.length), 0, kategorie);
 state.openCat = toBereichId;
 currentColumn = Math.max(0, columnsOf(to).indexOf(kategorie));
 save();
 render();
 goToColumn(currentColumn);
 toast(`„${esc(kategorie.name)}“ verschoben${to !== from ? ` nach ${esc(to.name)}` : ''}.`, true);
}
// Kategorie duplizieren: neue Kategorie „Name (Kopie)“ mit Kopien aller offenen To-Dos darin
// (mit ihren Unter-To-Dos, Ketten und Listen; ohne „Heute“).
function duplicateKategorie(fromBereichId, kategorieId, toBereichId, index) {
 const from = getBereich(fromBereichId);
 const to = getBereich(toBereichId);
 const kategorie = from.subs.find(k => k.id === kategorieId);
 undoSnapshot = snapshot();
 const copy = { id: uid(), name: `${kategorie.name} (Kopie)`, ...(kategorie.icon ? { icon: kategorie.icon } : {}) };
 const originals = allTasks().filter(t => !t.done && isIn(t, fromBereichId, kategorieId));
 const newIds = new Map(originals.map(t => [t.id, uid()]));
 originals.forEach(t => {
  const c = JSON.parse(JSON.stringify(t));
  c.id = newIds.get(t.id);
  c.needs = t.needs.filter(x => newIds.has(x)).map(x => newIds.get(x));
  c.soft = t.soft.filter(x => newIds.has(x)).map(x => newIds.get(x));
  delete c.today; delete c.todayOrder; delete c.todayBy;
  c.created = Date.now();
  if (Array.isArray(c.list)) c.list = c.list.map(item => ({ ...item, id: uid() }));
  // Wurzeln (gehören zu keinem anderen kopierten To-Do) kommen fest in die neue Kategorie
  const isRoot = !originals.some(o => o.needs.includes(t.id) || o.soft.includes(t.id));
  if (isRoot || t.cat === fromBereichId) { c.cat = toBereichId; c.area = copy.id; }
  state.tasks[c.id] = c;
 });
 to.subs.splice(Math.min(index, to.subs.length), 0, copy);
 state.openCat = toBereichId;
 currentColumn = Math.max(0, columnsOf(to).indexOf(copy));
 save();
 render();
 goToColumn(currentColumn);
 const n = originals.length;
 toast(`„${esc(copy.name)}“ angelegt${n ? ` – mit ${n} To-Do${pluralS(n)}` : ''}.`, true);
}
// Auge im Kategorie-Knopf: Sammlung ein- und ausblenden
function toggleKategorieHidden(bereichId, kategorieId) {
 const bereich = getBereich(bereichId);
 const kategorie = bereich && bereich.subs.find(k => k.id === kategorieId);
 if (!kategorie) return;
 if (kategorie.hidden) delete kategorie.hidden;
 else kategorie.hidden = true;
 state.openCat = bereichId;
 const index = columnsOf(bereich).indexOf(kategorie);
 currentColumn = Math.max(0, index);
 save();
 render();
 if (index >= 0) goToColumn(index, true);
}
function setIcon(kategorie, icon) {
 if (icon) kategorie.icon = icon;
 else delete kategorie.icon;
 return kategorie;
}
// Kategorie anlegen (ohne kategorieId) oder bearbeiten: Name, Emoji, Verschieben, Duplizieren, Löschen
async function kategorieDialog(bereichId, kategorieId) {
 const bereich = getBereich(bereichId);
 if (!bereich) return;
 const kategorie = kategorieId ? bereich.subs.find(k => k.id === kategorieId) : null;
 const firstHint = !kategorie && !bereich.subs.length && allTasks().some(t => isIn(t, bereichId))
  ? `<p class="prehint">Was schon in ${esc(bereich.name)} liegt, kommt erst mal in diese erste Kategorie.</p>`
  : '';
 const actions = kategorie
  ? `<div class="subpos">${buttonHtml('move', 'Verschieben …')}${buttonHtml('dup', 'Duplizieren …')}</div>`
  : '';
 const r = await modal(`<h2>${kategorie ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h2><p>in ${esc(bereich.name)}</p>
  <input class="field" name="name" value="${esc(kategorie ? kategorie.name : '')}" placeholder="z. B. Akquise" autocomplete="off" aria-label="Name">
  <label class="lbl">Symbol</label>${iconPickerHtml(kategorie && kategorie.icon, bereich.color)}
  ${firstHint}
  ${actions}
  <div class="btns">${kategorie ? buttonHtml('del', 'Löschen', 'ghost') : buttonHtml('', 'Abbrechen', 'ghost')}${buttonHtml('ok', kategorie ? 'Fertig' : 'Anlegen', 'pri')}</div>`);
 // Ein geänderter Name gilt auch beim Verschieben und Duplizieren
 const renameFirst = () => {
  if (kategorie && r.vals.name) { kategorie.name = r.vals.name; setIcon(kategorie, r.vals.icon); save(); }
 };
 if (r.v === 'move' || r.v === 'dup') {
  const moving = r.v === 'move';
  const index = bereich.subs.indexOf(kategorie);
  const target = await askKategorieTarget(moving ? `„${esc(r.vals.name || kategorie.name)}“ verschieben` : `„${esc(r.vals.name || kategorie.name)}“ duplizieren`,
   bereichId, kategorie, moving ? index : index + 1);
  if (!target) return;
  const before = snapshot();
  renameFirst();
  if (moving) moveKategorieTo(bereichId, kategorieId, target.bereichId, target.index);
  else duplicateKategorie(bereichId, kategorieId, target.bereichId, target.index);
  undoSnapshot = before;
  return;
 }
 if (r.v === 'del') {
  const count = allTasks().filter(t => !t.done && isIn(t, bereichId, kategorieId)).length;
  const rest = bereich.subs.find(k => k !== kategorie && !k.inbox) || bereich.subs.find(k => k !== kategorie);
  if (!await confirmDelete(`Kategorie „${esc(kategorie.name)}“ löschen?`,
   count === 1 ? `Das offene To-Do darin bleibt und liegt danach in ${esc(rest ? rest.name : bereich.name)}.` : count ? `Die ${count} offenen To-Dos darin bleiben und liegen danach in ${esc(rest ? rest.name : bereich.name)}.` : 'Sie ist leer.')) return;
  undoSnapshot = snapshot();
  const index = bereich.subs.indexOf(kategorie);
  bereich.subs.splice(index, 1);
  allTasks().forEach(t => { if (t.area === kategorieId) t.area = null; });
  currentColumn = 0;
  save();
  render();
  toast(`Kategorie gelöscht. Die To-Dos liegen jetzt in ${esc(rest ? rest.name : bereich.name)}.`, true);
  return;
 }
 if (r.v !== 'ok' || !r.vals.name) return;
 undoSnapshot = snapshot();
 if (kategorie) {
  kategorie.name = r.vals.name;
  setIcon(kategorie, r.vals.icon);
 } else {
  bereich.subs.push(setIcon({ id: uid(), name: r.vals.name }, r.vals.icon));
  currentColumn = columnsOf(bereich).length - 1;
  state.openCat = bereichId;
 }
 save();
 render();
 if (!kategorie) goToColumn(currentColumn);
}
// Setzt eine Kategorie an Stelle `to` (0 = ganz links). Die Reihenfolge der Spalten ist einfach die
// Reihenfolge in bereich.subs und wird damit gespeichert und in der Sicherung mitgenommen.
// hasSnapshot = true: undoSnapshot wurde schon gesetzt (aus dem Popup), dann auch ohne Bewegung speichern.
// Version C: `to` zählt nur die sichtbaren Spalten; ausgeblendete Kategorien bleiben an ihrem Platz.
function moveKategorie(bereichId, kategorieId, to, hasSnapshot) {
 const bereich = getBereich(bereichId);
 if (!bereich) return;
 const visible = columnsOf(bereich);
 const from = visible.findIndex(k => k.id === kategorieId);
 to = Math.max(0, Math.min(to, visible.length - 1));
 if (from < 0 || (from === to && !hasSnapshot)) return;
 if (!hasSnapshot) undoSnapshot = snapshot();
 const [kategorie] = visible.splice(from, 1);
 visible.splice(to, 0, kategorie);
 let next = 0;
 bereich.subs = bereich.subs.map(k => k.hidden ? k : visible[next++]);
 state.openCat = bereichId;
 currentColumn = to;
 save();
 render();
 // Die verschobene Spalte sichtbar halten
 const cols = $('#cols');
 const column = cols && cols.children[to];
 if (column) {
  const left = column.offsetLeft - cols.offsetLeft;
  if (left < cols.scrollLeft || left + column.offsetWidth > cols.scrollLeft + cols.clientWidth + 2) goToColumn(to);
 }
 if (from !== to) toast(`„${esc(kategorie.name)}“ verschoben.`, true);
}
/* Zeitnah ⇄ Backlog und Verschieben in einen anderen Bereich / eine andere Kategorie.
   cat/area = neuer Ort (undefined = Ort nicht ändern), bl = true ins Backlog, false nach Zeitnah
   (undefined = nicht ändern). Geht ein To-Do ins Backlog, fragt die App einmal, ob die ganze Kette mitkommt. */
async function moveTo(id, { cat, area, bl }) {
 const task = getTask(id);
 if (!task) return;
 const before = snapshot();
 const messages = [];
 if (cat !== undefined) {
  const newPlace = (cat || '') + '|' + (area || '');
  if (placeOf(task) !== newPlace) {
   task.cat = cat || null;
   task.area = area || null;
   messages.push('liegt jetzt in ' + placeName(cat, area));
  }
 }
 if (bl !== undefined && bl !== !!task.backlog) {
  if (bl) {
   const ids = await askWhatGoesToBacklog(task);
   if (!ids) { state = JSON.parse(before); render(); return null; } // abgebrochen: alles zurück
   ids.forEach(otherId => {
    const other = getTask(otherId);
    other.backlog = true;
    if (other.today) { other.today = false; other.todayBy = null; }
   });
   messages.push(ids.length > 1 ? `ist mit ${ids.length - 1} weiteren im Backlog` : 'ist im Backlog');
  } else {
   // Zurück nach Zeitnah: die Vorher-To-Dos im Backlog kommen mit
   const ids = [id, ...[...taskAndAllBefore(id)].filter(x => x !== id && getTask(x).backlog && !getTask(x).done)];
   ids.forEach(x => { getTask(x).backlog = false; });
   messages.push(ids.length > 1 ? `ist mit ${ids.length - 1} Vorher-To-Do${ids.length > 2 ? 's' : ''} zurück ${BACK_FROM_BACKLOG}` : `ist zurück ${BACK_FROM_BACKLOG}`);
  }
 }
 if (!messages.length) return false;
 undoSnapshot = before;
 save();
 render();
 toast(`„${esc(task.t)}“ ${messages.join(' und ')}.`, true);
 return true;
}
// Karte wurde abgelegt: an den neuen Ort (moveTo) und, falls order angegeben ist, in diese Reihenfolge.
// order = IDs der Karten in der Ablagefläche von oben nach unten (mit der gezogenen). Die Reihenfolge wird
// über prio gespeichert (höher = weiter oben), so wie überall sonst sortiert wird.
async function dropCard(id, place, order) {
 const before = snapshot();
 // Liegt es schon hier (auch geerbt vom Ziel), bleibt der Ort, wie er ist – nur Zeitnah/Backlog und Reihenfolge zählen
 if (isIn(getTask(id), place.cat, place.area)) place = { bl: place.bl };
 const moved = await moveTo(id, place);
 if (moved === null) return;
 if (order) order.forEach((otherId, i) => { if (getTask(otherId)) getTask(otherId).prio = order.length - i; });
 if (snapshot() === before) return;
 undoSnapshot = before;
 save();
 render();
 if (!moved) toast('Reihenfolge geändert.', true);
}
// Fragt, was mit ins Backlog kommt. Gibt die IDs zurück, oder null bei „Abbrechen“.
async function askWhatGoesToBacklog(task) {
 const id = task.id;
 const goal = task.goal ? null : goalsOf(id).find(g => !g.done && !g.backlog);
 const openBefore = [...taskAndAllBefore(id)].filter(x => x !== id && !getTask(x).done && !getTask(x).backlog);
 if (!goal && !openBefore.length) return [id];
 const wholeGoal = goal ? [...taskAndAllBefore(goal.id)].filter(x => !getTask(x).done) : [];
 const n = openBefore.length;
 const question = goal
  ? ` gehört zum Ziel „${esc(goal.t)}“.`
  : ` hat ${n} offene${n > 1 ? '' : 's'} Vorher-To-Do${pluralS(n)}.`;
 const q = await modal(`<h2>Kommt die ganze Kette mit ins Backlog?</h2><p>„${esc(task.t)}“${question}</p>
     <div class="btns">${buttonHtml('', 'Abbrechen', 'ghost')}${buttonHtml('one', 'Nur dieses To-Do')}${goal ? buttonHtml('goal', 'Das ganze Ziel', 'pri') : buttonHtml('chain', 'Ja, alles', 'pri')}</div>`);
 if (!q.v) return null;
 if (q.v === 'goal') return wholeGoal;
 if (q.v === 'chain') return [id, ...openBefore];
 return [id];
}
// Popup „Verschieben“ (Zeitnah/Backlog, Bereich, Kategorie)
async function moveMenu(id) {
 const task = getTask(id);
 if (!task) return;
 const r = await modal(`<h2>Verschieben</h2><p>${esc(task.t)}</p>
  <div class="seg" role="radiogroup" aria-label="Zeitnah oder Backlog"><label><input type="radio" name="bl" value="0"${task.backlog ? '' : ' checked'}>${wideNarrow('Zeitnah', 'Aktuell')}</label><label><input type="radio" name="bl" value="1"${task.backlog ? ' checked' : ''}>Backlog</label></div>
  ${placePickerHtml(placeOf(task))}
  <p><button class="link" data-v="more">Details und Verbindungen …</button></p>
  <div class="btns">${buttonHtml('', 'Abbrechen', 'ghost')}${buttonHtml('ok', 'Fertig', 'pri')}</div>`);
 if (r.v === 'more') { await editTask(id); return; }
 if (r.v !== 'ok') return;
 const [cat, area] = r.vals.place.split('|');
 await moveTo(id, { cat, area, bl: r.vals.bl === '1' });
}
// Einstellungen (Knopf ··· oben rechts)
async function settingsDialog() {
 const r = await modal(`<h2>Einstellungen</h2><label class="opt"><input type="checkbox" name="anim"${state.anim ? ' checked' : ''}> Sanfte Animationen</label>
  <p>Version B: Bereiche übereinander, Kategorien zum Wischen, ${wideNarrow('Zeitnah und ', '')}Backlog. Alles bleibt nur auf diesem Gerät.</p>
  <label class="lbl">Datensicherung</label>
  <p>Speichere ab und zu eine Sicherung als Datei. Damit holst du deine Liste auch auf ein anderes Gerät.</p>
  <div class="btns" style="justify-content:flex-start;margin-top:10px">${buttonHtml('export', 'Sicherung speichern')}${buttonHtml('import', 'Sicherung laden')}</div>
  <p class="prehint">App ${APP_VERSION} · Datenformat ${FORMAT}</p>
  <div class="btns">${buttonHtml('reset', 'Beispiel wiederherstellen', 'ghost')}${buttonHtml('copy', 'Daten kopieren', 'ghost')}${buttonHtml('ok', 'Fertig', 'pri')}</div>`);
 if (!r.v) return;
 state.anim = !!r.vals.anim;
 if (r.v === 'import') {
  save();
  render();
  $('#importFile').click(); // öffnet die Dateiauswahl, weiter geht es in importFile()
  return;
 }
 if (r.v === 'reset') {
  undoSnapshot = snapshot();
  state = seed();
  treeOpen.clear();
  save();
  render();
  toast('Beispiel wiederhergestellt.', true);
  return;
 }
 save();
 render();
 if (r.v === 'export') exportData();
 if (r.v === 'copy') {
  try {
   await navigator.clipboard.writeText(snapshot());
   toast('Kopiert.');
  } catch (e) {
   toast('Kopieren ging hier nicht.');
  }
 }
}

/* ---------- Datensicherung: Export und Import als JSON-Datei ----------
   Aufbau der Datei: {app:'power-liste', format:<Datenformat>, appVersion, exportedAt, data:<kompletter Zustand>} */
function exportData() {
 const date = new Date();
 const twoDigits = n => String(n).padStart(2, '0');
 const backup = { app: BACKUP_APP_NAME, format: FORMAT, appVersion: APP_VERSION, exportedAt: date.toISOString(), data: state };
 const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' }));
 const link = document.createElement('a');
 link.href = url;
 link.download = `power-liste-${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}.json`;
 document.body.append(link);
 link.click();
 link.remove();
 setTimeout(() => URL.revokeObjectURL(url), 4000);
 toast('Sicherung gespeichert.');
}
// Regeln für eine Sicherung: IDs nur aus Buchstaben, Ziffern, _ und -; Farben als #rgb … #rrggbbaa
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;
const isOptionalId = value => value == null || ID_PATTERN.test(value);
const isOptionalIdList = value => value == null || (Array.isArray(value) && value.every(id => ID_PATTERN.test(id)));
function isValidTask(key, task) {
 return task && typeof task === 'object' && ID_PATTERN.test(key) && task.id === key && typeof task.t === 'string'
  && isOptionalIdList(task.needs) && isOptionalIdList(task.soft)
  && isOptionalId(task.cat) && isOptionalId(task.area) && isOptionalId(task.todayBy)
  && (task.list == null || (Array.isArray(task.list) && task.list.every(item => item && typeof item.t === 'string' && typeof item.id === 'string')));
}
function isValidBereich(bereich) {
 const validKategorien = bereich.subs == null
  || (Array.isArray(bereich.subs) && bereich.subs.every(k => k && ID_PATTERN.test(k.id) && typeof k.name === 'string' && (k.icon == null || typeof k.icon === 'string')));
 return ID_PATTERN.test(bereich.id) && typeof bereich.name === 'string' && COLOR_PATTERN.test(bereich.color) && validKategorien;
}
function isValidInbox(inbox) {
 return Array.isArray(inbox) && inbox.every(item => item && ID_PATTERN.test(item.id) && typeof item.t === 'string' && isOptionalId(item.ctx));
}
// Prüft eine Sicherung. Gibt {data, when} zurück oder einen Fehlertext.
// Nimmt auch rohe Daten aus „Daten kopieren“ an (ohne die Hülle {app, format, data}).
function readBackup(text) {
 let parsed;
 try { parsed = JSON.parse(text); } catch (e) { return 'Die Datei ist keine gültige Sicherung.'; }
 const wrapped = parsed && parsed.app === BACKUP_APP_NAME && parsed.data;
 const format = wrapped ? +parsed.format || 1 : +(parsed && parsed.format) || 1;
 if (format > FORMAT) return 'Die Sicherung stammt aus einer neueren Version der App. Bitte erst die App aktualisieren.';
 const data = wrapped ? parsed.data : parsed;
 if (!data || typeof data !== 'object' || !data.tasks || typeof data.tasks !== 'object'
  || Array.isArray(data.tasks) || !Array.isArray(data.cats)) return 'In der Datei stehen keine To-Dos.';
 const damaged = 'Die Datei ist beschädigt.';
 for (const [key, task] of Object.entries(data.tasks)) {
  if (!isValidTask(key, task)) return damaged;
 }
 for (const bereich of data.cats) {
  if (!bereich || !isValidBereich(bereich)) return damaged;
 }
 if (data.inbox != null && !isValidInbox(data.inbox)) return damaged;
 if (!isOptionalId(data.openCat) || !['heute', 'jetzt', 'baum', undefined].includes(data.view)) return damaged;
 return { data: migrate(data), when: wrapped && parsed.exportedAt };
}
async function importFile(file) {
 let text;
 try { text = await file.text(); } catch (e) { toast('Die Datei ließ sich nicht lesen.'); return; }
 const result = readBackup(text);
 if (typeof result === 'string') { toast(result); return; }
 const openCount = Object.values(result.data.tasks).filter(t => !t.done).length;
 const date = result.when ? new Date(result.when) : null;
 const dateText = date && !isNaN(date) ? ` · vom ${date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}` : '';
 const q = await modal(`<h2>Sicherung laden?</h2><p>${esc(file.name)}${dateText}</p>`
  + `<p>Darin: ${openCount} offene To-Do${openCount === 1 ? '' : 's'}. Deine jetzige Liste wird dadurch ersetzt. Gleich danach kannst du es noch rückgängig machen.</p>
  <div class="btns">${buttonHtml('', 'Abbrechen', 'ghost')}${buttonHtml('ok', 'Laden', 'pri')}</div>`);
 if (q.v !== 'ok') return;
 undoSnapshot = snapshot();
 state = result.data;
 treeOpen.clear();
 openChains.clear();
 openBacklogs.clear();
 currentColumn = 0;
 startNewDayIfNeeded();
 save();
 render();
 toast('Sicherung geladen.', true);
}
$('#importFile').addEventListener('change', event => {
 const file = event.target.files && event.target.files[0];
 event.target.value = '';
 if (file) importFile(file);
});

/* ---------- Ereignisse ---------- */
// Im Popup: Art „Neues Ziel“/„Unter-To-Do“ gewechselt → anderer Platzhalter im Titelfeld.
// Bereich gewählt → passende Kategorien anzeigen. Ergebnis landet im Feld name="place".
document.addEventListener('change', event => {
 const field = event.target;
 if (field.matches && field.matches('#modal [name=what]')) {
  const titleField = $('#modal [name=text]');
  if (titleField) titleField.placeholder = field.value === 'goal' ? 'Was willst du erreichen? z. B. Neue Kund*innen gewinnen' : 'Was ist zu tun?';
  return;
 }
 if (!field.matches || !field.matches('[data-pick]')) return;
 const picker = field.closest('.pick');
 const bereichSelect = picker.querySelector('[data-pick=cat]');
 const kategorieSelect = picker.querySelector('[data-pick=kat]');
 if (field === bereichSelect) {
  kategorieSelect.innerHTML = kategorieOptionsHtml(bereichSelect.value, '');
  picker.querySelector('.pkat').hidden = !kategorieSelect.options.length;
 }
 picker.querySelector('[name=place]').value = bereichSelect.value + '|' + (kategorieSelect.options.length ? kategorieSelect.value : '');
});
// Auf-/Zuklappen merken: Ziel-Ketten auf Karten und Backlog-Kästen
document.addEventListener('toggle', event => {
 const details = event.target;
 if (!details.matches) return;
 if (details.matches('details.chain')) {
  if (details.open) openChains.add(details.dataset.id);
  else openChains.delete(details.dataset.id);
 }
 if (details.matches('details.blsec')) {
  if (details.open) openBacklogs.add(details.dataset.k);
  else openBacklogs.delete(details.dataset.k);
 }
}, true);
// Heute-Schalter geklickt
function toggleToday(id, button) {
 const task = getTask(id);
 const wasInBacklog = !!task.backlog;
 const count = setToday(id, !task.today);
 if (count > 0 && task.today) {
  toast(`Mit ${count} Vorher-To-Do${pluralS(count)} in „Heute“.` + (wasInBacklog ? ` Aus dem Backlog${wideNarrow(' nach Zeitnah', '')} geholt.` : ''));
 } else if (wasInBacklog && task.today) {
  toast(`In „Heute“ und aus dem Backlog${wideNarrow(' nach Zeitnah', '')} geholt.`);
 }
 save();
 // Im Tab „Heute“ gleitet die Karte erst sanft hinaus
 if (state.view === 'heute' && !task.today) {
  const cardEl = button.closest('.card');
  if (cardEl && state.anim) {
   cardEl.classList.add('leaving');
   setTimeout(render, 280);
   return;
  }
 }
 render();
}
// Schalter „Machbar“ an/aus
function setMachbar(on) {
 state.machbar = on;
 state.view = on ? 'jetzt' : 'baum';
 save();
 render();
 document.querySelector('.mswitch')?.focus();
}
// Bereich auf-/zuklappen
function toggleBereich(bereichId) {
 state.openCat = state.openCat === bereichId ? null : bereichId;
 currentColumn = 0;
 save();
 render();
 if (state.openCat !== null) document.querySelector('.cat.open')?.scrollIntoView({ block: 'nearest', behavior: state.anim ? 'smooth' : 'auto' });
}
// Ast in der Übersicht auf-/zuklappen. Bei einem Ziel (level 0) gilt es für alle Äste darunter.
function toggleTreeBranch(key, level) {
 const isOpen = treeOpen.has(key) ? treeOpen.get(key) : level > 0;
 if (level === 0) {
  [...treeOpen.keys()].forEach(k => { if (k.startsWith(key + '/')) treeOpen.delete(k); });
 }
 treeOpen.set(key, !isOpen);
 render();
}
// Alle Klicks laufen hier zusammen. Jeder Knopf im HTML trägt data-act="…" (und meist data-id),
// hier steht, was dann passiert. Neuer Knopf = data-act im HTML setzen + hier ein neues case.
document.addEventListener('click', event => {
 if (!$('#modal').hidden || Date.now() < ignoreClicksUntil) return;
 if (event.target.closest('details.chain')) return;
 const viewButton = event.target.closest('[data-view]');
 if (viewButton) {
  // „Übersicht“ öffnet sich so, wie der Schalter „Machbar“ zuletzt stand
  state.view = viewButton.dataset.view === 'heute' ? 'heute' : (state.machbar ? 'jetzt' : 'baum');
  save();
  render();
  return;
 }
 const button = event.target.closest('[data-act]');
 if (!button) return;
 const id = button.dataset.id;
 if (button.closest('.ctxmenu')) closeKatMenu();
 switch (button.dataset.act) {
  case 'check': toggleDone(id); break;
  case 'block': askBefore(id); break;
  case 'today': toggleToday(id, button); break;
  case 'del': deleteWithUndo(id); break;
  case 'add': addTask(); break;
  case 'addsub': addTask({ parent: id, mode: 'sub' }); break;
  case 'edit': editTask(id); break;
  case 'rename': startRename(button); break;
  case 'lcheck': toggleListItem(id, button.dataset.i); break;
  case 'ldel': deleteListItem(id, button.dataset.i); break;
  case 'lren': startItemEdit(button); break;
  case 'ins': case 'insroot': startInsert(button); break;
  case 'inbox': sortInbox(); break;
  case 'menu': settingsDialog(); break;
  case 'machbar': setMachbar(state.view !== 'jetzt'); break;
  case 'gocol': goToColumn(+button.dataset.i, true); break;
  case 'colstep':
   if (swallowArrowClick) { swallowArrowClick = false; break; }
   stepColumn(+button.dataset.d, button);
   break;
  case 'qstep':
   if (swallowArrowClick) { swallowArrowClick = false; break; }
   quickStep(+button.dataset.d);
   break;
  case 'qmore': setQuickOpen(!quickOpen); break;
  case 'qadd': quickAdd(); break;
  case 'qfull': {
   const text = $('#qin').value.trim();
   const place = quickTargetPlace();
   $('#qin').value = '';
   setQuickOpen(false);
   newTaskDialog(text, place);
   break;
  }
  case 'catcolor': openColorMenu(button); break;
  case 'setcolor': setBereichColor(id, button.dataset.color); break;
  case 'catname': startBereichRename(id); break;
  case 'catdel': deleteBereichFromHead(id); break;
  case 'eye': toggleKategorieHidden(id, button.dataset.s); break;
  case 'newcat': bereichDialog(); break;
  case 'editcat': bereichDialog(id); break;
  case 'opencat': editingBereichName = null; toggleBereich(button.dataset.cat); break;
  case 'newsub': kategorieDialog(id); break;
  case 'editsub': kategorieDialog(id, button.dataset.s); break;
  case 'move': case 'mgrip': moveMenu(id); break;
  case 'tozeit': moveTo(id, { bl: false }); break;
  case 'tog': toggleTreeBranch(button.dataset.k, +button.dataset.l); break;
 }
});
// Tastatur: Enter/Leertaste auf Titeln bearbeitet, Pfeiltasten wechseln die Kategorie
document.addEventListener('keydown', event => {
 if (!$('#modal').hidden) return;
 if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.t[data-act="rename"]')) {
  event.preventDefault();
  startRename(event.target);
  return;
 }
 if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.eye[data-act="eye"]')) {
  event.preventDefault();
  event.stopPropagation();
  toggleKategorieHidden(event.target.dataset.id, event.target.dataset.s);
  return;
 }
 if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.lt[data-act="lren"]')) {
  event.preventDefault();
  startItemEdit(event.target);
  return;
 }
 if (event.target.matches('.tab[data-i]') && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
  const count = columnsOf(visibleBereiche().find(b => b.id === state.openCat)).length;
  goToColumn((currentColumn + (event.key === 'ArrowRight' ? 1 : count - 1)) % count);
  document.querySelector(`.tab[data-i="${currentColumn}"]`)?.focus();
 }
});
// Name der Liste oben
$('#name').addEventListener('change', event => {
 state.name = event.target.value.trim() || 'Meine Liste';
 save();
 render();
});
$('#name').addEventListener('keydown', event => { if (event.key === 'Enter') event.target.blur(); });

/* ---------- Start: Daten laden, ggf. neuen Tag beginnen, anzeigen ---------- */
state = load();
const hadOpenToday = startNewDayIfNeeded();
render();
armExitGuard();
if (hadOpenToday) toast('Guten Morgen. „Heute“ ist wieder leer – Offenes steht weiter in der Übersicht.');
// Beim Zurückkehren zur App (z. B. am nächsten Morgen) prüfen, ob ein neuer Tag begonnen hat
document.addEventListener('visibilitychange', () => {
 if (document.visibilityState === 'visible' && startNewDayIfNeeded()) {
  render();
  toast('Neuer Tag. „Heute“ ist wieder leer.');
 }
});
// Offline-Betrieb und Updates: Der Service Worker legt alle Dateien der App lokal ab. Er greift nur über http(s), nicht bei file://.
// Updates: Beim Start und jedes Mal, wenn die App wieder in den Vordergrund kommt, fragt sie nach einer neuen Fassung.
// Ist eine da, lädt sich die App einmal neu. Die Liste bleibt dabei erhalten, denn sie liegt im localStorage
// und ist schon gespeichert (save() nach jeder Änderung). Ist gerade ein Popup offen (oder wird gezogen), wartet das Neuladen,
// bis die App das nächste Mal im Hintergrund ist, damit nichts Halbgetipptes verloren geht.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
 const UPDATE_FLAG = 'powerliste-update-geladen';
 const hadController = !!navigator.serviceWorker.controller;
 let reloadPending = false;
 let reloading = false;
 const reloadNow = () => {
  if (reloading) return;
  reloading = true;
  // Ein gerade bearbeitetes Textfeld zuerst verlassen: Das speichert den Text (blur → save).
  try { document.activeElement?.blur?.(); } catch (e) {}
  try { sessionStorage.setItem(UPDATE_FLAG, '1'); } catch (e) {}
  location.reload();
 };
 navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (!hadController) return; // allererste Installation: nichts neu zu laden
  const typing = document.activeElement && document.activeElement.matches('input:not([type=checkbox]),textarea,select,[contenteditable]');
  const busy = !$('#modal').hidden || document.querySelector('.dragging') || typing;
  if (busy) reloadPending = true;
  else reloadNow();
 });
 document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && reloadPending) reloadNow();
 });
 navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(registration => {
  document.addEventListener('visibilitychange', () => {
   if (document.visibilityState === 'visible') registration.update().catch(() => {});
  });
 }).catch(() => {});
 try {
  if (sessionStorage.getItem(UPDATE_FLAG)) {
   sessionStorage.removeItem(UPDATE_FLAG);
   if (!hadOpenToday) toast(`Neue Version ${APP_VERSION} geladen. Deine Liste ist unverändert.`);
  }
 } catch (e) {}
 // Den Browser bitten, die gespeicherte Liste nicht bei Platzmangel von selbst zu löschen.
 navigator.storage?.persist?.().catch(() => {});
}
}
