/* CHARISMATA — меню, фильм первого экрана, лента дней, видео, кнопка заявки и анкета.
   Без зависимостей. */
(() => {
  'use strict';

  const doc = document;
  const html = doc.documentElement;
  const $ = (s, c = doc) => c.querySelector(s);
  const $$ = (s, c = doc) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* События для будущей аналитики (GTM и т. п.). Ответы анкеты сюда не попадают. */
  const track = (event, extra) => {
    (window.dataLayer = window.dataLayer || []).push(Object.assign({ event }, extra || {}));
  };

  /* ───────── Типографика: неразрывные пробелы после коротких слов и перед тире ───────── */
  (function typograf(root) {
    const skip = /^(script|style|textarea|input|select|option|svg|code|noscript)$/i;
    const tw = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        for (let p = n.parentNode; p && p !== root; p = p.parentNode) {
          if (skip.test(p.nodeName)) return NodeFilter.FILTER_REJECT;
        }
        return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (tw.nextNode()) nodes.push(tw.currentNode);
    const short = /(^|[\s(«„"])([А-Яа-яЁёA-Za-z]{1,2})[ \n]+(?=\S)/g;
    nodes.forEach(n => {
      let t = n.nodeValue;
      t = t.replace(short, '$1$2 ').replace(short, '$1$2 ');
      t = t.replace(/[ \n]+(—|–)/g, ' $1');
      t = t.replace(/(\d)[ ](?=\d{3}(\D|$))/g, '$1 ');
      t = t.replace(/(\d\+?)[ ](€|лет|часов|человек|участник|апреля)/g, '$1 $2');
      if (t !== n.nodeValue) n.nodeValue = t;
    });
  })(doc.body);

  /* ───────── Появление блоков при прокрутке ─────────
     Скрипт сам размечает блоки и ставит класс rv-on; если он не загрузился, ничего не прячется. */
  (() => {
    if (reduce || !('IntersectionObserver' in window)) return;
    const IMAGES = '.marina figure, .mosaic figure, .circle figure, .prices__photo';
    const BLOCKS = '.sheet h2, .sheet .lead, .head__sub, .about p:not(.lead), .facts > div, .marina__text > p:not(.lead), .stats > div, .video, .more, .tabs, .method__note, .day, .chips, .chips__note, .food, .circle p:not(.lead), .rules > div, .whom__list li, .sub, .price, .flow li, .join__go, .split__head > p:not(.lead), .formbox, .ftr__top, .ftr__word, .ftr__base';
    $$(IMAGES).forEach(el => el.setAttribute('data-rv', 'img'));
    $$(BLOCKS).forEach(el => { if (!el.closest('[data-rv]')) el.setAttribute('data-rv', ''); });
    // соседние блоки появляются по очереди
    $$('[data-rv]').forEach(el => {
      const i = Array.from(el.parentNode.children).filter(c => c.hasAttribute('data-rv')).indexOf(el);
      if (i > 0) el.style.setProperty('--rv-d', (Math.min(i, 5) * 0.08).toFixed(2) + 's');
    });
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.05 });   // без отступа снизу: иначе последняя строка подвала никогда не «войдёт» в экран
    html.classList.add('rv-on');
    $$('[data-rv]').forEach(el => io.observe(el));
  })();

  /* ───────── Прокрутка: один обработчик на кадр ───────── */
  const scrollFns = [];
  let ticking = false;
  const runScroll = () => {
    ticking = false;
    const y = window.scrollY, vh = window.innerHeight;
    for (const f of scrollFns) f(y, vh);
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  /* ───────── Меню ───────── */
  const burger = $('.burger'), menu = $('#menu');
  if (burger && menu) {
    const setMenu = open => {
      html.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      menu.setAttribute('aria-hidden', String(!open));
      doc.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setMenu(!html.classList.contains('menu-open')));
    $$('[data-menu-close]', menu).forEach(b => b.addEventListener('click', () => { setMenu(false); burger.focus(); }));
    $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
    addEventListener('resize', () => { if (innerWidth > 1080) setMenu(false); });
  }

  /* ───────── Первый экран ───────── */
  const hero = $('[data-hero]');
  if (hero) {
    // Название — ровно по ширине экрана: уточняем размер шрифта, заданный в стилях
    const title = $('.hero__title', hero), word = $('.hero__word', hero);
    const fit = () => {
      title.style.fontSize = '';
      const avail = title.clientWidth, w = word.getBoundingClientRect().width;
      if (!avail || !w) return;
      const fs = parseFloat(getComputedStyle(title).fontSize) * (avail / w);
      title.style.fontSize = Math.min(fs, innerHeight * 0.34).toFixed(2) + 'px';
    };
    fit();
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit);
    addEventListener('resize', fit);
    addEventListener('load', fit);

    // Заставка: название увеличивается «сквозь» букву I — находим её место и нужный масштаб
    const introWord = $('.intro__word', hero);
    if (introWord && html.classList.contains('is-intro')) {
      const setOrigin = () => {
        if (performance.now() > 950) return;          // увеличение уже началось — размеры искажены
        const t = introWord.firstChild, r = doc.createRange(), i = t.nodeValue.indexOf('I');
        r.setStart(t, i); r.setEnd(t, i + 1);
        const g = r.getBoundingClientRect(), w = introWord.getBoundingClientRect();
        if (!g.width || !w.width) return;
        introWord.style.setProperty('--ox', (((g.left + g.width / 2 - w.left) / w.width) * 100).toFixed(2) + '%');
        introWord.style.setProperty('--zoom', String(Math.ceil((Math.max(innerWidth, innerHeight) / (g.width * 0.25)) * 1.6)));
      };
      setOrigin();
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(setOrigin);
      setTimeout(() => html.classList.remove('is-intro'), 3800);
    }

    // Фильм: кадр сменяется, когда заполнилась его полоска. Кадры после первого
    // подгружаются уже после загрузки страницы, на телефоне — облегчённые вертикальные.
    const slides = $$('.film img', hero), marks = $$('.reelnav button', hero);
    const small = matchMedia('(max-width: 700px)').matches;
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    let cur = 0;
    const isReady = img => img.complete && img.naturalWidth > 0;
    const loadSlide = img => {
      if (!img.dataset.src) return;
      img.src = small && img.dataset.srcM ? img.dataset.srcM : img.dataset.src;
      img.removeAttribute('data-src');
    };
    const restartBar = m => { m.classList.remove('is-on'); void m.offsetWidth; m.classList.add('is-on'); };
    // Смена кадра идёт по таймеру (полоски на ПК скрыты, поэтому на их анимацию не опираемся)
    const HOLD = 6500;
    let timer = 0;
    const schedule = () => {
      clearTimeout(timer);
      if (!reduce && !doc.hidden) timer = setTimeout(() => go(cur + 1), HOLD);
    };
    const go = (i, user) => {
      i = (i + slides.length) % slides.length;
      if (i === cur) { schedule(); return; }
      const next = slides[i];
      if (!isReady(next)) {                       // кадр ещё не загрузился — остаёмся на текущем
        if (user) { loadSlide(next); next.addEventListener('load', () => go(i), { once: true }); }
        restartBar(marks[cur]);
        schedule();
        return;
      }
      const old = slides[cur];
      old.classList.remove('is-on'); old.classList.add('is-out');
      setTimeout(() => { if (!old.classList.contains('is-on')) old.classList.remove('is-out'); }, 1500);
      next.classList.remove('is-out'); next.classList.add('is-on');
      marks.forEach((m, k) => { m.classList.toggle('is-on', k === i); m.classList.toggle('is-done', k < i); });
      cur = i;
      schedule();
    };
    marks.forEach((m, i) => m.addEventListener('click', () => go(i, true)));
    // вкладка ушла в фон — останавливаемся, вернулась — продолжаем с начала полоски
    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) clearTimeout(timer); else { restartBar(marks[cur]); schedule(); }
    });
    schedule();
    if (!saveData) {
      const loadRest = () => setTimeout(() => slides.forEach(loadSlide), 500);
      if (doc.readyState === 'complete') loadRest(); else addEventListener('load', loadRest);
    }
  }

  /* ───────── Переключатель «уровни / этапы» ───────── */
  $$('[data-tabs]').forEach(root => {
    const tabs = $$('[role="tab"]', root);
    const panels = tabs.map(t => doc.getElementById(t.getAttribute('aria-controls')));
    const select = (i, focus) => {
      tabs.forEach((t, k) => {
        const on = k === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (panels[k]) panels[k].hidden = !on;
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        select((i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length, true);
      });
    });
    select(0);
  });

  /* ───────── Лента дней ───────── */
  const reel = $('.reel');
  if (reel) {
    $$('.days__nav button').forEach(b => {
      b.addEventListener('click', () => reel.scrollBy({ left: +b.dataset.dir * reel.clientWidth * 0.7, behavior: reduce ? 'auto' : 'smooth' }));
    });
  }

  /* ───────── Видео: обложка → плеер на месте ───────── */
  $$('[data-yt]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const id = a.dataset.yt;
      const box = doc.createElement('div');
      box.className = 'video__frame';
      const f = doc.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1`;
      f.title = (a.getAttribute('aria-label') || 'Видео').replace(/^Смотреть видео:\s*/, '');
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.allowFullscreen = true;
      box.appendChild(f);
      a.replaceWith(box);
      track('video_play', { video: id });
    });
  });

  /* ───────── Плавающая кнопка заявки: после первого экрана и до анкеты ───────── */
  const dock = $('#dock'), applySec = $('#apply');
  if (dock) {
    const link = $('a', dock);
    let shown = false;
    scrollFns.push((y, vh) => {
      const on = y > vh * 0.7 && (!applySec || applySec.getBoundingClientRect().top > vh * 0.9);
      if (on === shown) return;
      shown = on;
      dock.classList.toggle('is-on', on);
      dock.setAttribute('aria-hidden', String(!on));
      if (link) link.tabIndex = on ? 0 : -1;
    });
  }

  /* ───────── Анкета: по одному вопросу ───────── */
  const form = $('#apply-form');
  if (form) {
    const steps = $$('.form__step', form);
    const nowEl = $('[data-step-now]', form), totalEl = $('[data-step-total]', form);
    const prev = $('[data-prev]', form), next = $('[data-next]', form), submit = $('[data-submit]', form);
    const hint = $('[data-enter-hint]', form);
    const errBox = $('.form__error', form), done = $('#apply-done');
    const box = form.closest('.formbox') || form;
    const KEY = 'charismata-form', UKEY = 'charismata-utm';
    let step = 0, started = false, sending = false;
    const PREVIEW = /\.github\.io$/i.test(location.hostname);
    const store = {
      get(k) { try { return JSON.parse(sessionStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } },
      set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } },
      del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* хранилище недоступно */ } }
    };
    if (totalEl) totalEl.textContent = String(steps.length);

    // UTM-метки и источник перехода
    const utm = store.get(UKEY);
    const qs = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => {
      const v = qs.get(k); if (v) utm[k] = v.slice(0, 120);
    });
    if (!utm.referrer && doc.referrer && doc.referrer.indexOf(location.origin) !== 0) utm.referrer = doc.referrer.slice(0, 300);
    store.set(UKEY, utm);
    Object.keys(utm).forEach(k => { const el = form.elements[k]; if (el) el.value = utm[k]; });

    // Черновик живёт до закрытия вкладки
    const saved = store.get(KEY);
    Object.keys(saved).forEach(k => { const el = form.elements[k]; if (el && 'value' in el) el.value = saved[k]; });
    const save = () => {
      const o = {};
      new FormData(form).forEach((v, k) => { if (!/^(consent|website|page|referrer|started_at|utm_)/.test(k)) o[k] = v; });
      store.set(KEY, o);
    };
    form.addEventListener('input', () => {
      if (!started) { started = true; form.elements.started_at.value = String(Date.now()); track('form_start'); }
      save();
    });

    // Проверка полей
    const rules = {
      name: v => v.trim().length >= 2 || 'Напишите, пожалуйста, имя и фамилию',
      email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Похоже, в адресе почты опечатка — проверьте его',
      phone: v => v.trim().length >= 5 || 'Оставьте телефон или мессенджер, чтобы мы могли с вами связаться',
      motivation: v => v.trim().length >= 10 || 'Напишите хотя бы пару слов — это главный вопрос анкеты',
      consent: (v, el) => el.checked || 'Без согласия на обработку данных мы не можем принять анкету'
    };
    const check = el => {
      const rule = rules[el.name];
      if (!rule) return true;
      const res = rule(el.value, el), ok = res === true;
      const wrap = el.closest('.field');
      if (wrap) {
        wrap.classList.toggle('is-bad', !ok);
        const msg = $('.field__err', wrap);
        if (msg) msg.textContent = ok ? '' : res;
      }
      el.setAttribute('aria-invalid', String(!ok));
      return ok;
    };
    const checkStep = (i, focus) => {
      let first = null;
      $$('input, textarea', steps[i]).forEach(el => { if (rules[el.name] && !check(el) && !first) first = el; });
      if (first && focus) first.focus();
      return !first;
    };
    form.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('.is-bad')) check(e.target); });
    form.addEventListener('change', e => { if (e.target.name === 'consent') check(e.target); });

    // Переход между вопросами
    const go = (i, user) => {
      step = clamp(i, 0, steps.length - 1);
      const last = step === steps.length - 1;
      steps.forEach((s, k) => s.classList.toggle('is-active', k === step));
      nowEl.textContent = String(step + 1);
      form.style.setProperty('--prog', ((step + 1) / steps.length).toFixed(3));
      prev.hidden = step === 0;
      next.hidden = last;
      submit.hidden = !last;
      if (hint) hint.hidden = last || !fine || !!$('textarea', steps[step]);
      if (user) {
        const top = box.getBoundingClientRect().top;
        if (top < 20 || top > innerHeight * 0.5) box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        const f = $('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea', steps[step]);
        if (f && fine) f.focus({ preventScroll: true });
      }
    };
    next.addEventListener('click', () => { if (checkStep(step, true)) { track('form_step', { step: step + 2 }); go(step + 1, true); } });
    prev.addEventListener('click', () => go(step - 1, true));
    go(0, false);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (sending) return;
      if (step < steps.length - 1) { if (checkStep(step, true)) go(step + 1, true); return; }   // Enter в поле = «Дальше»
      for (let i = 0; i < steps.length; i++) {
        if (!checkStep(i, false)) { go(i, true); checkStep(i, true); return; }
      }

      sending = true;
      form.classList.add('is-sending');
      submit.disabled = true;
      const old = submit.textContent;
      submit.textContent = 'Отправляем…';
      errBox.hidden = true;

      try {
        if (PREVIEW) {
          // публичный предпросмотр на GitHub Pages: обработчика почты там нет, анкету никуда не шлём
          await new Promise(r => setTimeout(r, 500));
          const note = doc.createElement('p');
          note.className = 'form-done__note';
          note.textContent = 'Это предпросмотр сайта: анкета никуда не отправлена.';
          done.appendChild(note);
        } else {
          const res = await fetch(form.getAttribute('action'), {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'fetch' },
            body: new URLSearchParams(new FormData(form))
          });
          let data = null;
          try { data = await res.json(); } catch (_) { /* не JSON */ }
          if (!res.ok || !data || !data.ok) throw new Error((data && data.message) || '');
        }

        track('form_submit');
        store.del(KEY);
        const first = form.elements.name.value.trim().split(/\s+/)[0] || '';
        const nm = $('[data-done-name]', done);
        if (nm) nm.textContent = first ? ', ' + first : '';
        form.hidden = true;
        done.hidden = false;
        form.reset();
        done.focus({ preventScroll: true });
        if (box.getBoundingClientRect().top < 20) box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      } catch (err) {
        errBox.textContent = err.message || 'Анкета не отправилась. Проверьте соединение и нажмите «Отправить анкету» ещё раз — ответы сохранены.';
        errBox.hidden = false;
      } finally {
        sending = false;
        form.classList.remove('is-sending');
        submit.disabled = false;
        submit.textContent = old;
      }
    });
  }

  onScroll();
})();
