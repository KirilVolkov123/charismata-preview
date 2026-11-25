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
    const BLOCKS = '.sheet h2, .sheet .lead, .head__sub, .about p:not(.lead), .facts > div, .marina__text > p:not(.lead), .stats > div, .listen__stage, .playlist li, .more, .tabs, .method__note, .day, .extras__head, .extras__list, .food, .circle p:not(.lead), .rules > div, .whom__list li, .sub, .offer__head > p:not(.lead), .offer__panel, .flow li, .join__note, .split__head > p:not(.lead), .formbox, .ftr__panel';
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

    const isReady = img => img.complete && img.naturalWidth > 0;

    // Заставка (один раз за посещение, класс is-intro ставит скрипт в <head>).
    // Счётчик и свет в названии идут по реальной загрузке: шрифт, кадры окна, первый кадр фильма
    // и начало видео. Пока грузится — в окне по очереди мелькают кадры усадьбы; на 100 окно
    // показывает первый кадр фильма и раскрывается на весь экран, после чего поднимается остальное.
    const runIntro = waitFor => new Promise(done => {
      if (!html.classList.contains('is-intro')) { done(); return; }
      const intro = $('.intro', hero), win = $('.intro__win', hero), ui = $('.intro__ui', hero);
      const count = $('[data-intro-count]', hero);
      const pics = $$('img', win), last = pics[pics.length - 1], cycle = pics.slice(0, -1);
      const MIN = 1300, MAX = 6000, STEP = 260;
      const t0 = performance.now();
      // окно — за названием: по центру по горизонтали, по высоте — на середине названия,
      // но не выше края экрана и не ниже строки со счётчиком; пропорции 4:5
      const place = () => {
        const hr = hero.getBoundingClientRect(), tr = title.getBoundingClientRect();
        const uiTop = ui.getBoundingClientRect().top - hr.top;
        const gap = Math.max(22, hr.height * .045);
        let h = Math.min(hr.height * .48, uiTop - gap * 2), w = h * .8;
        const maxW = hr.width * (hr.width <= 700 ? .62 : .3);
        if (w > maxW) { w = maxW; h = w / .8; }
        const mid = (tr.top + tr.bottom) / 2 - hr.top;
        const top = Math.min(Math.max(gap, mid - h / 2), uiTop - gap - h);
        win.style.setProperty('--wt', top.toFixed(1) + 'px');
        win.style.setProperty('--wl', ((hr.width - w) / 2).toFixed(1) + 'px');
        win.style.setProperty('--ww', w.toFixed(1) + 'px');
        win.style.setProperty('--wh', h.toFixed(1) + 'px');
      };
      place();
      addEventListener('resize', () => { if (!html.classList.contains('is-open')) place(); });
      // что ждём: шрифт названия, кадры окна, первый кадр фильма, видео (если есть)
      const later = ms => new Promise(r => setTimeout(r, ms));
      const fonts = doc.fonts && doc.fonts.load ? Promise.race([doc.fonts.load('1em Forum'), later(2500)]).catch(() => {}) : Promise.resolve();
      fonts.then(() => { fit(); place(); html.classList.add('is-fonts'); });
      const tasks = [fonts, ...pics.map(img => (img.decode ? img.decode() : Promise.resolve()).catch(() => {}))];
      if (waitFor) tasks.push(waitFor);
      let ready = 0, all = false;
      tasks.forEach(t => t.then(() => { ready++; }));
      Promise.all(tasks).then(() => { all = true; });
      let shown = 0, k = -1, swap = 0;
      const show = img => pics.forEach(p => p.classList.toggle('is-on', p === img));
      const tick = now => {
        const time = Math.min(1, Math.max(0, now - t0) / MIN);   // время кадра может быть чуть раньше t0
        if (now - t0 > MAX) all = true;
        const target = all ? time : Math.min(time, .12 + .78 * ready / tasks.length);
        shown = Math.max(shown, shown + (target - shown) * .2);   // счётчик только растёт
        if (target >= 1 && shown > .995) shown = 1;
        count.textContent = Math.round(shown * 100);
        word.style.setProperty('--p', shown.toFixed(4));
        if (shown < 1) {
          // пока грузится — кадры усадьбы по кругу (только уже загруженные)
          if (now - swap >= STEP) {
            const loaded = cycle.filter(isReady);
            if (loaded.length) { k = (k + 1) % loaded.length; show(loaded[k]); }
            swap = now;
          }
          requestAnimationFrame(tick);
          return;
        }
        // загрузилось: в окне — первый кадр фильма, пауза и раскрытие на весь экран
        show(last);
        setTimeout(() => {
          html.classList.add('is-open');
          setTimeout(() => {
            html.classList.add('is-enter');
            html.classList.remove('is-intro');
            intro.classList.add('is-gone');
            setTimeout(() => html.classList.remove('has-intro', 'is-open', 'is-fonts'), 600);
            done();
          }, 800);       // остальное начинает подниматься, когда окно почти раскрылось
        }, 200);
      };
      requestAnimationFrame(tick);
    });

    // Номер и название текущего кадра рядом со слоганом
    const frameNow = $('[data-frame-now]', hero), frameCap = $('[data-frame-cap]', hero);

    // Фильм: кадр сменяется, когда заполнилась его полоска. Кадры после первого
    // подгружаются уже после загрузки страницы, на телефоне — облегчённые вертикальные.
    const slides = $$('.film img', hero), marks = $$('.reelnav button', hero);
    const small = matchMedia('(max-width: 700px)').matches;
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    let cur = 0;
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
      if (frameNow) frameNow.textContent = String(i + 1).padStart(2, '0');
      if (frameCap) frameCap.textContent = marks[i].textContent.trim();
      cur = i;
      schedule();
    };
    // Запасной показ фотографиями — когда видео нет (экономия трафика, «меньше движения», ошибка)
    let mode = 'slides';
    const startSlides = () => {
      mode = 'slides';
      marks.forEach(m => { const bar = m.firstElementChild; if (bar) bar.style.transform = ''; });
      restartBar(marks[cur]);
      schedule();
      if (!saveData) {
        const loadRest = () => setTimeout(() => slides.forEach(loadSlide), 500);
        if (doc.readyState === 'complete') loadRest(); else addEventListener('load', loadRest);
      }
    };
    marks.forEach((m, i) => m.addEventListener('click', () => {
      if (mode === 'video') video.currentTime = i * SEG; else go(i, true);
    }));
    // вкладка ушла в фон — останавливаемся, вернулась — продолжаем с начала полоски
    doc.addEventListener('visibilitychange', () => {
      if (mode !== 'slides') return;
      if (doc.hidden) clearTimeout(timer); else { restartBar(marks[cur]); schedule(); }
    });

    // Оживлённый фильм: одно видео по кругу, в нём 4 кадра по SEG секунд (смена — на середине перехода).
    // Полоски и подпись кадра следуют за временем видео, клик по полоске перематывает к кадру.
    const video = $('.film__video', hero);
    const SEG = 4;
    let waitVideo = null, held = html.classList.contains('is-intro'), fail = () => {};
    if (video && !reduce && !saveData) {
      mode = 'video';
      const webm = video.canPlayType('video/webm; codecs="vp9"');
      video.src = small ? video.dataset.mp4M : (webm ? video.dataset.webm : video.dataset.mp4);
      video.preload = 'auto';
      let shown = -1, raf = 0;
      const tick = () => {
        const t = video.currentTime, n = marks.length;
        const i = Math.floor((t + SEG / 8) / SEG) % n;
        const p = Math.min(1, Math.max(0, (t - i * SEG + SEG / 8) / SEG));
        marks.forEach((m, k) => {
          const bar = m.firstElementChild;
          if (bar) bar.style.transform = `scaleX(${k < i ? 1 : k === i ? p : 0})`;
        });
        if (i !== shown) {
          shown = i;
          marks.forEach((m, k) => { m.classList.toggle('is-on', k === i); m.classList.toggle('is-done', k < i); });
          if (frameNow) frameNow.textContent = String(i + 1).padStart(2, '0');
          if (frameCap) frameCap.textContent = marks[i].textContent.trim();
        }
        raf = requestAnimationFrame(tick);
      };
      video.addEventListener('playing', () => {
        // идёт заставка — видео уже загрузилось, ждём её конца на первом кадре
        if (held) { video.pause(); video.currentTime = 0; return; }
        hero.classList.add('is-video');
        cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
      });
      video.addEventListener('pause', () => cancelAnimationFrame(raf));
      fail = () => { if (mode === 'video') { hero.classList.remove('is-video'); video.removeAttribute('src'); startSlides(); } };
      video.addEventListener('error', fail);
      // заставка ждёт, пока видео сможет играть (или откажет)
      waitVideo = new Promise(r => ['canplay', 'playing', 'error'].forEach(e => video.addEventListener(e, r, { once: true })));
      const p = video.play();
      if (p && p.catch) p.catch(fail);     // автозапуск запрещён (режим энергосбережения и т. п.)
    }
    runIntro(waitVideo).then(() => {
      held = false;
      if (mode !== 'video') { startSlides(); return; }
      const p = video.play();
      if (p && p.catch) p.catch(fail);
    });
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
    const days = $$('.day', reel), btns = $$('.days__nav button'), thumb = $('.days__bar i');
    // стрелки листают по одной карточке
    const step = () => (days.length > 1 ? days[1].offsetLeft - days[0].offsetLeft : reel.clientWidth);
    const move = dir => reel.scrollBy({ left: dir * step(), behavior: reduce ? 'auto' : 'smooth' });
    btns.forEach(b => b.addEventListener('click', () => move(+b.dataset.dir)));
    // на компьютере лента не прокручивается колесом и тачпадом (см. стили), поэтому с клавиатуры — стрелки
    reel.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      move(e.key === 'ArrowRight' ? 1 : -1);
    });
    // линия под лентой показывает, какая часть недели сейчас на экране
    let queued = false;
    const sync = () => {
      queued = false;
      const max = reel.scrollWidth - reel.clientWidth;
      const part = max > 0 ? reel.clientWidth / reel.scrollWidth : 1;
      const pos = max > 0 ? Math.min(1, Math.max(0, reel.scrollLeft / max)) : 0;
      if (thumb) {
        thumb.style.width = (part * 100).toFixed(2) + '%';
        thumb.style.transform = `translateX(${(pos * (1 - part) / part * 100).toFixed(2)}%)`;
      }
      btns.forEach(b => { b.disabled = +b.dataset.dir < 0 ? pos <= 0.005 : pos >= 0.995; });
    };
    reel.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(sync); } }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  /* ───────── Видео: большой кадр и список выпусков ─────────
     Обложка в кадре и строка списка включают плеер в этом же кадре. Без скрипта это обычные ссылки на YouTube. */
  $$('[data-listen]').forEach(root => {
    const stage = $('.listen__stage', root), picks = $$('[data-pick]', root);
    if (!stage) return;
    const play = (id, title) => {
      const box = doc.createElement('div');
      box.className = 'video__frame';
      const f = doc.createElement('iframe');
      // обычный адрес YouTube, а не youtube-nocookie: так плеер видит, что зритель уже вошёл в YouTube
      // в этом браузере, и реже просит «подтвердить, что вы не бот»
      f.src = `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1`;
      f.title = title || 'Видео';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.allowFullscreen = true;
      box.appendChild(f);
      // запасной путь, если плеер всё же не запустился (решает YouTube, со страницы этого не видно)
      const alt = doc.createElement('p');
      alt.className = 'listen__alt';
      const link = doc.createElement('a');
      link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Открыть на YouTube';
      alt.append('Видео не запускается? ', link);
      stage.replaceChildren(box, alt);
      picks.forEach(p => {
        const on = p.dataset.pick === id;
        p.classList.toggle('is-on', on);
        if (on) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current');
      });
      track('video_play', { video: id });
    };
    stage.addEventListener('click', e => {
      const a = e.target.closest('[data-yt]');
      if (!a) return;
      e.preventDefault();
      play(a.dataset.yt, (a.getAttribute('aria-label') || '').replace(/^Смотреть видео:\s*/, ''));
    });
    picks.forEach(p => p.addEventListener('click', e => {
      e.preventDefault();
      const b = $('b', p);
      play(p.dataset.pick, b ? b.textContent : '');
      // на телефоне кадр стоит над списком — возвращаем его в поле зрения
      const r = stage.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) stage.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }));
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
