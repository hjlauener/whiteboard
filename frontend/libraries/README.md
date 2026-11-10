# Formen-Bibliotheken

Bibliotheken von [libraries.excalidraw.com](https://libraries.excalidraw.com/)
(Stand November 2026). Alle Bibliotheken dort stehen unter der MIT-Lizenz.
Die Seitenleiste „Formen“ (`src/shapes/ShapesSidebar.tsx`) fasst sie zu drei
Sammlungen zusammen: Grundformen als Standard, die beiden anderen für die Lehre.

| Sammlung | Datei | Bibliothek | Autor/in | Downloads |
|---|---|---|---|---|
| Grundformen | `basic-shapes.excalidrawlib` | Basic shapes | Pablo Gil Fernández | 16 060 |
| Grundformen | `3d-shapes.excalidrawlib` | 3D Shapes | Andre Costa | 2 527 |
| Figuren und Sprechblasen | `stick-figures.excalidrawlib` | Stick Figures | Youri Tjang | 58 169 |
| Figuren und Sprechblasen | `stick-people.excalidrawlib` | Stick people | David Hurt | 6 719 |
| Figuren und Sprechblasen | `bubbles.excalidrawlib` | Bubbles | Oscar Capraro | 14 400 |
| Diagramme und Mathematik | `data-viz.excalidrawlib` | Data Viz | dbs-sticky | 40 627 |
| Diagramme und Mathematik | `math-teacher-library.excalidrawlib` | Math Teacher Library | Yatrik Patel | 7 829 |

„Stick Figures Collaboration“ ist bewusst nicht dabei: Als Autor ist Freepik
angegeben, dessen Grafiken eine eigene Lizenz mit Namensnennung haben.

Der Build kopiert die Dateien nach `js/dist/libraries/` (der Ordner wird
vorher geleert); die Seitenleiste lädt sie bei Bedarf.
