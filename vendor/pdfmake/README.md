# Local PDF runtime

`pdfmake.min.js` is the unmodified browser bundle from npm `pdfmake@0.2.20`; `LICENSE` is its MIT license. `vfs_fonts.js` embeds Noto Sans Regular and Bold TTFs for offline text rendering, including Hausa Latin characters. The pdfmake package's default Roboto subset omitted those characters in the PDF fixture and is not used. No CDN or runtime font/image fetch is used.

Source: https://github.com/bpampuch/pdfmake/tree/0.2.20

Noto Sans fonts and `OFL-NotoSans.txt` come from https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans and that repository's `LICENSE` (SIL OFL 1.1).

To update deliberately, obtain the pinned npm package and copy its `build/pdfmake.min.js` and `LICENSE`. Preserve the Noto font bundle: it maps `NotoSans-Regular.ttf` and `NotoSans-Bold.ttf` to base64 TTF data, then registers that map with `pdfMake.addVirtualFileSystem` (or exports it for Node tests). Rerun the PDF generation/embedding and Hausa text extraction checks, then inspect a rendered fixture. This is a vendored dependency, not application code.
