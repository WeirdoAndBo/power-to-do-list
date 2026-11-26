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
     state.view           = 'heute' (Tab Heute), 'jetzt' (Tab Machbar), 'baum' (Tab Übersicht)
     state.openCat        = ID des aufgeklappten Bereichs

   Aufbau der Datei (Abschnitte mit „----------“ markiert):
     Einstellungen → Hilfen → Laden/Speichern → Datenlogik → Ort (Bereich/Kategorie)
     → Ansichten → Seite aufbauen → Fokusmodus → Popup & Hinweis → Vorher-Liste im Popup
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
const APP_VERSION = '1.0.8';
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
let focusId = null;             // To-Do, das gerade im Fokusmodus offen ist
let lastRenderedBereich;        // welcher Bereich beim letzten render() offen war
let ignoreClicksUntil = 0;      // Zeitpunkt, bis zu dem Klicks ignoriert werden (direkt nach dem Ziehen)
const treeOpen = new Map();     // auf-/zugeklappte Äste in der Übersicht
const openBacklogs = new Set(); // aufgeklappte Backlog-Kästen
const openChains = new Set();   // aufgeklappte Ziel-Ketten auf Karten

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
     subs: [{ id: 'verw', name: 'Verwaltung' }, { id: 'akq', name: 'Akquise & Marketing' }, { id: 'daily', name: 'Daily business' }] },
   { id: 'privat', name: 'Privat', color: '#e0a03a',
     subs: [{ id: 'hobso', name: 'Hobby & Sozial' }, { id: 'alltag', name: 'Alltag & Lebensorga' }, { id: 'proj', name: 'Projekte' }] }
  ],
  openCat: 'arbeit',
  view: 'jetzt',
  inbox: [],
  anim,
  day: dayStart(),
  format: FORMAT
 };
}
// Bringt gespeicherte oder importierte Daten auf das aktuelle Format.
// Daten ohne Formatnummer stammen aus dem Prototyp (= Format 1).
function migrate(data) {
 data.inbox = data.inbox || [];
 data.cats.forEach(bereich => { bereich.subs = bereich.subs || []; });
 if (data.openCat === undefined) data.openCat = data.cats[0] ? data.cats[0].id : null;
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
 state.tasks[task.id] = task;
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
 const firstKategorie = bereich.subs[0].id;
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
 if (bereich && bereich.subs && bereich.subs.length) return bereich.subs;
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
function placeName(bereichId, kategorieId) {
 const bereich = getBereich(bereichId);
 if (!bereich) return 'Ohne Bereich';
 const kategorie = bereich.subs.find(k => k.id === kategorieId);
 return bereich.name + (kategorie ? ' · ' + kategorie.name : '');
}
// Der gerade sichtbare Ort, als Vorbelegung für „Neues To-Do“
function currentPlace() {
 const bereichId = state.openCat ?? (state.cats[0] ? state.cats[0].id : '');
 const bereich = getBereich(bereichId);
 const kategorie = bereich && bereich.subs.length
  ? bereich.subs[Math.min(currentColumn, bereich.subs.length - 1)]
  : null;
 return (bereichId || '') + '|' + (kategorie ? kategorie.id : '');
}
// Farbe eines To-Dos = Farbe seines Bereichs (grau ohne Bereich)
function colorOf(task) {
 const bereich = getBereich(bereicheOf(task)[0]);
 return bereich ? bereich.color : GRAY;
}
// Text unter dem Titel: „Das ist ein Ziel“ oder „Ziel: …“ (schon HTML-sicher)
function goalHint(task) {
 const goals = goalsOf(task.id);
 if (task.goal) return 'Das ist ein Ziel';
 return goals.length ? 'Ziel: ' + goals.map(goal => esc(goal.t)).join(' · ') : '';
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
 return bereich.subs.map(k => `<option value="${k.id}"${k.id === selectedId ? ' selected' : ''}>${esc(k.name)}</option>`).join('');
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
// Karte. options.grip = Griff zum Sortieren (in „Heute“), options.move = Griff und Menü zum Verschieben (in „Machbar“).
// Aufbau: Kopf mit Griff, Heute-Schalter, Bearbeiten/Verschieben/Löschen.
// Darunter Häkchen + Titel, Ziel-Kette, „Erst noch: …“ und unten der Knopf „+ Vorher-To-Do“.
function cardHtml(task, color, options = {}) {
 const title = esc(task.t);
 let grip = '';
 if (options.grip) {
  grip = `<button class="cgrip" data-act="grip" data-id="${task.id}" aria-label="${title} verschieben (Pfeiltasten hoch/runter)"`
   + ` title="Ziehen, um die Reihenfolge zu ändern">${ICON_GRIP}</button>`;
 } else if (options.move) {
  grip = `<button class="cgrip mgrip" data-act="mgrip" data-id="${task.id}" aria-label="${title} verschieben"`
   + ` title="Ziehen: ins Backlog, in eine andere Kategorie oder einen anderen Bereich">${ICON_GRIP}</button>`;
 }
 const moveButton = options.move
  ? `<button class="hbtn" data-act="move" data-id="${task.id}" aria-label="${title}: Backlog oder verschieben" title="Backlog / Verschieben nach …">${ICON_DOTS}</button>`
  : '';
 const waiting = openNeeds(task);
 const waitingHtml = waiting.length
  ? `<p class="wait">Erst noch: ${waiting.map(id => esc(getTask(id).t)).join(', ')}</p>`
  : '';
 return `<article class="card" data-act="focus" data-id="${task.id}"${options.move ? ' data-sort' : ''} style="--c:${color}" tabindex="0" aria-label="${title} – im Fokusmodus öffnen">
 <div class="chead">${grip}${todaySwitchHtml(task)}<span class="sp"></span>
  <button class="hbtn" data-act="edit" data-id="${task.id}" aria-label="${title} bearbeiten" title="Bearbeiten">${ICON_PEN}</button>
  ${moveButton}
  <button class="hbtn" data-act="del" data-id="${task.id}" aria-label="${title} löschen" title="Löschen">${ICON_TRASH}</button></div>
 <div class="cbody">${checkButtonHtml(task, color)}<div class="ctext"><h3>${title}</h3>${chainBoxHtml(task)}
 ${waitingHtml}</div></div>
 <button class="ask" data-act="block" data-id="${task.id}"><b aria-hidden="true">+</b> ${task.goal ? 'To-Do' : 'Vorher-To-Do'}</button></article>`;
}
// Kleiner Papierkorb-Knopf für Listenzeilen (Erledigt, Backlog, Heute geschafft, Danach dran, Unter-To-Dos in der Übersicht)
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
 return `<div class="brow" data-id="${task.id}" data-sort style="--c:${color}">`
  + `<span class="grip mgrip" data-id="${task.id}" title="Ziehen: nach Zeitnah, in eine andere Kategorie oder einen anderen Bereich">${ICON_GRIP}</span>`
  + `<button class="t" data-act="edit" data-id="${task.id}">${title}${openBefore ? `<small>mit ${openBefore} Vorher-To-Do${pluralS(openBefore)}</small>` : ''}</button>`
  + `<button class="mini" data-act="tozeit" data-id="${task.id}" title="Nach Zeitnah holen" aria-label="${title} nach Zeitnah holen">↑</button>`
  + `<button class="mini" data-act="move" data-id="${task.id}" aria-label="${title} verschieben" title="Verschieben nach …">${ICON_DOTS}</button>`
  + `${deleteMiniHtml(task)}</div>`;
}
// Tab „Machbar“: eine Kategorie-Spalte mit Zeitnah (nicht gesperrt), Backlog und Erledigt
function machbarColumnHtml(bereich, kategorie) {
 const here = task => isIn(task, bereich.id, kategorie.id);
 const doable = allTasks().filter(t => !t.done && !t.backlog && !openNeeds(t).length && here(t)).sort(byPrio);
 const backlogAll = allTasks().filter(t => !t.done && t.backlog && here(t));
 // Im Backlog nur die „obersten“ zeigen: nicht die, deren Ziel selbst schon im Backlog liegt
 const backlogTop = backlogAll.filter(t => !parentsOf(t.id).some(p => p.backlog && !p.done && here(p))).sort(byPrio);
 const done = allTasks().filter(t => t.done && here(t)).sort((a, b) => b.doneAt - a.doneAt);
 // Ablageziel fürs Ziehen
 const dropTarget = `data-drop="zone" data-cat="${bereich.id}" data-area="${kategorie.id}"`;
 const backlogKey = bereich.id + '|' + kategorie.id;
 const doableHtml = doable.length
  ? doable.map(t => cardHtml(t, bereich.color, { move: true })).join('')
  : `<div class="empty" style="--c:${bereich.color}">Hier ist gerade nichts zu tun.</div>`;
 const backlogHtml = backlogTop.length
  ? backlogTop.map(t => backlogRowHtml(t, bereich.color)).join('')
  : '<p class="bempty">Leer. Zieh To-Dos hierher, die gerade nicht dran sind.</p>';
 // Knopf „+ Neues To-Do“ direkt in der Spalte: legt es in diesem Bereich und dieser Kategorie an
 const addHereHtml = `<button class="coladd" data-act="addhere" data-cat="${bereich.id}" data-area="${kategorie.id}"`
  + ` aria-label="Neues To-Do in ${esc(kategorie.name || bereich.name)}"><span aria-hidden="true">+</span> Neues To-Do</button>`;
 return `<p class="zlabel">Zeitnah</p><div class="list zone" ${dropTarget} data-bl="0">${doableHtml}</div>${addHereHtml}
 <details class="bl zone" ${dropTarget} data-bl="1" data-k="${esc(backlogKey)}"${openBacklogs.has(backlogKey) ? ' open' : ''}>`
  + `<summary>Backlog · ${backlogAll.length}</summary>${backlogHtml}</details>${doneBoxHtml(done, bereich.color)}`;
}
// Tab „Übersicht“: ein Knoten im Baum, ruft sich für seine Vorher-To-Dos selbst auf.
// path = Weg im Baum (für auf/zu), level = Tiefe (0 = Ziel ganz oben), viaSoft = hängt über „hilft nur“ dran,
// parentId = das To-Do darüber in dieser Karte (nur dann gibt es den Griff zum Umsortieren).
// Ein Ziel ganz oben (level 0) ist eine Karte mit Kopf wie in „Machbar“: Griff (ziehen = umsortieren oder
// verschieben), Heute-Schalter, Bearbeiten, Verschieben-Menü, Löschen. Unter-To-Dos haben einen kleinen Papierkorb.
function treeNodeHtml(task, color, path, level, viaSoft, parentId = null) {
 const children = [
  ...task.needs.map(id => [getTask(id), 0]),
  ...task.soft.map(id => [getTask(id), 1])
 ].filter(([child]) => child).sort((a, b) => a[0].done - b[0].done);
 const key = path + '/' + task.id;
 const isOpen = treeOpen.has(key) ? treeOpen.get(key) : level > 0;
 const title = esc(task.t);
 const inBacklog = task.backlog && !task.done;
 const isCard = level === 0;
 let toggle = '<span class="mini"></span>';
 if (children.length) {
  const label = isOpen ? 'Zuklappen' : (level === 0 ? 'Alles aufklappen' : 'Aufklappen');
  const tip = level === 0 ? (isOpen ? 'Alles zuklappen' : 'Alles aufklappen') : '';
  toggle = `<button class="mini chev" data-act="tog" data-k="${esc(key)}" data-l="${level}" aria-expanded="${isOpen}" aria-label="${label}" title="${tip}">${ICON_CHEVRON}</button>`;
 }
 const head = isCard
  ? `<div class="chead">${task.done ? '' : `<button class="cgrip mgrip" data-act="mgrip" data-id="${task.id}" aria-label="${title} verschieben"`
    + ` title="Ziehen: Reihenfolge ändern, ins Backlog, in eine andere Kategorie oder einen anderen Bereich">${ICON_GRIP}</button>`
    + todaySwitchHtml(task)}<span class="sp"></span>`
   + `<button class="hbtn" data-act="edit" data-id="${task.id}" aria-label="${title} bearbeiten" title="Bearbeiten">${ICON_PEN}</button>`
   + `<button class="hbtn" data-act="move" data-id="${task.id}" aria-label="${title}: Backlog oder verschieben" title="Backlog / Verschieben nach …">${ICON_DOTS}</button>`
   + `<button class="hbtn" data-act="del" data-id="${task.id}" aria-label="${title} löschen" title="Löschen">${ICON_TRASH}</button></div>`
  : '';
 const grip = parentId
  ? `<button class="cgrip tgrip" aria-label="${title} umsortieren (Pfeiltasten: hoch/runter = Reihenfolge, rechts/links = Ebene)"`
   + ` title="Ziehen: hoch/runter = Reihenfolge, nach rechts = kommt vor das To-Do darüber">${ICON_GRIP}</button>`
  : '';
 // Knöpfe rechts als Gruppe (.racts): Wird es eng, rutschen sie unter den Titel, statt ihn zu quetschen.
 const row = `<div class="row${task.done ? ' isdone' : ''}${inBacklog ? ' inbl' : ''}">${grip}${checkButtonHtml(task, color)}`
  + `<button class="t" data-act="edit" data-id="${task.id}">${title}${inBacklog ? ' <span class="tag bl" title="Liegt im Backlog">Backlog</span>' : ''}</button>`
  + `<span class="racts">${viaSoft ? '<span class="tag">hilft</span>' : ''}`
  + `${task.done || isCard ? '' : todaySwitchHtml(task, 1)}`
  + `<button class="mini" data-act="addsub" data-id="${task.id}" aria-label="Vorher-To-Do für ${title} hinzufügen" title="Hier etwas davor einfügen">+</button>`
  + `${isCard ? '' : deleteMiniHtml(task)}${toggle}</span></div>`;
 const progressBar = level === 0 && !task.done
  ? `<div class="pbar" aria-hidden="true"><i style="width:${progress(task)}%"></i></div>`
  : '';
 const childList = children.length && isOpen
  ? `<ul>${children.map(([child, soft]) => treeNodeHtml(child, color, key, level + 1, soft, task.id)).join('')}</ul>`
  : '';
 return `<li data-tid="${task.id}" data-k="${esc(key)}" data-l="${level}"${isCard ? ` data-sort data-id="${task.id}"` : ''} style="--c:${color}">${head}${row}
 ${progressBar}
 ${childList}</li>`;
}
// Tab „Übersicht“: eine Kategorie-Spalte mit den Zielen als Wurzeln
function uebersichtColumnHtml(bereich, kategorie) {
 const inThisBereich = t => bereich.id ? t.cat === bereich.id : !t.cat || !getBereich(t.cat);
 const roots = allTasks().filter(t => (t.goal || !parentsOf(t.id).length) && inThisBereich(t)
  && (!kategorie.id || kategorieIn(t, bereich.id) === kategorie.id));
 const soon = roots.filter(t => !t.done && !t.backlog).sort(byPrio);
 const backlog = roots.filter(t => !t.done && t.backlog).sort(byPrio);
 const done = roots.filter(t => t.done);
 const nodes = (tasks, level) => tasks.map(t => treeNodeHtml(t, bereich.color, bereich.id, level)).join('');
 const emptyText = backlog.length ? 'Gerade nichts zeitnah.' : `Noch kein Ziel in ${esc(kategorie.name || bereich.name)}.`;
 // Ablageziele fürs Ziehen von Ziel-Karten (wie in „Machbar“). Der Backlog ist auch leer da, aber nur beim Ziehen sichtbar.
 const dropTarget = `data-drop="zone" data-cat="${bereich.id}" data-area="${kategorie.id}"`;
 const soonHtml = soon.length
  ? `<ul class="tree">${nodes(soon, 0)}</ul>`
  : `<div class="empty" style="--c:${bereich.color}">${emptyText}</div>`;
 const backlogHtml = `<div class="zone tzone${backlog.length ? '' : ' isempty'}" ${dropTarget} data-bl="1">`
  + `<p class="zlabel blhead">Backlog · ${backlog.length}</p>`
  + (backlog.length ? `<ul class="tree bltree">${nodes(backlog, 0)}</ul>` : '<p class="bempty">Hierher ziehen = ins Backlog.</p>') + '</div>';
 const doneHtml = done.length
  ? `<details class="done"><summary>Erreichte Ziele · ${done.length}</summary><ul class="tree">${nodes(done, 1)}</ul></details>`
  : '';
 return `<p class="zlabel">Zeitnah</p><div class="zone tzone" ${dropTarget} data-bl="0">${soonHtml}</div>
 ${backlogHtml}${doneHtml}`;
}
// Tab „Heute“: freie To-Dos (ziehbar), „Danach dran“ (noch gesperrt) und „Heute geschafft“
function heuteViewHtml() {
 const byTodayOrder = (a, b) => (a.todayOrder ?? 1e12) - (b.todayOrder ?? 1e12) || byPrio(a, b);
 const free = allTasks().filter(t => t.today && !t.done && !openNeeds(t).length).sort(byTodayOrder);
 const waiting = allTasks().filter(t => t.today && !t.done && openNeeds(t).length).sort(byPrio);
 const doneToday = allTasks().filter(t => t.today && t.done && t.doneAt >= dayStart()).sort((a, b) => b.doneAt - a.doneAt);
 const date = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
 const emptyText = waiting.length ? 'Gerade ist nichts frei.' : 'Noch nichts für heute.<br>Hake in „Machbar“ bei einer Karte „Heute“ an.';
 const freeHtml = free.length
  ? free.map(t => cardHtml(t, colorOf(t), { grip: true })).join('')
  : `<div class="empty">${emptyText}</div>`;
 const waitingHtml = waiting.length
  ? `<details class="done"><summary>Danach dran · ${waiting.length}</summary>`
   + waiting.map(t => `<div class="drow wrow"><span>${esc(t.t)}<small>erst: ${openNeeds(t).map(id => esc(getTask(id).t)).join(', ')}</small></span>${deleteMiniHtml(t)}</div>`).join('')
   + '</details>'
  : '';
 const doneHtml = doneToday.length
  ? `<details class="done"><summary>Heute geschafft · ${doneToday.length}</summary>`
   + doneToday.map(t => `<div class="drow">${checkButtonHtml(t, colorOf(t))}<span>${esc(t.t)}</span>${deleteMiniHtml(t)}</div>`).join('')
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
 return `${soon} zeitnah${inBacklog ? ` · ${inBacklog} im Backlog` : ''}`;
}
// Bereich zugeklappt: eine Leiste
function bereichBarHtml(bereich) {
 return `<button class="catbar" data-act="opencat" data-cat="${bereich.id}" data-drop="cat" style="--c:${bereich.color}" aria-expanded="false">`
  + `<b>${esc(bereich.name)}</b><small>${bereichCountsText(bereich)}</small>${ICON_CHEVRON}</button>`;
}
// Bereich aufgeklappt: Kopf, Kategorie-Navigation (kleine Knöpfe) und die Spalten nebeneinander
function bereichOpenHtml(bereich) {
 const name = esc(bereich.name);
 const editButton = bereich.id
  ? `<button class="iconbtn" data-act="editcat" data-id="${bereich.id}" aria-label="Bereich ${name} bearbeiten">${ICON_PEN}</button>`
  : '';
 const head = `<div class="cathead"><button class="ct" data-act="opencat" data-cat="${bereich.id}" aria-expanded="true" title="Zuklappen">`
  + `<i></i>${name} <small>${bereichCountsText(bereich)}</small>${ICON_CHEVRON}</button>${editButton}</div>`;
 const tabs = bereich.id
  ? `<nav class="subtabs" aria-label="Kategorien von ${name}">`
   + bereich.subs.map((k, i) => `<button class="tab" data-act="gocol" data-i="${i}" data-drop="zone" data-cat="${bereich.id}" data-area="${k.id}"`
    + ` style="--c:${bereich.color}" aria-current="${i === currentColumn}"><i></i>${esc(k.name)}</button>`).join('')
   + `<button class="tab new" data-act="newsub" data-id="${bereich.id}">+ Kategorie</button></nav>`
  : '';
 const columns = columnsOf(bereich).map(kategorie => {
  // Griff zum Umsortieren der Spalten, nur wenn es mehr als eine Kategorie gibt
  const columnGrip = bereich.subs.length > 1
   ? `<button class="colgrip" data-cat="${bereich.id}" data-s="${kategorie.id}" aria-label="Kategorie ${esc(kategorie.name)} verschieben, mit Pfeil links oder rechts"`
    + ` title="Ziehen, um die Reihenfolge zu ändern">${ICON_GRIP}</button>`
   : '';
  const columnHead = bereich.subs.length
   ? `<div class="colhead">${columnGrip}<h2>${esc(kategorie.name)}</h2><button class="iconbtn" data-act="editsub" data-id="${bereich.id}" data-s="${kategorie.id}"`
    + ` aria-label="Kategorie ${esc(kategorie.name)} bearbeiten">${ICON_PEN}</button></div>`
   : '';
  const content = state.view === 'baum' ? uebersichtColumnHtml(bereich, kategorie) : machbarColumnHtml(bereich, kategorie);
  return `<section class="col" aria-label="${esc(kategorie.name)}">${columnHead}${content}</section>`;
 }).join('');
 return `<section class="cat open" style="--c:${bereich.color}" aria-label="${name}">
 ${head}
 ${tabs}
 <div class="cols" id="cols">${columns}</div></section>`;
}

/* ---------- Seite aufbauen ---------- */
// Baut die ganze Seite aus state neu auf. Nach jeder Änderung an state aufrufen (nach save()).
function render() {
 document.body.classList.toggle('noanim', !state.anim);
 const nameField = $('#name');
 if (document.activeElement !== nameField) nameField.value = state.name;
 document.title = state.name || 'Meine Liste';
 document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === state.view));
 $('#inboxSlot').innerHTML = state.inbox.length
  ? `<button class="inbox" data-act="inbox">Später einsortieren · <b>${state.inbox.length}</b></button>`
  : '';
 if (state.view === 'heute') {
  $('#acc').innerHTML = heuteViewHtml();
  lastRenderedBereich = undefined;
  if (!$('#focus').hidden) renderFocus();
  return;
 }
 // Machbar oder Übersicht: Bereiche untereinander, einer davon aufgeklappt
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
 if (!$('#focus').hidden) renderFocus();
}
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

/* ---------- Fokusmodus ---------- */
function openFocus(id) {
 focusId = id;
 $('#focus').hidden = false;
 document.body.style.overflow = 'hidden';
 renderFocus();
 setTimeout(() => $('#focus .bigcheck .check')?.focus(), 30);
}
function closeFocus() {
 $('#focus').hidden = true;
 document.body.style.overflow = '';
 focusId = null;
 render();
}
function renderFocus() {
 const task = getTask(focusId);
 if (!task) { closeFocus(); return; }
 const color = colorOf(task);
 const before = openNeeds(task).map(getTask);
 const focusEl = $('#focus');
 focusEl.style.setProperty('--c', color);
 const hint = goalHint(task);
 const beforeHtml = before.length
  ? `<div class="before"><p>Vorher noch:</p>${before.map(t => `<div class="drow">${checkButtonHtml(t, color)}<span>${esc(t.t)}</span></div>`).join('')}</div>`
  : '';
 const addButton = task.done
  ? ''
  : `<button class="softbtn" data-act="block" data-id="${task.id}">${task.goal ? '+ To-Do' : '+ Vorher-To-Do'}</button>`;
 focusEl.innerHTML = `<div class="ftop"><small>FOKUSMODUS</small><span class="fbtns">`
  + `<button class="iconbtn" data-act="del" data-id="${task.id}" aria-label="${esc(task.t)} löschen" title="Löschen">${ICON_TRASH}</button>`
  + `<button class="iconbtn" data-act="closefocus" aria-label="Fokusmodus schließen">${ICON_CLOSE}</button></span></div>
 <div class="fmain">${hint ? `<p class="goal">${hint}</p>` : ''}<h1>${esc(task.t)}</h1>
 ${beforeHtml}
 <div class="bigcheck">${checkButtonHtml(task, color)}<span>${task.done ? 'Geschafft' : 'Abhaken, wenn es geschafft ist'}</span></div>
 ${addButton}</div>
 <div class="fbot"><button class="plus" data-act="quick"><span>+</span> Neues To-Do</button></div>`;
}

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
   const vals = readModalValues(modalEl);
   modalEl.hidden = true;
   modalEl.innerHTML = '';
   modalEl.onclick = null;
   document.removeEventListener('keydown', onKeyDown);
   previousFocus?.focus?.();
   resolve({ v: value, vals });
  };
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
document.addEventListener('pointerdown', event => {
 const grip = event.target.closest('#daylist .cgrip');
 if (!grip) return;
 event.preventDefault();
 const cardEl = grip.closest('.card');
 const list = cardEl.parentElement;
 cardEl.classList.add('dragging');
 trackPointer(moveEvent => {
  const target = itemBelow(list.querySelectorAll('.card'), cardEl, moveEvent.clientY);
  if (target) {
   if (target.previousElementSibling !== cardEl) target.before(cardEl);
  } else if (list.lastElementChild !== cardEl) {
   list.append(cardEl);
  }
 }, () => {
  cardEl.classList.remove('dragging');
  saveDayOrder();
  render();
 });
});
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

// 3) Tabs „Machbar“ und „Übersicht“: Karte, Backlog-Zeile oder Ziel-Karte am Griff ziehen.
//    Ablageziele (data-drop im HTML): Zeitnah, Backlog, Knöpfe der Kategorie-Navigation, Bereich-Leisten.
//    In Zeitnah und Backlog zeigt eine farbige Linie, an welcher Stelle es landet (Reihenfolge).
// Sichtbare Einträge eines Ablageziels, die man umsortieren kann (Attribut data-sort)
const sortItemsIn = zone => [...zone.querySelectorAll('[data-sort]')]
 .filter(item => item.closest('[data-drop]') === zone && item.getClientRects().length);
// Setzt prio des To-Dos so, dass es in der Liste `ids` (fertige Reihenfolge von oben nach unten) an seiner Stelle steht.
// Sortiert wird überall nach prio (höher = weiter oben), siehe byPrio.
function placeInOrder(id, ids) {
 const list = ids.map(getTask).filter(Boolean);
 const i = list.findIndex(t => t.id === id);
 if (i < 0 || list.length < 2) return;
 const task = list[i];
 const above = list[i - 1];
 const below = list[i + 1];
 if (above && below && above.prio > below.prio) task.prio = (above.prio + below.prio) / 2;
 else if (!above) task.prio = below.prio + 1;
 else if (!below) task.prio = above.prio - 1;
 else {
  // Gleiche prio darüber und darunter: die ganze Liste neu durchnummerieren
  const top = Math.max(...list.map(t => t.prio));
  list.forEach((t, k) => { t.prio = top + list.length - k; });
 }
}
document.addEventListener('pointerdown', event => {
 const grip = event.target.closest('.mgrip');
 if (!grip || !$('#modal').hidden) return;
 event.preventDefault();
 const id = grip.dataset.id;
 const source = grip.closest('.card,.brow,.tree > li');
 const box = source.getBoundingClientRect();
 // „Geist“: eine Kopie, die dem Zeiger folgt
 const ghost = source.cloneNode(true);
 ghost.classList.add('dragghost');
 Object.assign(ghost.style, { width: box.width + 'px', left: box.left + 'px', top: box.top + 'px', margin: 0 });
 const offsetX = event.clientX - box.left;
 const offsetY = event.clientY - box.top;
 const startX = event.clientX;
 const startY = event.clientY;
 let moved = false;
 let over = null;          // Ablageziel unter dem Zeiger
 let lastEdgeScroll = 0;   // wann zuletzt am Rand zur nächsten Spalte gewischt wurde
 let insertBefore;         // Eintrag, vor dem es landet (null = ans Ende, undefined = keine Stelle)
 const line = document.createElement('div');
 line.className = 'treeline';

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
  // Stelle im Ablageziel: Linie zwischen den Einträgen zeigen
  insertBefore = undefined;
  line.remove();
  if (over && over.dataset.drop === 'zone') {
   const items = sortItemsIn(over).filter(item => item !== source);
   if (items.length) {
    insertBefore = itemBelow(items, source, moveEvent.clientY);
    const zoneBox = over.getBoundingClientRect();
    const y = insertBefore ? insertBefore.getBoundingClientRect().top - 5 : items[items.length - 1].getBoundingClientRect().bottom + 5;
    line.style.setProperty('--c', getComputedStyle(over).getPropertyValue('--c'));
    Object.assign(line.style, { left: zoneBox.left + 8 + 'px', width: zoneBox.width - 16 + 'px', top: y - 1 + 'px' });
    document.body.append(line);
   }
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
 const onUp = async upEvent => {
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
   return;
  }
  // Neue Reihenfolge im Ablageziel merken, bevor sich die Anzeige ändert
  let order = null;
  if (insertBefore !== undefined) {
   const ids = sortItemsIn(over).map(item => item.dataset.id).filter(x => x !== id);
   const at = insertBefore ? ids.indexOf(insertBefore.dataset.id) : ids.length;
   ids.splice(at < 0 ? ids.length : at, 0, id);
   const oldIds = sortItemsIn(over).map(item => item.dataset.id);
   if (ids.join() !== oldIds.join()) order = ids;
  }
  const before = snapshot();
  // Bleibt es in derselben Liste, nur die Reihenfolge ändern. (moveTo würde sonst ein To-Do, das in mehreren
  // Bereichen steht, fest in diesen Bereich legen.)
  const task = getTask(id);
  const bl = drop.bl === undefined ? undefined : drop.bl === '1';
  const samePlace = task && isIn(task, drop.cat, drop.area) && (bl === undefined || bl === !!task.backlog);
  const changed = samePlace ? false : await moveTo(id, { cat: drop.cat, area: drop.area, bl });
  if (changed === null || !order) return;   // abgebrochen oder keine neue Stelle
  placeInOrder(id, order);
  save();
  render();
  if (!changed) {
   undoSnapshot = before;
   toast('Reihenfolge geändert.', true);
  }
 };
 trackPointer(onMove, onUp);
});

// 4) Kategorie-Spalten am Griff im Spaltenkopf ziehen. Eine farbige Kante zeigt, wo die Spalte landet.
//    Erreicht der Zeiger den Rand der Spalten, wird automatisch seitlich gescrollt.
document.addEventListener('pointerdown', event => {
 const grip = event.target.closest && event.target.closest('.colgrip');
 if (!grip || !$('#modal').hidden) return;
 event.preventDefault();
 const cols = $('#cols');
 const source = grip.closest('.col');
 const columns = [...cols.children];
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
});
// Tastatur: Griff im Spaltenkopf fokussieren, Pfeil links/rechts verschiebt die Spalte
document.addEventListener('keydown', event => {
 const grip = event.target.closest && event.target.closest('.colgrip');
 if (!grip || !$('#modal').hidden || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
 event.preventDefault();
 const { cat: bereichId, s: kategorieId } = grip.dataset;
 const bereich = getBereich(bereichId);
 if (!bereich) return;
 const index = bereich.subs.findIndex(k => k.id === kategorieId);
 moveKategorie(bereichId, kategorieId, index + (event.key === 'ArrowRight' ? 1 : -1));
 document.querySelector(`.colgrip[data-cat="${bereichId}"][data-s="${kategorieId}"]`)?.focus({ preventScroll: true });
});

// 5) Tab „Übersicht“: Unter-To-Dos am Griff umsortieren, auch in eine andere Karte derselben Spalte – wie die Vorher-Liste
//    im Popup: hoch/runter = Reihenfolge, nach rechts = kommt vor das To-Do darüber (eine Ebene tiefer),
//    nach links = eine Ebene höher. Eine farbige Linie zeigt, wo und auf welcher Ebene es landet.
// so weit ist eine Ebene im Baum eingerückt (margin + padding von .tree ul, auf dem Handy schmaler)
const treeIndent = () => matchMedia('(max-width:600px)').matches ? 22 : 34;
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
document.addEventListener('pointerdown', event => {
 const grip = event.target.closest && event.target.closest('.tree .tgrip');
 if (!grip || !$('#modal').hidden) return;
 event.preventDefault();
 const li = grip.closest('li');
 const card = li.closest('.tree > li');
 const id = li.dataset.tid;
 const oldParentId = treeParentLi(li).dataset.tid;
 const startLevel = +li.dataset.l;
 // Alle sichtbaren Zeilen aller Karten dieser Spalte (Zeitnah und Backlog), ohne das gezogene To-Do und seinen Unterbaum
 const column = li.closest('.col') || card.parentElement;
 const cards = [...column.querySelectorAll('.tzone .tree > li')];
 if (!cards.includes(card)) cards.splice(0, cards.length, card);
 const rows = cards.flatMap(c => [c, ...c.querySelectorAll('li')])
  .filter(x => x !== li && !li.contains(x))
  .map(x => ({ li: x, level: +x.dataset.l, row: x.querySelector(':scope > .row') }));
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
  drop = treeDropTarget(rows, moveEvent.clientY, wanted);
  const cardBox = (drop.parentLi ? drop.parentLi.closest('.tree > li') : card).getBoundingClientRect();
  const left = cardBox.left + 10 + drop.level * treeIndent();
  Object.assign(line.style, { left: left + 'px', width: Math.max(40, cardBox.right - 10 - left) + 'px', top: drop.lineY - 1 + 'px' });
  if (moveEvent.clientY < 50) scrollBy(0, -14);
  else if (moveEvent.clientY > innerHeight - 50) scrollBy(0, 14);
 }, upEvent => {
  line.remove();
  ghost.remove();
  li.classList.remove('tdrag');
  document.body.classList.remove('treedrag');
  if (!moved) return;
  ignoreClicksUntil = Date.now() + 350;
  if (upEvent.type === 'pointercancel' || !drop || !drop.parentLi) return;
  applyTreeMove(id, oldParentId, drop.parentLi, drop.afterLi ? drop.afterLi.dataset.tid : null);
 });
});
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

/* ---------- Abläufe (Dialoge) ---------- */
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
  if (r.v === 'go') { openFocus(parent.id); break; }
  if (r.v === 'more') await askBefore(parent.id);
 }
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
 const context = parent || (focusId && getTask(focusId) ? focusId : null);
 const candidates = allTasks().filter(t => !t.done);
 const asSub = mode ? mode === 'sub' : !!context;
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
// Schnelles Notieren im Fokusmodus. „Später einsortieren“ landet in state.inbox.
async function quickNote() {
 const r = await modal(`<h2>Neues To-Do</h2><p>Schreib es kurz auf. Danach geht’s hier weiter.</p>
  <input class="field" name="text" placeholder="Was ist dir eingefallen?" autocomplete="off" aria-label="Was ist dir eingefallen?">
  <div class="btns">${buttonHtml('now', 'Direkt einsortieren')}${buttonHtml('later', 'Später einsortieren', 'pri')}</div>`);
 if (!r.v || !r.vals.text) return;
 if (r.v === 'later') {
  undoSnapshot = snapshot();
  state.inbox.push({ id: uid(), t: r.vals.text, ctx: focusId });
  save();
  render();
  toast('Notiert. Weiter geht’s.', true);
  return;
 }
 await addTask({ text: r.vals.text, parent: focusId, mode: 'sub' });
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
   <p>${esc(placeName(...placeOf(task).split('|')))} · ${task.backlog ? 'Backlog' : 'Zeitnah'} <button class="link" data-v="move">Verschieben …</button></p>
   <label class="lbl">Kommt vorher</label>
   ${beforeRows}
   <button class="link" data-v="addk">+ Ein To-Do, das schon da ist, kommt vorher</button>
   ${parentRows}
   <div><button class="link" data-v="addp">+ Zahlt auch auf ein anderes To-Do ein</button></div>
   <div class="btns">${buttonHtml('del', 'Löschen', 'ghost')}${buttonHtml('ok', 'Fertig', 'pri')}</div>`;
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
 const q = await modal(`<h2>${asBefore ? 'Was kommt vorher?' : 'Worauf zahlt es noch ein?'}</h2><p>Auch aus anderen Bereichen.</p>`
  + (choices.length ? `<select class="field" name="o">${taskOptionsHtml(choices)}</select>${kindChoiceHtml()}` : '<p>Gerade passt nichts.</p>')
  + `<div class="btns">${buttonHtml('', 'Zurück', 'ghost')}${choices.length ? buttonHtml('ok', 'Verknüpfen', 'pri') : ''}</div>`);
 if (q.v !== 'ok') return;
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
// Löscht das To-Do und alle Vorher-To-Dos, die danach zu nichts mehr gehören (und keine Ziele sind)
function deleteTask(id) {
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
 if (focusId === id) closeFocus();
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
 if (r.v === 'del') {
  // Die To-Dos bleiben, sie stehen danach unter „Ohne Bereich“ (oder erben vom Ziel)
  undoSnapshot = snapshot();
  state.cats = state.cats.filter(b => b !== bereich);
  if (state.openCat === id) state.openCat = state.cats[0] ? state.cats[0].id : null;
  allTasks().forEach(t => { if (t.cat === id) t.cat = null; });
  save();
  render();
  toast('Bereich gelöscht. Die To-Dos sind noch da.', true);
  return;
 }
 if (r.v !== 'ok' || !r.vals.name) return;
 undoSnapshot = snapshot();
 if (bereich) {
  bereich.name = r.vals.name;
  bereich.color = r.vals.color;
 } else {
  const created = { id: uid(), name: r.vals.name, color: r.vals.color, subs: [] };
  state.cats.push(created);
  state.openCat = created.id;
  currentColumn = 0;
 }
 save();
 render();
}
// Kategorie anlegen (ohne kategorieId) oder umbenennen/löschen
async function kategorieDialog(bereichId, kategorieId) {
 const bereich = getBereich(bereichId);
 if (!bereich) return;
 const kategorie = kategorieId ? bereich.subs.find(k => k.id === kategorieId) : null;
 const firstHint = !kategorie && !bereich.subs.length && allTasks().some(t => isIn(t, bereichId))
  ? `<p class="prehint">Was schon in ${esc(bereich.name)} liegt, kommt erst mal in diese erste Kategorie.</p>`
  : '';
 // Knöpfe „← Nach links“ / „Nach rechts →“ (nicht am Rand)
 const orderButtons = kategorie && bereich.subs.length > 1
  ? `<div class="subpos"><span class="lbl">Reihenfolge</span>${bereich.subs[0] !== kategorie ? buttonHtml('left', '← Nach links') : ''}`
   + `${bereich.subs.at(-1) !== kategorie ? buttonHtml('right', 'Nach rechts →') : ''}</div>`
  : '';
 const r = await modal(`<h2>${kategorie ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h2><p>in ${esc(bereich.name)}</p>
  <input class="field" name="name" value="${esc(kategorie ? kategorie.name : '')}" placeholder="z. B. Akquise" autocomplete="off" aria-label="Name">
  ${firstHint}
  ${orderButtons}
  <div class="btns">${kategorie ? buttonHtml('del', 'Löschen', 'ghost') : buttonHtml('', 'Abbrechen', 'ghost')}${buttonHtml('ok', kategorie ? 'Fertig' : 'Anlegen', 'pri')}</div>`);
 if (r.v === 'left' || r.v === 'right') {
  // Umsortieren; ein geänderter Name wird dabei mit übernommen
  undoSnapshot = snapshot();
  if (r.vals.name) kategorie.name = r.vals.name;
  moveKategorie(bereichId, kategorieId, bereich.subs.indexOf(kategorie) + (r.v === 'right' ? 1 : -1), true);
  return;
 }
 if (r.v === 'del') {
  undoSnapshot = snapshot();
  const index = bereich.subs.indexOf(kategorie);
  bereich.subs.splice(index, 1);
  allTasks().forEach(t => { if (t.area === kategorieId) t.area = null; });
  currentColumn = Math.max(0, index - 1);
  save();
  render();
  toast(`Kategorie gelöscht. Die To-Dos liegen jetzt in ${esc(bereich.subs[0] ? bereich.subs[0].name : bereich.name)}.`, true);
  return;
 }
 if (r.v !== 'ok' || !r.vals.name) return;
 undoSnapshot = snapshot();
 if (kategorie) {
  kategorie.name = r.vals.name;
 } else {
  bereich.subs.push({ id: uid(), name: r.vals.name });
  currentColumn = bereich.subs.length - 1;
  state.openCat = bereichId;
 }
 save();
 render();
 if (!kategorie) goToColumn(currentColumn);
}
// Setzt eine Kategorie an Stelle `to` (0 = ganz links). Die Reihenfolge der Spalten ist einfach die
// Reihenfolge in bereich.subs und wird damit gespeichert und in der Sicherung mitgenommen.
// hasSnapshot = true: undoSnapshot wurde schon gesetzt (aus dem Popup), dann auch ohne Bewegung speichern.
function moveKategorie(bereichId, kategorieId, to, hasSnapshot) {
 const bereich = getBereich(bereichId);
 if (!bereich) return;
 const from = bereich.subs.findIndex(k => k.id === kategorieId);
 to = Math.max(0, Math.min(to, bereich.subs.length - 1));
 if (from < 0 || (from === to && !hasSnapshot)) return;
 if (!hasSnapshot) undoSnapshot = snapshot();
 const [kategorie] = bereich.subs.splice(from, 1);
 bereich.subs.splice(to, 0, kategorie);
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
// Gibt true zurück, wenn sich etwas geändert hat, false wenn nicht, null bei „Abbrechen“.
async function moveTo(id, { cat, area, bl }) {
 const task = getTask(id);
 if (!task) return null;
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
   messages.push(ids.length > 1 ? `ist mit ${ids.length - 1} Vorher-To-Do${ids.length > 2 ? 's' : ''} zurück in Zeitnah` : 'ist zurück in Zeitnah');
  }
 }
 if (!messages.length) return false;
 undoSnapshot = before;
 save();
 render();
 toast(`„${esc(task.t)}“ ${messages.join(' und ')}.`, true);
 return true;
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
  <div class="seg" role="radiogroup" aria-label="Zeitnah oder Backlog"><label><input type="radio" name="bl" value="0"${task.backlog ? '' : ' checked'}>Zeitnah</label><label><input type="radio" name="bl" value="1"${task.backlog ? ' checked' : ''}>Backlog</label></div>
  ${placePickerHtml(placeOf(task))}
  <div class="btns">${buttonHtml('', 'Abbrechen', 'ghost')}${buttonHtml('ok', 'Fertig', 'pri')}</div>`);
 if (r.v !== 'ok') return;
 const [cat, area] = r.vals.place.split('|');
 await moveTo(id, { cat, area, bl: r.vals.bl === '1' });
}
// Einstellungen (Knopf ··· oben rechts)
async function settingsDialog() {
 const r = await modal(`<h2>Einstellungen</h2><label class="opt"><input type="checkbox" name="anim"${state.anim ? ' checked' : ''}> Sanfte Animationen</label>
  <p>Version B: Bereiche übereinander, Kategorien zum Wischen, Zeitnah und Backlog. Alles bleibt nur auf diesem Gerät.</p>
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
  && isOptionalId(task.cat) && isOptionalId(task.area) && isOptionalId(task.todayBy);
}
function isValidBereich(bereich) {
 const validKategorien = bereich.subs == null
  || (Array.isArray(bereich.subs) && bereich.subs.every(k => k && ID_PATTERN.test(k.id) && typeof k.name === 'string'));
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
 if (details.matches('details.bl')) {
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
  toast(`Mit ${count} Vorher-To-Do${pluralS(count)} in „Heute“.` + (wasInBacklog ? ' Aus dem Backlog nach Zeitnah geholt.' : ''));
 } else if (wasInBacklog && task.today) {
  toast('In „Heute“ und aus dem Backlog nach Zeitnah geholt.');
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
  state.view = viewButton.dataset.view;
  save();
  render();
  return;
 }
 const button = event.target.closest('[data-act]');
 if (!button) return;
 const id = button.dataset.id;
 switch (button.dataset.act) {
  case 'check': toggleDone(id); break;
  case 'block': askBefore(id); break;
  case 'today': toggleToday(id, button); break;
  case 'del': deleteWithUndo(id); break;
  case 'focus': openFocus(id); break;
  case 'closefocus': closeFocus(); break;
  case 'add': addTask(); break;
  case 'addsub': addTask({ parent: id, mode: 'sub' }); break;
  case 'addhere': addTask({ mode: 'goal', place: button.dataset.cat + '|' + button.dataset.area }); break;
  case 'quick': quickNote(); break;
  case 'edit': editTask(id); break;
  case 'inbox': sortInbox(); break;
  case 'menu': settingsDialog(); break;
  case 'gocol': goToColumn(+button.dataset.i, true); break;
  case 'newcat': bereichDialog(); break;
  case 'editcat': bereichDialog(id); break;
  case 'opencat': toggleBereich(button.dataset.cat); break;
  case 'newsub': kategorieDialog(id); break;
  case 'editsub': kategorieDialog(id, button.dataset.s); break;
  case 'move': case 'mgrip': moveMenu(id); break;
  case 'tozeit': moveTo(id, { bl: false }); break;
  case 'tog': toggleTreeBranch(button.dataset.k, +button.dataset.l); break;
 }
});
// Tastatur: Escape schließt den Fokusmodus, Enter öffnet eine Karte, Pfeiltasten wechseln die Kategorie
document.addEventListener('keydown', event => {
 if (!$('#modal').hidden) return;
 if (event.key === 'Escape' && !$('#focus').hidden) closeFocus();
 if (event.key === 'Enter' && event.target.matches('.card')) openFocus(event.target.dataset.id);
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
if (hadOpenToday) toast('Guten Morgen. „Heute“ ist wieder leer – Offenes steht weiter in „Machbar“.');
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
// und ist schon gespeichert (save() nach jeder Änderung). Ist gerade ein Popup oder der Fokusmodus offen (oder wird gezogen), wartet das Neuladen,
// bis die App das nächste Mal im Hintergrund ist, damit nichts Halbgetipptes verloren geht.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
 const UPDATE_FLAG = 'powerliste-update-geladen';
 const hadController = !!navigator.serviceWorker.controller;
 let reloadPending = false;
 let reloading = false;
 const reloadNow = () => {
  if (reloading) return;
  reloading = true;
  try { sessionStorage.setItem(UPDATE_FLAG, '1'); } catch (e) {}
  location.reload();
 };
 navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (!hadController) return; // allererste Installation: nichts neu zu laden
  const busy = !$('#modal').hidden || !$('#focus').hidden || document.querySelector('.dragging');
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
