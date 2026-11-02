// Generates PWA icons into public/icons from an inline SVG (run: npm run icons).
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a4145"/><stop offset="1" stop-color="#13775f"/></linearGradient></defs>
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="url(#g)"/>
  <g transform="translate(256 236) scale(${pad ? 0.78 : 1})">
    <circle r="118" fill="none" stroke="#ffffff" stroke-width="34"/>
    <circle r="46" fill="#9cd6c6"/>
    ${Array.from({ length: 8 }, (_, i) => `<rect x="-20" y="-168" width="40" height="52" rx="8" fill="#ffffff" transform="rotate(${i * 45})"/>`).join("")}
  </g>
  <text x="256" y="${pad ? 430 : 462}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="${pad ? 54 : 64}" fill="#ffffff" letter-spacing="4">KAAFIYE</text>
</svg>`;

mkdirSync("public/icons", { recursive: true });
const out = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
];
for (const [name, size, pad] of out) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log("wrote", name);
}
await sharp(Buffer.from(svg(false))).resize(48, 48).png().toFile("src/app/icon.png");
console.log("wrote src/app/icon.png");
