(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ nav */
  const nav = document.querySelector('[data-nav]');
  const toggle = document.querySelector('[data-nav-toggle]');
  const links = document.getElementById('nav-links');

  const progressBar = document.querySelector('[data-progress-bar]');
  const onScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 8);
    if (progressBar) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    }
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    links.classList.toggle('is-open', open);
    nav.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* -------------------------------------------------------------- reveal */
  const revealables = [...document.querySelectorAll('.reveal')];
  document.querySelectorAll('.pillars, .segments, .tiers, .steps, .sustain__cards').forEach((group) => {
    [...group.children].forEach((el, i) => el.style.setProperty('--i', i));
  });
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('is-pending');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach((el) => {
      // Only hide what's below the fold, so nothing flashes on first paint.
      if (el.getBoundingClientRect().top > window.innerHeight) {
        el.classList.add('is-pending');
        io.observe(el);
      }
    });
  }

  /* ---------------------------------------------------- lifecycle dial */
  const dial = document.querySelector('[data-dial]');
  if (dial) {
    const STOPS = [
      { at: 0, rgb: [94, 42, 75] },     // care — dark mauve
      { at: 17, rgb: [140, 82, 118] },  // maintain
      { at: 33, rgb: [195, 147, 171] }, // reuse
      { at: 50, rgb: [242, 214, 223] }, // recycle — powder pink
    ];
    const STAGES = [
      { from: 0, name: 'Care' },
      { from: 13, name: 'Maintain' },
      { from: 26, name: 'Reuse' },
      { from: 39, name: 'Recycle' },
    ];

    const range = dial.querySelector('[data-range]');
    const progress = dial.querySelector('[data-progress]');
    const hand = dial.querySelector('[data-hand]');
    const count = dial.querySelector('[data-count]');
    const stageEl = dial.querySelector('[data-stage]');
    const stageItems = [...dial.querySelectorAll('[data-stage-item]')];
    const ticks = dial.querySelector('[data-ticks]');
    const colourTarget = dial.closest('.hero') || dial;

    const SVG_NS = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 50; i++) {
      const major = STAGES.some((s) => s.from === i);
      const a = (i / 50) * Math.PI * 2 - Math.PI / 2;
      const r1 = 166, r2 = major ? 178 : 172;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', 180 + r1 * Math.cos(a));
      line.setAttribute('y1', 180 + r1 * Math.sin(a));
      line.setAttribute('x2', 180 + r2 * Math.cos(a));
      line.setAttribute('y2', 180 + r2 * Math.sin(a));
      line.setAttribute('class', major ? 'dial__tick dial__tick--major' : 'dial__tick');
      ticks.appendChild(line);
    }

    const colourAt = (v) => {
      for (let i = 1; i < STOPS.length; i++) {
        const a = STOPS[i - 1], b = STOPS[i];
        if (v <= b.at) {
          const t = (v - a.at) / (b.at - a.at);
          return `rgb(${a.rgb.map((c, k) => Math.round(c + (b.rgb[k] - c) * t)).join(',')})`;
        }
      }
      return `rgb(${STOPS[STOPS.length - 1].rgb.join(',')})`;
    };

    const render = (v) => {
      const stageIndex = STAGES.reduce((acc, s, i) => (v >= s.from ? i : acc), 0);
      colourTarget.style.setProperty('--lc', colourAt(v));
      progress.setAttribute('stroke-dasharray', `${v} 50`);
      hand.style.transform = `rotate(${(v / 50) * 360}deg)`;
      count.textContent = v;
      stageEl.textContent = STAGES[stageIndex].name;
      stageItems.forEach((li, i) => li.classList.toggle('is-active', i === stageIndex));
      range.setAttribute('aria-valuetext', `${v} wash cycles — ${STAGES[stageIndex].name}`);
    };

    // Gentle autoplay until the visitor takes control.
    let value = 0;
    let timer = null;
    const stop = () => { clearInterval(timer); timer = null; };
    range.addEventListener('input', () => { stop(); render(Number(range.value)); });
    range.addEventListener('pointerdown', stop);
    range.addEventListener('keydown', stop);

    render(0);
    if (!reduceMotion) {
      let dir = 1;
      setTimeout(() => {
        timer = setInterval(() => {
          value += dir;
          if (value >= 50 || value <= 0) dir *= -1;
          range.value = value;
          render(value);
        }, 140);
      }, 900);
    } else {
      range.value = 24;
      render(24);
    }
  }

  /* ------------------------------------------ hero tilt (pointer only) */
  const visual = document.querySelector('.hero__visual');
  if (visual && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    const card = visual.querySelector('.instrument');
    const hero = visual.closest('.hero');
    hero.addEventListener('pointermove', (e) => {
      const r = visual.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      card.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
    });
    hero.addEventListener('pointerleave', () => {
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--rx', '0deg');
    });
  }

  /* ---------------------------------------- manifesto: scroll-lit words */
  const manifesto = document.querySelector('[data-manifesto]');
  if (manifesto) {
    const ACCENT = new Set(['cared', 'kept', 'passed', 'recycled.']);
    const words = manifesto.textContent.trim().split(/\s+/);
    manifesto.textContent = '';
    const spans = words.map((w, i) => {
      const span = document.createElement('span');
      span.className = 'mw' + (ACCENT.has(w.replace(/,$/, '')) ? ' is-accent' : '');
      span.textContent = w;
      manifesto.append(span, i < words.length - 1 ? ' ' : '');
      return span;
    });
    manifesto.setAttribute('aria-label', words.join(' '));
    if (reduceMotion) {
      spans.forEach((sp) => sp.classList.add('is-lit'));
    } else {
      const light = () => {
        const r = manifesto.getBoundingClientRect();
        const vh = window.innerHeight;
        const p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.3)));
        const lit = Math.round(p * spans.length);
        spans.forEach((sp, i) => sp.classList.toggle('is-lit', i < lit));
      };
      window.addEventListener('scroll', light, { passive: true });
      window.addEventListener('resize', light);
      light();
    }
  }

  /* -------------------------------------------------- count-up figures */
  const counters = [...document.querySelectorAll('[data-count-to]')].filter((el) => Number(el.dataset.countTo) > 0);
  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    const run = (el) => {
      const target = Number(el.dataset.countTo);
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / 1400);
        el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const co = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { run(e.target); co.unobserve(e.target); }
    }), { threshold: 0.6 });
    counters.forEach((el) => { el.textContent = '0'; co.observe(el); });
  }

  /* ----------------------------------------------- spotlight on cards */
  document.querySelectorAll('.pillar, .sustain__card, .step, .segment, .tier, .figure').forEach((el) => {
    el.classList.add('spot');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  /* ------------------------------------- lifecycle story (scroll-driven) */
  const story = document.querySelector('[data-story]');
  if (story) {
    const STOPS = [[94, 42, 75], [140, 82, 118], [195, 147, 171], [242, 214, 223]];
    const NAMES = ['Care', 'Maintain', 'Reuse', 'Recycle'];
    const stages = [...story.querySelectorAll('[data-story-stage]')];
    const details = [...story.querySelectorAll('[data-story-detail]')];
    const indicator = story.querySelector('[data-story-indicator]');
    const tag = story.querySelector('[data-story-tag]');
    const chips = [...story.querySelectorAll('[data-story-chip]')];
    const odoCols = [...story.querySelectorAll('.odo__col')];
    const dye = story.querySelector('[data-story-dye]');
    const fan = story.querySelector('[data-fan]');
    const nameEl = story.querySelector('[data-story-name]');

    const mix = (p) => {
      const seg = Math.min(STOPS.length - 2, Math.floor(p * (STOPS.length - 1)));
      const t = p * (STOPS.length - 1) - seg;
      return `rgb(${STOPS[seg].map((c, k) => Math.round(c + (STOPS[seg + 1][k] - c) * t)).join(',')})`;
    };

    let target = 0;
    let current = 0;
    let lastWashes = -1;
    let lastStage = -1;
    let raf = null;

    const measure = () => {
      const r = story.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      target = travel > 0 ? Math.min(1, Math.max(0, -r.top / travel)) : 0;
    };

    const render = (p) => {
      story.style.setProperty('--lc', mix(p));
      story.style.setProperty('--p', p.toFixed(4));
      story.style.setProperty('--gp', p.toFixed(4));

      const washes = Math.round(p * 50);
      if (washes !== lastWashes) {
        odoCols[0].style.transform = `translateY(${-Math.floor(washes / 10) * 10}%)`;
        odoCols[1].style.transform = `translateY(${-(washes % 10) * 10}%)`;
        lastWashes = washes;
      }

      const idx = Math.min(3, Math.floor(washes / 12.75));
      if (idx !== lastStage) {
        stages.forEach((li, i) => li.classList.toggle('is-active', i === idx));
        details.forEach((d, i) => d.classList.toggle('is-active', i === idx));
        chips.forEach((c, i) => c.classList.toggle('is-active', i === idx));
        indicator.style.setProperty('--si', idx);
        nameEl.textContent = NAMES[idx];
        if (lastStage !== -1 && !reduceMotion) {
          [tag, dye].forEach((el) => el.classList.remove('is-pulse', 'is-wave'));
          void tag.getBoundingClientRect(); // restart the animations
          tag.classList.add('is-pulse');
          dye.classList.add('is-wave');
        }
        lastStage = idx;
      }
    };

    // Ease towards the scroll position each frame, so wheel steps feel continuous.
    const frame = () => {
      current += (target - current) * 0.12;
      if (Math.abs(target - current) < 0.0008) current = target;
      render(current);
      raf = current === target ? null : requestAnimationFrame(frame);
    };

    const onStoryScroll = () => {
      measure();
      if (reduceMotion) { current = target; render(current); return; }
      if (!raf) raf = requestAnimationFrame(frame);
    };

    window.addEventListener('scroll', onStoryScroll, { passive: true });
    window.addEventListener('resize', onStoryScroll);
    measure();
    current = target;
    render(current);

    // Deal the cards in from a stack the first time the section is reached.
    if (!reduceMotion && 'IntersectionObserver' in window) {
      fan.classList.add('is-waiting');
      const dealer = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        dealer.disconnect();
        fan.classList.add('is-dealing');
        requestAnimationFrame(() => fan.classList.remove('is-waiting'));
        setTimeout(() => fan.classList.remove('is-dealing'), 2600);
      }, { threshold: 0.35 });
      dealer.observe(fan);
    }
  }

  /* --------------------------------------------- magnetic primary CTAs */
  if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.btn--lg.btn--primary, .btn--lg.btn--light').forEach((btn) => {
      btn.classList.add('is-magnetic');
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.18;
        const y = (e.clientY - r.top - r.height / 2) * 0.3;
        btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  /* ------------------------------------------------- BOM estimator */
  const est = document.querySelector('[data-estimator]');
  if (est) {
    const pricing = JSON.parse(est.dataset.pricing);
    const volumeInput = est.querySelector('[data-est-volume]');
    const volumeOut = est.querySelector('[data-est-volume-out]');
    const rrpInput = est.querySelector('[data-est-rrp]');
    const out = (name) => est.querySelector(`[data-est-${name}]`);
    const MIN = 5000, MAX = 1000000;

    const gbp = (n, dp = 2) => '£' + n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    const pct = (n) => (n * 100).toLocaleString('en-GB', { maximumFractionDigits: 1 }) + '%';
    const pence = (n) => (n * 100).toLocaleString('en-GB', { maximumFractionDigits: 1 }) + 'p';
    const roundNice = (n) => {
      const step = n < 20000 ? 1000 : n < 200000 ? 5000 : 25000;
      return Math.round(n / step) * step;
    };

    const update = () => {
      const t = Number(volumeInput.value) / 100;
      const volume = roundNice(MIN * Math.pow(MAX / MIN, t));
      const rrp = Math.max(1, Number(rrpInput.value) || 0);
      const bespoke = est.querySelector('[data-est-tier]:checked').value === 'bespoke';
      const band = pricing.standard.find((b) => volume >= b.min && (b.max === null || volume <= b.max));
      const low = band.low * (bespoke ? pricing.bespoke.upliftLow : 1);
      const high = band.high * (bespoke ? pricing.bespoke.upliftHigh : 1);

      volumeInput.style.setProperty('--fill', `${volumeInput.value}%`);
      volumeOut.textContent = volume.toLocaleString('en-GB');
      out('price').textContent = `${gbp(low)} – ${gbp(high)}`;
      out('band').textContent = `Volume band: ${band.label}${bespoke ? ' · Bespoke' : ''}`;
      out('share').textContent = `${pct(low / rrp)} – ${pct(high / rrp)}`;
      out('wash').textContent = `${pence(low / pricing.washLife)} – ${pence(high / pricing.washLife)}`;
      out('annual').textContent = `${gbp(low * volume, 0)} – ${gbp(high * volume, 0)}`;
      out('note').textContent = `*Spread across a ${pricing.washLife}-wash calibrated life. Excludes VAT${bespoke ? `; Bespoke also has a one-off design fee from ${gbp(pricing.bespoke.setupFrom, 0)}` : ''}.`;
    };

    est.addEventListener('input', update);
    est.addEventListener('change', update);
    update();
  }

  /* ---------------------------------------------- CTA → form prefills */
  const form = document.querySelector('[data-pilot-form]');
  const specsBox = document.querySelector('[data-specs-box]');
  document.querySelectorAll('[data-specs-cta]').forEach((a) =>
    a.addEventListener('click', () => { if (specsBox) specsBox.checked = true; }));
  document.querySelectorAll('[data-category]').forEach((a) =>
    a.addEventListener('click', () => {
      const select = form && form.elements.category;
      if (select) { select.value = a.dataset.category; select.dispatchEvent(new Event('change', { bubbles: true })); }
    }));

  /* ------------------------------------------------------- pilot form */
  if (form) {
    const submit = form.querySelector('[data-submit]');
    const label = form.querySelector('[data-submit-label]');
    const status = form.querySelector('[data-status]');
    const success = document.querySelector('[data-success]');
    const defaultLabel = label.textContent;

    // Volume is optional when the category is "Other" (volume may not be known yet).
    const syncVolume = () => { form.elements.volume.required = form.elements.category.value !== 'Other'; };
    form.elements.category.addEventListener('change', syncVolume);

    const clearErrors = () => {
      form.querySelectorAll('[data-error-for]').forEach((p) => { p.textContent = ''; });
      form.querySelectorAll('.has-error').forEach((f) => f.classList.remove('has-error'));
      status.textContent = '';
    };

    const showErrors = (errors) => {
      let first = null;
      Object.entries(errors).forEach(([name, msg]) => {
        const slot = form.querySelector(`[data-error-for="${name}"]`);
        if (slot) slot.textContent = msg;
        const input = form.elements[name];
        if (input) {
          input.closest('.field')?.classList.add('has-error');
          input.setAttribute('aria-invalid', 'true');
          first = first || input;
        }
      });
      first?.focus();
    };

    const localErrors = () => {
      const e = {};
      const v = (n) => (form.elements[n].value || '').trim();
      if (v('name').length < 2) e.name = 'Please enter your full name.';
      if (!v('company')) e.company = 'Please enter your company or brand.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) e.email = 'Please enter a valid work email.';
      if (!v('category')) e.category = 'Please choose a category.';
      if (v('category') !== 'Other' && !v('volume')) e.volume = 'Please choose a volume band.';
      if (!form.elements.consent.checked) e.consent = 'Please confirm we may contact you.';
      return e;
    };

    form.addEventListener('input', (e) => {
      const field = e.target.closest('.field');
      if (field?.classList.contains('has-error')) {
        field.classList.remove('has-error');
        e.target.removeAttribute('aria-invalid');
        const slot = field.querySelector('[data-error-for]');
        if (slot) slot.textContent = '';
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();
      const errors = localErrors();
      if (Object.keys(errors).length) return showErrors(errors);

      const data = Object.fromEntries(new FormData(form));
      submit.disabled = true;
      label.textContent = 'Sending…';

      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.ok) {
          form.hidden = true;
          success.hidden = false;
          success.focus();
          return;
        }
        if (res.status === 422 && json.errors) showErrors(json.errors);
        else status.textContent = json.error || 'Something went wrong. Please try again.';
      } catch {
        status.textContent = 'Network error. Please check your connection and try again.';
      } finally {
        submit.disabled = false;
        label.textContent = defaultLabel;
      }
    });
  }
})();
