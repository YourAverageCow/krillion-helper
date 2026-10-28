# 🦐 Krillion Helper

A userscript for [krillion.io](https://krillion.io) that asks an AI for **rare answers** to the prompt on your screen. It **learns from your real results**, so its suggestions get better the more you play.

> Not affiliated with Krillion or its creator. Krillion is a one-person project: if you enjoy it, consider [supporting it](https://shop.krillion.io/).

**[⬇️ Install (one click)](https://raw.githubusercontent.com/YourAverageCow/krillion-helper/main/krillion-helper.user.js)** (you need a userscript manager first; see [Install](#install)).

---

## What it does

Krillion gives you prompts like *"name a cheese"*. Obvious answers (cheddar) are worth almost nothing, and rare ones (taleggio) score big. Krillion Helper adds a small panel to the page that:

- **Suggests rare answers** as soon as a prompt appears, streamed in one by one, rarest first, with a 1–5 ★ rarity guess.
- **Checks them** before you see them:
  - Letter and length rules in the prompt ("starting with B", "5-letter", "ending in *stan*", …) are checked locally.
  - An optional second AI pass throws out made-up or wrong answers. Answers that pass get a ✔.
- **Learns your real results.** After each guess it reads the tier the game showed you (plankton → schooler → rare → deep cut → krillion, or 🤡 *too clever*) and replaces the AI's guess with the truth. Answers the game rejected are hidden for good, and the AI is told about them next time.
- **Saves everything locally**, so a prompt you've seen before shows its answers instantly, with no AI request.
- **Puffer Party aware:** it watches which answers have already been said, hides them from your suggestions (repeats get rejected), and tells the AI to skip them.

## Install

1. Install a userscript manager:
   - **[Tampermonkey](https://www.tampermonkey.net/)** (Chrome, Edge, Firefox, Safari; recommended, and the only one that streams answers live).
   - Or [Violentmonkey](https://violentmonkey.github.io/).
   - In **Chrome/Edge**, also turn on **"Allow User Scripts"** in Tampermonkey's extension details, or Developer mode at `chrome://extensions`.
2. Click **[Install Krillion Helper](https://raw.githubusercontent.com/YourAverageCow/krillion-helper/main/krillion-helper.user.js)**, then press **Install**.
3. Open [krillion.io](https://krillion.io). The panel appears bottom-right. Click **⚙**, pick an AI provider, and enter its API key (see below).

It **updates itself automatically** whenever a new version is pushed here.

## Choosing an AI

Pick a provider in **⚙ → AI**, enter its key with the **API key** button, then press **test** to check it works. **list models** shows every model your key can use.

| Provider | Notes | Get a key |
|---|---|---|
| DeepSeek | Cheap and good; the default | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| Claude (Anthropic) | Opus is the smartest; Haiku is fast and cheap | [platform.claude.com](https://platform.claude.com/settings/keys) |
| OpenAI | GPT models | [platform.openai.com](https://platform.openai.com/api-keys) |
| Google Gemini | Has a free tier | [aistudio.google.com](https://aistudio.google.com/apikey) |
| Groq | Extremely fast; has a free tier | [console.groq.com](https://console.groq.com/keys) |
| OpenRouter | One key, hundreds of models | [openrouter.ai](https://openrouter.ai/keys) |
| Mistral / xAI Grok | | [mistral](https://console.mistral.ai/api-keys) · [x.ai](https://console.x.ai) |
| **Ollama** (local) | Free, runs on your PC, no key | [ollama.com](https://ollama.com) |
| **LM Studio** (local) | Free, runs on your PC, no key | [lmstudio.ai](https://lmstudio.ai) |
| Custom | Any OpenAI-compatible server URL | |

**Local models (Ollama):** install Ollama, run `ollama pull llama3.1:8b`, and pick **Ollama** in ⚙. If you see "blocked by the local server", restart Ollama with the environment variable `OLLAMA_ORIGINS=*`. Small local models make more mistakes, so keep **double-check** on and use **depth: safe**.

**Cost:** each prompt is one short request, plus one more if double-check is on. On DeepSeek, Haiku, Gemini Flash or Groq, a whole day of dives costs a fraction of a cent. Saved prompts cost nothing.

## Using it

- Click a suggestion to put it in the answer box, then press Enter. Or turn on **picking also submits** in ⚙.
- **↻ get new answers** asks for more, never repeating ones you already have.
- Drag the panel by its header to move it. Click the header to collapse it.

| Shortcut | Does |
|---|---|
| **Tab / Shift+Tab** (in the answer box) | Cycle through suggestions |
| **Alt+1 … Alt+9** | Pick suggestion 1–9 (on Linux Chrome these switch tabs, so use Tab there) |
| **Alt+R** | Get new answers |
| **Alt+A** | Ask for the current prompt |
| **Alt+H** | Hide or show the panel |

What the labels mean:

| Label | Meaning |
|---|---|
| ★★★★ | The AI's rarity guess (1–5) |
| ✔ ★★★ | Passed the double-check |
| ✓ DEEP CUT | The game's real tier for that answer |
| ✗ not accepted | The game rejected it (hidden by default) |

## Settings (⚙)

**AI**
- Provider, model and server URL (local or custom only).
- API key, list models, test.
- Thinking effort (Claude only).
- Creativity, and whether to send it at all.
- Timeout.

**Answers**
- Answers per request.
- **Depth**:
  - *safe:* more hits, lower rarity.
  - *balanced:* the default.
  - *deep:* riskier, higher scores.
- Minimum ★ to show, double-check, and auto-ask on new prompts.
- Fetch more automatically when you're running low.
- Picking also submits.
- Hide answers already said in a party, hide past misses.
- **Extra instructions**: free text added to the AI's instructions, e.g. *"prefer British spellings"*.

**Auto-answer (solo modes only)**
- Submits the best suggestion on a timer: a wait, a random extra wait, and a wait after a miss. The panel shows a live countdown.
- If an answer is rejected it tries the next one, and asks the AI for more if it runs out.
- It **never runs in Puffer Party**, where you're playing live against real people.

**Look**
- Corner, width, text size, opacity, shortcut hints.

**Saved answers**
- Forget the current prompt, or clear everything.
- **Export / import** to move what you've learned between computers. Import merges files and keeps real results over guesses.
- Reset position, reset settings.

## Privacy

- **API keys** are stored only inside your userscript manager on your own computer. They're never written into the script or sent anywhere except the provider you picked.
- **What's sent:** only the prompt text, plus the answers already tried for it, goes to your chosen AI provider. With a local model, nothing leaves your computer.
- **Network permission:** the script lists the AI providers it talks to. It also has `@connect *` so local and custom servers work, and Tampermonkey asks your permission before it contacts any server that isn't on that list.
- **What it never touches:** the script doesn't call Krillion's servers, doesn't read hidden answer lists, and doesn't unlock paid packs. It only reads what's already shown on your screen.

## Fair play

This is a study and practice aid. A few things to keep in mind:

- Daily scores are compared against everyone else's. **Scores you post with AI help aren't really yours**, so think about that before sharing them or comparing with friends.
- **Auto-answer is deliberately disabled in Puffer Party.** Please don't modify it to play live games against people.
- The developer may consider AI help against the spirit of the game. Use it at your own risk.

## Troubleshooting

| Problem | Fix |
|---|---|
| Panel says "waiting for a prompt…" forever | Refresh. Check the script is enabled in Tampermonkey. Krillion may have changed its page layout, so open an issue here |
| "API key rejected" / "out of credit" | Re-enter the key (⚙ → API key) and check your balance with the provider |
| "model or URL not found" | Press **list models** and pick one from the list |
| Lots of answers rejected by the game | Use **depth: safe**, keep **double-check** on, or try a smarter model |
| Answers appear all at once instead of streaming | Live streaming needs Tampermonkey; other managers deliver the whole reply at the end |
| Ollama "blocked" | Start Ollama with `OLLAMA_ORIGINS=*` |

## How it works (for the curious)

- The script finds the current prompt from the round card on the page and reads your results from the result card the game draws after each guess.
- Rejected guesses are read from the "not in the list" message, and Puffer Party answers from the players' speech bubbles.
- Requests go through Tampermonkey's `GM_xmlhttpRequest`, so any provider works without CORS problems.
- Everything except Claude uses the OpenAI-style `/chat/completions` API, and Claude uses the Anthropic Messages API.
- Everything it learns is stored with `GM_setValue`.
