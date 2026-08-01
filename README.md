# Ostfriesland Bilder

Mattschwarze, responsive Fotogalerie für Nikon-RAW-Dateien. Die Oberfläche läuft auf GitHub Pages; Original-NEFs und die größten eingebetteten JPEG-Vorschauen liegen als GitHub-Release-Assets.

## Lokaler Start

```powershell
npm.cmd install
npm.cmd run import:initial
npm.cmd run dev
```

Der Import liest standardmäßig `ofrila07/`, ignoriert ZIP-Dateien, extrahiert pro NEF die größte valide JPEG-Vorschau und erzeugt ein WebP-Thumbnail. Originale werden niemals verändert. `.gitignore` verhindert, dass NEFs, ZIPs und temporäre Release-Dateien im Git-Repository landen.

## Veröffentlichung

1. GitHub CLI für `flohuawei39-commits` anmelden.
2. Öffentliches Repository `ostfriesland-bilder` erstellen und `main` pushen.
3. `npm.cmd run release:initial` ausführen, um fehlende Release-Assets fortsetzbar hochzuladen.
4. Den Pages-Workflow abwarten und die öffentliche URL prüfen.

Der Adminbereich benötigt zusätzlich einen Fine-grained Personal Access Token, der ausschließlich auf dieses Repository beschränkt ist und `Contents: Read and write` besitzt. Der Token wird nur im Arbeitsspeicher der aktuellen Browserseite gehalten.

## Sicherheitsgrenze

Die statische Anmeldung ist bewusst nur eine Sichtschranke. Repository, Manifest und direkte Release-Downloads sind öffentlich. Die Kennwörter stehen nicht im Klartext im Repository, ein technisch versierter Besucher kann die Oberfläche jedoch umgehen.

