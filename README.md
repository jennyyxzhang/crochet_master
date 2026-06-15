# Crochet Studio

A little web app for designing and visualizing **flat crochet color work**
(tapestry / C2C / "graphghan" style patterns). Built with React + Vite +
TypeScript + Tailwind CSS. No backend — your designs are saved in your browser.

## Tools

### 📐 Size Calculator
Turn yarn weight + hook size (or your own measured gauge) into finished
dimensions, and work backwards from a target size to the stitch/row counts you
need. Includes a rough yardage estimate.

### 🎨 Grid Designer
Paint your own color chart on a grid: paint / fill / erase / eyedropper tools, a
color palette you can edit, undo/redo, live stitch counts, finished-size
readout, and PNG/PDF export. Patterns save to your browser.

### 🖼️ Image → Pattern
Upload a photo, pixelate it to a crochet grid (color count is reduced with
median-cut quantization, and can snap to a real-yarn palette), then follow it
**row by row** with a guided highlighter that respects the back-and-forth
reading direction of flat crochet.

## A note on gauge & proportions

Gauge (stitches & rows per 4 in / 10 cm) depends on your yarn, hook, and
tension, so the most accurate results come from measuring a swatch. Crochet
stitches are usually **wider than tall**, so the app can render the grid in
"true stitch proportions" using your gauge — otherwise a chart that looks right
on screen comes out squished once crocheted.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # typecheck + production build
npm run lint     # eslint
npm run preview  # preview the production build
```

## Roadmap

- Amigurumi (worked-in-the-round) pattern generator
