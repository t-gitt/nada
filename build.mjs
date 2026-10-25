// Builds the site into dist/:
//   content/*.yml + src/index.html  ->  dist/index.html
//   media/** (any size jpg/png/webp)  ->  dist/img/*.webp (+ -sm thumbnails)
// Processed images are cached in .cache/img so rebuilds only touch new uploads.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import Mustache from 'mustache';
import YAML from 'yaml';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, '.cache/img');

// The four rooms each have their own hand-made layout, so their order is fixed here.
const ROOMS = [
  { id: 'early', nav: 'Early', num: 'I', layout: 'wall', eyes: 3 },
  { id: 'charcoal', nav: 'Charcoal', num: 'II', layout: 'masonry', eyes: 3 },
  { id: 'ink', nav: 'Ink', num: 'III', layout: 'ink-track', eyes: 3 },
  { id: 'digital', nav: 'Digital', num: 'IV', layout: 'cinema', eyes: 4 },
];
const DIVIDERS = [
  'M10 50 C 120 10, 180 70, 300 40 S 480 10, 560 45 S 700 75, 820 35 S 1000 20, 1080 50 S 1170 60, 1190 30',
  'M10 30 C 160 70, 240 10, 380 42 S 560 70, 640 30 S 820 8, 900 46 S 1080 70, 1190 40',
  'M10 44 C 140 20, 260 66, 400 38 S 600 12, 700 48 S 880 70, 980 30 S 1140 40, 1190 56',
];
const FULL = 2000;
const THUMB = 760;

const readYaml = async (p) => YAML.parse(await fs.readFile(path.join(ROOT, p), 'utf8')) ?? {};

// Escape for HTML, then turn *words* into <em>words</em>
const escape = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rich = (s) => escape(String(s ?? '').trim()).replace(/\*([^*]+)\*/g, '<em>$1</em>');

const plain = (s) => String(s).replace(/<\/?em>/g, '');

const isImagePath = (v) => typeof v === 'string' && /^\/?media\/.+\.(jpe?g|png|webp|gif|tiff?|avif|heic)$/i.test(v.trim());

const processed = new Map();
async function image(ref) {
  const rel = ref.trim().replace(/^\//, '');
  if (processed.has(rel)) return processed.get(rel);
  const src = path.join(ROOT, rel);
  if (!existsSync(src)) throw new Error(`Image not found: ${ref}`);

  const buf = await fs.readFile(src);
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
  const base = rel.replace(/^media\//, '').replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const name = `${base}-${hash}`;
  const full = path.join(CACHE, `${name}.webp`);
  const sm = path.join(CACHE, `${name}-sm.webp`);

  if (!existsSync(full) || !existsSync(sm)) {
    const img = sharp(buf).rotate(); // respect phone-camera orientation
    await img.clone().resize(FULL, FULL, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(full);
    await img.clone().resize(THUMB, THUMB, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toFile(sm);
    console.log(`  processed ${rel}`);
  }
  const { width: w, height: h } = await sharp(full).metadata();
  for (const f of [full, sm]) await fs.copyFile(f, path.join(DIST, 'img', path.basename(f)));

  const out = { src: `img/${name}.webp`, sm: `img/${name}-sm.webp`, w, h };
  processed.set(rel, out);
  return out;
}

// Walk the content: image paths become {src, sm, w, h}; text becomes safe HTML
async function prepare(v) {
  if (Array.isArray(v)) return Promise.all(v.map(prepare));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = await prepare(val);
    return out;
  }
  if (isImagePath(v)) return image(v);
  if (typeof v === 'string') return rich(v);
  return v;
}

const pad = (n) => String(n).padStart(2, '0');

async function build() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(path.join(DIST, 'img'), { recursive: true });
  await fs.mkdir(CACHE, { recursive: true });

  const site = await prepare(await readYaml('content/site.yml'));

  const roomList = [];
  for (const [i, r] of ROOMS.entries()) {
    const data = await prepare(await readYaml(`content/rooms/${r.id}.yml`));
    const title = data.title || r.nav;
    const works = (data.works || []).filter((wk) => wk && wk.image).map((wk, n) => {
      const number = pad(n + 1);
      const details = [wk.title, wk.year, wk.medium].filter(Boolean);
      return {
        ...wk.image,
        full: wk.image.src,
        wide: wk.image.w > wk.image.h,
        short: wk.title ? `${wk.title}${wk.year ? ` · ${wk.year}` : ''}` : `${title} · ${number}`,
        caption: plain(details.length ? details.join(' · ') : title),
        label: plain(wk.title || `${title} work ${n + 1}`),
        alt: plain(wk.description || `${wk.title || `${title} work ${n + 1}`} by Nada Abu Taleb`),
      };
    });
    roomList.push({
      ...r,
      title,
      line: data.line,
      works,
      count: `${works.length} ${works.length === 1 ? 'work' : 'works'}`,
      peek: works[0]?.sm,
      isInk: r.id === 'ink',
      divider: i < ROOMS.length - 1 ? DIVIDERS[i % DIVIDERS.length] : null,
    });
  }

  const template = await fs.readFile(path.join(ROOT, 'src/index.html'), 'utf8');
  const html = Mustache.render(template, {
    ...site,
    roomList,
    year: new Date().getFullYear(),
    version: Date.now().toString(36),
  });
  await fs.writeFile(path.join(DIST, 'index.html'), html);

  for (const f of ['style.css', 'main.js', 'favicon.svg']) {
    await fs.copyFile(path.join(ROOT, 'src', f), path.join(DIST, f));
  }
  if (existsSync(path.join(ROOT, 'CNAME'))) await fs.copyFile(path.join(ROOT, 'CNAME'), path.join(DIST, 'CNAME'));

  const total = roomList.reduce((n, r) => n + r.works.length, 0);
  console.log(`Built dist/ — ${total} works, ${processed.size} images.`);
}

build().catch((err) => {
  console.error(`\nBuild failed: ${err.message}\n`);
  process.exit(1);
});
