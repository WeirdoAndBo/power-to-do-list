# Meine Power-Liste

Eine ruhige To-do-App für neurodivergente Menschen. Große Ziele werden in kleine „Vorher-To-dos“ zerlegt, und die App zeigt nur, was gerade wirklich machbar ist.

- Läuft komplett im Browser, auf Handy, Tablet und Desktop (iOS/macOS, Windows, Android).
- Installierbar als App (PWA) und voll offline nutzbar.
- Kein Konto, kein Tracking, keine externen Abhängigkeiten. Alle Daten bleiben im Browser des Geräts (localStorage).

Dies ist **Version B** des Prototyps: Bereiche liegen übereinander wie ein Akkordeon, Kategorien sind Spalten zum Wischen, und jede Kategorie trennt „Zeitnah“ und „Backlog“.

## So funktioniert die App

- **Heute**: nur die To-dos, die du für heute markiert hast. Die Reihenfolge lässt sich per Griff ziehen (oder Pfeiltasten). Jeden Morgen ab 4 Uhr wird „Heute“ geleert; Offenes geht nicht verloren.
- **Machbar**: pro Bereich und Kategorie die To-dos, die gerade nicht blockiert sind. Darunter der Backlog für alles, was gerade nicht dran ist, und das Erledigte.
- **Übersicht**: Baum mit dem Ziel oben und aufklappbaren Unter-To-dos.
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

```
index.html             Einstieg der App
css/app.css            Gestaltung
js/app.js              Logik, Speichern, Export/Import
sw.js                  Service Worker für den Offline-Betrieb
manifest.webmanifest   App-Name, Farben, Icons für die Installation
icons/                 App-Icons (SVG und PNG, auch für iOS und Android)
archiv/version-a.html  Prototyp Version A (Kategorien als Spalten), nur zum Nachschauen
archiv/v3-voll.html    ältere, umfangreichere Fassung (Routinen, Fokus-Bereiche, Eingangskorb)
```

## Neue Version veröffentlichen
Bei jeder Änderung an den App-Dateien die Versionsnummer in `sw.js` (`VERSION`) und in `js/app.js` (`APP_VERSION`) erhöhen. Sonst behalten installierte Apps die alte Fassung im Offline-Cache. Neue Dateien zusätzlich in die Liste `FILES` in `sw.js` eintragen.

## Hosting (Vorschlag, noch nicht eingerichtet)
Die App besteht nur aus statischen Dateien und braucht keinen Server-Code.
- **Netlify** oder **Cloudflare Pages**: kostenlos, auch aus einem privaten Repository. Repository verbinden, kein Build-Befehl, Ausgabeordner ist das Hauptverzeichnis.
- **GitHub Pages**: für private Repositorys nur mit bezahltem Tarif.

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
