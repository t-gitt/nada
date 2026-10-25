(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const body = document.body;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  /* ---------------------------------------------------------------- galleries */
  // Works are rendered by the build; the pinned-paper frame tilts each one a little.
  // Deterministic so they don't reshuffle on every visit.
  $$('.gallery').forEach((g) => $$('.work', g).forEach((b, i) => {
    b.style.setProperty('--rot', (Math.sin(i * 12.9898 + 5) * 3).toFixed(2) + 'deg');
  }));

  /* ---------------------------------------------------------------- the light */
  // Mouse: a candle that follows the cursor.
  // Touch: a steady lantern held mid-screen; scrolling carries the work through it.
  let tx = innerWidth / 2, ty = innerHeight * 0.45, x = tx, y = ty, rx = 0, ry = 0;
  let travelled = 0;
  const hint = $('.hint');

  let lantern = {};
  const measureLantern = () => {
    // Sized once per width so the mobile URL bar collapsing doesn't make it jump
    const h = window.screen && screen.height ? Math.min(innerHeight * 1.15, screen.height) : innerHeight;
    lantern = { x: innerWidth / 2, y: innerHeight * 0.5, rx: innerWidth * 0.9, ry: h * 0.4 };
    tx = x = lantern.x; ty = y = lantern.y;
  };
  let lastWidth = innerWidth;
  if (coarse) {
    measureLantern();
    addEventListener('resize', () => {
      if (innerWidth !== lastWidth) { lastWidth = innerWidth; measureLantern(); }
    });
    addEventListener('scroll', () => hint && scrollY > 80 && hint.classList.add('gone'), { passive: true });
  } else {
    addEventListener('mousemove', (e) => {
      travelled += Math.abs(e.clientX - tx) + Math.abs(e.clientY - ty);
      tx = e.clientX; ty = e.clientY;
      if (travelled > 1400 && hint) hint.classList.add('gone');
    }, { passive: true });
  }
  const candleRadius = () => Math.max(170, Math.min(innerWidth * 0.19, 300));

  /* ---------------------------------------------------------------- the eyes */
  const pairs = [];
  // Eyes hide in the empty dark, never on top of the words or the pictures
  const WORDS = '.lit, .cap, h2, p, li, blockquote, .work, .story-figure img, .about-figure, .avatar';
  // Where a pair sits, ignoring the drift of its flee animation
  const boxOf = (el) => {
    const l = el.parentElement.getBoundingClientRect();
    const left = l.left + el.offsetLeft, top = l.top + el.offsetTop;
    return { left, top, right: left + el.offsetWidth, bottom: top + el.offsetHeight };
  };
  const overlapsWords = (el) => {
    const b = boxOf(el);
    return [...$$(WORDS, el.closest('section, footer')), $('.switch-tip')].some((t) => {
      const r = t.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      return b.right > r.left - 24 && b.left < r.right + 24 && b.bottom > r.top - 24 && b.top < r.bottom + 24;
    });
  };
  // Pairs keep their distance from each other, so no two ever read as one cluster
  const spots = new Map(); // visible pair -> its position, in % of its layer
  const minGap = () => Math.max(120, Math.min(innerWidth, innerHeight) * 0.18);
  const nearest = (el, left, top) => {
    const layer = el.parentElement, w = layer.offsetWidth, h = layer.offsetHeight;
    let d = Infinity;
    for (const [other, s] of spots) {
      if (other === el || other.parentElement !== layer) continue;
      d = Math.min(d, Math.hypot((s.left - left) * w / 100, (s.top - top) * h / 100));
    }
    return d;
  };
  const place = (el, edges) => {
    el.style.setProperty('--s', (0.55 + Math.random() * 0.9).toFixed(2));
    const gap = minGap();
    let best = null;
    for (let tries = 0; tries < 40; tries++) {
      const left = edges
        ? (Math.random() < 0.5 ? 1 + Math.random() * 6 : 93 + Math.random() * 5)
        : 3 + Math.random() * 92;
      const top = 5 + Math.random() * 88;
      const d = nearest(el, left, top);
      if (best && d <= best.d) continue;
      el.style.left = left + '%';
      el.style.top = top + '%';
      const r = boxOf(el), box = el.parentElement.getBoundingClientRect();
      if (r.left < box.left + 6 || r.right > box.right - 6 || overlapsWords(el)) continue;
      best = { left, top, d };
      if (d >= gap) break;
    }
    // Nowhere roomy enough (a small screen, a crowded layer): stay shut for now
    if (!best || best.d < gap) { spots.delete(el); return false; }
    el.style.left = best.left + '%';
    el.style.top = best.top + '%';
    spots.set(el, best);
    return true;
  };

  $$('[data-eyes]').forEach((layer) => {
    const edges = layer.classList.contains('eyes--edges');
    for (let i = 0; i < +layer.dataset.eyes; i++) {
      const el = document.createElement('div');
      el.className = 'pair';
      el.innerHTML = '<i></i><i></i>';
      layer.append(el);
      const shown = place(el, edges);
      el.classList.toggle('flee', !shown);
      pairs.push({ el, edges, hidden: !shown, since: 0 });
    }
  });

  if (!reduced) {
    const blink = (p) => {
      setTimeout(() => {
        p.el.classList.add('blink');
        setTimeout(() => { p.el.classList.remove('blink'); blink(p); }, 140 + Math.random() * 80);
      }, 1800 + Math.random() * 6000);
    };
    pairs.forEach(blink);
  }

  let lastAudit = 0;
  const updateEyes = (now) => {
    // Images loading in and text revealing shift the layout under the eyes,
    // so every so often any pair that has ended up on the words shuts and moves
    const audit = now - lastAudit > 600;
    if (audit) lastAudit = now;
    for (const p of pairs) {
      const b = p.el.getBoundingClientRect();
      if (b.bottom < -50 || b.top > innerHeight + 50) continue;
      if (audit && !p.hidden && overlapsWords(p.el)) {
        p.hidden = true; p.since = now - 1200;
        spots.delete(p.el);
        p.el.classList.add('flee');
        continue;
      }
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy) || 1;
      const reach = Math.hypot(dx / rx, dy / ry); // < 1 means inside the light

      if (!p.hidden && reach < 0.8) {
        // Caught in the light: shut and slink away
        p.hidden = true; p.since = now;
        spots.delete(p.el);
        p.el.style.setProperty('--fx', (dx / d) * 40 + 'px');
        p.el.style.setProperty('--fy', (dy / d) * 40 + 'px');
        p.el.classList.add('flee');
      } else if (p.hidden && now - p.since > 2200 && reach > 1.4) {
        // Re-emerge somewhere else, once the light has moved on
        if (!place(p.el, p.edges)) { p.since = now; continue; }
        // Jump to the new spot unseen, then fade in there
        p.el.classList.add('placing');
        p.el.style.setProperty('--fx', '0px');
        p.el.style.setProperty('--fy', '0px');
        void p.el.offsetWidth;
        p.el.classList.remove('placing', 'flee');
        p.hidden = false;
      } else if (!p.hidden) {
        // Watch the light
        p.el.style.setProperty('--lx', (-dx / d) * 2.5 + 'px');
        p.el.style.setProperty('--ly', (-dy / d) * 2.5 + 'px');
      }
    }
  };

  const frame = (now) => {
    x += (tx - x) * 0.16;
    y += (ty - y) * 0.16;
    const flick = reduced ? 1
      : 1 + Math.sin(now / 95) * 0.012 + Math.sin(now / 41) * 0.009 + (Math.random() - 0.5) * 0.018;
    if (coarse) { rx = lantern.rx * flick; ry = lantern.ry * flick; }
    else { rx = ry = candleRadius() * flick; }
    if (!body.classList.contains('power')) {
      root.style.setProperty('--x', x.toFixed(1) + 'px');
      root.style.setProperty('--y', y.toFixed(1) + 'px');
      root.style.setProperty('--rx', rx.toFixed(1) + 'px');
      root.style.setProperty('--ry', ry.toFixed(1) + 'px');
      updateEyes(now);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  /* ---------------------------------------------------------------- the switch */
  const sw = $('.switch');
  const swLabel = $('.switch-label');
  const tip = $('.switch-tip');
  let tipTimer;
  const setPower = (on, animate) => {
    body.classList.toggle('power', on);
    sw.setAttribute('aria-pressed', String(on));
    // The label says what pressing it will do
    swLabel.textContent = on ? 'Lights off' : 'Lights on';
    sw.title = on ? 'Back to the dark' : 'Turn the lights on';
    if (on && animate && !reduced) {
      body.classList.add('flicker');
      setTimeout(() => body.classList.remove('flicker'), 1150);
    }
    try { localStorage.setItem('nada-power', on ? '1' : '0'); } catch (e) {}
  };
  let stored = null;
  try { stored = localStorage.getItem('nada-power'); } catch (e) {}
  setPower(stored === '1', false);

  // Until someone has used the switch, it glows like a hallway switch in the dark,
  // and a scribbled note points at it after a few seconds.
  const flip = () => {
    setPower(!body.classList.contains('power'), true);
    sw.classList.remove('beckon');
    tip.classList.remove('show');
    clearTimeout(tipTimer);
    try { localStorage.setItem('nada-switch-known', '1'); } catch (e) {}
  };
  sw.addEventListener('click', flip);
  tip.addEventListener('click', flip);

  let known = false;
  try { known = localStorage.getItem('nada-switch-known') === '1'; } catch (e) {}
  if (!known && !body.classList.contains('power')) {
    sw.classList.add('beckon');
    tipTimer = setTimeout(() => {
      tip.classList.add('show');
      tipTimer = setTimeout(() => tip.classList.remove('show'), 9000);
    }, 4000);
  }

  /* ---------------------------------------------------------------- menu */
  const menuBtn = $('.menu-btn');
  const menu = $('#menu');
  const closeMenu = () => { menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.textContent = 'Menu'; };
  menuBtn.addEventListener('click', () => {
    const open = !menu.classList.contains('open');
    menu.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
  });
  $$('a', menu).forEach((a) => a.addEventListener('click', closeMenu));

  /* ---------------------------------------------------------------- reveal */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
  $$('[data-reveal], .scribble').forEach((el) => io.observe(el));

  /* ---------------------------------------------------------------- room peek */
  const peek = $('.peek');
  const peekImg = $('img', peek);
  if (!coarse) {
    $$('[data-peek]').forEach((a) => {
      a.addEventListener('mouseenter', () => { peekImg.src = a.dataset.peek; peek.classList.add('on'); });
      a.addEventListener('mouseleave', () => peek.classList.remove('on'));
      a.addEventListener('mousemove', (e) => {
        peek.style.left = e.clientX + 140 + 'px';
        peek.style.top = e.clientY + 'px';
      });
    });
  }

  /* ---------------------------------------------------------------- the corridors */
  // Every room is a sideways row; the door at the end opens the whole room
  $$('.track-wrap').forEach((wrap) => {
    const track = $('.track', wrap);
    const meter = $('.track-meter span', wrap);
    const updateMeter = () => {
      const max = track.scrollWidth - track.clientWidth;
      const vis = track.clientWidth / track.scrollWidth;
      meter.style.width = vis * 100 + '%';
      meter.style.left = (max > 0 ? (track.scrollLeft / max) * (1 - vis) * 100 : 0) + '%';
    };
    track.addEventListener('scroll', updateMeter, { passive: true });
    addEventListener('resize', updateMeter);
    addEventListener('load', updateMeter);

    $$('.track-btn', wrap).forEach((b) => b.addEventListener('click', () => {
      track.scrollBy({ left: +b.dataset.dir * track.clientWidth * 0.75, behavior: reduced ? 'auto' : 'smooth' });
    }));

    let drag = null;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || track.scrollWidth <= track.clientWidth) return;
      drag = { x: e.clientX, left: track.scrollLeft, moved: false };
    });
    addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; track.classList.add('dragging'); }
      if (drag.moved) track.scrollLeft = drag.left - dx;
    });
    addEventListener('pointerup', () => {
      if (!drag) return;
      // Let the click that ends a drag be swallowed (works have pointer-events off while dragging)
      setTimeout(() => track.classList.remove('dragging'), 0);
      drag = null;
    });
  });

  /* ---------------------------------------------------------------- the full rooms */
  // Each opens at its own address (#charcoal/all), so Back closes it and the link can be shared
  const roomFromHash = () => {
    const m = location.hash.match(/^#([\w-]+)\/all$/);
    return m && $('#' + m[1] + '-all');
  };
  const openRoom = (dlg) => {
    if (!dlg || dlg.open) return;
    dlg.scrollTop = 0;
    dlg.showModal();
    root.classList.add('room-open');
  };
  let pushed = false; // did we add the history step (so Back can undo it)?
  $$('.room-all').forEach((dlg) => {
    $('.room-all-close', dlg).addEventListener('click', () => {
      if (pushed) history.back(); else dlg.close();
    });
    dlg.addEventListener('close', () => {
      root.classList.remove('room-open');
      pushed = false;
      // Leave the room's address without adding a history step
      if (roomFromHash() === dlg) history.replaceState(null, '', '#' + dlg.id.replace(/-all$/, ''));
      $('.door', dlg.closest('.room')).focus({ preventScroll: true });
    });
  });
  $$('.door').forEach((d) => d.addEventListener('click', (e) => {
    e.preventDefault();
    history.pushState(null, '', d.getAttribute('href'));
    pushed = true;
    openRoom(roomFromHash());
  }));
  addEventListener('popstate', () => {
    const want = roomFromHash();
    $$('.room-all').forEach((dlg) => { if (dlg.open && dlg !== want) dlg.close(); });
    openRoom(want);
  });
  if (roomFromHash()) {
    roomFromHash().closest('.room').scrollIntoView();
    openRoom(roomFromHash());
  }

  /* ---------------------------------------------------------------- lightbox */
  const lb = $('#lightbox');
  const lbImg = $('.lb-img', lb);
  const lbCap = $('.lb-cap', lb);
  const pad = (n) => String(n).padStart(2, '0');
  let list = [];
  let cur = 0;

  const show = (i) => {
    cur = (i + list.length) % list.length;
    const w = list[cur];
    const thumb = $('img', w);
    const full = w.dataset.full;
    lbImg.src = thumb.currentSrc || thumb.src;
    lbImg.width = +w.dataset.w; lbImg.height = +w.dataset.h;
    lbImg.alt = thumb.alt;
    lbCap.textContent = `${w.dataset.caption} — ${pad(cur + 1)} / ${pad(list.length)}`;
    const hi = new Image();
    hi.src = full;
    const shown = cur;
    hi.decode().then(() => { if (cur === shown && list[cur] === w) lbImg.src = full; }).catch(() => {});
  };

  document.addEventListener('click', (e) => {
    const w = e.target.closest('.work');
    if (!w) return;
    list = $$('.work', w.closest('.gallery'));
    lb.style.setProperty('--ox', e.clientX + 'px');
    lb.style.setProperty('--oy', e.clientY + 'px');
    show(list.indexOf(w));
    lb.showModal();
    root.classList.add('lb-open');
  });

  $('.lb-prev', lb).addEventListener('click', () => show(cur - 1));
  $('.lb-next', lb).addEventListener('click', () => show(cur + 1));
  $('.lb-close', lb).addEventListener('click', () => lb.close());
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.tagName === 'FIGURE') lb.close(); });
  lb.addEventListener('close', () => {
    root.classList.remove('lb-open');
    list[cur] && list[cur].focus({ preventScroll: true });
  });
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  });

  let sx = null;
  lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1));
    sx = null;
  }, { passive: true });

})();
