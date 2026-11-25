# Meine Power-Liste

Eine ruhige To-do-App für neurodivergente Menschen. Große Ziele werden in kleine „Vorher-To-dos“ zerlegt, und die App zeigt nur, was gerade wirklich machbar ist.

- Läuft komplett im Browser, auf Handy, Tablet und Desktop (iOS/macOS, Windows, Android).
- Installierbar als App (PWA) und voll offline nutzbar.
- Kein Konto, kein Tracking, keine externen Abhängigkeiten. Alle Daten bleiben im Browser des Geräts (localStorage).

Dies ist **Version C** (Experiment, baut auf Version B 1.0.6 auf): Bereiche liegen übereinander wie ein Akkordeon, Kategorien sind Spalten zum Wischen, und jede Kategorie trennt „Zeitnah“ und „Backlog“. Neu in Version C: „Machbar“ ist kein eigener Tab mehr, sondern ein Schalter im Kopf jedes Bereichs der Übersicht. Es gibt nur noch die Tabs Übersicht und Heute.

## So funktioniert die App

- **Übersicht**: Baum mit dem Ziel oben und aufklappbaren Unter-To-dos. Der Ort, um in Ruhe alles systematisch zu erfassen.
- **Schalter „Machbar“** (im Kopf des aufgeklappten Bereichs): An = pro Kategorie nur die To-dos, die gerade nicht blockiert sind, als Karten; darunter der Backlog und das Erledigte. Aus = wieder der ganze Baum. Der Schalter gilt für alle Bereiche und bleibt so, auch nach einem Wechsel zu „Heute“.
- **Karten**: sehen mit Schalter an und aus gleich aus (Kopf mit Heute und ⋯ für Verschieben/Details; darunter Häkchen, Titel und Mülleimer). Mit Schalter aus hat die Ziel-Karte im Kopf einen Pfeil mit der Anzahl der Vorher-To-Dos: Er klappt alle Ebenen auf einmal auf oder zu.
- **Ketten**: Hat ein To-Do genau ein Vorher-To-Do, steht dieses direkt darunter (nicht eingerückt), mit einem Strich zwischen den Häkchen verbunden (gestrichelt bei „hilft nur“). Nur das letzte Glied der Kette, mit dem man anfängt, ist kräftig, die anderen leicht ausgegraut. Hat ein To-Do mehrere Vorher-To-Dos, laufen die parallel: eingerückt mit senkrechter Linie, ohne Strich. Das „+“ zwischen zwei Kettengliedern fügt mitten in die Kette ein.
- **Hinter jedem To-Do** stehen nur der Heute-Schalter und der Mülleimer. Löscht man ein Unter-To-Do mitten aus einer Kette, bleibt der Rest: seine Vorher-To-Dos rücken an seine Stelle. Löscht man eine ganze Karte, gehen ihre Unter-To-Dos mit (Rückgängig holt alles zurück).
- **Sammlung**: Jeder Bereich hat vorne eine Spalte „📥 Sammlung“ zum schnellen Notieren, ohne Zeitnah und Backlog. Einsortieren = Karte in eine andere Spalte ziehen. Mit dem Auge im Kategorie-Knopf lässt sie sich aus- und wieder einblenden. Sie lässt sich umbenennen und löschen (dann kommt sie nicht wieder).
- **Zeitnah und Backlog**: Jede Spalte hat zwei Abschnitte mit gleichen Karten. Der Backlog lässt sich mit einem Klick auf die Überschrift einklappen. Karten zieht man zwischen beiden hin und her, auch auf die zugeklappte Überschrift.
- **Unter-To-Do herausziehen**: Ein Unter-To-Do aus der Karte in die Spalte ziehen, dann wird es ein eigenes To-Do mit eigener Karte.
- **Neues To-Do in einer Spalte**: Zwischen zwei Karten (oder ganz oben) erscheint beim Drüberfahren ein „+“. So legt man direkt in Zeitnah oder Backlog an. Den Knopf „+ Neues To-Do“ unten in der Spalte gibt es nicht mehr.
- **Weißer Knopf „Neues To-Do“** (unten): öffnet ein Popup, das wie eine Karte aufgebaut ist. Oben Bereich, Kategorie und „Erst mal ins Backlog“, darunter Titel und Unter-To-Dos. Enter: nächstes Unter-To-Do. Tab: kommt davor (eine Ebene tiefer). Umschalt+Tab: zurück. Enter in einer leeren Zeile: anlegen.
- **Neues To-Do an einer Stelle**: Mit der Maus zwischen zwei To-Dos fahren, dann erscheint ein „+“, daneben klein die Frage aus dem Eingabefeld („Was gehört dazu?“, „Was muss vorher passieren?“ oder „Neues To-Do“). Klick, Text eintippen, Enter. Gleich danach öffnet sich das nächste Feld, Escape schließt es. Der eingerückte Streifen direkt unter einem To-Do legt etwas an, das davor kommt (eine Ebene tiefer). Am Handy sind die „+“ ganz leicht immer zu sehen.
- **Listen**: Beginnt der Text eines To-Dos mit „Liste:“ (zum Beispiel „Liste: Baumarkt“), bekommt es eine einfache Abhak-Liste. Das geht beim Anlegen und auch später, indem man „Liste:“ vorne an den Text setzt. Die Punkte sind keine eigenen To-Dos. Feld „+ Punkt“: Enter fügt hinzu und bleibt im Feld. Punkt antippen = Text ändern (leer = löschen). Im Kartenkopf steht der Stand, zum Beispiel „1/4“. Nimmt man „Liste:“ wieder weg, wird die Liste nur ausgeblendet. Im Popup „Neues To-Do“ werden bei einem Titel „Liste: …“ die Zeilen zu Listenpunkten.
- **Text bearbeiten**: Text antippen, ändern, Enter. Escape bricht ab. Verbindungen und Details: im Menü ⋯ oder im Fokusmodus.
- **Ziehen**: Es gibt keine Griffe. Man zieht ein Element dort, wo man es anfasst (Maus: drücken und ziehen; Handy: kurz halten, dann ziehen). Jede Karte lässt sich so ziehen: an eine andere Stelle in derselben Kategorie (eine farbige Linie zeigt, wo sie landet), in eine andere Spalte, auf einen Knopf der Kategorie-Navigation, ins Backlog oder auf einen anderen Bereich.
- **Heute**: nur die To-dos, die du für heute markiert hast. Die Reihenfolge lässt sich per Griff ziehen (oder Pfeiltasten). Jeden Morgen ab 4 Uhr wird „Heute“ geleert; Offenes geht nicht verloren.
- **Bereich bearbeiten** (Stift im Bereichskopf): Name und Farbe ändern, Löschen. **Kategorie bearbeiten** (Stift im Spaltenkopf): Name und Emoji (aus einer Auswahl) ändern, „Verschieben …“ (Bereich und Position wählen, die To-Dos kommen mit), „Duplizieren …“ (Kopie mit allen offenen To-Dos, Ort wie beim Verschieben wählen), Löschen. Löschen fragt immer erst nach („Löschen“ oder „Abbrechen“); die To-Dos bleiben dabei erhalten.
- **Kategorie-Navigation**: Über den Spalten eines Bereichs stehen alle Kategorien als kleine Knöpfe. Ein Klick springt zur Spalte, sie leuchtet kurz auf.
- **Fokusmodus**: Ein Tipp auf eine Karte öffnet sie im Vollbild. Dort kann man schnell ein neues To-do notieren und „später einsortieren“.
- **Vorher-To-dos**: „geht sonst nicht“ sperrt das To-do, „würde nur helfen“ sperrt nichts. Ein Schritt kann zu mehreren Zielen gehören.

## Nutzung

### Lokal öffnen
- **Schnell ansehen**: `index.html` doppelklicken. Die App läuft, speichert aber nur in diesem Browser, und Installation/Offline-Cache sind so nicht aktiv (Browser erlauben das nur über http/https).
- **Mit Offline und Installation**: im Projektordner einen kleinen lokalen Server starten, zum Beispiel
  ```
  python3 -m http.server 8000
  ```
  und dann <http://localhost:8000> öffnen.

### Installieren
Sobald die App über https erreichbar ist (siehe Hosting):
- **Android (Chrome)**: Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.
- **iPhone/iPad (Safari)**: Teilen → „Zum Home-Bildschirm“.
- **Windows/macOS (Chrome oder Edge)**: Installations-Symbol in der Adressleiste. Unter macOS geht in Safari auch „Ablage → Zum Dock hinzufügen“.

Nach dem ersten Öffnen funktioniert die App ohne Internet.

### Datensicherung und Gerätewechsel
Die Daten liegen nur auf dem jeweiligen Gerät und in dem jeweiligen Browser. Über **Einstellungen (···) → „Sicherung speichern“** lädst du eine Datei `power-liste-JJJJ-MM-TT.json` herunter. Mit **„Sicherung laden“** holst du sie zurück, auch auf einem anderen Gerät. Das Laden ersetzt die aktuelle Liste und lässt sich direkt danach rückgängig machen.

Wichtig für iPhone/iPad: Safari kann lokale Daten nach längerer Nichtnutzung löschen. Regelmäßig sichern.

## Datenformat
Gespeichert wird ein JSON-Objekt unter dem Schlüssel `powerliste-b-v1` im localStorage. Es trägt eine Formatnummer `format` (aktuell **1**). Eine Sicherungsdatei sieht so aus:

```json
{
  "app": "power-liste",
  "format": 1,
  "appVersion": "1.0.0",
  "exportedAt": "2026-11-25T16:00:00.000Z",
  "data": { "name": "...", "tasks": { }, "cats": [ ], "inbox": [ ], "format": 1 }
}
```

Ändert sich die Datenstruktur, wird `FORMAT` in `js/app.js` erhöht und `migrate()` bringt ältere Daten auf den neuen Stand. Sicherungen aus einer neueren App-Version werden abgelehnt statt falsch gelesen.

## Ordnerstruktur
Wer am Code arbeiten will: Aufbau, Datenmodell und Arbeitsweise stehen in [DEVELOPING.md](DEVELOPING.md).


```
index.html             Einstieg der App
css/app.css            Gestaltung
js/app.js              Logik, Speichern, Export/Import
sw.js                  Service Worker für den Offline-Betrieb
manifest.webmanifest   App-Name, Farben, Icons für die Installation
icons/                 App-Icons (SVG und PNG, auch für iOS und Android)
tests/test.html        Selbsttest (im Browser öffnen, siehe DEVELOPING.md)
archiv/version-a.html  Prototyp Version A (Kategorien als Spalten), nur zum Nachschauen
archiv/v3-voll.html    ältere, umfangreichere Fassung (Routinen, Fokus-Bereiche, Eingangskorb)
.nojekyll              sorgt dafür, dass GitHub Pages die Dateien unverändert ausliefert
```

## Neue Version veröffentlichen
Bei jeder Änderung an den App-Dateien die Versionsnummer in `sw.js` (`VERSION`) und in `js/app.js` (`APP_VERSION`) erhöhen. Sonst behalten installierte Apps die alte Fassung im Offline-Cache. Neue Dateien zusätzlich in die Liste `FILES` in `sw.js` eintragen.

## Hosting
Die App wird über **GitHub Pages** veröffentlicht unter:

**<https://weirdoandbo.github.io/power-to-do-list/>**

Veröffentlicht wird direkt aus dem Branch `main`, Ordner `/` (Hauptverzeichnis). Es gibt keinen Build-Schritt und keinen Workflow: Was auf `main` liegt, ist ein bis zwei Minuten später online. Die leere Datei `.nojekyll` sagt GitHub, dass die Dateien unverändert ausgeliefert werden sollen.

Alle Pfade in der App sind relativ (`manifest.webmanifest`, Icons, `sw.js`, `start_url` und `scope` = `./`). Deshalb läuft sie auch unter dem Unterpfad `/power-to-do-list/` mit Offline-Start und Installation.

### Einmalig einrichten
1. Das Repository muss **öffentlich** sein (GitHub Pages ist sonst nur mit bezahltem Tarif möglich): **Settings → General**, ganz unten bei „Danger Zone“ → **Change visibility** → **Change to public** und bestätigen.
2. **Settings → Pages** (links im Menü unter „Code and automation“).
3. Bei **Build and deployment** → **Source**: **Deploy from a branch** wählen.
4. Bei **Branch**: `main` und Ordner `/ (root)` wählen, dann **Save**.
5. Ein bis zwei Minuten warten. Oben auf der Seite erscheint „Your site is live at https://weirdoandbo.github.io/power-to-do-list/“. Den Fortschritt sieht man auch im Reiter **Actions** („pages build and deployment“).

### Testen
- Die Adresse im Browser öffnen. Die App sollte mit Beispieldaten erscheinen.
- Offline: Seite einmal laden, dann Flugmodus an und neu laden. Die App muss weiter erscheinen.
- Installation: Am Handy bzw. in Chrome/Edge wie unter „Installieren“ beschrieben.

### Nach Änderungen
Jede Änderung, die auf `main` landet, wird automatisch neu veröffentlicht. Damit installierte Apps die neue Fassung auch bekommen, **immer `VERSION` in `sw.js` erhöhen** (und `APP_VERSION` in `js/app.js` gleich setzen). Ohne neue Versionsnummer liefert der Service Worker weiter die alte Fassung aus dem Offline-Cache. Nach dem Hochladen braucht eine installierte App meist ein- bis zweimal Schließen und Öffnen, bis die neue Version angezeigt wird.

### Gut zu wissen
- GitHub Pages hat **keine Vorschau-Adressen pro Pull Request**. Änderungen sieht man online erst nach dem Mergen in `main`. Vorher lokal testen (siehe „Lokal öffnen“).
- Alle Pages-Projekte unter `weirdoandbo.github.io` teilen sich denselben Browser-Speicher. Die App nutzt eigene Namen (`powerliste-b-v1` im localStorage, Caches `powerliste-…`), damit nichts kollidiert.
- Die Daten bleiben auch online nur im Browser des Geräts. Auf GitHub landet nichts davon.

## Backlog
- **Alarme an Uhrzeiten** (Idee von Bo): Ein To-do kann an eine Uhrzeit gekoppelt werden. Es gibt zwei Alarme: einen einstellbaren Ankündigungsalarm (z. B. 10, 15 oder 30 Minuten vorher, als ruhige Info, damit man rechtzeitig aufhören kann) und einen Alarm „Jetzt XY machen“. Einsatz z. B. für Pausen, Essen und Termine.
  - Offen: Wie funktionieren Alarme offline und ohne Tracking? Lokale Benachrichtigungen der PWA brauchen die Erlaubnis des Geräts, und Browser wecken eine geschlossene Web-App nicht zuverlässig. Eventuell braucht es später eine native Hülle oder einen Kalender-Export (.ics).
  - Offen: Wie klingt bzw. fühlt sich ein Alarm reizarm an (Ton wählbar, nur Vibration, nur Anzeige)? Gibt es Schlummern? Was passiert, wenn man gerade im Fokusmodus ist?
- **Angefangenes bleibt „aktiv“** (Idee von Bo): Ein angefangenes, noch nicht fertiges To-do bleibt sichtbar als aktiv markiert, damit man nach einer Unterbrechung (Alarm, Pause, Termin) gezielt dort weitermacht und nicht versehentlich bei einem anderen landet.
  - Offen: Wann gilt etwas als aktiv: beim Öffnen des Fokusmodus, über einen eigenen Knopf „Ich bin dran“ oder automatisch bei einer Unterbrechung durch einen Alarm?
  - Offen: Darf nur eines aktiv sein oder höchstens zwei bis drei (gegen Zerfasern)? Wo wird es angezeigt: als Leiste ganz oben „Weitermachen mit …“, als erste Karte in „Heute“ oder beim nächsten Öffnen der App?
  - Offen: Wie verhält es sich zu „Heute“ und zum Zurücksetzen um 4 Uhr? Bleibt ein aktives To-do über Nacht aktiv? Wann wird die Markierung still wieder entfernt, wenn man nicht zurückkehrt?
- **Deadlines** (Idee von Bo): Ein To-do bekommt optional ein Datum. Offen: Wie zeigt man das ohne Druck (z. B. „noch 3 Tage“ statt Rot)? Wandern To-dos mit naher Deadline automatisch nach „Heute“ oder nur als sanfter Vorschlag? Erben Vorher-To-dos die Deadline?
- **„Zwingend heute“-Markierung** (Idee von Bo): eine stärkere Stufe als „Heute“, die oben steht und beim morgendlichen Leeren nicht verschwindet, bis sie erledigt ist. Offen: Wie viele sind sinnvoll (Begrenzung gegen Überforderung)?
- **Routinen** (Idee von Bo, noch nicht umgesetzt): Routine-To-dos sind eine eigene Art. Man legt sie in der jeweiligen Kategorie an und stellt ein, wie oft sie vorkommen.
  - a) Feste Tagesroutinen (Frühstück, Mittagessen, Abendessen) erscheinen automatisch einmal täglich in „Heute“.
  - b) Lose Routinen (Pflanzen düngen) zeigen in „Machbar“ nur an, wann sie zuletzt erledigt wurden.
  - Die Kategorie-Spalte bekommt dafür einen abgetrennten Bereich für Routinen, getrennt von den einmaligen To-dos.
  - In „Heute“ kann man optional eine Routine hinzufügen.
  - Offene Fragen: Liegt der Routinen-Bereich oben oder unten, und ist er eingeklappt? Woran unterscheidet die App Typ a und b: an einem Schalter „automatisch in Heute“ oder an der Häufigkeit? Was passiert, wenn eine feste Routine ausfällt? Sie sollte still verschwinden, ohne Schuldgefühl. Wie werden Häufigkeiten wie „2× pro Woche“ ohne festen Tag angezeigt? Können Routinen Voraussetzungen haben (Waschmittel kaufen → Wäsche waschen)? Zählen sie für den Fortschritt eines Ziels?
- Fokus-Bereiche pro Tag/Woche und „zuletzt etwas getan vor X Tagen“.
- Hinweis auf lange liegende To-dos („Was blockiert dich?“).
- Status-Farben (bereit / in Arbeit / liegt lange).
- ~~Daten exportieren und importieren (Datei).~~ Erledigt: Einstellungen → „Sicherung speichern“ / „Sicherung laden“.
- **Alle Geräte und Systeme** (Wunsch von Bo): Die App soll auf Handy, Tablet und Desktop laufen, unter iOS/macOS, Windows und Android. Das ist mit einer Web-App/PWA gegeben: ein Code für alle, installierbar auf dem Homescreen bzw. als Desktop-App, funktioniert offline.
  - Geräteabgleich: Daten liegen pro Gerät lokal. Für mehrere Geräte zuerst Export/Import per Datei; später optional ein Sync ohne Konto-Tracking (z. B. verschlüsselt über eigene Cloud-Datei oder direkt zwischen Geräten).
  - Einschränkungen auf iOS: Benachrichtigungen (wichtig für Alarme) gehen erst ab iOS 16.4 und nur, wenn die App auf dem Homescreen installiert ist; Safari kann lokale Daten nach längerer Nichtnutzung löschen, daher ist Export als Sicherung wichtig.
