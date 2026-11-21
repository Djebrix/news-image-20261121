// THE WORLD IN ONE DAY - 21 November 2026
// A newspaper front page drawn from scratch with Node built-ins only.
// Writes a deterministic 1024x1024 PNG to /output/entry.png.

import * as fs from "node:fs";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------- CRC32 (IEEE 802.3) ----------
const CRC_TABLE: number[] = (() => {
  const table: number[] = new Array<number>(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width: number, height: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // no interlace
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Canvas ----------
type RGB = [number, number, number];
const PAPER: RGB = [248, 246, 238];
const INK: RGB = [18, 18, 18];
const RED: RGB = [172, 32, 32];
const GREY: RGB = [110, 108, 100];

class Sheet {
  readonly w: number;
  readonly h: number;
  readonly px: Buffer;
  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.px[i * 3] = bg[0];
      this.px[i * 3 + 1] = bg[1];
      this.px[i * 3 + 2] = bg[2];
    }
  }
  dot(x: number, y: number, c: RGB): void {
    // Floor coordinates: fractional indices on a Buffer silently write
    // nowhere (they become expando properties), so never pass floats on.
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const o = (iy * this.w + ix) * 3;
    this.px[o] = c[0];
    this.px[o + 1] = c[1];
    this.px[o + 2] = c[2];
  }
  fill(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.dot(xx, yy, c);
    }
  }
  frame(x: number, y: number, w: number, h: number, c: RGB, t: number): void {
    this.fill(x, y, w, t, c);
    this.fill(x, y + h - t, w, t, c);
    this.fill(x, y, t, h, c);
    this.fill(x + w - t, y, t, h, c);
  }
}

// ---------- 5x7 bitmap font (all-caps newspaper face) ----------
// Each glyph is 7 rows of 5 cells; "#" is ink, "." is blank.
const GLYPHS: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
  "%": ["##...", "##...", "...#.", "..#..", ".#...", "...##", "...##"],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  "&": [".###.", "#...#", "#.#..", ".#.#.", "#.#.#", "#..#.", ".##.#"],
  "$": ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "*": [".....", ".#.#.", "..#..", "#####", "..#..", ".#.#.", "....."],
};

// ---------- Text ----------
function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawGlyph(s: Sheet, ch: string, x: number, y: number, scale: number, c: RGB): void {
  const g = GLYPHS[ch] ?? GLYPHS["?"];
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === "#") s.fill(x + col * scale, y + r * scale, scale, scale, c);
    }
  }
}

function drawText(s: Sheet, text: string, x: number, y: number, scale: number, c: RGB): number {
  let cx = x;
  for (const ch of text) {
    if (ch !== " ") drawGlyph(s, ch, cx, y, scale, c);
    cx += 6 * scale;
  }
  return cx;
}

function drawCentred(s: Sheet, text: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(s, text, Math.floor(cx - textWidth(text, scale) / 2), y, scale, c);
}

// Split text on explicit newlines, then wrap each part to maxW.
function wrapLines(text: string, maxW: number, scale: number): string[] {
  const out: string[] = [];
  for (const part of text.split("\n")) {
    const words = part.split(" ").filter((w) => w !== "");
    let cur = "";
    for (const word of words) {
      const trial = cur === "" ? word : cur + " " + word;
      if (textWidth(trial, scale) <= maxW || cur === "") cur = trial;
      else {
        out.push(cur);
        cur = word;
      }
    }
    if (cur !== "") out.push(cur);
  }
  return out;
}

// Draw a (possibly multi-line) paragraph; returns the y below it.
function drawPara(
  s: Sheet,
  text: string,
  x: number,
  y: number,
  maxW: number,
  scale: number,
  c: RGB,
  leading: number,
): number {
  let yy = y;
  for (const line of wrapLines(text, maxW, scale)) {
    drawText(s, line, x, yy, scale, c);
    yy += leading;
  }
  return yy;
}

// Horizontal bar chart of negative moves (losses in red).
// Returns the y below the chart.
function drawBars(
  s: Sheet,
  items: { label: string; value: number }[],
  x: number,
  y: number,
  maxBarW: number,
  scale: number,
): number {
  const maxV = Math.max(...items.map((it) => Math.abs(it.value)));
  const labelW = 13 * 6 * scale;
  const rowH = 18 * scale;
  const barH = 9 * scale;
  let yy = y;
  for (const it of items) {
    drawText(s, it.label, x, yy, scale, INK);
    const bw = Math.max(2, Math.round((Math.abs(it.value) / maxV) * maxBarW));
    s.fill(x + labelW, yy + 1, bw, barH, RED);
    drawText(s, it.value.toFixed(1) + "%", x + labelW + bw + 8, yy, scale, RED);
    yy += rowH;
  }
  return yy;
}

// ---------- Front page ----------
function main(): void {
  const s = new Sheet(W, H, PAPER);
  const MX = 28; // side margin
  const CW = W - MX * 2; // content width: 968
  const colW = Math.floor((CW - 24) / 2); // two-column width: 472
  const col2X = MX + colW + 24;

  s.frame(12, 12, W - 24, H - 24, INK, 3);

  // Masthead
  drawCentred(s, "THE WORLD IN ONE DAY", W / 2, 30, 8, INK);
  s.fill(MX, 96, CW, 4, RED);
  drawCentred(s, "SATURDAY 21 NOVEMBER 2026", W / 2, 108, 3, INK);
  s.fill(MX, 138, CW, 2, INK);

  let y = 152;

  // Lead story: war in Ukraine
  drawText(s, "WAR IN UKRAINE", MX, y, 2, RED);
  y += 22;
  y = drawPara(
    s,
    "RUSSIA'S BIGGEST ATTACKS\nOF THE YEAR ON UKRAINE",
    MX, y, CW, 4, INK, 38,
  );
  y += 8;
  y = drawPara(
    s,
    "MORE THAN 400 DRONES AND 110 MISSILES HIT UKRAINE IN THE LARGEST ATTACK OF THE YEAR. EIGHT PEOPLE WERE KILLED IN KYIV. MISSILES AND A DRONE CAME DOWN IN POLAND, AND PRIME MINISTER TUSK CALLED IT A DELIBERATE PROVOCATION.",
    MX, y, CW, 2, INK, 22,
  );
  y += 12;

  // Stat boxes
  const stats: [string, string][] = [
    ["400+", "DRONES"],
    ["110+", "MISSILES"],
    ["8", "KILLED IN KYIV"],
    ["20", "WOUNDED IN KRYVYI RIH"],
  ];
  const boxW = Math.floor((CW - 3 * 12) / 4);
  const boxH = 124;
  for (let i = 0; i < stats.length; i++) {
    const bx = MX + i * (boxW + 12);
    s.frame(bx, y, boxW, boxH, INK, 2);
    drawCentred(s, stats[i][0], bx + boxW / 2, y + 16, 4, RED);
    drawCentred(s, stats[i][1], bx + boxW / 2, y + 66, 1, INK);
  }
  y += boxH + 16;
  s.fill(MX, y, CW, 2, INK);
  y += 18;

  // Middle row, left: ICJ genocide ruling
  let yL = y;
  yL = drawPara(
    s,
    "ICJ: MYANMAR GUILTY OF\nGENOCIDE AGAINST THE\nROHINGYA",
    MX, yL, colW, 3, INK, 28,
  );
  yL += 6;
  yL = drawPara(
    s,
    "THE INTERNATIONAL COURT OF JUSTICE RULED MYANMAR RESPONSIBLE FOR GENOCIDE AGAINST THE ROHINGYA, THE FIRST TIME ANY INTERNATIONAL COURT HAS FOUND A STATE GUILTY OF GENOCIDE.",
    MX, yL, colW, 2, INK, 22,
  );

  // Middle row, right: market sell-off
  let yR = y;
  yR = drawPara(
    s,
    "AI SELL-OFF: S&P 500\nIN CORRECTION",
    col2X, yR, colW, 3, INK, 28,
  );
  yR += 6;
  yR = drawPara(
    s,
    "FEARS OVER AI SPENDING HIT MARKETS AROUND THE WORLD.",
    col2X, yR, colW, 2, INK, 22,
  );
  yR += 4;
  yR = drawBars(
    s,
    [
      { label: "NASDAQ", value: -5.3 },
      { label: "NIKKEI", value: -5.1 },
      { label: "S&P 500", value: -3.7 },
      { label: "FTSE 100", value: -1.0 },
    ],
    col2X, yR, 260, 1,
  );

  y = Math.max(yL, yR) + 18;
  s.fill(MX, y, CW, 2, INK);
  y += 18;

  // Lower row, left: COP31
  let y3L = y;
  y3L = drawPara(
    s,
    "COP31 RUNS PAST\nDEADLINE IN ANTALYA",
    MX, y3L, colW, 3, INK, 28,
  );
  y3L += 6;
  y3L = drawPara(
    s,
    "CLIMATE TALKS OVERRAN AS COUNTRIES SPLIT OVER FOSSIL FUELS.",
    MX, y3L, colW, 2, INK, 22,
  );

  // Lower row, right: UK-EU deals
  let y3R = y;
  y3R = drawPara(
    s,
    "UK AND EU SIGN BIGGEST\nPOST-BREXIT DEALS",
    col2X, y3R, colW, 3, INK, 28,
  );
  y3R += 6;
  y3R = drawPara(
    s,
    "THE AGREEMENTS COVER FOOD EXPORTS, CARBON MARKETS AND YOUTH MOBILITY.",
    col2X, y3R, colW, 2, INK, 22,
  );

  y = Math.max(y3L, y3R) + 18;
  s.fill(MX, y, CW, 2, INK);
  y += 18;

  // Also today strip
  drawText(s, "ALSO TODAY", MX, y, 2, RED);
  y += 22;
  const also: string[] = [
    "6.8-MAGNITUDE QUAKE HITS PERU",
    "ANTHROPIC SHARES SLIDE AFTER $2TN DEBUT",
    "FBI DATABASE HACKED",
    "HOUTHI MISSILES AT RIYADH INTERCEPTED",
    "DENMARK EXPELS RUSSIAN DIPLOMAT",
    "BAYER PAYS $7.25BN OVER ROUNDUP",
  ];
  for (let i = 0; i < also.length; i++) {
    const ax = MX + (i % 2) * (colW + 24);
    const ay = y + Math.floor(i / 2) * 26;
    s.fill(ax, ay + 2, 8, 8, RED);
    drawText(s, also[i], ax + 14, ay, 1, INK);
  }
  y += 3 * 26 + 12;

  // Footer
  s.fill(MX, y, CW, 2, INK);
  drawCentred(s, "THE WORLD IN ONE DAY - 21 NOVEMBER 2026", W / 2, y + 10, 1, INK);

  const png = encodePNG(W, H, s.px);
  fs.mkdirSync("/output", { recursive: true });
  fs.writeFileSync("/output/entry.png", png);
}

main();
