
(() => {
  if (window.__audioCorrectInstalled) {
    console.log('%c[AUDIO-CORRECT] already installed', 'color:#ffb45c;font-weight:bold');
    return;
  }
  window.__audioCorrectInstalled = true;

  const TAG = '%c[AUDIO-CORRECT]';
  const STYLE = 'color:#4ade80;font-weight:bold';

  // ------------------------------------------------------------
  // 1. Rewrite any `isCorrect: false` inside a JSON string
  // ------------------------------------------------------------
  function rewriteJSONText(text) {
    if (typeof text !== 'string') return null;
    if (text.indexOf('isCorrect') === -1) return null;

    let data;
    try { data = JSON.parse(text); } catch { return null; }

    let changed = false;
    const seen = new Set();

    (function walk(node) {
      if (!node || typeof node !== 'object' || seen.has(node)) return;
      seen.add(node);
      if ('isCorrect' in node && node.isCorrect === false) {
        node.isCorrect = true;
        changed = true;
      }
      for (const k of Object.keys(node)) {
        try { walk(node[k]); } catch { /* skip */ }
      }
    })(data);

    return changed ? JSON.stringify(data) : null;
  }

  // ------------------------------------------------------------
  // 2. XHR hook
  // ------------------------------------------------------------
  (function patchXHR() {
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function (method, url) {
      this.__ac_url = String(url || '');
      return open.apply(this, arguments);
    };

    XHR.send = function () {
      this.addEventListener('load', function () {
        try {
          const url = this.__ac_url || '';
          if (!/evaluateAudio|recognition|homophone|speak|audio|pronunc/i.test(url)) return;

          let raw = null;
          try { raw = this.responseText; } catch { /* might throw for non-text */ }

          // Fallback for responseType === 'json'
          if (!raw && this.responseType === 'json' && this.response) {
            try { raw = JSON.stringify(this.response); } catch { /* skip */ }
          }

          if (!raw) return;
          const patched = rewriteJSONText(raw);
          if (!patched) return;

          console.log(TAG, STYLE, '✎ XHR response rewritten:', url.split('?')[0]);

          Object.defineProperty(this, 'responseText', { configurable: true, get: () => patched });
          if (this.responseType === 'json') {
            Object.defineProperty(this, 'response', { configurable: true, get: () => JSON.parse(patched) });
          } else {
            Object.defineProperty(this, 'response', { configurable: true, get: () => patched });
          }
        } catch (e) { console.warn(TAG, 'XHR patch err', e); }
      });
      return send.apply(this, arguments);
    };
  })();

  // ------------------------------------------------------------
  // 3. fetch hook
  // ------------------------------------------------------------
  (function patchFetch() {
    const orig = window.fetch;
    if (!orig) return;

    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const res = await orig.apply(this, arguments);

      if (!/evaluateAudio|recognition|homophone|speak|audio|pronunc/i.test(url)) return res;

      let raw;
      try { raw = await res.clone().text(); } catch { return res; }

      const patched = rewriteJSONText(raw);
      if (!patched) return res;

      console.log(TAG, STYLE, '✎ fetch response rewritten:', url.split('?')[0]);
      return new Response(patched, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers
      });
    };
  })();

  // ------------------------------------------------------------
  // 4. Scan window globals every 500ms for a result object
  //    with `finalResult.isCorrect === false` and flip it.
  // ------------------------------------------------------------
  function scanGlobals() {
    for (const k of Object.keys(window)) {
      try {
        const v = window[k];
        if (!v || typeof v !== 'object') continue;

        if (v.finalResult && typeof v.finalResult === 'object' && v.finalResult.isCorrect === false) {
          v.finalResult.isCorrect = true;
          console.log(TAG, STYLE, '✎ in-memory patched: window.' + k + '.finalResult.isCorrect');
        }
        if (v.serverAudioResult && v.serverAudioResult.isCorrect === false) {
          v.serverAudioResult.isCorrect = true;
          console.log(TAG, STYLE, '✎ in-memory patched: window.' + k + '.serverAudioResult.isCorrect');
        }
      } catch { /* cross-origin, skip */ }
    }
  }
  setInterval(scanGlobals, 500);

  // ------------------------------------------------------------
  // 5. Console.log interceptor — mutate result objects at the
  //    moment they're logged, before the game reads them.
  // ------------------------------------------------------------
  (function patchConsole() {
    const origLog = console.log;
    const origWarn = console.warn;
    const origInfo = console.info;

    function mutate(args) {
      for (const a of args) {
        try {
          if (!a || typeof a !== 'object') continue;
          if (a.finalResult && typeof a.finalResult === 'object' && a.finalResult.isCorrect === false) {
            a.finalResult.isCorrect = true;
          }
          if ('isCorrect' in a && a.isCorrect === false) {
            a.isCorrect = true;
          }
          if (a.serverAudioResult && typeof a.serverAudioResult === 'object' && a.serverAudioResult.isCorrect === false) {
            a.serverAudioResult.isCorrect = true;
          }
        } catch { /* skip */ }
      }
    }

    console.log  = function (...a) { mutate(a); return origLog.apply(console, a); };
    console.warn = function (...a) { mutate(a); return origWarn.apply(console, a); };
    console.info = function (...a) { mutate(a); return origInfo.apply(console, a); };
  })();

  console.log(TAG, STYLE, '✓ Ready. Speak — any isCorrect:false will be flipped to true.');
  console.log(TAG, STYLE, '  To uninstall: reload the page.');
})();
