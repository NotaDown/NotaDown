# README screenshot

Regenerates [`docs/image/screenshot.png`](../../docs/image/screenshot.png), the image below the title in the README.

## Usage

```bash
pnpm install
pnpm screenshot:readme
```

`capture.mjs` starts the Vite dev server on port 5813 if nothing is listening there, then drives the web app in headless Chrome over CDP: it injects a demo workspace (`field-notes`) and three documents into the Pinia stores, applies the Paper theme, and captures a 1600×1000 page at 2× scale.

Options: `--out <png>`, `--theme <default|paper|nordic|contrast>`, `--mode <light|dark>`, `--scale`, `--width`, `--height`, `--scroll`, `--url`, `--chrome <exe>`.

Requirements: Chrome (or `CHROME_PATH` / `--chrome`), with ports 5813 and 9333 free. The temporary Chrome profile lives in the system temp directory.
