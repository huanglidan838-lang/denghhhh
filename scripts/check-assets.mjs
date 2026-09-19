import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const pageDir = path.resolve("public/portfolio/pages");
const coverDir = path.resolve("public/portfolio/covers");
const photographyDir = path.resolve("public/portfolio/photography");
const meituDir = path.resolve("public/portfolio/meitu");
const travelDir = path.resolve("public/portfolio/travel");
const photoArchiveDir = path.resolve("public/portfolio/photo-archive");
const handcraftDir = path.resolve("public/portfolio/handcraft");
const updatedDir = path.resolve("public/portfolio/updated");
const thumbnailDir = path.resolve("public/portfolio/thumbs");
const pages = (await readdir(pageDir)).filter((name) => /^page-\d{2}\.webp$/.test(name)).sort();
const covers = (await readdir(coverDir)).filter((name) => name.endsWith(".webp")).sort();
const photography = (await readdir(photographyDir)).filter((name) => name.endsWith(".webp")).sort();
const meitu = (await readdir(meituDir)).filter((name) => name.endsWith(".webp")).sort();
const travel = (await readdir(travelDir)).filter((name) => name.endsWith(".webp")).sort();
const photoArchive = (await readdir(photoArchiveDir)).filter((name) => name.endsWith(".webp")).sort();
const handcraft = (await readdir(handcraftDir)).filter((name) => name.endsWith(".webp")).sort();
const updated = (await readdir(updatedDir)).filter((name) => name.endsWith(".webp")).sort();
const thumbnails = (await readdir(thumbnailDir)).filter((name) => name.endsWith(".webp")).sort();
assert.equal(pages.length, 42, "作品集必须包含 42 张页面图片");
assert.equal(covers.length, 21, "二十一个项目都必须具有独立横向封面");
assert.equal(photography.length, 12, "三类摄影项目必须拆分为十二张单图");
assert.equal(meitu.length, 19, "九个美图项目必须包含十九张作品图");
assert.equal(travel.length, 49, "云南、川西、新疆和福建摄影图集必须包含四十九张作品图");
assert.equal(photoArchive.length, 28, "人像与产品摄影图集必须包含二十八张作品图");
assert.equal(handcraft.length, 1, "手作设计使用最新的一张作品总览图");
assert.equal(updated.length, 64, "新版作品集必须包含五十八张编号页面、五张分类作品图与万里茶山封面");
assert.equal(thumbnails.length, 25, "每个项目必须具有独立轻量封面");
assert.equal(updated[0], "aigc-design.webp");
for (let pageNumber = 1; pageNumber <= 58; pageNumber += 1) {
  assert.ok(updated.includes(`page-${String(pageNumber).padStart(2, "0")}.webp`), `缺少新版作品集第 ${pageNumber} 页`);
}
assert.equal(pages[0], "page-01.webp");
assert.equal(pages.at(-1), "page-42.webp");

let total = 0;
for (const name of pages) {
  const size = (await stat(path.join(pageDir, name))).size;
  assert.ok(size < 800_000, `${name} 超过 800KB`);
  total += size;
}
for (const name of covers) {
  const size = (await stat(path.join(coverDir, name))).size;
  assert.ok(size < 250_000, `${name} 封面超过 250KB`);
}
for (const name of photography) {
  const size = (await stat(path.join(photographyDir, name))).size;
  assert.ok(size < 300_000, `${name} 摄影单图超过 300KB`);
}
let meituTotal = 0;
for (const name of meitu) {
  const size = (await stat(path.join(meituDir, name))).size;
  assert.ok(size < 500_000, `${name} 美图项目图片超过 500KB`);
  meituTotal += size;
}
assert.ok(meituTotal < 5_000_000, `美图项目图片总量 ${(meituTotal / 1_000_000).toFixed(2)}MB 超过 5MB`);
let travelTotal = 0;
for (const name of travel) {
  const size = (await stat(path.join(travelDir, name))).size;
  assert.ok(size < 550_000, `${name} 地区摄影图片超过 550KB`);
  travelTotal += size;
}
assert.ok(travelTotal < 20_000_000, `地区摄影图片总量 ${(travelTotal / 1_000_000).toFixed(2)}MB 超过 20MB`);
let photoArchiveTotal = 0;
for (const name of photoArchive) {
  const size = (await stat(path.join(photoArchiveDir, name))).size;
  assert.ok(size < 800_000, `${name} 分类摄影图片超过 800KB`);
  photoArchiveTotal += size;
}
assert.ok(photoArchiveTotal < 8_000_000, `人像与产品摄影图片总量 ${(photoArchiveTotal / 1_000_000).toFixed(2)}MB 超过 8MB`);
let handcraftTotal = 0;
for (const name of handcraft) {
  const size = (await stat(path.join(handcraftDir, name))).size;
  assert.ok(size < 650_000, `${name} 手作设计图片超过 650KB`);
  handcraftTotal += size;
}
assert.ok(handcraftTotal < 5_000_000, `手作设计图片总量 ${(handcraftTotal / 1_000_000).toFixed(2)}MB 超过 5MB`);
let updatedTotal = 0;
for (const name of updated) {
  const size = (await stat(path.join(updatedDir, name))).size;
  assert.ok(size < 650_000, `${name} 新版作品图片超过 650KB`);
  updatedTotal += size;
}
assert.ok(updatedTotal < 13_000_000, `新版作品集图片总量 ${(updatedTotal / 1_000_000).toFixed(2)}MB 超过 13MB`);
let thumbnailTotal = 0;
for (const name of thumbnails) {
  const size = (await stat(path.join(thumbnailDir, name))).size;
  assert.ok(size < 150_000, `${name} 项目封面超过 150KB`);
  thumbnailTotal += size;
}
assert.ok(thumbnailTotal < 2_000_000, `项目封面总量 ${(thumbnailTotal / 1_000_000).toFixed(2)}MB 超过 2MB`);
assert.ok(total < 7_000_000, `作品图片总量 ${(total / 1_000_000).toFixed(2)}MB 超过 7MB`);
for (const asset of ["public/portfolio/portrait.webp", "public/portfolio/scene/ocean-view.webp", "public/og.png", "public/fonts/xiangjiao-kuanmaoshualinggan.ttf"]) await stat(asset);
const fontSize = (await stat("public/fonts/xiangjiao-kuanmaoshualinggan.ttf")).size;
assert.ok(fontSize < 500_000, "场景字体子集超过 500KB");
const headlineFontSize = (await stat("public/fonts/portfolio-headline.ttf")).size;
assert.ok(headlineFontSize < 350_000, "标题字体子集超过 350KB");

if (process.argv.includes("--bundle")) {
  const chunkDir = path.resolve("dist/client/_next/static/chunks");
  const chunks = (await readdir(chunkDir)).filter((name) => name.endsWith(".js"));
  const sizes = await Promise.all(chunks.map(async (name) => ({ name, size: (await stat(path.join(chunkDir, name))).size })));
  const largest = sizes.sort((a, b) => b.size - a.size)[0];
  assert.ok(largest.size < 691_000, `${largest.name} 超过 691KB`);
  console.log(`bundle ok · largest ${(largest.size / 1000).toFixed(0)}KB`);
}

console.log(`assets ok · ${pages.length} archive pages · ${updated.length} updated portfolio images · ${thumbnails.length} lightweight covers · ${covers.length} legacy covers · ${photography.length} single photos · ${meitu.length} meitu slides · ${travel.length} travel photos · ${photoArchive.length} portrait/product photos · ${handcraft.length} handcraft photos`);
