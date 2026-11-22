# Tout en PDF (première version)

Site qui transforme n'importe quel fichier en PDF, entièrement dans le navigateur : aucun fichier n'est envoyé sur un serveur.

## L'essayer
Téléchargez le dossier (ou `tout-en-pdf.zip`), décompressez-le et double-cliquez sur `index.html`. Ça marche même sans Internet.

## Formats pris en charge
- Images : JPG, PNG, WEBP, GIF, BMP, SVG, AVIF (HEIC seulement sous Safari)
- PDF existants (pages recopiées telles quelles)
- Word .docx, Excel .xlsx/.xls/.ods/.csv, PowerPoint .pptx
- Texte, Markdown, HTML, JSON, XML, code…

Pas encore : .doc, .ppt, .odt, .rtf (il faudrait un serveur avec LibreOffice).

## Fonctions
Plusieurs fichiers, ordre par glisser-déposer ou flèches, un seul PDF ou un PDF par fichier (zip), format A4 / Lettre / taille de l'image, coller une image (Ctrl+V).

## Mettre en ligne
Site 100 % statique : il suffit de copier le dossier sur un hébergeur gratuit (GitHub Pages, Netlify, Cloudflare Pages…).

## Limites connues
- Les pages issues de Word, Excel, PowerPoint, texte et HTML sont des images : le texte n'est pas sélectionnable dans le PDF.
- La mise en page Word/PowerPoint est simplifiée par rapport à Office.

Bibliothèques incluses dans `vendor/` : pdf-lib, html2canvas, mammoth, SheetJS, JSZip, marked.
