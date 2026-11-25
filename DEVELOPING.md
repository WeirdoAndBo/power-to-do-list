# Entwickeln an der Power-Liste

Diese Anleitung ist für Menschen, die HTML, CSS und JavaScript können und die App verstehen oder ändern wollen. Für die Bedienung der App siehe [README.md](README.md).

## Auf einen Blick

- Keine Werkzeuge nötig: kein Build, kein npm, keine Bibliotheken. Datei ändern, Browser neu laden, fertig.
- Die ganze Logik steht in **`js/app.js`**, die ganze Gestaltung in **`css/app.css`**.
- Der Zustand der App ist ein einziges Objekt `S`. Jede Änderung folgt demselben Muster:
  **`S` ändern → `save()` → `render()`**.
- Alle Ansichten sind Funktionen, die HTML als Text bauen (Template-Strings mit `` `...${wert}...` ``). Nach jeder Änderung wird die Seite komplett neu gebaut.

## Ordnerstruktur

```
index.html             Grundgerüst: Kopfzeile, Umschalter Heute/Machbar/Übersicht, leere Container
css/app.css            Gestaltung (Farben ganz oben in :root)
js/app.js              Logik, Ansichten, Dialoge, Speichern, Export/Import
sw.js                  Service Worker: legt die Dateien für den Offline-Betrieb ab
manifest.webmanifest   Name, Farben und Icons für die Installation als App
icons/                 App-Icons
archiv/                ältere Prototypen, nur zum Nachschauen, werden von der App nicht geladen
```

`index.html` enthält fast keinen Inhalt. Die Container `#acc` (Hauptbereich), `#focus` (Fokusmodus), `#modal` (Popups) und `#toast` (Hinweis unten) werden von `js/app.js` gefüllt.

## Wörter im Code und in der App

Das ist die wichtigste Stolperfalle: Die Namen im Code passen nicht immer zu den Namen in der App.

| In der App      | Im Code                                    | Beispiel                 |
|-----------------|--------------------------------------------|--------------------------|
| Bereich         | `cat`, `S.cats`, `C(id)`                    | Arbeit, Privat, Hobby    |
| Kategorie       | `subs` (eines Bereichs), `area` (am To-Do) | Akquise, Finanzen        |
| Ziel            | To-Do mit `goal: true`                      | Newsletter starten       |
| Vorher-To-Do „geht sonst nicht“ | `needs`                    | sperrt das To-Do         |
| Vorher-To-Do „würde nur helfen“ | `soft`                     | sperrt nichts            |
| Tab „Machbar“   | Ansicht `'jetzt'`                           |                          |
| Tab „Übersicht“ | Ansicht `'baum'`                            |                          |
| Tab „Heute“     | Ansicht `'heute'`                           |                          |
| Zeitnah / Backlog | `backlog: false` / `backlog: true`        |                          |
| Später einsortieren | `S.inbox`                               |                          |

Achtung: `sub(id)` ist eine Funktion (das To-Do und alle seine Vorher-To-Dos), hat also nichts mit `subs` (Kategorien) zu tun.

## Datenmodell

Alles wird als JSON unter dem Schlüssel `powerliste-b-v1` im `localStorage` des Browsers gespeichert. Die Beispieldaten in `seed()` (Anfang von `js/app.js`) zeigen das Modell am besten.

```js
S = {
  name: 'Meine Power-Liste',        // Titel oben
  tasks: { <id>: To-Do, ... },      // alle To-Dos und Ziele, nach ID
  cats: [                           // Bereiche, in Anzeigereihenfolge
    { id: 'arbeit', name: 'Arbeit', color: '#5b8def',
      subs: [ { id: 'akq', name: 'Akquise' }, ... ] }   // Kategorien
  ],
  inbox: [ { id, t: 'Text', ctx: <To-Do-ID oder null> } ], // „Später einsortieren“
  openCat: 'arbeit',                // welcher Bereich aufgeklappt ist (null = keiner)
  view: 'jetzt',                    // 'heute' | 'jetzt' | 'baum'
  anim: true,                       // sanfte Animationen an/aus
  day: <Zeitstempel>,               // Beginn des aktuellen Tages (4 Uhr morgens)
  format: 1                         // Version des Datenformats
}

To-Do = {
  id, t: 'Titel',
  needs: [ids], soft: [ids],        // Vorher-To-Dos (sperrend / nur hilfreich)
  done: false, doneAt: null,
  goal: false,                      // true = Ziel
  cat: null, area: null,            // eigener Bereich / eigene Kategorie; ohne: vom Ziel geerbt
  prio: 0, created: <Zeitstempel>,  // Sortierung: höhere prio zuerst, dann älteres zuerst
  today: false,                     // steht in „Heute“
  todayBy: null,                    // wurde mit diesem To-Do nach „Heute“ mitgenommen
  todayOrder: 3,                    // Reihenfolge in „Heute“
  backlog: false                    // liegt im Backlog
}
```

Die To-Dos bilden einen Graphen: Ein To-Do kann Vorher-To-Do von mehreren anderen sein. Ein To-Do ist **machbar**, wenn keines seiner `needs` mehr offen ist (`openHard(t)` ist leer).

**„Heute“ und der Tageswechsel:** Ein Tag beginnt um 4 Uhr (`dayStart()`). Beim Öffnen und beim Zurückkehren zur App prüft `newDay()`, ob ein neuer Tag begonnen hat, und setzt dann bei allen To-Dos `today` zurück. Nichts wird gelöscht.

**Datenstruktur ändern:** `FORMAT` in `js/app.js` erhöhen und in `migrate()` ergänzen, wie alte Daten umgebaut werden. Sonst gehen bei bestehenden Nutzer*innen Daten kaputt. Auch `readBackup()` prüft neue Felder, falls sie IDs enthalten.

## Wo steht was in `js/app.js`

Die Datei ist in Abschnitte gegliedert, erkennbar an Kommentaren mit `----------`. Am besten im Editor nach dem Funktionsnamen suchen.

| Was                                    | Funktion(en)                                   |
|----------------------------------------|------------------------------------------------|
| Laden, Speichern, Beispieldaten        | `load`, `save`, `seed`, `migrate`              |
| Wer gehört zu wem (Graph)              | `goalsOf`, `sub`, `parentsAll`, `openHard`, `chains` |
| In welchem Bereich/welcher Kategorie   | `catsOf`, `areaIn`, `inCol`, `placeOf`         |
| Tab „Heute“                            | `viewHeute`, `setToday`, `saveDayOrder`        |
| Tab „Machbar“                          | `colJetzt`, `card`, `brow`                     |
| Tab „Übersicht“                        | `colBaum`, `node`                              |
| Bereiche und Kategorien (Akkordeon)    | `catBar`, `catOpen`, `catDialog`, `subDialog`  |
| Ganze Seite neu aufbauen               | `render`                                       |
| Fokusmodus                             | `openFocus`, `renderFocus`, `closeFocus`       |
| Popup und Hinweis unten                | `modal`, `btn`, `toast`                        |
| Abhaken                                | `check`                                        |
| Neues To-Do / Ziel                     | `addTask`, `quick`, `blocker`, `createPre`     |
| Bearbeiten, Löschen                    | `edit`, `del`, `delAsk`                        |
| Verschieben, Backlog                   | `moveTo`, `moveMenu`, Ziehen am Griff (`.mgrip`) |
| Einstellungen                          | `menu`                                         |
| Sicherung speichern/laden              | `exportData`, `readBackup`, `importFile`       |
| Was ein Klick auslöst                  | großer `switch` im Abschnitt „Ereignisse“      |

**Wie ein Knopf funktioniert:** Knöpfe haben im HTML `data-act="…"` und meist `data-id="<To-Do-ID>"`. Ein einziger Klick-Listener im Abschnitt „Ereignisse“ liest das aus und ruft die passende Funktion auf. Für einen neuen Knopf: im HTML `data-act="meinknopf"` setzen und im `switch` ein `case'meinknopf':` ergänzen.

**Wie ein Popup funktioniert:** `modal(html)` gibt ein Promise zurück. Mit `await` wartet man, bis es geschlossen wird, und bekommt `{v, vals}`: `v` ist der `data-v`-Wert des gedrückten Knopfs, `vals` enthält alle Felder mit `name="…"`.

```js
const r = await modal(`<h2>Titel</h2><input class="field" name="text">
  <div class="btns">${btn('', 'Abbrechen', 'ghost')}${btn('ok', 'Fertig', 'pri')}</div>`);
if (r.v === 'ok') { /* r.vals.text benutzen */ }
```

**Rückgängig:** Vor einer Änderung `undoSnap = snap()` setzen, danach `toast('Text', true)` aufrufen. Der Knopf „Rückgängig“ stellt dann den alten Stand her.

**Sicherheit:** Texte, die Nutzer*innen eingeben, immer mit `esc(...)` ins HTML einsetzen, nie direkt.

## Was ändere ich wo?

- **Farben, Schrift, Schatten:** `css/app.css`, Variablen in `:root` ganz oben. `light-dark(hell, dunkel)` setzt die Farbe für hellen und dunklen Modus.
- **Farbauswahl für Bereiche:** `COLORS` am Anfang von `js/app.js`.
- **Farbe der App beim Installieren:** `theme_color` und `background_color` in `manifest.webmanifest` sowie `theme-color` in `index.html`.
- **Texte in der App:** stehen direkt im HTML-Text der jeweiligen Funktion in `js/app.js`. Am einfachsten im Editor nach dem sichtbaren Text suchen, z. B. „Cool, geschafft!“.
- **Beispieldaten:** `seed()` in `js/app.js`. Wirkt nur bei neuem Browser oder über Einstellungen → „Beispiel wiederherstellen“.
- **Wann ein Tag beginnt (4 Uhr):** `dayStart()` in `js/app.js` (`4*36e5` = 4 Stunden in Millisekunden).

**Wichtig bei CSS:** `css/app.css` ist in Schichten gewachsen. Spätere Abschnitte („Version B“, „Kompakter“, „Kartenkopf + Heute-Schalter“) überschreiben frühere Regeln für dieselben Klassen. Wenn eine Änderung nicht wirkt, steht weiter unten eine spätere Regel für dieselbe Klasse. Im Browser hilft Rechtsklick → „Untersuchen“: Dort sieht man, welche Regel gewinnt und in welcher Zeile sie steht.

## Lokal starten

```
python3 -m http.server 8000
```

im Projektordner ausführen und <http://localhost:8000> öffnen. Nur `index.html` doppelklicken geht auch, dann laufen aber Service Worker und Installation nicht.

Tipp: Beim Entwickeln in den Entwicklertools des Browsers unter „Anwendung“ bzw. „Application“ → „Service Workers“ den Haken „Update on reload“ setzen. Sonst zeigt der Browser womöglich noch die alte Fassung aus dem Offline-Cache.

Die eigenen Daten im Browser zurücksetzen: Entwicklertools → „Anwendung“ → „Local Storage“ → Eintrag `powerliste-b-v1` löschen, oder in der App Einstellungen → „Beispiel wiederherstellen“.

## Testen

Es gibt keine automatischen Tests. Nach einer Änderung von Hand prüfen:

1. Alle drei Tabs öffnen: Heute, Machbar, Übersicht.
2. Ein Ziel mit zwei Vorher-To-Dos anlegen, eines abhaken, prüfen, dass das Ziel erst frei wird, wenn beide erledigt sind.
3. Ein To-Do per „Heute“-Schalter nach „Heute“ holen, dort die Reihenfolge ziehen.
4. Ein To-Do ins Backlog verschieben und zurück.
5. Fokusmodus öffnen und schließen.
6. „Rückgängig“ im Hinweis unten ausprobieren.
7. Fenster schmal ziehen (Handy-Breite) und prüfen, dass nichts seitlich herausragt.
8. Entwicklertools → „Konsole“: Es dürfen keine roten Fehler stehen.

## Nach jeder Änderung: Versionsnummer erhöhen

Installierte Apps holen sich neue Dateien erst, wenn sich der Service Worker ändert. Deshalb bei jeder Änderung an App-Dateien:

1. `VERSION` in `sw.js` erhöhen (z. B. `1.0.0` → `1.0.1`).
2. `APP_VERSION` in `js/app.js` auf denselben Wert setzen (steht in den Einstellungen der App).
3. Neue Dateien zusätzlich in die Liste `FILES` in `sw.js` eintragen.

Reine Änderungen an Kommentaren oder an Dokumentation brauchen keine neue Version.

## Arbeitsweise mit GitHub

- `main` ist der Stand, der gilt. Änderungen nie direkt auf `main`, sondern auf einem eigenen Branch.
- Branch anlegen → ändern → Pull Request öffnen → ansehen und prüfen → mergen.
- Kleine Änderungen gehen auch im Browser: Im Repository auf GitHub die Taste `.` drücken öffnet einen Editor (github.dev), in dem man Dateien ändern und als neuen Branch speichern kann.
- Vorschau einer Änderung vor dem Mergen: Sobald die App bei Netlify oder Cloudflare Pages hängt (siehe README, „Hosting“), bekommt jeder Pull Request automatisch einen eigenen Vorschau-Link. Bis dahin: Branch lokal starten wie oben beschrieben.
