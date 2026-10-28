// ==UserScript==
// @name         Krillion Helper
// @namespace    https://krillion.io/
// @homepageURL  https://github.com/YourAverageCow/krillion-helper
// @supportURL   https://github.com/YourAverageCow/krillion-helper/issues
// @version      5.3
// @description  Streams obscure answers for the prompt on screen from the AI of your choice (DeepSeek, OpenAI, Claude, Gemini, Groq, OpenRouter, Mistral, xAI, or a local model), learns real tiers from your results, and saves everything locally.
// @match        https://krillion.io/*
// @downloadURL  https://raw.githubusercontent.com/YourAverageCow/krillion-helper/main/krillion-helper.user.js
// @updateURL    https://raw.githubusercontent.com/YourAverageCow/krillion-helper/main/krillion-helper.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      api.deepseek.com
// @connect      api.openai.com
// @connect      api.anthropic.com
// @connect      generativelanguage.googleapis.com
// @connect      api.groq.com
// @connect      openrouter.ai
// @connect      api.mistral.ai
// @connect      api.x.ai
// @connect      localhost
// @connect      127.0.0.1
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ---------- Game tiers (from the game's own tier table) ----------
  const TIERS = {
    plankton: { name: 'PLANKTON', score: 10 },
    tooclever: { name: 'TOO CLEVER 🤡', score: 15 }, // a famous "obscure" pick everyone reaches for
    schooler: { name: 'SCHOOLER', score: 30 },
    rare: { name: 'RARE', score: 60 },
    deepcut: { name: 'DEEP CUT', score: 85 },
    krillion: { name: 'KRILLION 🌟', score: 100 },
  };
  const STAR_SCORE = [0, 10, 30, 60, 85, 100]; // the AI's 1–5 guess mapped onto the same scale

  // ---------- AI providers ----------
  // Everything except Claude speaks the OpenAI-style /chat/completions API.
  // Model lists are just suggestions — type any model name, or press "list models".
  const PROVIDERS = {
    deepseek: { label: 'DeepSeek', kind: 'openai', base: 'https://api.deepseek.com', model: 'deepseek-chat',
      models: ['deepseek-chat', 'deepseek-reasoner'], keyUrl: 'https://platform.deepseek.com/api_keys' },
    openai: { label: 'OpenAI', kind: 'openai', base: 'https://api.openai.com/v1', model: 'gpt-4.1-mini',
      models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o'], keyUrl: 'https://platform.openai.com/api-keys' },
    anthropic: { label: 'Claude (Anthropic)', kind: 'anthropic', base: 'https://api.anthropic.com', model: 'claude-opus-5-5',
      models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'], keyUrl: 'https://platform.claude.com/settings/keys' },
    gemini: { label: 'Google Gemini', kind: 'openai', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash',
      models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'], keyUrl: 'https://aistudio.google.com/apikey' },
    groq: { label: 'Groq (very fast)', kind: 'openai', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'], keyUrl: 'https://console.groq.com/keys' },
    openrouter: { label: 'OpenRouter (many models)', kind: 'openai', base: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-chat',
      models: ['deepseek/deepseek-chat', 'anthropic/claude-sonnet-5-5', 'google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct'],
      keyUrl: 'https://openrouter.ai/keys' },
    mistral: { label: 'Mistral', kind: 'openai', base: 'https://api.mistral.ai/v1', model: 'mistral-large-latest',
      models: ['mistral-large-latest', 'mistral-small-latest'], keyUrl: 'https://console.mistral.ai/api-keys' },
    xai: { label: 'xAI Grok', kind: 'openai', base: 'https://api.x.ai/v1', model: 'grok-3-mini',
      models: ['grok-3-mini', 'grok-3'], keyUrl: 'https://console.x.ai' },
    ollama: { label: 'Ollama (local)', kind: 'openai', base: 'http://localhost:11434/v1', model: 'llama3.1:8b', local: true,
      models: ['llama3.1:8b', 'qwen2.5:14b', 'gemma2:9b', 'mistral-nemo'] },
    lmstudio: { label: 'LM Studio (local)', kind: 'openai', base: 'http://localhost:1234/v1', model: '', local: true, models: [] },
    custom: { label: 'Custom (OpenAI-compatible URL)', kind: 'openai', base: '', model: '', local: true, models: [] },
  };

  // ---------- Settings ----------
  const DEFAULTS = {
    provider: 'deepseek',
    models: {},           // per-provider model override
    baseUrls: {},         // per-provider base URL override (local / custom)
    count: 10,            // answers per request
    depth: 'balanced',    // safe | balanced | deep — how obscure to aim
    temperature: 0.7,
    sendTemperature: true, // some models reject it; the script also retries without it automatically
    effort: 'low',        // Claude only: low is fastest
    timeoutSec: 45,
    extraInstructions: '', // appended to the AI instructions
    autoAsk: true,        // ask automatically when a new prompt appears
    autoSubmit: false,    // choosing a suggestion also presses Enter
    hideSaid: true,       // hide (instead of strike through) answers already said in Puffer Party
    hideMisses: true,     // hide answers the game rejected before
    minStars: 1,          // only show answers at least this rare
    verify: true,         // second AI pass that drops answers that don't fit the prompt
    refillBelow: 3,       // fetch more automatically when fewer unused suggestions than this remain (0 = off)
    autoAnswer: false,    // solo modes only: submit the best answer on a timer
    autoDelay: 3,         // seconds to wait once a round opens
    autoJitter: 1.5,      // extra random 0–N seconds
    autoRetry: 1.5,       // seconds between attempts after a rejected answer
    corner: 'br',         // br | bl | tr | tl
    pos: null,            // {left, top} once dragged
    width: 310,
    fontSize: 15,
    opacity: 0.93,
    showHints: true,
  };
  const loaded = GM_getValue('settings', {});
  const settings = Object.assign({}, DEFAULTS, loaded);
  // carry over v1–v4 settings
  if (loaded.model && !settings.models.deepseek) settings.models.deepseek = loaded.model;
  delete settings.model;
  const saveSettings = () => GM_setValue('settings', settings);

  const keys = GM_getValue('keys', {});
  const oldKey = GM_getValue('deepseekKey', '');
  if (oldKey && !keys.deepseek) { keys.deepseek = oldKey; GM_setValue('keys', keys); }

  const prov = () => PROVIDERS[settings.provider] || PROVIDERS.deepseek;
  const provModel = () => settings.models[settings.provider] || prov().model;
  const provBase = () => (settings.baseUrls[settings.provider] || prov().base).replace(/\/+$/, '');
  const provKey = () => keys[settings.provider] || '';

  // ---------- Saved answers (persist across sessions) ----------
  // { normalisedPrompt: { prompt, at, answers: [{answer, rarity, tier?, miss?, canonical?, mine?, doubt?, checked?}] } }
  let store = GM_getValue('answers', {});
  const norm = (s) => String(s).toLowerCase().replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  const saveStore = () => GM_setValue('answers', store);
  const entryFor = (prompt) => (store[norm(prompt)] ||= { prompt, at: Date.now(), answers: [] });
  const findAnswer = (entry, text) => {
    const n = norm(text);
    return entry.answers.find((a) => norm(a.answer) === n || (a.canonical && norm(a.canonical) === n));
  };

  // ---------- State ----------
  let lastPrompt = null;
  let pending = false;
  let verifying = false;
  let lastSubmitted = null;   // what was in the game's input when Enter was pressed
  let visible = [];           // answers currently shown, in order (for shortcuts)
  let cursor = -1;            // Tab-cycling position
  let lastLatency = null;     // seconds until the first suggestion arrived
  const partySaid = new Set(); // normalised answers accepted in the current party category
  const handled = new WeakSet();
  const refills = new Map();  // prompt → automatic refills this page load

  // ---------- API key ----------
  const keyAsked = new Set(); // only pop up the key box once per provider per page load
  function getKey(forcePrompt) {
    let key = provKey();
    if (forcePrompt || (!key && !prov().local && !keyAsked.has(settings.provider))) {
      keyAsked.add(settings.provider);
      const hint = prov().keyUrl ? `\n(get one at ${prov().keyUrl})` : '\n(leave blank if your server needs none)';
      const input = prompt(`${prov().label} API key — stored only in your userscript manager:${hint}`, key);
      if (input === null) return key;
      key = input.trim();
      keys[settings.provider] = key;
      GM_setValue('keys', keys);
    }
    return key;
  }
  GM_registerMenuCommand('Set API key for current provider', () => getKey(true));
  GM_registerMenuCommand('Show / hide helper panel', () => panel.classList.toggle('hidden'));

  // ---------- LLM request layer ----------
  const errText = (raw) => {
    try {
      const j = JSON.parse(raw);
      const e = Array.isArray(j) ? j[0]?.error : j.error;
      return (e && (e.message || e)) || j.message || '';
    } catch (e) { return String(raw || '').slice(0, 160); }
  };
  const supportsFallbacks = (m) => /^claude-(opus-5|fable-5-1|sonnet-5-5)/.test(m);

  // Calls the chosen provider. onDelta(text) gets streamed text; onDone(err, fullText) at the end.
  function llmRequest({ system, user, stream, temperature, onDelta, onDone, retried }) {
    const p = prov();
    const model = provModel();
    const key = provKey();
    if (!model) return onDone('Set a model name in ⚙ (or press "list models").');
    let url, headers = { 'Content-Type': 'application/json' }, body;

    if (p.kind === 'anthropic') {
      url = provBase() + '/v1/messages';
      headers['x-api-key'] = key;
      headers['anthropic-version'] = '2026-10-21';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      body = { model, max_tokens: 16000, system, stream, messages: [{ role: 'user', content: user }] };
      if (/^claude-(opus|sonnet|haiku|fable)-5/.test(model)) body.output_config = { effort: settings.effort };
      if (supportsFallbacks(model)) { // re-run a declined request on Anthropic's recommended fallback model
        headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
        body.fallbacks = 'default';
      }
    } else {
      url = provBase() + '/chat/completions';
      if (key) headers.Authorization = 'Bearer ' + key;
      if (settings.provider === 'openrouter') { headers['HTTP-Referer'] = 'https://krillion.io'; headers['X-Title'] = 'Krillion Helper'; }
      body = { model, stream, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
      const noTemp = /reasoner|^o\d|gpt-5/.test(model);
      if (temperature != null && settings.sendTemperature && !noTemp && !retried) body.temperature = temperature;
    }

    let full = '', refusal = false, streamErr = '';
    const handleEvent = (j) => {
      if (j.error) { streamErr = j.error.message || String(j.error); return; }
      let t = '';
      if (p.kind === 'anthropic') {
        if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') t = j.delta.text;
        if (j.type === 'message_delta' && j.delta && j.delta.stop_reason === 'refusal') refusal = true;
      } else {
        t = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
      }
      if (t) { full += t; onDelta && onDelta(t); }
    };

    let seen = 0, buf = '', streamed = false, finished = false;
    const feed = (raw) => {
      if (!raw || raw.length <= seen) return;
      buf += raw.slice(seen);
      seen = raw.length;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const d = line.slice(5).trim();
        if (!d || d === '[DONE]') continue;
        try { handleEvent(JSON.parse(d)); } catch (e) { /* partial or keep-alive line */ }
      }
    };

    const finish = (status, raw) => {
      if (finished) return;
      finished = true;
      if (status && status !== 200) {
        // some models reject temperature: retry once without it
        if (status === 400 && !retried && body.temperature != null) {
          return llmRequest({ system, user, stream, temperature, onDelta, onDone, retried: true });
        }
        const why = errText(raw);
        const hints = { 401: 'API key rejected', 402: 'out of credit', 403: p.local ? 'blocked by the local server (see Ollama tip in ⚙)' : 'access denied', 404: 'model or URL not found', 429: 'rate limited — slow down or check your plan' };
        return onDone(`${p.label}: ${hints[status] || 'error ' + status}${why ? ' — ' + why : ''}`);
      }
      if (stream) {
        feed((raw || '') + '\n');
        // a provider that can't stream (or errors early) replies with plain JSON instead of events
        if (!full && !streamErr && /^\s*[[{]/.test(raw || '')) {
          const why = errText(raw);
          if (why) return onDone(`${p.label}: ${why}`);
        }
      } else {
        try {
          const j = JSON.parse(raw);
          if (p.kind === 'anthropic') {
            if (j.stop_reason === 'refusal') refusal = true;
            full = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
          } else full = j.choices[0].message.content || '';
        } catch (e) { return onDone(`${p.label}: couldn't read the reply.`); }
      }
      if (streamErr) return onDone(`${p.label}: ${streamErr}`);
      if (refusal && !full) return onDone(`${p.label} declined this prompt.`);
      onDone(null, full);
    };

    GM_xmlhttpRequest({
      method: 'POST',
      url,
      headers,
      data: JSON.stringify(body),
      responseType: stream ? 'stream' : undefined, // Tampermonkey streams; other managers fall back to onprogress/onload
      timeout: settings.timeoutSec * 1000 * (/reasoner|pro|opus|fable/.test(model) ? 2 : 1),
      async onloadstart(res) {
        if (!stream) return;
        const s = res.response;
        if (!s || typeof s.getReader !== 'function') return;
        streamed = true;
        const reader = s.getReader();
        const dec = new TextDecoder();
        let raw = '';
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            raw += dec.decode(value, { stream: true });
            if (!res.status || res.status === 200) feed(raw);
          }
        } catch (e) { /* connection dropped */ }
        finish(res.status, raw);
      },
      onprogress(res) { if (stream && !streamed && typeof res.responseText === 'string') feed(res.responseText); },
      onload(res) { if (!streamed) finish(res.status, typeof res.responseText === 'string' ? res.responseText : ''); },
      onerror() {
        if (finished) return;
        finished = true;
        onDone(p.local ? `Can't reach ${provBase()} — is the local server running?` : `Network error reaching ${p.label}.`);
      },
      ontimeout() { if (!finished) { finished = true; onDone(`${p.label} timed out — try again or raise the timeout in ⚙.`); } },
    });
  }

  function listModels(cb) {
    const p = prov();
    const headers = {};
    const key = provKey();
    let url;
    if (p.kind === 'anthropic') {
      url = provBase() + '/v1/models';
      headers['x-api-key'] = key;
      headers['anthropic-version'] = '2026-10-21';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    } else {
      url = provBase() + '/models';
      if (key) headers.Authorization = 'Bearer ' + key;
    }
    GM_xmlhttpRequest({
      method: 'GET', url, headers, timeout: 15000,
      onload(res) {
        if (res.status !== 200) return cb(`couldn't list models (${res.status}) ${errText(res.responseText)}`);
        try {
          const j = JSON.parse(res.responseText);
          const ids = (j.data || j.models || []).map((m) => (m.id || m.name || '').replace(/^models\//, '')).filter(Boolean);
          cb(null, ids.sort());
        } catch (e) { cb("couldn't read the model list"); }
      },
      onerror() { cb(p.local ? `can't reach ${provBase()} — is it running?` : 'network error'); },
      ontimeout() { cb('timed out'); },
    });
  }

  // ---------- Panel ----------
  const style = document.createElement('style');
  style.textContent = `
    #kr-helper{position:fixed;z-index:99999;max-height:70vh;display:flex;flex-direction:column;
      background:rgba(11,20,40,var(--kr-op,.93));color:#e8eef5;border:1px solid #4de3ff;border-radius:8px;
      font-family:var(--font-vt323, ui-monospace, monospace);line-height:1.3;box-shadow:0 4px 18px #0008}
    #kr-helper.hidden{display:none}
    #kr-helper header{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;
      background:#4de3ff22;cursor:move;user-select:none}
    #kr-helper .body{padding:8px 10px;overflow:auto}
    #kr-helper.collapsed .body,#kr-helper.collapsed .settings{display:none}
    #kr-helper .q{opacity:.8;margin-bottom:2px}
    #kr-helper .meta{opacity:.55;font-size:.87em;margin-bottom:6px}
    #kr-helper .chip{display:flex;align-items:center;gap:8px;width:100%;margin:3px 0;padding:4px 8px;
      background:#13204a;color:inherit;border:1px solid #2a3c7a;border-radius:5px;font:inherit;text-align:left;cursor:pointer}
    #kr-helper .chip:hover,#kr-helper .chip.cur{border-color:#ffd166;background:#1d2d63}
    #kr-helper .chip.said,#kr-helper .chip.miss{opacity:.4;text-decoration:line-through}
    #kr-helper .n{opacity:.45;width:1em}
    #kr-helper .w{flex:1}
    #kr-helper .r{color:#ffd166;white-space:nowrap;font-size:.87em}
    #kr-helper .r.real{color:var(--tc,#ffd166);font-weight:bold}
    #kr-helper .err{color:#ff6b6b}
    #kr-helper .auto{color:#7dffb0;font-size:.93em;margin-bottom:4px}
    #kr-helper .auto:empty{display:none}
    #kr-helper .said-list,#kr-helper .keys{margin-top:8px;font-size:.87em;opacity:.6}
    #kr-helper.no-hints .keys{display:none}
    #kr-helper .btn{background:none;border:none;color:#4de3ff;font:inherit;cursor:pointer;padding:0 3px}
    #kr-helper .more{width:100%;margin-top:6px;padding:4px;background:#4de3ff22;color:#4de3ff;border:1px dashed #4de3ff;
      border-radius:5px;font:inherit;cursor:pointer}
    #kr-helper .settings{display:none;padding:8px 10px;border-top:1px solid #2a3c7a;font-size:.93em;overflow:auto}
    #kr-helper.show-settings .settings{display:block}
    #kr-helper.show-settings .body{max-height:30vh}
    #kr-helper .settings h4{margin:10px 0 4px;color:#4de3ff;font-weight:normal;letter-spacing:.05em}
    #kr-helper .settings label{display:flex;justify-content:space-between;align-items:center;margin:4px 0;gap:8px}
    #kr-helper .settings input[type=number],#kr-helper .settings input[type=text],#kr-helper .settings select{width:140px;
      background:#13204a;color:inherit;border:1px solid #2a3c7a;border-radius:4px;font:inherit}
    #kr-helper .settings textarea{width:100%;box-sizing:border-box;min-height:48px;background:#13204a;color:inherit;
      border:1px solid #2a3c7a;border-radius:4px;font:inherit}
    #kr-helper .settings .row{display:flex;gap:6px;margin-top:6px}
    #kr-helper .settings .row button{flex:1;background:#13204a;color:inherit;border:1px solid #2a3c7a;border-radius:4px;font:inherit;cursor:pointer}
    #kr-helper .tip{font-size:.85em;opacity:.6;margin:2px 0 6px}
  `;
  document.head.appendChild(style);

  const providerOptions = Object.entries(PROVIDERS).map(([id, p]) => `<option value="${id}">${p.label}</option>`).join('');
  const panel = document.createElement('div');
  panel.id = 'kr-helper';
  panel.innerHTML = `
    <header><span>🦐 krillion helper</span><span>
      <button class="btn" data-a="ask" title="ask / show answers (Alt+A)">▶</button>
      <button class="btn" data-a="settings" title="settings">⚙</button>
      <button class="btn" data-a="toggle" title="collapse">–</button></span></header>
    <div class="body">
      <div class="q">waiting for a prompt…</div><div class="meta"></div><div class="auto"></div>
      <div class="list"></div>
      <button class="more" style="display:none">↻ get new answers (Alt+R)</button>
      <div class="said-list"></div>
      <div class="keys">Tab / Shift+Tab: cycle · Alt+1–9: pick · Alt+R: more · Alt+H: hide</div>
    </div>
    <div class="settings">
      <h4>AI</h4>
      <label>provider <select data-s="provider">${providerOptions}</select></label>
      <label>model <input type="text" list="kr-models" data-p="model" spellcheck="false"></label>
      <datalist id="kr-models"></datalist>
      <label class="base-row">server URL <input type="text" data-p="base" spellcheck="false"></label>
      <div class="tip prov-tip"></div>
      <div class="row"><button data-a="key">API key</button><button data-a="models">list models</button><button data-a="test">test</button></div>
      <label class="effort-row">thinking effort <select data-s="effort">
        <option value="low">low (fastest)</option><option value="medium">medium</option><option value="high">high</option></select></label>
      <label>creativity <input type="number" min="0" max="1.5" step="0.1" data-s="temperature"></label>
      <label>send creativity setting <input type="checkbox" data-s="sendTemperature"></label>
      <label>timeout (s) <input type="number" min="10" max="300" data-s="timeoutSec"></label>

      <h4>ANSWERS</h4>
      <label>answers per request <input type="number" min="3" max="30" data-s="count"></label>
      <label>depth <select data-s="depth">
        <option value="safe">safe (more hits)</option>
        <option value="balanced">balanced</option>
        <option value="deep">deep (riskier)</option></select></label>
      <label>min rarity ★ <input type="number" min="1" max="5" data-s="minStars"></label>
      <label>double-check answers <input type="checkbox" data-s="verify"></label>
      <label>auto-ask on new prompt <input type="checkbox" data-s="autoAsk"></label>
      <label>fetch more when fewer than <input type="number" min="0" max="10" data-s="refillBelow"></label>
      <label>picking also submits <input type="checkbox" data-s="autoSubmit"></label>
      <label>hide answers said in party <input type="checkbox" data-s="hideSaid"></label>
      <label>hide past misses <input type="checkbox" data-s="hideMisses"></label>
      <div>extra instructions for the AI</div>
      <textarea data-s="extraInstructions" placeholder="e.g. prefer British spellings · avoid anything after 2000 · I like birds"></textarea>

      <h4>AUTO-ANSWER (solo modes)</h4>
      <label>auto-answer <input type="checkbox" data-s="autoAnswer"></label>
      <label>wait before answering (s) <input type="number" min="0" max="60" step="0.5" data-s="autoDelay"></label>
      <label>random extra wait (s) <input type="number" min="0" max="20" step="0.5" data-s="autoJitter"></label>
      <label>wait after a miss (s) <input type="number" min="0.5" max="20" step="0.5" data-s="autoRetry"></label>

      <h4>LOOK</h4>
      <label>corner <select data-s="corner">
        <option value="br">bottom right</option><option value="bl">bottom left</option>
        <option value="tr">top right</option><option value="tl">top left</option></select></label>
      <label>width (px) <input type="number" min="220" max="600" step="10" data-s="width"></label>
      <label>text size <input type="number" min="11" max="24" data-s="fontSize"></label>
      <label>opacity <input type="number" min="0.3" max="1" step="0.05" data-s="opacity"></label>
      <label>show shortcut hints <input type="checkbox" data-s="showHints"></label>

      <h4>SAVED ANSWERS</h4>
      <div class="row"><button data-a="clear-prompt">forget this prompt</button><button data-a="clear-all">clear all</button></div>
      <div class="row"><button data-a="export">export</button><button data-a="import">import</button></div>
      <div class="row"><button data-a="reset-pos">reset position</button><button data-a="reset-settings">reset settings</button></div>
      <div class="meta saved-count"></div>
      <input type="file" accept=".json,application/json" class="import-file" style="display:none">
    </div>`;
  document.body.appendChild(panel);

  const $ = (sel) => panel.querySelector(sel);
  const qEl = $('.q'), metaEl = $('.meta'), listEl = $('.list'), moreBtn = $('.more'), saidEl = $('.said-list');

  function applyLook() {
    panel.style.width = settings.width + 'px';
    panel.style.fontSize = settings.fontSize + 'px';
    panel.style.setProperty('--kr-op', settings.opacity);
    panel.classList.toggle('no-hints', !settings.showHints);
    for (const s of ['left', 'right', 'top', 'bottom']) panel.style[s] = '';
    if (settings.pos) {
      panel.style.left = Math.min(Math.max(0, settings.pos.left), innerWidth - 80) + 'px';
      panel.style.top = Math.min(Math.max(0, settings.pos.top), innerHeight - 40) + 'px';
    } else {
      panel.style[settings.corner.includes('b') ? 'bottom' : 'top'] = '12px';
      panel.style[settings.corner.includes('r') ? 'right' : 'left'] = '12px';
    }
  }

  function syncProviderFields() {
    const p = prov();
    $('[data-p="model"]').value = provModel();
    $('[data-p="base"]').value = provBase();
    $('.base-row').style.display = p.local ? '' : 'none';
    $('.effort-row').style.display = p.kind === 'anthropic' ? '' : 'none';
    setModelOptions(p.models);
    $('.prov-tip').textContent = providerTip();
  }

  const TIPS = {
    ollama: 'Install Ollama, run "ollama pull llama3.1:8b". If you get "blocked", start it with OLLAMA_ORIGINS=* set. Bigger models give better answers.',
    lmstudio: 'In LM Studio, load a model and start the local server (Developer tab), then press "list models".',
    custom: 'Any OpenAI-compatible server: enter its base URL (ending in /v1) and a model name.',
    anthropic: 'Opus is the smartest; Haiku is fastest and cheapest. Effort "low" keeps it quick.',
    groq: 'Groq is extremely fast, good for auto-answer.',
    openrouter: 'One key for hundreds of models — press "list models" to browse.',
  };
  const providerTip = () => TIPS[settings.provider] || (prov().keyUrl ? 'Get a key: ' + prov().keyUrl : '');

  function setModelOptions(ids) {
    const dl = $('#kr-models');
    dl.textContent = '';
    for (const m of ids) { const o = document.createElement('option'); o.value = m; dl.appendChild(o); }
  }

  panel.querySelectorAll('[data-s]').forEach((el) => {
    const k = el.dataset.s;
    if (el.type === 'checkbox') el.checked = settings[k];
    else el.value = settings[k];
    el.addEventListener('change', () => {
      settings[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
      saveSettings();
      if (k === 'provider') syncProviderFields();
      applyLook();
      if (lastPrompt) render(lastPrompt);
    });
  });
  $('[data-p="model"]').addEventListener('change', (e) => { settings.models[settings.provider] = e.target.value.trim(); saveSettings(); });
  $('[data-p="base"]').addEventListener('change', (e) => { settings.baseUrls[settings.provider] = e.target.value.trim(); saveSettings(); });
  syncProviderFields();
  applyLook();

  const updateSavedCount = () => {
    const entries = Object.values(store);
    const learned = entries.reduce((n, e) => n + e.answers.filter((a) => a.tier || a.miss).length, 0);
    const hits = entries.reduce((n, e) => n + e.answers.filter((a) => a.tier && TIERS[a.tier].score >= 60).length, 0);
    $('.saved-count').textContent = `${entries.length} prompts saved · ${learned} real results · ${hits} rare-or-better hits`;
  };
  updateSavedCount();

  function download(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  // merge imported answers into the store, keeping real results over guesses
  // only copy known fields with valid values, so a bad file can't break the panel
  function cleanAnswer(a) {
    if (!a || typeof a.answer !== 'string' || !a.answer.trim() || a.answer.length > 80) return null;
    const out = { answer: a.answer.trim(), rarity: Math.max(0, Math.min(5, a.rarity | 0)) };
    if (TIERS[a.tier]) out.tier = a.tier;
    else if (a.miss === true) out.miss = true;
    if (typeof a.canonical === 'string' && a.canonical.length <= 80) out.canonical = a.canonical;
    for (const f of ['mine', 'checked']) if (a[f] === true) out[f] = true;
    if (typeof a.doubt === 'string') out.doubt = a.doubt.slice(0, 40);
    return out;
  }

  function importStore(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an export');
    let prompts = 0, added = 0;
    for (const [rawKey, e] of Object.entries(data)) {
      if (!e || !Array.isArray(e.answers)) continue;
      const k = norm(typeof e.prompt === 'string' ? e.prompt : rawKey);
      if (!k || ['__proto__', 'constructor', 'prototype'].includes(k)) continue;
      prompts++;
      if (!Object.hasOwn(store, k)) store[k] = { prompt: String(e.prompt || rawKey).slice(0, 300), at: Date.now(), answers: [] };
      const mine = store[k];
      for (const raw of e.answers) {
        const a = cleanAnswer(raw);
        if (!a) continue;
        const have = findAnswer(mine, a.answer);
        if (!have) { mine.answers.push(a); added++; }
        else if ((a.tier || a.miss) && !(have.tier || have.miss)) Object.assign(have, a);
      }
    }
    saveStore();
    updateSavedCount();
    return `imported ${added} answers across ${prompts} prompts`;
  }

  const settingsMsg = (text, isErr) => {
    const el = $('.prov-tip');
    el.textContent = text;
    el.style.color = isErr ? '#ff6b6b' : '#7dffb0';
    el.style.opacity = 1;
    clearTimeout(settingsMsg.timer);
    settingsMsg.timer = setTimeout(() => { el.style.color = ''; el.style.opacity = ''; el.textContent = providerTip(); }, 6000);
  };

  panel.addEventListener('click', (e) => {
    const a = e.target.dataset && e.target.dataset.a;
    if (!a) return;
    e.stopPropagation();
    if (a === 'toggle') panel.classList.toggle('collapsed');
    else if (a === 'settings') { panel.classList.remove('collapsed'); panel.classList.toggle('show-settings'); }
    else if (a === 'ask' && lastPrompt) ask(lastPrompt, false);
    else if (a === 'key') getKey(true);
    else if (a === 'models') {
      settingsMsg('listing models…');
      listModels((err, ids) => {
        if (err) return settingsMsg(err, true);
        setModelOptions(ids);
        settingsMsg(`${ids.length} models found — click the model box to pick one`);
      });
    } else if (a === 'test') {
      settingsMsg('testing…');
      const t0 = Date.now();
      llmRequest({
        system: 'Reply with exactly: OK', user: 'Say OK.', stream: false, temperature: 0,
        onDone: (err, text) => err ? settingsMsg(err, true)
          : settingsMsg(`✓ ${prov().label} / ${provModel()} replied "${text.trim().slice(0, 20)}" in ${((Date.now() - t0) / 1000).toFixed(1)}s`),
      });
    } else if (a === 'clear-prompt' && lastPrompt) {
      delete store[norm(lastPrompt)]; saveStore(); updateSavedCount(); render(lastPrompt);
    } else if (a === 'clear-all' && confirm('Delete all saved answers?')) {
      store = {}; saveStore(); updateSavedCount(); if (lastPrompt) render(lastPrompt);
    } else if (a === 'export') download('krillion-saved-answers.json', store);
    else if (a === 'import') $('.import-file').click();
    else if (a === 'reset-pos') { settings.pos = null; saveSettings(); applyLook(); }
    else if (a === 'reset-settings' && confirm('Reset all settings (keeps saved answers and keys)?')) {
      GM_setValue('settings', {});
      location.reload();
    }
  });
  $('.import-file').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      try { settingsMsg(importStore(JSON.parse(t))); if (lastPrompt) render(lastPrompt); }
      catch (err) { settingsMsg("that file isn't a saved-answers export", true); }
      e.target.value = '';
    });
  });
  moreBtn.addEventListener('click', () => lastPrompt && ask(lastPrompt, true));

  // drag the panel by its header; a click without movement collapses it
  (function makeDraggable() {
    const header = $('header');
    let start = null;
    header.addEventListener('mousedown', (e) => {
      if (e.target.dataset.a || e.button !== 0) return;
      const r = panel.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top, moved: false };
      e.preventDefault();
    });
    addEventListener('mousemove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!start.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      start.moved = true;
      settings.pos = { left: start.left + dx, top: start.top + dy };
      applyLook();
    });
    addEventListener('mouseup', () => {
      if (!start) return;
      if (start.moved) saveSettings();
      else panel.classList.toggle('collapsed');
      start = null;
    });
    addEventListener('resize', applyLook);
  })();

  // ---------- Filling the game's input ----------
  const gameInput = () => document.querySelector('input.ds-input');

  function fillInput(text, submit) {
    const input = gameInput();
    if (!input) return;
    // React tracks the value itself, so use the native setter and fire an input event.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    if (submit) {
      setTimeout(() => {
        lastSubmitted = text;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        try { if (input.form) input.form.requestSubmit(); } catch (e) { /* older browsers: the Enter key event covers it */ }
      }, 30);
    }
  }

  // ---------- Rendering ----------
  const answerScore = (a) => (a.tier ? TIERS[a.tier].score : STAR_SCORE[Math.max(1, Math.min(5, a.rarity | 0))]);
  const isSaid = (a) => partySaid.has(norm(a.answer)) || (a.canonical && partySaid.has(norm(a.canonical)));

  function render(prompt, msg, isErr) {
    qEl.textContent = prompt;
    const entry = store[norm(prompt)];
    const answers = entry ? entry.answers : [];
    const learned = answers.filter((a) => a.tier || a.miss).length;
    metaEl.textContent = [
      `${prov().label.replace(/ \(.*\)/, '')}${provModel() ? ' · ' + provModel() : ''}`,
      entry ? `${answers.length} saved` : '',
      learned ? `${learned} confirmed` : '',
      pending ? 'streaming…' : lastLatency ? `first in ${lastLatency}s` : '',
      verifying ? 'double-checking…' : '',
    ].filter(Boolean).join(' · ');
    listEl.textContent = '';

    if (msg) {
      const d = document.createElement('div');
      if (isErr) d.className = 'err';
      d.textContent = msg;
      listEl.appendChild(d);
    }

    visible = answers
      .filter((a) => !(a.miss && settings.hideMisses))
      .filter((a) => !a.doubt || a.tier)
      .filter((a) => !(settings.hideSaid && isSaid(a)))
      .filter((a) => a.tier || (a.rarity | 0) >= settings.minStars || a.mine)
      .sort((a, b) => (b.miss ? -1 : answerScore(b)) - (a.miss ? -1 : answerScore(a)) ||
        (b.tier ? 2 : b.checked ? 1 : 0) - (a.tier ? 2 : a.checked ? 1 : 0));
    if (cursor >= visible.length) cursor = -1;

    visible.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'chip' + (isSaid(a) ? ' said' : '') + (a.miss ? ' miss' : '') + (i === cursor ? ' cur' : '');
      b.innerHTML = '<span class="n"></span><span class="w"></span><span class="r"></span>';
      b.querySelector('.n').textContent = i < 9 ? String(i + 1) : '';
      b.querySelector('.w').textContent = a.answer + (a.canonical && norm(a.canonical) !== norm(a.answer) ? ` → ${a.canonical}` : '');
      const r = b.querySelector('.r');
      if (a.miss) r.textContent = '✗ not accepted';
      else if (a.tier) {
        r.className = 'r real';
        r.style.setProperty('--tc', `var(--tier-${a.tier})`);
        r.textContent = '✓ ' + TIERS[a.tier].name;
      } else r.textContent = (a.checked ? '✔ ' : '') + '★'.repeat(Math.max(1, Math.min(5, a.rarity | 0)));
      b.addEventListener('click', () => fillInput(a.answer, settings.autoSubmit));
      listEl.appendChild(b);
    });
    moreBtn.style.display = entry && !pending ? 'block' : 'none';
    saidEl.textContent = partySaid.size ? `said in party (${partySaid.size}): ${[...partySaid].join(', ')}` : '';
    maybeRefill(prompt);
  }

  // keep a few unused suggestions in reserve
  function maybeRefill(prompt) {
    if (!settings.refillBelow || pending || verifying || prompt !== lastPrompt) return;
    const entry = store[norm(prompt)];
    const done = refills.get(prompt) || 0;
    if (!entry || !entry.answers.length || done >= 3) return; // at most 3 automatic refills per prompt per page load
    const unused = visible.filter((a) => !a.miss && !a.tier && !isSaid(a)).length;
    if (unused < settings.refillBelow) {
      refills.set(prompt, done + 1);
      setTimeout(() => ask(prompt, true), 0);
    }
  }

  // ---------- Local prompt checks ----------
  // Letter/length rules in a prompt can be checked without asking the AI, so obvious misfits never show.
  function promptRules(prompt) {
    const p = prompt.toLowerCase();
    const rules = [];
    const letters = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
    const filler = '(?!(?:the|same|any|one|its|their|his|her|two|no)\\b)';
    const start = p.match(new RegExp(`(?:start|begin)s?(?:ing)? with (?:the letters? |an? )?["'“]?${filler}([a-z]{1,4})\\b`));
    if (start) rules.push((a) => letters(a).startsWith(start[1]));
    const end = p.match(new RegExp(`end(?:s|ing)? (?:with|in) (?:the letters? |an? )?["'“]?${filler}([a-z]{1,4})\\b`));
    if (end) rules.push((a) => letters(a).endsWith(end[1]));
    const cont = p.match(/contain(?:s|ing)? (?:the letters? |an? )?["'“]([a-z]{1,6})["'”]/) ||
      p.match(/contain(?:s|ing)? the letters? ([a-z]{1,6})\b/);
    if (cont) rules.push((a) => letters(a).includes(cont[1]));
    const len = p.match(/\b(\d{1,2})[- ]letters?\b/);
    if (len) rules.push((a) => letters(a).length === +len[1]);
    const words = { one: 1, two: 2, three: 3, four: 4 };
    const wc = p.match(/\b(one|two|three|four|single)[- ]word\b/);
    if (wc) rules.push((a) => a.trim().split(/\s+/).length === (wc[1] === 'single' ? 1 : words[wc[1]]));
    return rules;
  }
  const fitsRules = (prompt, answer) => promptRules(prompt).every((r) => r(answer));

  // ---------- Asking the AI ----------
  function addSuggestion(prompt, answer, rarity) {
    answer = answer.replace(/^[\d.)\-\s*•]+/, '').replace(/\*\*/g, '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
    if (!answer || answer.length > 60) return false;
    const entry = entryFor(prompt);
    if (findAnswer(entry, answer)) return false;
    const a = { answer, rarity: Math.max(1, Math.min(5, rarity | 0 || 3)) };
    if (!fitsRules(prompt, answer)) a.doubt = 'breaks the prompt rules';
    entry.answers.push(a);
    return !a.doubt;
  }

  // Second pass: ask the AI to strictly judge its own unconfirmed answers.
  function verify(prompt) {
    const entry = store[norm(prompt)];
    if (!entry) return;
    const todo = entry.answers.filter((a) => !a.tier && !a.miss && !a.doubt && !a.checked && !a.mine);
    if (!todo.length) return;
    verifying = true;
    if (prompt === lastPrompt) render(prompt);
    llmRequest({
      system:
        'You are a strict fact-checker for a trivia game. For each candidate, decide whether it is a real thing that ' +
        'correctly and fully answers the prompt (every condition) and would appear in Wikipedia or a dictionary under that name. ' +
        'Reject anything invented, misspelled, or only loosely related. Reply ONLY with JSON: {"valid":[...],"invalid":[...]} using the candidates exactly as given.',
      user: 'Prompt: ' + prompt + '\nCandidates:\n' + todo.map((a) => a.answer).join('\n'),
      stream: false,
      temperature: 0,
      onDone(err, text) {
        if (!err) {
          try {
            const out = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
            const bad = new Set((out.invalid || []).map(norm));
            const good = new Set((out.valid || []).map(norm));
            for (const a of todo) {
              if (bad.has(norm(a.answer))) a.doubt = 'failed double-check';
              else if (good.has(norm(a.answer))) a.checked = true;
            }
            saveStore();
          } catch (e) { /* leave unchecked */ }
        }
        verifying = false;
        if (prompt === lastPrompt) render(prompt);
      },
    });
  }

  function ask(prompt, wantMore) {
    const k = norm(prompt);
    if (store[k] && store[k].answers.length && !wantMore) return render(prompt);
    if (pending) return;
    const key = getKey(false);
    if (!key && !prov().local) return render(prompt, `No ${prov().label} API key — use ⚙ → API key.`, true);

    const entry = store[k];
    const known = entry ? entry.answers.filter((a) => !a.miss).map((a) => a.answer) : [];
    const misses = entry ? entry.answers.filter((a) => a.miss).map((a) => a.answer) : [];
    const common = entry ? entry.answers.filter((a) => a.tier === 'plankton' || a.tier === 'tooclever').map((a) => a.answer) : [];
    const hits = entry ? entry.answers.filter((a) => a.tier && TIERS[a.tier].score >= 60)
      .map((a) => `${a.canonical || a.answer} (${TIERS[a.tier].name.toLowerCase()})`) : [];
    const doubts = entry ? entry.answers.filter((a) => a.doubt).map((a) => a.answer) : [];
    const rules = promptRules(prompt).length;
    const exclude = [...new Set([...known, ...partySaid, ...doubts])];

    const depthRule = {
      safe: 'Prefer answers of rarity 2–3: uncommon but well known enough to appear on Wikipedia list pages.',
      balanced: 'Aim mostly for rarity 3–4: genuinely uncommon, but each must have its own Wikipedia article or dictionary entry.',
      deep: 'Go for rarity 4–5, but every answer must still be real and verifiable on Wikipedia or in a dictionary.',
    }[settings.depth] || '';
    const system =
      'You help a player in a trivia game. Each prompt has a curated answer set built from Wikipedia, dictionaries and encyclopedias; ' +
      'rarer valid answers score more, but answers not in the set score nothing. ' +
      'Read the prompt literally: every answer must match ALL of its conditions exactly (type, category, letters, era, etc.). ' +
      'Never invent or guess names. If unsure an answer is real and fits, leave it out. ' +
      depthRule + ' ' +
      `List ${settings.count} answers, most obscure first. ` +
      'Output ONLY lines in the form: answer | rarity  (rarity 1–5, 5 = very obscure, 1 = obvious). ' +
      'No numbering, no headings, no explanations. Use the standard English name exactly as Wikipedia titles it, without parentheses or qualifiers. ' +
      'Rarity means how few players would think of typing it, not how hard the fact is. ' +
      'Avoid "famously obscure" picks that everyone reaches for when trying to be clever (the game scores those as common).' +
      (settings.extraInstructions.trim() ? '\nPlayer preferences: ' + settings.extraInstructions.trim() : '');
    let user = 'Prompt: ' + prompt;
    if (rules) user += '\nThis prompt has spelling/letter rules: check every answer letter by letter before listing it.';
    if (exclude.length) user += '\nDo NOT repeat any of these: ' + exclude.join(', ');
    if (hits.length) user += '\nThese scored well, so similar depth works and spellings like these are accepted: ' + hits.join(', ');
    if (misses.length) user += '\nThese were NOT accepted by the game, avoid similar: ' + misses.join(', ');
    if (common.length) user += '\nThese turned out too common, go deeper than them: ' + common.join(', ');

    pending = true;
    lastLatency = null;
    const t0 = Date.now();
    render(prompt);

    let content = '', consumed = 0, added = 0;
    const consumeLines = (final) => {
      const lines = content.split('\n');
      const upto = final ? lines.length : lines.length - 1;
      let changed = false;
      for (; consumed < upto; consumed++) {
        const m = lines[consumed].match(/^\s*(.+?)\s*\|\s*([1-5])/);
        if (m && addSuggestion(prompt, m[1], +m[2])) {
          if (!added) lastLatency = ((Date.now() - t0) / 1000).toFixed(1);
          added++;
          changed = true;
        }
      }
      if (changed) { saveStore(); if (prompt === lastPrompt) render(prompt); }
    };

    llmRequest({
      system, user, stream: true, temperature: settings.temperature,
      onDelta(t) { content += t; consumeLines(false); },
      onDone(err, full) {
        pending = false;
        if (full && full.length > content.length) content = full; // non-streaming fallback
        let msg = err || '', isErr = !!err;
        if (!err) {
          consumeLines(true);
          if (!added) { msg = 'No new answers this time — try again.'; isErr = true; }
        }
        if (store[k]) store[k].at = Date.now();
        saveStore();
        updateSavedCount();
        if (prompt === lastPrompt) render(prompt, msg, isErr);
        if (!isErr && settings.verify) verify(prompt);
      },
    });
  }

  // ---------- Learning real results ----------
  const tierFromStyle = (el, prop) => {
    const m = (el.style.getPropertyValue(prop) || '').match(/--tier-([a-z]+)/);
    return m && TIERS[m[1]] ? m[1] : null;
  };
  const quoted = (s) => { const m = String(s).match(/“([^”]+)”/); return m ? m[1].trim() : null; };

  function record(prompt, typed, canonical, tier, miss) {
    if (!prompt) return;
    const entry = entryFor(prompt);
    let a = (typed && findAnswer(entry, typed)) || (canonical && findAnswer(entry, canonical));
    if (!a) {
      const text = typed || canonical;
      if (!text) return;
      a = { answer: text, rarity: 0, mine: true };
      entry.answers.push(a);
    }
    if (miss) { a.miss = true; delete a.tier; }
    else {
      a.tier = tier;
      delete a.miss;
      delete a.doubt;
      if (canonical && norm(canonical) !== norm(a.answer)) a.canonical = canonical;
    }
    saveStore();
    updateSavedCount();
  }

  function checkResults() {
    let changed = false;

    // Daily / unlimited / packs: result card after each guess.
    document.querySelectorAll('.ds-landed').forEach((el) => {
      if (handled.has(el)) return;
      handled.add(el);
      // Only trust cards that follow a guess made this session (reloads redraw old cards).
      if (!lastSubmitted) return;
      const ans = quoted(el.querySelector('.tans')?.textContent || '');
      roundDoneFor = lastPrompt; // a result card means this round is over
      if (el.classList.contains('miss')) {
        record(lastPrompt, lastSubmitted, null, null, true);
      } else {
        const tier = tierFromStyle(el, '--tc');
        if (tier) record(lastPrompt, lastSubmitted, ans, tier, false);
      }
      lastSubmitted = null;
      changed = true;
    });

    // Rejected guesses: “X”: <message>. Repeats ("already said") aren't misses.
    document.querySelectorAll('.ds-reject').forEach((el) => {
      if (handled.has(el)) return;
      handled.add(el);
      const txt = el.textContent;
      if (/already said|signal lost/i.test(txt)) return;
      const guess = quoted(txt) || lastSubmitted;
      if (guess) { record(lastPrompt, guess, null, null, true); changed = true; }
    });

    // Puffer Party: accepted answers show up as speech bubbles with the "ok" class and the tier colour.
    document.querySelectorAll('.pf-say.ok').forEach((el) => {
      const t = norm(el.textContent);
      if (!t) return;
      if (!partySaid.has(t)) { partySaid.add(t); changed = true; }
      const tier = tierFromStyle(el, '--cc');
      const seenKey = t + '|' + tier;
      if (tier && el.dataset.krSeen !== seenKey) {
        el.dataset.krSeen = seenKey;
        record(lastPrompt, t, null, tier, false);
        changed = true;
      }
    });

    if (changed && lastPrompt) render(lastPrompt);
  }

  // Remember what was in the box when the player pressed Enter / Send.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('input.ds-input')) {
      lastSubmitted = e.target.value.trim() || lastSubmitted;
    }
  }, true);
  document.addEventListener('submit', () => {
    const v = gameInput()?.value.trim();
    if (v) lastSubmitted = v;
  }, true);

  // ---------- Keyboard shortcuts ----------
  document.addEventListener('keydown', (e) => {
    const inGame = e.target && e.target.matches && e.target.matches('input.ds-input');
    if (e.key === 'Tab' && inGame && visible.length && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      cursor = e.shiftKey ? (cursor <= 0 ? visible.length - 1 : cursor - 1) : (cursor + 1) % visible.length;
      fillInput(visible[cursor].answer, false);
      render(lastPrompt);
      return;
    }
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (/^[1-9]$/.test(e.key) && visible[+e.key - 1]) {
      e.preventDefault();
      cursor = +e.key - 1;
      fillInput(visible[cursor].answer, settings.autoSubmit);
      render(lastPrompt);
    } else if (k === 'r' && lastPrompt) { e.preventDefault(); ask(lastPrompt, true); }
    else if (k === 'a' && lastPrompt) { e.preventDefault(); ask(lastPrompt, false); }
    else if (k === 'h') { e.preventDefault(); panel.classList.toggle('hidden'); }
  }, true);

  // ---------- Auto-answer (solo modes only) ----------
  // Puffer Party is live against real people, so auto-answer never runs there.
  const inParty = () => location.pathname.startsWith('/party');
  const autoEl = $('.auto');
  let roundDoneFor = null;
  const auto = { prompt: null, fireAt: 0, tried: new Set(), askedMore: false };

  setInterval(() => {
    if (!settings.autoAnswer) { autoEl.textContent = ''; return; }
    if (inParty()) { autoEl.textContent = 'auto-answer is off in Puffer Party'; return; }
    const input = gameInput();
    if (!lastPrompt || !input || input.disabled || roundDoneFor === lastPrompt) {
      autoEl.textContent = 'auto-answer: waiting for a round';
      auto.prompt = null;
      return;
    }
    const now = Date.now();
    if (auto.prompt !== lastPrompt) {
      auto.prompt = lastPrompt;
      auto.tried = new Set();
      auto.askedMore = false;
      auto.fireAt = now + (settings.autoDelay + Math.random() * settings.autoJitter) * 1000;
    }
    const next = visible.find((a) => !a.miss && !auto.tried.has(norm(a.answer)));
    if (now < auto.fireAt) {
      autoEl.textContent = `auto-answer in ${((auto.fireAt - now) / 1000).toFixed(1)}s` + (next ? ` → ${next.answer}` : '');
      return;
    }
    if (!next) {
      if (pending || verifying) { autoEl.textContent = 'auto-answer: waiting for suggestions…'; return; }
      if (!auto.askedMore) { auto.askedMore = true; ask(lastPrompt, true); }
      autoEl.textContent = 'auto-answer: out of suggestions, asking for more…';
      auto.fireAt = now + 1000;
      return;
    }
    auto.tried.add(norm(next.answer));
    auto.askedMore = false;
    autoEl.textContent = `auto-answer: trying ${next.answer}`;
    fillInput(next.answer, true);
    auto.fireAt = now + settings.autoRetry * 1000;
  }, 100);

  // ---------- Watch the page ----------
  function checkPrompt() {
    const prompts = [...document.querySelectorAll('.ds-card .prompt')].filter(
      (el) => !el.closest('.pf-newcat') && !el.closest('.gone')
    );
    const el = prompts[prompts.length - 1];
    const text = el && el.textContent.trim();
    if (!text || text === lastPrompt) return;
    lastPrompt = text;
    cursor = -1;
    lastLatency = null;
    partySaid.clear(); // new category → old party answers no longer matter
    const entry = store[norm(text)];
    if ((entry && entry.answers.length) || settings.autoAsk) ask(text, false);
    else render(text, 'press ▶ to ask the AI');
  }

  let queued = false;
  new MutationObserver(() => {
    // batch bursts of DOM changes into one check per frame
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; checkPrompt(); checkResults(); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
  checkPrompt();
})();
