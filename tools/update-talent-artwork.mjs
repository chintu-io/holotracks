#!/usr/bin/env node
/**
 * Build a small, local manifest from the official Hololive talent directory.
 * This runs only in the Pages deployment job; it never touches the song catalog.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const DIRECTORY_URL = 'https://hololive.hololivepro.com/en/talents/';
const OUTPUT = 'data/talents.json';
const MINIMUM_TALENTS = 30;
const EXCLUDED_SLUGS = /(?:^|[-])(office-staff|harusaki-nodoka|friend-a|a-chan)(?:$|-)/i;
const KNOWN_NAMES = {
  'tokino-sora': 'Tokino Sora',
  'robocosan': 'Roboco-san',
  'aki-rosenthal': 'Aki Rosenthal',
  'akai-haato': 'Akai Haato',
  'shirakami-fubuki': 'Shirakami Fubuki',
  'natsuiro-matsuri': 'Natsuiro Matsuri',
  'nakiri-ayame': 'Nakiri Ayame',
  'yuzuki-choco': 'Yuzuki Choco',
  'oozora-subaru': 'Oozora Subaru',
  'azki': 'AZKi',
  'ookami-mio': 'Ookami Mio',
  'sakura-miko': 'Sakura Miko',
  'nekomata-okayu': 'Nekomata Okayu',
  'inugami-korone': 'Inugami Korone',
  'hoshimachi-suisei': 'Hoshimachi Suisei',
  'usada-pekora': 'Usada Pekora',
  'shiranui-flare': 'Shiranui Flare',
  'shirogane-noel': 'Shirogane Noel',
  'houshou-marine': 'Houshou Marine',
  'tsunomaki-watame': 'Tsunomaki Watame',
  'tokoyami-towa': 'Tokoyami Towa',
  'himemori-luna': 'Himemori Luna',
  'yukihana-lamy': 'Yukihana Lamy',
  'momosuzu-nene': 'Momosuzu Nene',
  'shishiro-botan': 'Shishiro Botan',
  'omaru-polka': 'Omaru Polka',
  'la-darknesss': 'La+ Darknesss',
  'takane-lui': 'Takane Lui',
  'hakui-koyori': 'Hakui Koyori',
  'kazama-iroha': 'Kazama Iroha',
  'ayunda-risu': 'Ayunda Risu',
  'moona-hoshinova': 'Moona Hoshinova',
  'airani-iofifteen': 'Airani Iofifteen',
  'kureiji-ollie': 'Kureiji Ollie',
  'anya-melfissa': 'Anya Melfissa',
  'pavolia-reine': 'Pavolia Reine',
  'vestia-zeta': 'Vestia Zeta',
  'kaela-kovalskia': 'Kaela Kovalskia',
  'kobo-kanaeru': 'Kobo Kanaeru',
  'mori-calliope': 'Mori Calliope',
  'takanashi-kiara': 'Takanashi Kiara',
  'ninomae-inanis': 'Ninomae Ina’nis',
  'irys': 'IRyS',
  'ouro-kronii': 'Ouro Kronii',
  'hakos-baelz': 'Hakos Baelz',
  'shiori-novella': 'Shiori Novella',
  'koseki-bijou': 'Koseki Bijou',
  'nerissa-ravencroft': 'Nerissa Ravencroft',
  'fuwawa-abyssgard': 'Fuwawa Abyssgard',
  'mococo-abyssgard': 'Mococo Abyssgard',
  'elizabeth-rose-bloodflame': 'Elizabeth Rose Bloodflame',
  'gigi-murin': 'Gigi Murin',
  'cecilia-immergreen': 'Cecilia Immergreen',
  'raora-panthera': 'Raora Panthera',
  'otonose-kanade': 'Otonose Kanade',
  'ichijou-ririka': 'Ichijou Ririka',
  'juufuutei-raden': 'Juufuutei Raden',
  'todoroki-hajime': 'Todoroki Hajime',
  'isaki-riona': 'Isaki Riona',
  'koganei-niko': 'Koganei Niko',
  'mizumiya-su': 'Mizumiya Su',
  'rindo-chihaya': 'Rindo Chihaya',
  'kikirara-vivi': 'Kikirara Vivi',
  'achichi-mela': 'Achichi Mela',
  'sorashina-sopia': 'Sorashina Sopia',
  'suzuna-tsuzuri': 'Suzuna Tsuzuri',
  'hyakuto-kyoko': 'Hyakuto Kyoko',
  'izuki-michiru': 'Izuki Michiru',
  'hanazono-sayaka': 'Hanazono Sayaka',
  'kazeshiro-yuki': 'Kazeshiro Yuki',
};
const FALLBACK_TALENTS = [
  ['Hoshimachi Suisei','https://hololive.hololivepro.com/wp-content/uploads/2020/06/Hoshimachi-Suisei_pr-img_01.png'],
  ['Sakura Miko','https://hololive.hololivepro.com/wp-content/uploads/2020/06/Sakura-Miko_pr-img_01.webp'],
  ['Houshou Marine','https://hololive.hololivepro.com/wp-content/uploads/2020/06/Houshou-Marine_pr-img_01.png'],
  ['Mori Calliope','https://hololive.hololivepro.com/wp-content/uploads/2020/07/Mori-Calliope_megane_07.png'],
  ['Shirakami Fubuki','https://hololive.hololivepro.com/wp-content/uploads/2020/06/Shirakami-Fubuki_pr-img_01.webp'],
  ['Usada Pekora','https://hololive.hololivepro.com/wp-content/uploads/2020/06/Usada-Pekora_pr-img_01.webp'],
  ['Inugami Korone','https://hololive.hololivepro.com/wp-content/uploads/2020/06/Inugami-Korone_pr-img_01.png'],
  ['Nekomata Okayu','https://hololive.hololivepro.com/wp-content/uploads/2020/06/Nekomata-Okayu_pr-img_01.png'],
  ['Ookami Mio','https://hololive.hololivepro.com/wp-content/uploads/2020/06/Ookami-Mio_pr-img_01.webp'],
  ['Shiranui Flare','https://hololive.hololivepro.com/wp-content/uploads/2020/06/Shiranui-Flare_pr-img_01.png'],
  ['AZKi','https://hololive.hololivepro.com/wp-content/uploads/2020/06/AZKi_pr-img_01.webp'],
  ['Takanashi Kiara','https://hololive.hololivepro.com/wp-content/uploads/2020/07/Takanashi-Kiara_pr-img_01.webp'],
  ['Tokino Sora','https://hololive.hololivepro.com/wp-content/uploads/2020/06/Tokino-Sora_pr-img_01.webp'],
  ['Nakiri Ayame','https://hololive.hololivepro.com/wp-content/uploads/2020/06/Nakiri-Ayame_pr-img_01.webp'],
  ['Tokoyami Towa','https://hololive.hololivepro.com/wp-content/uploads/2020/06/Tokoyami-Towa_pr-img_01.webp'],
];

function attr(tag, name) {
  const match = tag.match(new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '').trim() : '';
}
function absoluteURL(value, base = DIRECTORY_URL) {
  if (!value || /^(?:data:|blob:|#|javascript:)/i.test(value)) return '';
  try {
    const url = new URL(value.replace(/&amp;/g, '&'), base);
    if (url.origin !== 'https://hololive.hololivepro.com') return '';
    if (!url.pathname.includes('/wp-content/uploads/')) return '';
    if (!/\.(?:png|webp|jpe?g|avif)(?:$|\?)/i.test(url.href)) return '';
    return url.href;
  } catch { return ''; }
}
function slugName(slug) {
  if (KNOWN_NAMES[slug]) return KNOWN_NAMES[slug];
  return slug.split('-').filter(Boolean).map(word => {
    if (word.toLowerCase() === 'azki') return 'AZKi';
    if (word.toLowerCase() === 'irys') return 'IRyS';
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}
function imageCandidates(inner) {
  const found = [];
  const tags = inner.match(/<(?:img|source)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    for (const key of ['data-src','data-lazy-src','data-original','src']) {
      const src = absoluteURL(attr(tag, key));
      if (src) found.push(src);
    }
    const srcset = attr(tag, 'data-srcset') || attr(tag, 'srcset');
    if (srcset) {
      const options = srcset.split(',').map(part => {
        const bits = part.trim().split(/\s+/);
        const width = Number((bits[1] || '').replace(/w$/i, '')) || (parseFloat(bits[1]) || 1) * 1000;
        return { url: absoluteURL(bits[0]), width };
      }).filter(item => item.url).sort((a,b) => b.width-a.width);
      found.push(...options.map(item => item.url));
    }
    const style = attr(tag, 'style');
    for (const match of style.matchAll(/url\((?:"|')?(.*?)(?:"|')?\)/gi)) {
      const src = absoluteURL(match[1]);
      if (src) found.push(src);
    }
  }
  for (const match of inner.matchAll(/(?:href|src|data-src|data-original)=["']([^"']+\.(?:png|webp|jpe?g|avif)(?:\?[^"']*)?)["']/gi)) {
    const src = absoluteURL(match[1]);
    if (src) found.push(src);
  }
  return [...new Set(found)].sort((a,b) => {
    const rank = url => (/_pr-img_0?1\./i.test(url) ? 4 : /pr-img/i.test(url) ? 3 : /wp-content\/uploads/i.test(url) ? 1 : 0);
    return rank(b)-rank(a);
  });
}
function fallbackRoster() {
  return FALLBACK_TALENTS.map(([name,image]) => ({
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g,''),
    name, image, bannerImage: image,
    profileUrl: DIRECTORY_URL,
  }));
}


async function fullBodyImageFromProfile(profileUrl) {
  const response = await fetch(profileUrl, {
    headers: { 'user-agent': 'HoloTracks talent-artwork catalog (independent fan project)' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('Profile returned HTTP ' + response.status);
  const html = await response.text();
  const bodyCandidates = [];
  const allCandidates = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = absoluteURL(attr(match[1], 'href'), profileUrl);
    if (!href) continue;
    allCandidates.push(href);
    if (/全身画像|full[\s-]*body|full[\s-]*length/i.test(match[2])) bodyCandidates.push(href);
  }
  const attrCandidates = [];
  for (const match of html.matchAll(/(?:href|src|data-src|data-lazy-src|data-original)=["']([^"']+)["']/gi)) {
    const url = absoluteURL(match[1], profileUrl);
    if (url) attrCandidates.push(url);
  }
  const unique = values => [...new Set(values)];
  const priority = url => /_pr-img_0?1\./i.test(url) ? 0 : /_pr-img_0?2\./i.test(url) ? 1 : /pr-img/i.test(url) ? 2 : 3;
  const fullBody = unique(bodyCandidates).sort((a,b)=>priority(a)-priority(b));
  if (fullBody.length) return fullBody[0];
  const candidates = unique([...allCandidates, ...attrCandidates]).sort((a,b)=>priority(a)-priority(b));
  return candidates.find(url => /_pr-img_0?1\./i.test(url)) ||
    candidates.find(url => /_pr-img/i.test(url)) || '';
}
async function enrichFullBodyArtwork(entries) {
  let cursor = 0;
  const workers = Array.from({ length: 8 }, async () => {
    while (cursor < entries.length) {
      const entry = entries[cursor++];
      try {
        const path = new URL(entry.profileUrl).pathname;
        if (!/\/en\/talents\/[^/]+\/?$/i.test(path)) {
          entry.bannerImage = entry.bannerImage || '';
          continue;
        }
        entry.bannerImage = await fullBodyImageFromProfile(entry.profileUrl) || entry.bannerImage || '';
      } catch {
        entry.bannerImage = entry.bannerImage || '';
      }
    }
  });
  await Promise.all(workers);
  const found = entries.filter(entry => entry.bannerImage && entry.bannerImage !== entry.image).length;
  console.log('[HoloTracks] Matched ' + found + ' full-body profile illustrations for seamless banner cut-outs.');
}

let roster = [];
try {
  const response = await fetch(DIRECTORY_URL, {
    headers: { 'user-agent': 'HoloTracks talent-artwork catalog (independent fan project)' },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error('Official directory returned HTTP ' + response.status);
  const html = await response.text();
  const seen = new Set();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(match[1], 'href');
    let profile;
    try { profile = new URL(href.replace(/&amp;/g,'&'), DIRECTORY_URL); } catch { continue; }
    if (profile.origin !== 'https://hololive.hololivepro.com') continue;
    const pathMatch = profile.pathname.match(/^\/en\/talents\/([^/]+)\/?$/i);
    if (!pathMatch) continue;
    const slug = decodeURIComponent(pathMatch[1]).toLowerCase();
    if (EXCLUDED_SLUGS.test(slug) || seen.has(slug)) continue;
    const images = imageCandidates(match[2]);
    const image = images[0];
    if (!image) continue;
    seen.add(slug);
    roster.push({
      slug,
      name: slugName(slug),
      image,
      profileUrl: profile.href,
    });
  }
  if (roster.length < MINIMUM_TALENTS) {
    throw new Error('Only parsed ' + roster.length + ' talent portraits; expected at least ' + MINIMUM_TALENTS);
  }
  console.log('[HoloTracks] Parsed ' + roster.length + ' talent illustrations from the official directory.');
} catch (error) {
  // Keep deployments usable if the official site temporarily changes markup or is unavailable.
  try {
    const existing = JSON.parse(await readFile(OUTPUT, 'utf8'));
    if (Array.isArray(existing.talents) && existing.talents.length >= MINIMUM_TALENTS) {
      roster = existing.talents;
      console.warn('[HoloTracks] Official roster fetch failed; reusing checked-in manifest: ' + error.message);
    }
  } catch {}
  if (!roster.length) {
    roster = fallbackRoster();
    console.warn('[HoloTracks] Official roster unavailable; using ' + roster.length + ' known artwork fallbacks: ' + error.message);
  }
}

await enrichFullBodyArtwork(roster);

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify({
  source: DIRECTORY_URL,
  generatedAt: new Date().toISOString(),
  talents: roster,
}, null, 2) + '\n');
console.log('[HoloTracks] Wrote ' + roster.length + ' talent records to ' + OUTPUT + '.');
