# Entwickeln an der Power-Liste

Diese Anleitung ist für Menschen, die HTML, CSS und JavaScript können und die App verstehen oder ändern wollen. Für die Bedienung der App siehe [README.md](README.md).

## Auf einen Blick

- Keine Werkzeuge nötig: kein Build, kein npm, keine Bibliotheken. Datei ändern, Browser neu laden, fertig.
- Die ganze Logik steht in **`js/app.js`**, die ganze Gestaltung in **`css/app.css`**.
- Der Zustand der App ist ein einziges Objekt `state`. Jede Änderung folgt demselben Muster:
  **`state` ändern → `save()` → `render()`**.
- Alle Ansichten sind Funktionen, die HTML als Text bauen (Template-Strings mit `` `...${wert}...` ``). Ihre Namen enden auf `Html`, z. B. `cardHtml()`. Nach jeder Änderung wird die Seite komplett neu gebaut.

## Ordnerstruktur

```
index.html             Grundgerüst: Kopfzeile, Umschalter Übersicht/Machbar/Heute, leere Container
css/app.css            Gestaltung (Farben ganz oben in :root)
js/app.js              Logik, Ansichten, Dialoge, Speichern, Export/Import
sw.js                  Service Worker: legt die Dateien für den Offline-Betrieb ab
manifest.webmanifest   Name, Farben und Icons für die Installation als App
icons/                 App-Icons
tests/test.html        Selbsttest: klickt die App automatisch durch (siehe „Testen“)
archiv/                ältere Prototypen, nur zum Nachschauen, werden von der App nicht geladen
```

`index.html` enthält fast keinen Inhalt. Die Container `#acc` (Hauptbereich), `#focus` (Fokusmodus), `#modal` (Popups) und `#toast` (Hinweis unten) werden von `js/app.js` gefüllt.

## Wörter im Code und in der App

Im Code heißen Funktionen und Variablen so wie die Dinge in der App: `bereich`, `kategorie`, `getBereich()`, `kategorieIn()`, `bereicheOf()`.

**Ausnahme: das gespeicherte Datenformat.** Die Felder, die im Browser und in Sicherungsdateien gespeichert werden, haben noch ihre alten, kurzen Namen. Sie bleiben absichtlich so, damit bestehende Listen und Sicherungen weiter laden. Wer sie umbenennen will, braucht eine Umstellung mit `migrate()` (siehe unten).

| In der App      | Gespeichertes Feld                          | Beispiel                 |
|-----------------|---------------------------------------------|--------------------------|
| Bereich         | `state.cats` (Liste), `task.cat` (ID)       | Arbeit, Privat, Hobby    |
| Kategorie       | `bereich.subs` (Liste), `task.area` (ID)    | Akquise, Finanzen        |
| Titel           | `task.t`                                    |                          |
| Ziel            | To-Do mit `goal: true`                      | Newsletter starten       |
| Vorher-To-Do „geht sonst nicht“ | `needs`                     | sperrt das To-Do         |
| Vorher-To-Do „würde nur helfen“ | `soft`                      | sperrt nichts            |
| Tab „Machbar“   | `state.view = 'jetzt'`                      |                          |
| Tab „Übersicht“ | `state.view = 'baum'`                       |                          |
| Tab „Heute“     | `state.view = 'heute'`                      |                          |
| Aufgeklappter Bereich | `state.openCat`                       |                          |
| Zeitnah / Backlog | `backlog: false` / `backlog: true`        |                          |
| Später einsortieren | `state.inbox`                           |                          |

Achtung: `area` heißt auf Englisch zwar „Bereich“, steht hier aber für die **Kategorie**. Deshalb benutzt der Code für Bereich und Kategorie die deutschen Wörter.

## Datenmodell

Alles wird als JSON unter dem Schlüssel `powerliste-b-v1` im `localStorage` des Browsers gespeichert. Die Beispieldaten in `seed()` (Anfang von `js/app.js`) zeigen das Modell am besten.

```js
state = {
  name: 'Meine Power-Liste',        // Titel oben
  tasks: { <id>: To-Do, ... },      // alle To-Dos und Ziele, nach ID
  cats: [                           // Bereiche, in Anzeigereihenfolge
    { id: 'arbeit', name: 'Arbeit', color: '#5b8def',
      subs: [ { id: 'akq', name: 'Akquise' }, ... ] }   // Kategorien, in Spaltenreihenfolge
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

Die To-Dos bilden einen Graphen: Ein To-Do kann Vorher-To-Do von mehreren anderen sein. Ein To-Do ist **machbar**, wenn keines seiner `needs` mehr offen ist (`openNeeds(task)` ist leer).

**„Heute“ und der Tageswechsel:** Ein Tag beginnt um 4 Uhr (`dayStart()`). Beim Öffnen und beim Zurückkehren zur App prüft `startNewDayIfNeeded()`, ob ein neuer Tag begonnen hat, und setzt dann bei allen To-Dos `today` zurück. Nichts wird gelöscht.

**Datenstruktur ändern:** `FORMAT` in `js/app.js` erhöhen und in `migrate()` ergänzen, wie alte Daten umgebaut werden. Sonst gehen bei bestehenden Nutzer*innen Daten kaputt. Auch `readBackup()` prüft neue Felder, falls sie IDs enthalten.

## Wo steht was in `js/app.js`

Die Datei ist in Abschnitte gegliedert, erkennbar an Kommentaren mit `----------`. Am besten im Editor nach dem Funktionsnamen suchen.

| Was                                    | Funktion(en)                                   |
|----------------------------------------|------------------------------------------------|
| Laden, Speichern, Beispieldaten        | `load`, `save`, `seed`, `migrate`              |
| Neuer Tag (4 Uhr)                      | `dayStart`, `startNewDayIfNeeded`              |
| Wer gehört zu wem                      | `goalsOf`, `taskAndAllBefore`, `parentsOf`, `openNeeds`, `pathsToGoals` |
| In welchem Bereich/welcher Kategorie   | `bereicheOf`, `kategorieIn`, `isIn`, `placeOf` |
| Tab „Heute“                            | `heuteViewHtml`, `setToday`, `saveDayOrder`    |
| Tab „Machbar“                          | `machbarColumnHtml`, `cardHtml`, `backlogRowHtml` |
| Tab „Übersicht“                        | `uebersichtColumnHtml`, `treeNodeHtml`         |
| Unter-To-Dos in der Übersicht umsortieren (auch in andere Karten der Spalte) | `moveInTree`, `treeDropTarget`, `applyTreeMove`, Ziehen am Griff (`.tgrip`, Abschnitt „Ziehen“ Nr. 5), Pfeiltasten |
| Bereiche und Kategorien (Akkordeon)    | `bereichBarHtml`, `bereichOpenHtml`, `bereichDialog`, `kategorieDialog` |
| Kategorie-Navigation (Knöpfe über den Spalten) | `subtabs` in `bereichOpenHtml`, `goToColumn` (Sprung + Aufleuchten), `markCurrentTab` |
| Kategorie-Spalten umsortieren          | `moveKategorie`, Ziehen am Griff (`.colgrip`, Abschnitt „Ziehen“), Pfeiltasten, „Nach links/rechts“ in `kategorieDialog` |
| Ganze Seite neu aufbauen               | `render`                                       |
| Fokusmodus                             | `openFocus`, `renderFocus`, `closeFocus`       |
| Popup und Hinweis unten                | `modal`, `buttonHtml`, `toast`                 |
| Abhaken                                | `toggleDone`                                   |
| Neues To-Do / Ziel                     | `addTask`, `quickNote`, `askBefore`, `createPreTasks`; „+ Neues To-Do“ in jeder Spalte = `data-act="addhere"` |
| Bearbeiten, Löschen                    | `editTask`, `deleteTask`, `deleteWithUndo`; Papierkorb-Knöpfe: `data-act="del"`, kleine Variante `deleteMiniHtml` |
| Verschieben, Backlog, Reihenfolge      | `moveTo`, `moveMenu`, `placeInOrder`; Ziehen am Griff (`.mgrip`, Abschnitt „Ziehen“ Nr. 3, gilt für Karten in „Machbar“ und Ziel-Karten in „Übersicht“). Umsortierbare Einträge haben `data-sort`, die Reihenfolge steckt in `prio` |
| Einstellungen                          | `settingsDialog`                               |
| Sicherung speichern/laden              | `exportData`, `readBackup`, `importFile`       |
| Was ein Klick auslöst                  | großer `switch` im Abschnitt „Ereignisse“      |

**Wie ein Knopf funktioniert:** Knöpfe haben im HTML `data-act="…"` und meist `data-id="<To-Do-ID>"`. Ein einziger Klick-Listener im Abschnitt „Ereignisse“ liest das aus und ruft die passende Funktion auf. Für einen neuen Knopf: im HTML `data-act="meinknopf"` setzen und im `switch` ein `case 'meinknopf':` ergänzen.

**Wie ein Popup funktioniert:** `modal(html)` gibt ein Promise zurück. Mit `await` wartet man, bis es geschlossen wird, und bekommt `{v, vals}`: `v` ist der `data-v`-Wert des gedrückten Knopfs, `vals` enthält alle Felder mit `name="…"`.

```js
const r = await modal(`<h2>Titel</h2><input class="field" name="text">
  <div class="btns">${buttonHtml('', 'Abbrechen', 'ghost')}${buttonHtml('ok', 'Fertig', 'pri')}</div>`);
if (r.v === 'ok') { /* r.vals.text benutzen */ }
```

**Rückgängig:** Vor einer Änderung `undoSnapshot = snapshot()` setzen, danach `toast('Text', true)` aufrufen. Der Knopf „Rückgängig“ stellt dann den alten Stand her.

**Löschen:** geht überall mit dem Papierkorb (`data-act="del"` → `deleteWithUndo`): auf Karten, im Backlog, in „Erledigt“, in „Heute geschafft“ und „Danach dran“, oben im Fokusmodus und in der Übersicht auf Ziel-Karten und an jedem Unter-To-Do. Vorher-To-Dos, die danach zu nichts mehr gehören, verschwinden mit (`deleteTask`).

**Sicherheit:** Texte, die Nutzer*innen eingeben, immer mit `esc(...)` ins HTML einsetzen, nie direkt.

## Was ändere ich wo?

- **Farben, Schrift, Schatten:** `css/app.css`, Variablen in `:root` ganz oben. `light-dark(hell, dunkel)` setzt die Farbe für hellen und dunklen Modus.
- **Farbauswahl für Bereiche:** `COLORS` am Anfang von `js/app.js`.
- **Farbe der App beim Installieren:** `theme_color` und `background_color` in `manifest.webmanifest` sowie `theme-color` in `index.html`.
- **Texte in der App:** stehen direkt im HTML-Text der jeweiligen Funktion in `js/app.js`. Am einfachsten im Editor nach dem sichtbaren Text suchen, z. B. „Cool, geschafft!“.
- **Beispieldaten:** `seed()` in `js/app.js`. Wirkt nur bei neuem Browser oder über Einstellungen → „Beispiel wiederherstellen“.
- **Wann ein Tag beginnt (4 Uhr):** `DAY_STARTS_AT_HOUR` am Anfang von `js/app.js`.

**CSS:** `css/app.css` ist nach Teilen der App geordnet (Kopf, Bereiche, Listen, Karte, Heute-Schalter, Übersicht, Heute, Fokusmodus, Popup …). Jede Klasse ist an einer Stelle beschrieben. Wenn eine Änderung trotzdem nicht wirkt, hilft im Browser Rechtsklick → „Untersuchen“: Dort sieht man, welche Regel gewinnt und in welcher Zeile sie steht.

## Lokal starten

```
python3 -m http.server 8000
```

im Projektordner ausführen und <http://localhost:8000> öffnen. Nur `index.html` doppelklicken geht auch, dann laufen aber Service Worker und Installation nicht.

Der Service Worker arbeitet „Netz zuerst“: Normales Neuladen zeigt immer die aktuellen Dateien. Der Offline-Cache wird nur benutzt, wenn kein Netz da ist oder das Netz länger als 4 Sekunden braucht.

Die eigenen Daten im Browser zurücksetzen: Entwicklertools → „Anwendung“ → „Local Storage“ → Eintrag `powerliste-b-v1` löschen, oder in der App Einstellungen → „Beispiel wiederherstellen“.

## Testen

**Selbsttest (automatisch):** Die App lokal starten (siehe oben) und <http://localhost:8000/tests/test.html> öffnen, dann „Test starten“. Die Seite klickt die App in einem Rahmen durch: anlegen (auch mit „+“ in einer Spalte), abhaken, Rückgängig, Heute-Schalter, Reihenfolge in Heute, Spalten umsortieren, Backlog, Löschen (in Machbar, Heute, Fokusmodus und Übersicht), Fokusmodus, Sicherung speichern und laden (auch alte und kaputte Dateien). Grün = in Ordnung, rot = mit Grund, was nicht geklappt hat. Die eigene Liste wird vorher gesichert und danach wiederhergestellt. Den Tab während des Tests nicht schließen.

Einen neuen Test ergänzen: in `tests/test.html` einen Block `test('Name', async () => { … })` hinzufügen. Mit `click('css-selektor')` klicken, mit `saved()` den gespeicherten Zustand lesen, mit `expect(bedingung, 'Fehlertext')` prüfen.

**Von Hand** (was der Selbsttest nicht kann):

1. Alle drei Tabs ansehen: Übersicht, Machbar, Heute. Sieht alles aus wie vorher?
2. In „Heute“ eine Karte am Griff ziehen und die Reihenfolge ändern.
3. In „Machbar“ und in der Übersicht eine Karte am Griff hoch/runter ziehen (Linie zeigt die Stelle), ins Backlog, auf einen Knopf der Kategorie-Navigation und auf einen anderen Bereich ziehen.
4. In der Übersicht Äste auf- und zuklappen. Ein Unter-To-Do am Griff hoch/runter ziehen (Reihenfolge, auch in eine andere Karte) und nach rechts/links (Ebene). Die farbige Linie zeigt, wo es landet.
5. Eine Kategorie-Spalte am Griff im Spaltenkopf ziehen (am Rand scrollt es seitlich mit). Nach dem Neuladen bleibt die Reihenfolge.
6. Fenster schmal ziehen (Handy-Breite): nichts ragt seitlich heraus, Kategorien lassen sich wischen.
7. Update: App offen lassen, `VERSION`/`APP_VERSION` erhöhen, zu einem anderen Tab wechseln und zurück. Die App lädt sich neu, zeigt „Neue Version … geladen“, und die Liste ist unverändert.
8. Offline: Seite laden, dann in den Entwicklertools unter „Netzwerk“ auf „Offline“ stellen und neu laden. Die App muss erscheinen.
9. Entwicklertools → „Konsole“: Es dürfen keine roten Fehler stehen.

## Nach jeder Änderung: Versionsnummer erhöhen

Die Dateien kommen dank „Netz zuerst“ auch ohne neue Nummer an. Die neue Nummer in `sw.js` ist aber das Zeichen für eine offene App, sich selbst neu zu laden (Hinweis „Neue Version … geladen“), und sie erneuert den Offline-Cache. Deshalb bei jeder Änderung an App-Dateien:

1. `VERSION` in `sw.js` erhöhen (z. B. `1.0.0` → `1.0.1`).
2. `APP_VERSION` in `js/app.js` auf denselben Wert setzen (steht in den Einstellungen der App).
3. Neue Dateien zusätzlich in die Liste `FILES` in `sw.js` eintragen.

Reine Änderungen an Kommentaren oder an Dokumentation brauchen keine neue Version.

## Arbeitsweise mit GitHub

- `main` ist der Stand, der gilt. Änderungen nie direkt auf `main`, sondern auf einem eigenen Branch.
- Branch anlegen → ändern → Pull Request öffnen → ansehen und prüfen → mergen.
- Kleine Änderungen gehen auch im Browser: Im Repository auf GitHub die Taste `.` drücken öffnet einen Editor (github.dev), in dem man Dateien ändern und als neuen Branch speichern kann.
- Vorschau einer Änderung vor dem Mergen: Sobald die App bei Netlify oder Cloudflare Pages hängt (siehe README, „Hosting“), bekommt jeder Pull Request automatisch einen eigenen Vorschau-Link. Bis dahin: Branch lokal starten wie oben beschrieben.
