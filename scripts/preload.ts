(() => {
  type UIState = { textCount: number; logoCount: number; updRemoved: number; ghRemoved: number };
  const LOGO_PATH = 'welcome_logo.png';
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

              function updateLogos(root: Document | ShadowRoot = document) {
    let updated = 0;
    try {
      // 1) 修改：只有当 .logo 是 <img> 时，才设置 src
      const imgs: HTMLImageElement[] = Array.from((root as any).querySelectorAll('img[class*="logo" i]')) as any;
      for (const img of imgs) {
        try {
          const cur = img.getAttribute('src') || '';
          if (cur !== LOGO_PATH) {
            img.setAttribute('src', LOGO_PATH);
            if (img.hasAttribute('srcset')) img.setAttribute('srcset', '');
            updated++;
          }
        } catch {}
      }
      // 2) 删除：所有 class 含 logo 但不是 <img> 的元素
      const nonImgs: Element[] = Array.from((root as any).querySelectorAll('[class="logoBox c"]')) as any;
      for (const el of nonImgs) {
        try { const p = el.parentNode; if (p) p.removeChild(el); } catch {}
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
  
  function fixTitle() {
    try {
      const apply = () => { try { if (document && typeof document.title === 'string') { document.title = String(document.title).replace(RE_TOONFLOW, 'JulongAI'); } } catch {} };
      apply();
      const t = document.querySelector('title');
      if (t) new MutationObserver(apply).observe(t, { characterData: true, childList: true, subtree: true });
    } catch {}
  }
  function startObserver() {
    try {
      const obs = new MutationObserver(() => {

        clearTimeout((globalThis as any).__preloadTimer);
        (globalThis as any).__preloadTimer = setTimeout(() => { const st = applyAll(); try { const q = new URL("toonflow://uistate"); q.searchParams.set("text", String(st.textCount||0)); q.searchParams.set("logos", String(st.logoCount||0)); q.searchParams.set("rmUpdate", String(st.updRemoved||0)); q.searchParams.set("rmGithub", String(st.ghRemoved||0)); fetch(q.toString()); } catch {} }, 80);
      });
      obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const st = applyAll();
      notifyState(st);
      fixTitle(); notifyReady();
      startObserver();
    }, { once: true });
  } else {
    const st = applyAll();
    notifyState(st);
    fixTitle(); notifyReady();
    startObserver();
  }
})();













