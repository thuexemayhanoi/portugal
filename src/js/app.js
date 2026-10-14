// Site behaviour: theme toggle, desktop dropdowns, mobile drawer, lazy search and TOC highlight.
// No dependencies. The search module and its index are only downloaded when search is opened.
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  var SEARCH_SRC = '__SEARCH_SRC__';

  /* ---------- Theme ---------- */
  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('pt-theme', next);
    } catch (e) {}
  }

  /* ---------- Desktop dropdowns ---------- */
  var openItem = null;
  function closePanel(returnFocus) {
    if (!openItem) return;
    var trigger = openItem.querySelector('.nav-trigger');
    openItem.classList.remove('is-open');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) trigger.focus();
    }
    openItem = null;
  }
  function togglePanel(item) {
    if (openItem === item) return closePanel(false);
    closePanel(false);
    item.classList.add('is-open');
    item.querySelector('.nav-trigger').setAttribute('aria-expanded', 'true');
    openItem = item;
  }

  /* ---------- Mobile drawer ---------- */
  var drawer = doc.querySelector('[data-drawer]');
  var menuButton = doc.querySelector('[data-menu-open]');
  function focusables(container) {
    return Array.prototype.slice.call(
      container.querySelectorAll('a[href], button:not([disabled]), summary, input, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) {
      return el.offsetParent !== null;
    });
  }
  function openDrawer() {
    if (!drawer) return;
    drawer.hidden = false;
    doc.body.classList.add('is-locked');
    if (menuButton) menuButton.setAttribute('aria-expanded', 'true');
    var items = focusables(drawer);
    if (items.length) items[0].focus();
  }
  function closeDrawer(returnFocus) {
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    doc.body.classList.remove('is-locked');
    if (menuButton) {
      menuButton.setAttribute('aria-expanded', 'false');
      if (returnFocus) menuButton.focus();
    }
  }

  /* ---------- Search (lazy) ---------- */
  var searchModule = null;
  function openSearch() {
    closeDrawer(false);
    closePanel(false);
    if (searchModule) return searchModule.open();
    import(SEARCH_SRC)
      .then(function (mod) {
        searchModule = mod;
        mod.open();
      })
      .catch(function () {
        window.location.href = '/perguntas-frequentes/';
      });
  }

  /* ---------- Local assistant (lazy) ----------
     The engine (owner data, /web engine, pt-PT adapter) is never executed at page load: the files
     are prefetched at idle priority by <link rel="prefetch" data-assistant-src> and injected, in
     document order, on the first hover/press/focus of the button or when the panel opens. */
  var chatFab = doc.getElementById('chat-fab');
  var chatPanel = doc.getElementById('chat-panel');
  var chatForm = chatPanel ? chatPanel.querySelector('.chat-input') : null;
  var assistantState = 0; // 0 idle · 1 loading · 2 ready
  var pendingSubmit = false;
  function assistantReady() {
    assistantState = 2;
    if (chatPanel && !chatPanel.hidden) {
      try {
        chatPanel.dispatchEvent(new CustomEvent('chat:open')); // greeting + lazy search index
      } catch (e) {}
    }
    if (pendingSubmit && chatForm && chatForm.requestSubmit) chatForm.requestSubmit();
    pendingSubmit = false;
  }
  function loadAssistant() {
    if (assistantState) return;
    var sources = Array.prototype.map.call(doc.querySelectorAll('link[data-assistant-src]'), function (link) {
      return link.getAttribute('href');
    });
    if (!sources.length) return;
    assistantState = 1;
    (function next(i) {
      if (i >= sources.length) return assistantReady();
      var script = doc.createElement('script');
      script.src = sources[i];
      script.onload = function () {
        next(i + 1);
      };
      script.onerror = function () {
        assistantState = 0; // the next interaction tries again
      };
      doc.head.appendChild(script);
    })(0);
  }
  if (chatFab && chatPanel) {
    ['pointerenter', 'pointerdown', 'touchstart', 'focus', 'keydown'].forEach(function (type) {
      chatFab.addEventListener(type, loadAssistant, { passive: true });
    });
    chatPanel.addEventListener('chat:open', loadAssistant);
    if (chatForm) {
      // A message sent before the engine has arrived waits for it instead of reloading the page.
      chatForm.addEventListener(
        'submit',
        function (event) {
          if (assistantState === 2) return;
          event.preventDefault();
          pendingSubmit = true;
          loadAssistant();
        },
        true
      );
    }
  }

  /* ---------- Events ---------- */
  doc.addEventListener('click', function (event) {
    var target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-theme-toggle]')) return toggleTheme();
    if (target.closest('[data-search-open]')) {
      event.preventDefault();
      return openSearch();
    }
    if (target.closest('[data-menu-open]')) return openDrawer();
    if (target.closest('[data-menu-close]')) return closeDrawer(true);
    var trigger = target.closest('.nav-trigger');
    if (trigger) return togglePanel(trigger.parentElement);
    if (openItem && !target.closest('.nav-item.is-open')) closePanel(false);
  });

  doc.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (drawer && !drawer.hidden) return closeDrawer(true);
      if (openItem) return closePanel(true);
    }
    if (event.key === 'Tab' && drawer && !drawer.hidden) {
      var items = focusables(drawer);
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((doc.activeElement || {}).tagName || '');
    if (!typing && (event.key === '/' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'))) {
      event.preventDefault();
      openSearch();
    }
  });

  // Close the mobile drawer if the viewport grows to desktop size.
  if (window.matchMedia) {
    var desktop = window.matchMedia('(min-width: 1100px)');
    var onChange = function (e) {
      if (e.matches) closeDrawer(false);
    };
    if (desktop.addEventListener) desktop.addEventListener('change', onChange);
  }

  /* ---------- TOC: highlight the section being read ---------- */
  var toc = doc.querySelector('[data-toc]');
  if (toc && 'IntersectionObserver' in window) {
    var links = {};
    Array.prototype.forEach.call(toc.querySelectorAll('a[href^="#"]'), function (a) {
      links[decodeURIComponent(a.getAttribute('href').slice(1))] = a;
    });
    var current = null;
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var link = links[entry.target.id];
          if (!link) return;
          if (current) current.classList.remove('is-current');
          link.classList.add('is-current');
          current = link;
        });
      },
      { rootMargin: '-15% 0px -70% 0px' }
    );
    Object.keys(links).forEach(function (id) {
      var el = doc.getElementById(id);
      if (el) observer.observe(el);
    });
  }
})();
