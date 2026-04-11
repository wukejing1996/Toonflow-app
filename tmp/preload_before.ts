(() => {
  type UIState = { textCount: number; logoCount: number; updRemoved: number; ghRemoved: number };
  const LOGO_URL = new URL('welcome_logo.png', document.baseURI).toString();
  const RE_TOONFLOW = /toonflow/gi;

  function replaceTextIn(node: Node) {
    let count = 0;
    try {
      const tw = document.createTreeWalker(
        node,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(n) {
            const p = n.parentNode;
            if (!p || p.nodeType !== 1) return NodeFilter.FILTER_REJECT;
            const tag = p.nodeName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
            const txt = n.nodeValue || '';
            return RE_TOONFLOW.test(txt) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
        }
      );
      const buf = [];
      let cur;
      while ((cur = tw.nextNode())) buf.push(cur);
      for (const t of buf) {
        const old = t.nodeValue || '';
        const newer = old.replace(RE_TOONFLOW, 'JulongAI');
        if (newer !== old) count++;
        t.nodeValue = newer;
      }
    } catch {}
    return count;
  }

  function updateLogos(root = document) {
    let updated = 0;
    try {
      const all = root.querySelectorAll('[class][src]');
      for (const el of all) {
        const cls = String(el.getAttribute('class') || '').split(/\s+/);
        if (cls.some(c => /logo/i.test(c))) {
          const cur = el.getAttribute('src') || '';
          if (cur !== LOGO_URL) { el.setAttribute('src', LOGO_URL); updated++; }
        }
      }
    } catch {}
    return updated;
  }

  function removeUpdateMenu(root = document) {
    let removed = 0;
    try {
      const items = root.querySelectorAll('.t-menu__content');
      for (const el of items) {
        const text = (el.textContent || '').trim();
        if (text === '检查更新') {
          const li = el.closest('li');
          if (li && li.parentNode) { li.parentNode.removeChild(li); removed++; }
        }
      }
    } catch {}
    return removed;
  }

  function removeGithubBlock(root = document) {
    let removed = 0;
    try {
      const icons = root.querySelectorAll('.i-icon.i-icon-github-one');
      for (const icon of icons) {
        const container = icon.closest('div.item.c');
        if (container && container.parentNode) { container.parentNode.removeChild(container); removed++; }
      }
    } catch {}
    return removed;
  }

  function applyAll(target = document) {
    const scope = target === document ? document.body : target;
    const textCount = scope ? replaceTextIn(scope) : 0;
    const logoCount = updateLogos(target);
    const updRemoved = removeUpdateMenu(target);
    const ghRemoved = removeGithubBlock(target);
    return { textCount, logoCount, updRemoved, ghRemoved };
  }

  function notifyState(st: UIState) {
    try {
      const q = new URL('toonflow://uistate');
      q.searchParams.set('text', String(st.textCount||0));
      q.searchParams.set('logos', String(st.logoCount||0));
      q.searchParams.set('rmUpdate', String(st.updRemoved||0));
      q.searchParams.set('rmGithub', String(st.ghRemoved||0));
      fetch(q.toString());
    } catch {}
  }

  function notifyReady() {
    try { fetch('toonflow://uiready'); } catch {}
  }

  function startObserver() {
    try {
      const obs = new MutationObserver(() => {

        clearTimeout((globalThis as any).__preloadTimer);
        (globalThis as any).__preloadTimer = setTimeout(() => applyAll(), 50);
      });
      obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const st = applyAll();
      notifyState(st);
      notifyReady();
      startObserver();
    }, { once: true });
  } else {
    const st = applyAll();
    notifyState(st);
    notifyReady();
    startObserver();
  }
})();


