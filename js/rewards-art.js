// ========================================================
// Rewards art: inline SVG built from a handful of shared shapes. No images, no requests.
// Colours come in as CSS variables on a wrapper <g style="--a:..;--b:..;--c:..">, so one
// shape serves every colour variant (--a main, --b accent, --c ink / chest text).
// Avatar frame: viewBox 0 0 110 120, head centre (55,42) r17 — the legacy outfits' frame.
// DOM-free: returns strings, so it also runs under node for the tests.
// ========================================================

const RewardsArt = (() => {
  const vars = c => `--a:${c[0]};--b:${c[1] || c[0]};--c:${c[2] || '#fff'}`;
  const A = 'var(--a)', B = 'var(--b)', C = 'var(--c)';
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const text = (x, y, size, t, fill = C) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="800" font-family="system-ui,sans-serif" fill="${fill}">${esc(t)}</text>`;

  // --- Glyphs: 64x64, shared by stickers and avatar props ---
  const GLYPHS = {
    coin: `<circle cx="32" cy="32" r="19" fill="${A}"/><circle cx="32" cy="32" r="14" fill="none" stroke="${B}" stroke-width="2.5"/>`,
    coins: `<g fill="${A}" stroke="${B}" stroke-width="2.5"><ellipse cx="32" cy="45" rx="17" ry="6"/><ellipse cx="32" cy="37" rx="17" ry="6"/><ellipse cx="32" cy="29" rx="17" ry="6"/><ellipse cx="32" cy="21" rx="17" ry="6"/></g>`,
    bulb: `<path d="M32 10a15 15 0 0 1 9 27v6H23v-6a15 15 0 0 1 9-27z" fill="${A}"/><rect x="24" y="45" width="16" height="4" rx="2" fill="${B}"/><rect x="27" y="51" width="10" height="4" rx="2" fill="${B}"/><path d="M28 30l4-4v12" fill="none" stroke="${B}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    die: `<rect x="13" y="13" width="38" height="38" rx="10" fill="${A}"/><g fill="${B}"><circle cx="23" cy="23" r="3.8"/><circle cx="41" cy="23" r="3.8"/><circle cx="32" cy="32" r="3.8"/><circle cx="23" cy="41" r="3.8"/><circle cx="41" cy="41" r="3.8"/></g>`,
    urn: `<path d="M23 12h18l-3 7c9 4 12 12 10 20-2 9-8 13-16 13s-14-4-16-13c-2-8 1-16 10-20z" fill="${A}"/><rect x="22" y="10" width="20" height="5" rx="2.5" fill="${B}"/><circle cx="27" cy="38" r="4" fill="${B}"/><circle cx="37" cy="40" r="4" fill="#fff"/><circle cx="31" cy="46" r="3.5" fill="${B}"/>`,
    fish: `<path d="M10 32c7-11 20-15 31-8l11-8v32l-11-8c-11 7-24 3-31-8z" fill="${A}"/><circle cx="21" cy="29" r="2.6" fill="${B}"/><path d="M29 24q-4 8 0 16" fill="none" stroke="${B}" stroke-width="2.2" stroke-linecap="round"/>`,
    clock: `<circle cx="32" cy="34" r="19" fill="${A}"/><rect x="28" y="9" width="8" height="5" rx="2" fill="${A}"/><path d="M32 23v11l7 5" fill="none" stroke="${B}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    bell: `<path d="M6 50C21 50 24 14 32 14s11 36 26 36z" fill="${A}"/><path d="M32 16v34M23.5 33v17M40.5 33v17" stroke="${B}" stroke-width="2" stroke-dasharray="3 2.5"/>`,
    crown: `<path d="M11 44l2-26 10 10 9-15 9 15 10-10 2 26z" fill="${A}"/><rect x="11" y="43" width="42" height="7" rx="2.5" fill="${B}"/><circle cx="32" cy="32" r="3.5" fill="${B}"/>`,
    flame: `<path d="M32 8c4 11 17 15 17 30a17 17 0 0 1-34 0c0-9 5-13 9-17 1 6 4 9 6 9-2-8 0-15 2-22z" fill="${A}"/><path d="M32 31c3 5 8 7 8 13a8 8 0 0 1-16 0c0-5 5-8 8-13z" fill="${B}"/>`,
    owl: `<path d="M16 18l8 7h16l8-7v26a16 16 0 0 1-32 0z" fill="${A}"/><circle cx="25" cy="34" r="6.5" fill="#fff"/><circle cx="39" cy="34" r="6.5" fill="#fff"/><circle cx="25" cy="34" r="3" fill="${B}"/><circle cx="39" cy="34" r="3" fill="${B}"/><path d="M29.5 41h5L32 46z" fill="${B}"/>`,
    sun: `<circle cx="32" cy="32" r="11" fill="${A}"/><path d="M32 7v8M32 49v8M7 32h8M49 32h8M14 14l6 6M44 44l6 6M14 50l6-6M44 20l6-6" stroke="${A}" stroke-width="4.5" stroke-linecap="round"/>`,
    back: `<path d="M45 21a17 17 0 1 0 5 15" fill="none" stroke="${A}" stroke-width="7" stroke-linecap="round"/><path d="M38 9l14 11-16 6z" fill="${A}"/>`,
    tomato: `<circle cx="32" cy="36" r="18" fill="${A}"/><path d="M32 19l-9-5 4 8-9 2 10 2 4 7 4-7 10-2-9-2 4-8z" fill="${B}"/><path d="M21 33a11 11 0 0 1 6-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
    bag: `<path d="M15 23h34l-3 29H18z" fill="${A}"/><path d="M25 26v-6a7 7 0 0 1 14 0v6" fill="none" stroke="${B}" stroke-width="3.5" stroke-linecap="round"/>`,
    hanger: `<path d="M32 23a5 5 0 1 1 5-5M32 23L9 42h46z" fill="none" stroke="${A}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>`,
    check: `<path d="M16 33l10 10 22-23" fill="none" stroke="${A}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
    star: `<path d="M32 9l7 14.5 16 2-11.6 11 2.9 16L32 45l-14.3 7.5 2.9-16L9 25.5l16-2z" fill="${A}"/>`,
    target: `<circle cx="32" cy="32" r="20" fill="${A}"/><circle cx="32" cy="32" r="13" fill="${B}"/><circle cx="32" cy="32" r="6" fill="${A}"/>`,
    bubble: `<path d="M10 14h44v26H31l-11 9v-9H10z" fill="${A}" stroke-linejoin="round"/><g fill="${B}"><circle cx="22" cy="27" r="3"/><circle cx="32" cy="27" r="3"/><circle cx="42" cy="27" r="3"/></g>`,
    cup: `<path d="M14 26h28v14a11 11 0 0 1-11 11h-6a11 11 0 0 1-11-11z" fill="${A}"/><path d="M42 30h4a5.5 5.5 0 0 1 0 11h-4" fill="none" stroke="${A}" stroke-width="4"/><path d="M22 20q-3-4 0-8M30 20q-3-4 0-8" fill="none" stroke="${B}" stroke-width="2.5" stroke-linecap="round"/><rect x="14" y="31" width="28" height="4" fill="${B}"/>`,
    cat: `<path d="M12 52V18l11 10h18l11-10v34a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8z" fill="${A}"/><circle cx="24" cy="39" r="3" fill="${B}"/><circle cx="40" cy="39" r="3" fill="${B}"/><path d="M29.5 45h5L32 48z" fill="#f472b6"/><path d="M8 44l11 1M8 49l11-1M56 44l-11 1M56 49l-11-1" stroke="${B}" stroke-width="1.6" stroke-linecap="round"/>`
  };

  function glyph(name) {
    if (name && name.startsWith('T:')) {
      const t = name.slice(2);
      return text(32, t.length > 2 ? 40 : 43, t.length > 3 ? 17 : t.length > 2 ? 21 : 30, t, 'var(--a)');
    }
    return GLYPHS[name] || GLYPHS.star;
  }

  // --- Stickers: die-cut rim (rarity colour) + hue disc + glyph + optional corner label ---
  // opts: { rim, secret } — a secret one not yet found is drawn as a grey "?"
  function sticker(st, opts = {}) {
    const hue = opts.secret ? '#94a3b8' : st.h;
    const art = opts.secret ? text(32, 43, 30, '?', '#fff') : glyph(st.a);
    const label = !opts.secret && st.l
      ? `<circle cx="49" cy="49" r="10" fill="#fff"/>${text(49, 52.5, st.l.length > 2 ? 7 : 9, st.l, hue)}` : '';
    return `<svg viewBox="0 0 64 64" class="rw-sticker" aria-hidden="true" focusable="false">` +
      `<circle cx="33" cy="34" r="30" fill="#0f172a" opacity=".16"/>` +
      `<circle cx="32" cy="32" r="30" fill="${opts.rim || '#fff'}"/><circle cx="32" cy="32" r="25.5" fill="${hue}"/>` +
      `<path d="M14 24a20 20 0 0 1 16-14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/>` +
      `<g style="--a:#fff;--b:rgba(15,23,42,.6)" transform="translate(32 32) scale(.62) translate(-32 -32)">${art}</g>${label}</svg>`;
  }

  // --- Avatar parts ---
  const BODY = 'M20 101C20 82 32 69 47 67h16c15 2 27 15 27 34A52 52 0 0 1 20 101z';
  const SHADE = `<path d="M20 101c0-17 8-27 19-30-6 8-8 19-8 35z" fill="#0f172a" opacity=".13"/>`;
  const chest = (it, y = 92) => it.t2
    ? text(55, y - 4, 5.2, it.t) + text(55, y + 3, 5.2, it.t2)
    : it.t ? text(55, y, it.t.length > 4 ? 7 : 8.5, it.t) : '';

  const TOPS = {
    tee: it => `<path d="${BODY}" fill="${A}"/>${SHADE}<path d="M47 67q8 9 16 0" fill="none" stroke="${B}" stroke-width="2.6"/><path d="M33 77q-2 9-1 18M77 77q2 9 1 18" fill="none" stroke="${B}" stroke-width="1.4" opacity=".5"/>${chest(it)}`,
    hoodie: it => `<path d="${BODY}" fill="${A}"/>${SHADE}<path d="M39 71c0-13 32-13 32 0-5-4-27-4-32 0z" fill="${B}"/><path d="M51 71v9M59 71v9" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><path d="M40 101h30l3 9H37z" fill="#0f172a" opacity=".14"/>${chest(it, 92)}`,
    sweater: it => `<path d="${BODY}" fill="${A}"/>${SHADE}<path d="M46 67q9 9 18 0" fill="none" stroke="${B}" stroke-width="4"/><path d="M24 104h62M25 108h60" stroke="${B}" stroke-width="2" opacity=".7"/>${chest(it, 91)}`,
    suit: () => `<path d="${BODY}" fill="${A}"/>${SHADE}<path d="M47 67l8 19 8-19z" fill="#f8fafc"/><path d="M53.6 69h2.8l1.5 13-2.9 4-2.9-4z" fill="${B}"/><path d="M47 67l5 17-8-6zM63 67l-5 17 8-6z" fill="#0f172a" opacity=".3"/><circle cx="55" cy="96" r="1.4" fill="#94a3b8"/><circle cx="55" cy="104" r="1.4" fill="#94a3b8"/>`,
    robe: it => `<path d="${BODY}" fill="${A}"/>${SHADE}<path d="M47 67l8 13 8-13" fill="none" stroke="${B}" stroke-width="2.8"/><g fill="${B}"><circle cx="34" cy="92" r="1.5"/><circle cx="76" cy="96" r="1.5"/><circle cx="69" cy="108" r="1.2"/><circle cx="41" cy="108" r="1.2"/></g>${chest(it, 97)}`,
    vest: it => `<path d="${BODY}" fill="${B}"/><path d="M33 73c6-3 12-4 16-4l6 12 6-12c4 0 10 1 16 4l5 33a52 52 0 0 1-54 0z" fill="${A}"/>${SHADE}<path d="M55 81v32" stroke="${C}" stroke-width="1.6"/><text x="67" y="90" text-anchor="middle" font-size="4.6" font-weight="800" font-family="system-ui,sans-serif" fill="${C}">${esc(it.t || '')}</text>`,
    blanket: () => `<path d="${BODY}" fill="${A}"/>${SHADE}<path d="M22 86h66M24 98h62M44 70v43M66 70v43" stroke="${B}" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M47 67c-7 9-1 21-7 33" fill="none" stroke="#0f172a" stroke-width="1.5" opacity=".2"/>`,
    raglan: it => `<path d="${BODY}" fill="${A}"/><path d="M47 67C33 69 20 81 20 101l6 4 12-17zM63 67c15 2 27 15 27 34l-6 4-12-17z" fill="${B}"/>${SHADE}<path d="M47 67q8 8 16 0" fill="none" stroke="${B}" stroke-width="2.6"/>${chest(it, 91)}`
  };

  const HATS = {
    cap: `<path d="M36.5 38C36.5 15 73.5 15 73.5 38z" fill="${A}"/><path d="M55 36c11-2 23-2 29 2-8 3-20 3-29 1z" fill="${B}"/><circle cx="55" cy="21" r="2" fill="${B}"/>`,
    beanie: `<path d="M36 40c-1-26 39-26 38 0z" fill="${A}"/><rect x="35" y="33" width="40" height="8" rx="4" fill="${B}"/><circle cx="55" cy="17" r="4.5" fill="${B}"/>`,
    wizard: `<path d="M55 0L40 33h30z" fill="${A}"/><ellipse cx="55" cy="34" rx="22" ry="4.5" fill="${A}"/><path d="M42 29h26l1.5 4h-29z" fill="${B}"/><g fill="${B}"><circle cx="51" cy="19" r="1.6"/><circle cx="58" cy="11" r="1.2"/><circle cx="60" cy="23" r="1.3"/></g>`,
    crown: `<path d="M38 34l2-17 8 8 7-12 7 12 8-8 2 17z" fill="${A}"/><rect x="38" y="30" width="34" height="5" rx="2" fill="${B}"/><circle cx="40" cy="17" r="2" fill="#ef4444"/><circle cx="55" cy="13" r="2.4" fill="#3b82f6"/><circle cx="70" cy="17" r="2" fill="#10b981"/>`,
    gauss: `<path d="M35 40c9 0 11-27 20-27s11 27 20 27z" fill="${A}"/><rect x="35" y="34" width="40" height="7" rx="3.5" fill="${B}"/><path d="M55 14v19" stroke="${B}" stroke-width="1.3" stroke-dasharray="2 2"/>`,
    party: `<path d="M45 33l13-27 11 25z" fill="${A}"/><path d="M48 26l17-3M52 18l9-1.5" stroke="${B}" stroke-width="2"/><circle cx="58" cy="6" r="3.2" fill="${B}"/>`,
    phones: `<path d="M35.5 44c0-26 39-26 39 0" fill="none" stroke="${A}" stroke-width="4"/><rect x="31" y="37" width="9" height="15" rx="4" fill="${B}"/><rect x="70" y="37" width="9" height="15" rx="4" fill="${B}"/>`
  };

  const FACES = {
    round: `<g fill="none" stroke="${A}" stroke-width="1.6"><circle cx="49" cy="44" r="5" fill="${B}" fill-opacity=".25"/><circle cx="61" cy="44" r="5" fill="${B}" fill-opacity=".25"/><path d="M54 43.5h2M44 43l-5.5-1.5M66 43l5.5-1.5"/></g>`,
    shades: `<path d="M42.5 40.5h12v3.5a6 6 0 0 1-12 0zM55.5 40.5h12v3.5a6 6 0 0 1-12 0z" fill="${A}"/><path d="M54.5 41.5h1M42.5 41l-4-1M67.5 41l4-1" stroke="${A}" stroke-width="1.6"/><path d="M45 42.5l3-1.5M58 42.5l3-1.5" stroke="${B}" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>`,
    mustache: `<path d="M55 48.2c-4-2.4-8-1-9.5 2.3 3.5-1 6.5-.5 9.5-.9 3 .4 6-.1 9.5.9-1.5-3.3-5.5-4.7-9.5-2.3z" fill="${A}"/>`
  };

  // Props reuse the sticker glyphs, scaled into a corner of the avatar
  const PROP_SPOT = { cat: 'translate(9 56) scale(.42)' };

  // Backgrounds: a disc behind the avatar (centre 55,62 r52) + a pattern in the upper half
  const disc = fill => `<circle cx="55" cy="62" r="52" fill="${fill}"/>`;
  const chordLines = (step, vertical) => {
    let d = '';
    for (let v = 15; v < 110; v += step) {
      const h = Math.sqrt(Math.max(0, 52 * 52 - (v - (vertical ? 55 : 62)) ** 2));
      if (h < 4) continue;
      d += vertical ? `M${v} ${(62 - h).toFixed(1)}V${(62 + h).toFixed(1)}` : `M${(55 - h).toFixed(1)} ${v}H${(55 + h).toFixed(1)}`;
    }
    return d;
  };
  const STARS = '20,46 30,26 44,16 70,18 84,30 92,48 26,62 86,62 64,10 16,80 94,78 52,6';
  const BGS = {
    plain: () => disc(A),
    grid: () => disc(A) + `<path d="${chordLines(10, true)}${chordLines(10, false)}" stroke="${B}" stroke-width=".8"/>`,
    bell: () => disc(A) + `<path d="M16 96c20 0 26-74 39-74s19 74 39 74z" fill="${B}" opacity=".7"/><path d="M55 22v74" stroke="${A}" stroke-width="1.2" stroke-dasharray="3 3"/>`,
    dots: () => disc(A) + `<g fill="${B}">${STARS.split(' ').map((p, i) => { const [x, y] = p.split(','); return `<circle cx="${x}" cy="${y}" r="${[1.2, 1.8, 1, 2.2][i % 4]}"/>`; }).join('')}</g>`,
    night: () => disc(A) + `<circle cx="83" cy="30" r="9" fill="${B}"/><circle cx="87" cy="27" r="8" fill="${A}"/><g fill="${B}"><circle cx="24" cy="34" r="1.4"/><circle cx="36" cy="18" r="1"/><circle cx="70" cy="14" r="1.2"/><circle cx="18" cy="58" r="1"/></g>`,
    sunset: () => disc(A) + `<circle cx="82" cy="34" r="13" fill="${B}" opacity=".85"/><path d="M3 74h104" stroke="${B}" stroke-width="2" opacity=".5"/>`
  };

  const HEAD = `<path d="M49 55h12v13q-6 4-12 0z" fill="#f2bf98"/>` +
    `<circle cx="38.5" cy="44" r="3.6" fill="#f2bf98"/><circle cx="71.5" cy="44" r="3.6" fill="#f2bf98"/>` +
    `<circle cx="55" cy="42" r="17" fill="#f7cfae"/>` +
    `<path d="M37.6 43C36 29 43.5 23.5 55 23.5S74 29 72.4 43c-1.5-6-4.5-9-9.4-10-5 3-15 3.5-20.5 1-2.5 2-4 5-4.9 9z" fill="#3f2d26"/>` +
    `<path d="M46 39.6q3-1.7 6 0M58 39.6q3-1.7 6 0" fill="none" stroke="#3f2d26" stroke-width="1.3" stroke-linecap="round"/>` +
    `<ellipse cx="49" cy="44.2" rx="2" ry="2.4" fill="#1e293b"/><ellipse cx="61" cy="44.2" rx="2" ry="2.4" fill="#1e293b"/>` +
    `<circle cx="49.7" cy="43.4" r=".7" fill="#fff"/><circle cx="61.7" cy="43.4" r=".7" fill="#fff"/>` +
    `<circle cx="45.4" cy="49" r="2.6" fill="#fb7185" opacity=".35"/><circle cx="64.6" cy="49" r="2.6" fill="#fb7185" opacity=".35"/>` +
    `<path d="M51.5 50.6q3.5 3.2 7 0" fill="none" stroke="#9f1239" stroke-width="1.5" stroke-linecap="round"/>`;

  const wrap = (it, inner) => `<g style="${vars(it.c || ['#94a3b8'])}">${inner}</g>`;
  const layer = (it, slot) => {
    if (!it) return '';
    if (it.legacy) return it.legacy(); // tier without new art: its own renderSvg in the legacy frame
    if (slot === 'top') return wrap(it, (TOPS[it.art] || TOPS.tee)(it));
    if (slot === 'hat') return wrap(it, HATS[it.art] || '');
    if (slot === 'face') return wrap(it, FACES[it.art] || '');
    if (slot === 'prop') return wrap(it, `<g transform="${PROP_SPOT[it.art] || 'translate(72 76) scale(.48)'}">${glyph(it.art)}</g>`);
    if (slot === 'bg') return wrap(it, (BGS[it.art] || BGS.plain)());
    return '';
  };

  // parts: { bg, top, hat, face, prop } — item specs (or null); a missing top falls back to a plain tee
  function avatar(parts = {}, cls = 'w-full h-full') {
    const top = parts.top && parts.top.legacy
      ? layer({ art: 'tee', c: ['#3b82f6', '#1e3a8a'] }, 'top') + layer(parts.top, 'top')
      : layer(parts.top || { art: 'tee', c: ['#94a3b8', '#64748b'] }, 'top');
    return `<svg viewBox="0 0 110 120" class="${cls}" aria-hidden="true" focusable="false" style="overflow:visible">` +
      (parts.bg ? layer(parts.bg, 'bg') : disc('var(--rw-avatar-bg)')) +
      top + HEAD + layer(parts.face, 'face') + layer(parts.hat, 'hat') + layer(parts.prop, 'prop') + '</svg>';
  }

  // A single part on its own (shop / wardrobe tiles), cropped to where that slot lives
  const VIEW = { top: '14 58 82 58', hat: '28 -2 56 46', face: '36 32 38 22', prop: '0 0 64 64', bg: '3 10 104 104' };
  function part(it) {
    if (it.legacy) return avatar({ top: it }, 'w-full h-full');
    const inner = it.slot === 'prop' ? wrap(it, glyph(it.art)) : layer(it, it.slot);
    return `<svg viewBox="${VIEW[it.slot]}" class="w-full h-full" aria-hidden="true" focusable="false">${inner}</svg>`;
  }

  return { avatar, part, sticker, glyph, GLYPHS, TOPS, HATS, FACES, BGS };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RewardsArt };
} else {
  window.RewardsArt = RewardsArt;
}
