# MeetMap

Ein privater Ort für Menschen, Begegnungen und Erinnerungen. Eine selbst gehostete Web-App mit einer ruhigen deutschen Oberfläche, persönlichen Profilen, Fotogalerien, interaktiver Karte und Zeitstrahl.

## Start mit Docker Compose

Voraussetzungen: Docker Engine mit Compose v2, mindestens 2 GB RAM für den Betrieb; für den ersten Build besser 4 GB. Die erste Installation benötigt Internet für Container-Images und npm-Pakete. Danach funktioniert die App einschließlich der lokalen Weltkarte ohne externe Dienste.

```bash
cp .env.example .env
openssl rand -hex 24
```

Trage den erzeugten Wert als `POSTGRES_PASSWORD` in `.env` ein. `APP_URL` muss exakt der Adresse entsprechen, mit der du MeetMap öffnest, zum Beispiel `http://localhost:3000` oder `https://meetmap.dein-lan.example`. Verwende hexadezimale bzw. URL-sichere Zeichen im Datenbankpasswort.

```bash
docker compose up -d --build
```

Öffne **http://localhost:3000**. Beim ersten Start legst du deinen eigenen Owner-Account an. Es gibt keinen Standardbenutzer und keine öffentliche Registrierung. Das Passwort muss mindestens 12 Zeichen haben. Optional kannst du im leeren Dashboard sechs fiktive Menschen und drei Beispielerinnerungen hinzufügen. Die Fotos werden dann in deinen privaten Bildspeicher kopiert.

Compose startet PostgreSQL, wendet die versionierten Migrationen an und startet anschließend die App. PostgreSQL hat standardmäßig **keinen veröffentlichten Port**. Die App bindet standardmäßig an `127.0.0.1`. Für Zugriff aus dem LAN kannst du `BIND_ADDRESS=0.0.0.0` setzen. Verwende bei Zugriff außerhalb deines Rechners einen HTTPS-Reverse-Proxy; `APP_URL=https://...` aktiviert sichere Session-Cookies. Der Proxy soll den Host und den originalen Origin-Header durchreichen. Die App benötigt keine CORS-Freigabe.

## Was MeetMap kann

- Einmaliges Owner-Setup, Argon2id-Passwörter, serverseitige 7-Tage-Sessions mit zufälligen Tokens, Login/Logout und Rate Limits.
- Dashboard mit echten Zählwerten, letzten Erinnerungen, Kontaktintervallen, Geburtstagen und Systemstatus.
- Personen mit Spitznamen, Profilbild, Geburtstag, Tags, Wichtigkeit, Favorit, Notizen, Kennenlern-/Enddatum, Kontaktfrequenz, letztem Kontakt, Ort und Online-Kontext.
- Erinnerungen mit Personen, Orten, Zeitraum, Typ, Stimmung, Privatheitslabel, Favorit, Pin und privaten Bildern. Entwürfe werden nach einer kurzen Schreibpause automatisch gespeichert. Versionsprüfung schützt vor widersprüchlichen parallelen Änderungen.
- Ferienzeiträume mit zugeordneten Urlauben, gemeinsamen Personen, Tagebuch, Fotos, Kalender, Reisewegen und Auswertungen der unterwegs verbrachten Tage.
- Vorfreude im Dashboard: persönliche vorgemerkte Momente sowie kommende Urlaube, Ferien und veröffentlichte Events mit Tages-Countdown.
- Sichere Bilder-Uploads: Multipart, höchstens 12 MB pro Bild, Typprüfung anhand des Inhalts, maximal 40 Millionen Eingangspixel, EXIF-Entfernung, WebP-Konvertierung, Vorschauen und nur authentifizierte Bildzugriffe. JPEG, PNG, WebP und AVIF werden angenommen. Andere Dateianhänge gehören noch nicht zu v1.
- MapLibre mit lokal enthaltenen Natural-Earth-Ländergrenzen, gruppierten Personen-/Erinnerungsmarkern, Filtern, automatisch angepasstem Ausschnitt, Ortsliste und separaten Online-Kontakten.
- Beziehungsspannen und Erinnerungen im Zeitstrahl, Personen-/Tag-/Zeitraumfilter und dynamischer Zoom mit anpassbarer Datumsachse.
- Tastaturbedienbare globale Suche (`⌘K` / `Ctrl+K`) mit Stichwörtern, ähnlichen Schreibweisen, Facetten und serverseitig gespeicherten Suchen. Die fuzzy Suche arbeitet auf den bereits authentifiziert geladenen Daten; die API bietet Keyword-Suche.
- Serverseitig gespeicherte Einstellungen, Audit-Log für zentrale Änderungen, JSON-Export, vollständiges Backup-Skript und Health-/Readiness-Endpunkte.
- Optionaler Ollama-Anschluss für lokale Zusammenfassungen über die API. Ohne Ollama bleiben alle Kernfunktionen verfügbar.

Alle Datenabfragen und Verknüpfungen sind an den angemeldeten Owner gebunden. Mutationen prüfen den Origin gegen `APP_URL`. Bilder liegen außerhalb des öffentlichen Webverzeichnisses. Schriftdateien werden lokal ausgeliefert. Es gibt keine Analytics- oder externen KI-Aufrufe.

Die Privacy-Labels „Privat“ und „Sensibel“ sind persönliche Kennzeichnungen: In v1 kann ohnehin nur der Owner Daten sehen. Sie implementieren keine zusätzliche Verschlüsselung oder getrennte Zugriffsrollen. Die Orte-Rundung wirkt auf die Kartendarstellung; die Originalkoordinaten bleiben in der Datenbank. Server-/Datenträgerverschlüsselung und Schutz deiner Backups liegen beim Betreiber.

## Reisen, Ferien und Reisewege

**Reisen & Ferien** unterscheidet deinen freien Ferienzeitraum von den einzelnen Urlauben darin. Lege beispielsweise Ferien vom **01/08/2027 bis 21/08/2027** an und ordne ihnen mehrere Urlaube zu. Eine Reise kann auch ohne Ferienzuordnung bestehen. In der Detailansicht findest du die zugehörigen Personen, Tagebucheinträge, Fotos, Reisewege und den Kalender. Einträge müssen in den zugeordneten Zeitraum passen; beim Verkürzen eines Zeitraums prüft MeetMap die bereits verknüpften Daten.

Reisetage zählen einschließlich Start- und Endtag. Überlappende Urlaube zählen in den gemeinsamen Auswertungen jeden Kalendertag einmal. Bei einem Ferienzeitraum ergeben sich Tage zu Hause aus den Ferientagen abzüglich der Tage der zugeordneten Urlaube. Der Rückblick vergleicht abgeschlossene Ferien und Reisen. Das Entfernen eines Ferienzeitraums oder einer Reise erhält die verknüpften Geschichten und Fotos und löst deren Zuordnung.

Unter **Reisewege** erfasst du einzelne Etappen mit Startort, Zielort, Datum und Verkehrsmittel. Die automatische Kilometerangabe ist die **Luftlinie zwischen den gespeicherten Orten**; sie ist keine Straßen-, Bahn- oder Flugroute. Für eine tatsächlich zurückgelegte Strecke trägst du die Kilometer manuell ein. Beide Herkunftsarten werden gekennzeichnet und in der Entfernungssumme berücksichtigt. Auch direkte Etappen eines Ferienzeitraums sind möglich, etwa zwischen zwei Urlauben.

## Vorfreude

Im Dashboard sammelt **Darauf kannst du dich freuen** kommende Urlaube, Ferien, veröffentlichte Erinnerungen vom Typ Event und eigene Vorfreude-Momente. Über **Moment vormerken** speicherst du einen Titel, ein Datum und optional einen Gedanken dazu. Der Countdown zeigt die verbleibenden Tage oder „Heute“. Ein Klick öffnet den Eintrag zum Bearbeiten; eigene Momente lassen sich auch wieder entfernen. Vergangene Termine erscheinen nicht mehr in der Vorschau. Die Funktion erstellt keine Benachrichtigungen, Erinnerungen oder Kalendereinträge bei externen Diensten.

## Datum, Kalender und Zeitstrahl

Vollständige Datumsanzeigen und Datumsfelder verwenden **`dd/mm/yyyy`**, zum Beispiel **12/09/2026**. Du kannst tippen oder den Kalenderbutton am Feld verwenden. Eingaben wie `12.09.2026` werden in das einheitliche Format umgewandelt. Unvollständige Eingaben bleiben während des Tippens stehen; unmögliche Daten und Werte außerhalb eines vorgegebenen Zeitraums verhindern das Absenden. Intern bleiben Datumswerte im ISO-Format gespeichert, damit die Daten unabhängig von Browser-Sprache und Sommerzeit auswertbar sind.

Der Reisekalender zeigt die zeitliche Einordnung deiner Ferien und Urlaube. Im allgemeinen **Zeitstrahl** vergrößerst oder verkleinerst du die Darstellung mit **+ / −** zwischen 1× und 8×. Die Datumsachse und ihre Abstände passen sich an den Zoom und die verfügbare Breite an. Bei vergrößerter Ansicht kannst du horizontal scrollen; **Einpassen** stellt den gesamten gewählten Zeitraum wieder dar. Personen-, Verbindungs- und Zeitraumfilter begrenzen die angezeigten Daten.

## Karte & Ortssuche

Standardmäßig ist die Karte vollständig lokal. Die enthaltenen groben Ländergrenzen eignen sich zum Überblick, nicht zur Straßennavigation. Neue Orte kannst du über Name, Breiten- und Längengrad erfassen.

In **Einstellungen → Online-Kartendetails & Ortssuche** kannst du OpenStreetMap-Straßenkarten und die serverseitige Nominatim-Suche einschalten. Dabei erhält der Dienst die IP deines Servers, die Suchbegriffe bzw. Kartenausschnitte. Der Browser spricht nur mit deinem MeetMap-Server. Die Ortssuche wird explizit ausgelöst, gecacht und auf maximal eine Anfrage pro Sekunde begrenzt. Kartenkacheln werden sieben Tage serverseitig zwischengespeichert. Es gibt keine Hintergrundvorabdownloads.

Für eigene Dienste sind `GEOCODER_URL` (Nominatim-kompatible API) und `TILE_URL_TEMPLATE` (zum Beispiel `http://tiles:8080/{z}/{x}/{y}.png`) konfigurierbar. Setze sie nur auf vertrauenswürdige Server. Im Compose-File kann die zusätzliche Tile-Variable unter `app.environment` gesetzt werden. Der Schalter für Kartendetails muss auch für lokale zusätzliche Dienste aktiv sein. In diesem Fall verlassen die Anfragen nur dein konfiguriertes Netzwerk. Die Beschriftung des Schalters beschreibt die Standardanbieter.

## Reisefotos und Aufnahme-Metadaten

Im Bereich **Reisen → Fotos importieren → Hochladen** kannst du Bilder zu deiner privaten Reisegalerie hinzufügen. Wähle eine Reise ausdrücklich aus oder verwende die automatische Zuordnung. Diese ordnet ein Foto nur dann zu, wenn sein Aufnahmedatum in genau einen deiner Reisezeiträume fällt. Bei überlappenden Reisen bleiben die Fotos unzugeordnet und die passenden Reisen werden zur Auswahl angeboten. Es wird keine Erinnerung automatisch angelegt.

Nur dieser ausdrücklich gewählte Fotoimport liest EXIF-Aufnahmedatum und GPS vor der Bildkonvertierung aus und speichert sie privat in der Datenbank. Ein vorhandener EXIF-Zeitzonenoffset wird berücksichtigt; ohne Offset bleibt die Kamerazeit als UTC-Zeit erhalten. Reisezuordnungen vergleichen den UTC-Kalendertag. Die ausgelieferten Bilder und Vorschauen enthalten weiterhin keine EXIF-Daten. Bereits früher hochgeladene, bereinigte Bilder enthalten diese Originaldaten nicht mehr: Sie lassen sich daraus nicht wiederherstellen. Importiere bei Bedarf die Originaldatei erneut oder ergänze Datum und Koordinaten manuell.

Fehlt das Datum, bleibt es unbekannt. Im Importformular kann unter **Wenn im Foto kein Datum gespeichert ist** ein Ersatzdatum angegeben werden. In den Fotodetails lassen sich Aufnahmedatum, Aufnahmeort und Reisezuordnung anschließend korrigieren. Gehört ein Foto schon zu einer Erinnerung, werden widersprüchliche Reisezuordnungen abgewiesen; bearbeite dann zunächst die Erinnerung oder löse das Foto daraus. Aus einem ausgewählten Foto kannst du selbst eine Erinnerung erstellen.

Angenommen werden JPEG, PNG, WebP und AVIF: höchstens **10 Bilder pro Import, 12 MB pro Bild, 64 MB pro Anfrage und 40 Millionen Eingangspixel**. Dateien werden anhand ihres Inhalts geprüft, dekodiert und auf maximal 2400 × 2400 Pixel als WebP gespeichert. MeetMap bewahrt damit keine verlustfreie Kopie der Originaldatei auf. HEIC/HEIF, RAW und Videos müssen vorher in eines der unterstützten Bildformate umgewandelt werden.

Für **Reisevorschläge aus Fotos** wählst du einen gespeicherten Heimatort in den Reiseeinstellungen. Standardmäßig werden mindestens zwei verschiedene fotografierte Tage außerhalb von 50 km um den Heimatort benötigt. Die Fotos müssen aufeinanderfolgende UTC-Tage bilden und innerhalb eines räumlichen Clusters von 50 km liegen. Bereits zugeordnete Fotos werden ausgeschlossen. Die Auswertung erzeugt ausschließlich Vorschläge mit Datumsbereich, Fotoliste und Belegen; du prüfst und speicherst eine Reise selbst. Sie berücksichtigt maximal die ersten 10.000 datierten GPS-Fotos ohne Reisezuordnung. Die gesonderte Foto-API liefert maximal 1.000 Fotos pro Abfrage und kennzeichnet eine Begrenzung mit `truncated`.

## Optionaler Immich-Import

MeetMap kann ausgewählte Bilder von deinem eigenen Immich-Server übernehmen. In Immich erstellst du für den Benutzer der gewünschten Bibliothek einen API-Schlüssel mit den Rechten **`asset.read` und `asset.download`**. Ein separater Schlüssel mit diesen Rechten genügt; MeetMap schreibt oder löscht keine Daten in Immich.

Ergänze die Serverkonfiguration in `.env`:

```dotenv
IMMICH_URL=http://dein-immich-server:2283
IMMICH_API_KEY=dein-separater-api-schluessel
```

Die Adresse muss aus dem MeetMap-Container erreichbar sein. Sie darf mit oder ohne `/api` enden. Verwende die endgültige, vertrauenswürdige Serveradresse: Weiterleitungen werden abgewiesen, damit der Schlüssel nicht an ein anderes Ziel weitergegeben wird. Zugangsdaten im URL, Suchparameter und URL-Fragmente sind nicht erlaubt. Der Schlüssel bleibt auf dem MeetMap-Server und wird weder an den Browser noch an externe KI-Dienste gesendet.

Übernimm die geänderten Compose-Umgebungsvariablen mit `docker compose up -d app`; bei nativem Betrieb startest du den Next-Prozess neu. Öffne anschließend **Reisen → Fotos importieren → Immich**. Nach dem Verbindungstest wählst du einen Datumsbereich von maximal einem Jahr, lädst die paginierte Textvorschau und markierst bis zu zehn Bilder. Die Vorschau zeigt Dateiname, Datum, vorhandenes GPS und in Immich erkannte Namen. Die API unterstützt bis zu 100 Einträge pro Seite; die Oberfläche lädt 24.

Beim Übernehmen lädt MeetMap die ausgewählten Originaldateien serverseitig, liest EXIF bzw. Immich-Metadaten und speichert die bereinigten Bildkopien privat. Es gelten dieselben Bildformate und Größenlimits wie beim lokalen Fotoimport. Pro Immich-Anfrage gelten 15 Sekunden Zeitlimit, 4 MB für Metadatenantworten und 12 MB für ein Originalbild. Erneute Importe derselben Immich-Asset-ID ergeben keine zweite Kopie, auch bei parallelen Anfragen. Erkannte Namen bleiben Hinweise in `sourcePeople`; gleichnamige Kontakte werden nicht automatisch verknüpft. Ein Datum oder Ort aus Immich ist keine externe Ortsrecherche.

Der Immich-Import ist eine ausdrücklich ausgelöste Übernahme ausgewählter Bilder. Er führt keine laufende Synchronisation durch: spätere Änderungen oder Löschungen in Immich ändern die bereits gespeicherten MeetMap-Kopien nicht. Die Voransicht ist eine Textliste; Bilder werden erst nach deiner Auswahl kopiert.

Ohne Konfiguration bleiben Upload, Reisegalerie und alle übrigen Funktionen verfügbar. Verbindungs-, Rechte-, Format- und Größenprobleme werden als konkrete Fehlermeldung angezeigt. Die aktuelle Anbindung nutzt Immichs weiterhin unterstützte, seitenbasierte Metadatensuche, die in Immich 2.x und 3.x vorhanden ist. Verwendete offizielle API-Endpunkte: [Metadatensuche](https://api.immich.app/endpoints/search/searchAssets), [Asset-Informationen](https://api.immich.app/endpoints/assets/getAssetInfo) und [Originaldatei herunterladen](https://api.immich.app/endpoints/assets/downloadAsset).

Die HTTP-Fotoprüfungen können nach Einrichtung der isolierten Instanz auf `localhost:3001` mit `node tests/integration/travel-photos.mjs` ausgeführt werden. Sie verwenden ausschließlich eigene `QA-PHOTO`-Datensätze, entfernen diese anschließend und stellen temporär geänderte Erkennungseinstellungen wieder her. Ein Live-Immich-Server wird dafür nicht benötigt; dessen Protokoll- und Schutzregeln werden zusätzlich mit simulierten Antworten in den Unit-Tests geprüft.

## Backups

Ein JSON-Export in der Oberfläche enthält Kontakte, Orte, Texte, Reise- und Ferienangaben sowie Bildmetadaten. **Er ist kein vollständiges Backup und enthält keine Bilddateien.**

Ein vollständiges, konsistentes Backup von Datenbank und Uploads:

```bash
./scripts/backup.sh
# Oder ein eigener Zielordner:
./scripts/backup.sh /sicherer/pfad/meetmap-backup
```

Das Skript stoppt die App kurz, erstellt `database.dump` und `uploads.tar.gz`, markiert den erfolgreichen Sicherungszeitpunkt und startet die App wieder. PostgreSQL bleibt dabei an. Das Zielverzeichnis wird mit privaten Dateirechten angelegt. Backups sind nicht verschlüsselt: bewahre sie auf einem geschützten Datenträger auf. Der lokale Standardordner `backups/` ist von Git und Docker-Build-Kontext ausgeschlossen. Automatisiere das Skript bei Bedarf über die Sicherungsverwaltung deines Homeservers.

### Wiederherstellen

Stelle zuerst sicher, dass das Backup zum gewünschten Zeitpunkt gehört. Die folgenden Schritte ersetzen die Ziel-Datenbank und den Inhalt des Ziel-Upload-Volumes. Sichere den bisherigen Stand separat, bevor du sie auf einer bestehenden Installation ausführst.

```bash
docker compose stop app
docker compose up -d --wait db
# Pfade jeweils auf dein Backup anpassen:
cat /sicherer/pfad/database.dump | docker compose exec -T db pg_restore \
  -U meetmap -d meetmap --clean --if-exists --no-owner
# Leere das Ziel-Upload-Verzeichnis nach eigener Prüfung, wenn es Daten enthält.
cat /sicherer/pfad/uploads.tar.gz | docker compose run --rm --no-deps -T \
  --entrypoint tar app xzf - -C /data
docker compose run --rm migrate
docker compose up -d app
```

Danach sind der ursprüngliche Owner-Account und dessen Passwort wiederhergestellt. Für einen Test der Wiederherstellung kannst du ein getrenntes Compose-Projekt mit eigenem `PORT`, Netzwerk und Volumes verwenden. Prüfe Login, eine Person, eine Erinnerung und ein Originalbild.

## Bestehende Installation aktualisieren

Erstelle vor dem Update ein vollständiges [Backup von Datenbank und Bildern](#backups) mit `./scripts/backup.sh` und bewahre auch die bisherige Konfiguration und den bisherigen Programmstand auf. Stelle danach den neuen Projektstand bereit. Verwende denselben Compose-Projektnamen, dieselbe `.env` und die vorhandenen Volumes. Neue optionale Variablen wie `IMMICH_URL` und `IMMICH_API_KEY` kannst du aus `.env.example` übernehmen; bestehende Passwörter und Serveradressen bleiben erhalten.

```bash
docker compose build app migrate
docker compose stop app
docker compose up -d --wait db
docker compose run --rm --no-deps migrate
```

Erst wenn die Migration erfolgreich abgeschlossen ist, startest du die App:

```bash
docker compose up -d app
docker compose logs --tail=80 app migrate
```

Die Migrationen für Reisen/Fotos (`20260912090000_travel`) und Vorfreude (`20260912110000_anticipation`) ergänzen Tabellen, optionale Verknüpfungen, Metadatenfelder und Indizes. Sie setzen die Datenbank nicht zurück und erhalten bestehende Personen, Erinnerungen und Bilddateien. Bereits entfernte EXIF-Daten werden durch das Update nicht wiederhergestellt. Verwende für Updates weder `prisma migrate reset` noch `docker compose down -v`.

Prüfe nach dem Start die Anmeldung, vorhandene Erinnerungen samt Bildern, die neuen Bereiche und `/api/readyz`. Falls eine Migration fehlschlägt, untersuche die Meldung, bevor du die App startest. Eine Rückkehr zum alten Stand erfolgt bei Bedarf mit dem gesicherten Programmstand und der zusammengehörigen Datenbank-/Bildsicherung gemäß [Wiederherstellen](#wiederherstellen); das reine Zurücksetzen von Programmdateien ist kein Datenbank-Rollback.

## Optionale lokale KI

```bash
docker compose --profile ai up -d
# Modell explizit installieren:
docker compose exec ollama ollama pull gemma3:4b
```

`OLLAMA_URL` wird in Compose auf `http://ollama:11434` gesetzt; `OLLAMA_DOCKER_URL` kann diesen Wert überschreiben. Das Modell lässt sich über `OLLAMA_MODEL` ändern. Der Download des Modells benötigt Internet; die spätere Auswertung läuft auf deinem Server. Die App fragt nur die konfigurierte lokale Ollama-Instanz an. Zusammenfassung: authentifiziertes `POST /api/ai/summarize` mit `{ "memoryId": "..." }` und korrektem Origin.

**Für v2 vorgesehen:** semantische Suche/Embeddings, automatische Tags, OCR und eine dauerhafte Background-Job-Queue. Diese Funktionen werden in v1 nicht als bereits indexiert oder verfügbar dargestellt. Freigabelinks und Gäste sind ebenfalls noch nicht implementiert.

## Entwicklung

Node.js 22.12+ und PostgreSQL 17. Für eine lokale Entwicklungs-Datenbank kann `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db` verwendet werden; nur dieses explizite Dev-Overlay veröffentlicht PostgreSQL auf `127.0.0.1:55439`. Passe `DATABASE_URL` entsprechend an. Die lokale `.env` benötigt eine passende `DATABASE_URL`, `APP_URL` und einen beschreibbaren `UPLOAD_DIR`.

```bash
npm ci
npm run db:migrate
npm run dev
```

Der Dev-Server läuft standardmäßig auf Port 3000. MapLibre-Worker und Shared-Modul werden beim Installieren und Bauen automatisch nach `public/maplibre/` kopiert. Das ist für den ESM-Worker mit Next/Turbopack erforderlich.

```bash
npm run typecheck
npm test
npm run build
```

Mit `npm run test:serve` wird über eine lokale Entwicklungsverbindung eine getrennte Datenbank `meetmap_test` angelegt und eine isolierte Instanz auf `localhost:3001` gestartet. Erlaubt sind nur PostgreSQL-URLs mit Loopback-Host ohne Query-Parameter. Die Datenbank wird über die Wartungsdatenbank `postgres` angelegt; verwende dafür eine Entwicklungs-Datenbankrolle mit CREATE-DATABASE-Recht. In CI muss `meetmap_test` bereits existieren; dort wird keine lokale `.env` geladen. `npm run test:integration` prüft Zugriffsschutz, Änderungen, Uploads und EXIF-Entfernung. Anschließend führen `npm run test:integration:travel` die Reise-, Foto- und Vorfreude-Prüfungen und `TEST_BASE_URL=http://localhost:3001 npm run test:e2e` die Playwright-Prüfungen aus.

Die API- und Upload-Integrationsskripte unter `tests/integration/` sind für die während der Entwicklung verwendete, getrennte Testinstanz auf `localhost:3001` ausgelegt und **nicht** gegen deine private Datenbank auszuführen. Sie verwenden eine ausdrücklich separate Testdatenbank und temporäre Zugangsdaten unter `work/`. `tests/e2e/security.spec.ts` enthält zusätzlich Playwright-Prüfungen für öffentliche Health-Endpunkte, Zugriffsschutz und Origin-Checks; `TEST_BASE_URL` konfiguriert deren Ziel.

### Continuous Integration

`.github/workflows/ci.yml` läuft bei Pull Requests nach `main`, Pushes auf `main` und manuell über **Actions → CI → Run workflow**. Feature-Branches werden über ihren Pull Request geprüft, um doppelte Push-/PR-Läufe zu vermeiden. Ein Job führt TypeScript und Vitest aus, ein zweiter alle Integrationsskripte und die bestehenden Chromium-Tests. Beide verwenden Node.js 22 und `npm ci`; der Postinstall-Schritt generiert den Prisma-Client bereits.

Der Integrationsjob verwendet einen frischen PostgreSQL-17-Service mit der Datenbank `meetmap_test`, ausschließlich temporären Zugangsdaten und Uploads unter `work/test-uploads`. Er erhält keine Repository-Secrets, keine Produktionsumgebung und keine privaten Volumes. Immich bleibt unkonfiguriert; KI-, Geocoder- und Tile-URLs zeigen auf einen unbenutzten Loopback-Port. Die für den Vorfreude-Test erforderliche `.env` wird ausschließlich aus der Test-URL neu geschrieben. Das Testserver-Skript akzeptiert in CI nur eine lokale `meetmap_test`-URL und erzeugt ein zufälliges Owner-Passwort.

`bash scripts/test-ci.sh` startet den Testserver genau einmal, wartet höchstens rund 180 Sekunden auf `/api/readyz` (Datenbank, Schema und Upload-Schreibzugriff) und führt API/Uploads, Reisen/Fotos/Vorfreude und Playwright nacheinander aus. Frühe Serverabbrüche und Migrationsfehler schlagen fehl. Die Suiten laufen nach einem Testfehler weiter, der Gesamtlauf bleibt fehlgeschlagen; nach Erfolg, Fehler oder Abbruch wird die Prozessgruppe beendet. Serverlog, Playwright-Bericht und Fehler-Traces werden sieben Tage als `test-diagnostics` aufbewahrt, ohne `.env`, Zugangsdaten, Cookies oder Upload-Verzeichnis zu archivieren.

**Abdeckungsgrenzen:** Die fünf vorhandenen Playwright-Tests prüfen Zugriffsschutz, Origin-Regeln, Health und die Weiterleitung zur Anmeldung. Angemeldete Browserabläufe für Profile, Erinnerungen, Reisen, Galerie und interaktive Karten fehlen noch; die entsprechenden API- und Unit-Prüfungen ersetzen diese nicht. CI verwendet den Dev-Server und prüft weder Produktionsbuild/Container noch Live-Immich, Ollama oder Online-Kartendienste. Eine erfolgreiche CI verhindert einen Merge nur, wenn die beiden Jobs zusätzlich als verpflichtende Statusprüfungen in GitHub eingerichtet sind.

## Betrieb und Grenzen

- `GET /api/healthz`: Prozess lebt. `GET /api/readyz`: Umgebungsvariablen, Datenbank/Schema und Upload-Schreibzugriff verfügbar. Beide Endpunkte enthalten keine privaten Daten.
- Die App läuft als unprivilegierter Benutzer mit UID/GID 1001. Ein eigenes Host-Verzeichnis für Uploads muss für diese ID beschreibbar sein.
- Die Daten werden in den Compose-Volumes `postgres` und `uploads` dauerhaft gespeichert. `docker compose down` erhält sie; `down -v` würde sie löschen.
- Verwaiste, nicht mit einer Erinnerung verknüpfte Uploads sind nach abgebrochenen Formularen möglich; automatische Speicherbereinigung ist noch nicht enthalten. Originale werden für Speichergrenzen auf maximal 2400 × 2400 Pixel normalisiert, nicht verlustfrei archiviert.
- Die Oberfläche lädt in v1 den privaten Datenbestand als Ganzes. Für sehr große Sammlungen sind Pagination, serverseitige Suchindizes und ein Job-System der nächste Ausbauschritt.
- Ein Code- und Funktionstest ist keine unabhängige Sicherheitszertifizierung. Vor einer offenen Internetfreigabe sind TLS, Firewall, Update-/Backup-Konzept und eine separate Sicherheitsprüfung sinnvoll.

## Bild- und Kartenquellen

Die optionalen Beispielgeschichten sind fiktiv. Die drei Fotos sind unter der [Unsplash-Lizenz](https://unsplash.com/license) enthalten:

- [Comer See — Mariya Georgieva](https://unsplash.com/photos/yellow-boat-docked-near-building-wwV3ZMLaAmg)
- [Dolomiten — Hikerwise.com](https://unsplash.com/photos/a-man-hiking-up-a-trail-in-the-mountains-l3fkqYm1_5E)
- [Café — Gabriel Forsberg](https://unsplash.com/photos/cooked-bread-on-plate-1h1dyDxL31g)

Die Offline-Karte verwendet [Natural Earth 1:110m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson), [Public Domain](https://www.naturalearthdata.com/about/terms-of-use/). Online-Karten: [OpenStreetMap](https://www.openstreetmap.org/copyright). Technische Hinweise: [MapLibre-Installation](https://maplibre.org/maplibre-gl-js/docs/) und [Nominatim-Nutzungsrichtlinie](https://operations.osmfoundation.org/policies/nominatim/).
