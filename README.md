# 🎬 Kurdî Subtitle Translator | وەرگێڕی پێشکەوتووی ژێرنووسی کوردی

[![Version v103](https://img.shields.io/badge/Version-v103-7c5cfc?style=flat-square&logo=github)](https://LOST-4EVER.github.io/kurdish-translator/)
[![Progressive Web App](https://img.shields.io/badge/PWA-Installable%20%26%20Offline-0ea5e9?style=flat-square&logo=pwa&logoColor=white)](https://LOST-4EVER.github.io/kurdish-translator/)
[![Target Kurdish Sorani](https://img.shields.io/badge/Target%20Language-Kurdish%20Sorani%20(ckb)-fbbf24?style=flat-square)](https://LOST-4EVER.github.io/kurdish-translator/)
[![100% Client-Side](https://img.shields.io/badge/Privacy-100%25%20In--Browser-10b981?style=flat-square&logoColor=white)](https://LOST-4EVER.github.io/kurdish-translator/)
[![Zero Build Step](https://img.shields.io/badge/Build-Zero%20Dependencies-ec4899?style=flat-square)](https://LOST-4EVER.github.io/kurdish-translator/)
[![GitHub Pages](https://img.shields.io/badge/Deployment-GitHub%20Pages-6366f1?style=flat-square&logo=githubpages&logoColor=white)](https://LOST-4EVER.github.io/kurdish-translator/)

A state-of-the-art, 100% client-side subtitle translation and fansubbing suite designed specifically for **Kurdish Sorani (کوردیی ناوەندی - `ckb`)**. Purpose-built for anime fansubbers, cinema translators, and video editors, it features an advanced Kurdish linguistic normalizer, an extensive anime & cartoon cultural lexicon, a real-time subtitle player, a two-way synchronized editor, and an automated Kurdish orthographic quality inspector.

🔗 **Live Web Application:** [https://LOST-4EVER.github.io/kurdish-translator/](https://LOST-4EVER.github.io/kurdish-translator/)

---

## 📑 Table of Contents
1. [Supported Subtitle Formats & Encodings](#-supported-subtitle-formats--encodings)
2. [Anime, Cartoon & Cinema Kurdish Intelligence](#-anime-cartoon--cinema-kurdish-intelligence)
3. [Core Translation & Multi-API Failover Engine](#-core-translation--multi-api-failover-engine)
4. [Real-Time Subtitle Player & Cinema Mode](#-real-time-subtitle-player--cinema-mode)
5. [Live Subtitle Editor & Instant Search](#-live-subtitle-editor--instant-search)
6. [Kurdish Quality Inspector & Auto-Repair](#-kurdish-quality-inspector--auto-repair)
7. [Character Glossary & Speaker Manager](#-character-glossary--speaker-manager)
8. [PWA Offline Engine & Diagnostics](#-pwa-offline-engine--diagnostics)
9. [Architecture & Source Structure](#-architecture--source-structure)
10. [Keyboard Shortcuts Cheat Sheet](#-keyboard-shortcuts-cheat-sheet)
11. [Local Development & Deployment](#-local-development--deployment)

---

## 🗂 Supported Subtitle Formats & Encodings

The built-in parser (`SubParser`) decodes, cleans, preserves styling tags, and serializes subtitles with strict standard compliance:

| Format | Extension | Specification & Preserved Features |
|---|:---:|---|
| **SubRip** | `.srt` | Millisecond timecodes (`hh:mm:ss,mmm`), HTML styling tags (`<i>`, `<b>`, `<u>`, `<font>`), multi-line dialogue |
| **WebVTT** | `.vtt` | Header & cue positioning settings (`align:start position:0%`), 2-part (`mm:ss.mmm`) and 3-part (`hh:mm:ss.mmm`) timestamps |
| **Advanced SubStation Alpha** | `.ass` | Script headers, styles, override codes (`{\an8}`, `{\pos()}`, `{\c&H...&}`, `{\fad()}`, `{\blur}`), `\N` linebreaks |
| **SubStation Alpha** | `.ssa` | V4 styles, dialogue layers, event metadata, and field order preservation |
| **MicroDVD** | `.sub` | Frame-based timing with FPS headers (`{1}{1}23.976`), pipe `\|` linebreaks, control codes |
| **SAMI** | `.smi` | `<SYNC Start=...>` timing blocks, multi-paragraph handling, HTML tag sanitization & entities |
| **Plain Transcript** | `.txt` | Line-by-line transcript translation with automatic pacing and cue generation |

### Encoding & Character Detection
- **Automatic Byte Order Mark (BOM) Stripping:** Handles UTF-8 with BOM, UTF-16LE, and UTF-16BE seamlessly.
- **Legacy Code Pages:** Automatically decodes Windows-1256 (Arabic/Kurdish), ISO-8859-1, and standard UTF-8 without mojibake.

---

## 🎌 Anime, Cartoon & Cinema Kurdish Intelligence

The application includes an extensive Kurdish Sorani cinematic dialogue engine (`TranslatorDict`) with 250+ pre-mapped battle incantations, power systems, catchphrases, and cartoon dialogue lines:

### ⚡ Iconic Anime Worlds & Battle Cries
- **Jujutsu Kaisen:** *Domain Expansion* (`فراوانکردنی دۆمەین`), *Unlimited Void* (`بۆشایی بێسنوور`), *Malevolent Shrine* (`مەزارگەی شەڕانگێزی`), *Hollow Purple* (`مۆری بەتاڵ`), *Black Flash* (`بریسکەی ڕەش`), *"Throughout heaven and earth, I alone am the honored one"*, *"Nah, I'd win"*, *"Stand proud, you are strong"*.
- **One Piece:** *Gear 2/3/4/5* (`گێری پێنجەم - شێوەی ئازادی نیکا`), *Conqueror's / Armament / Observation Haki*, *"I'm gonna be king of the pirates"*, *"Nothing happened"*, *"I want to live!"*, *"People's dreams have no end"*.
- **Attack on Titan (Shingeki no Kyojin):** *Tatakae* (`بجەنگە! شەڕ بکە!`), *Shinzou wo Sasageyo* (`دڵەکانتان ببەخشن بۆ ئازادی!`), *"This world is cruel but also very beautiful"*, *"I will keep moving forward until all my enemies are destroyed"*, *The Rumbling*.
- **Naruto & Boruto:** *Rasengan* (`ڕاسێنگان`), *Chidori* (`چیدۆری`), *Amaterasu* (`ئاماتێراسو`), *Tsukuyomi / Infinite Tsukuyomi*, *Kamui*, *Susanoo*, *Shadow Clone Jutsu* (`کاگێ بونشین`), *Shinra Tensei / Almighty Push*, *Bansho Tenin*, *"Wake up to reality..."*, *"Those who break the rules are scum..."*.
- **Demon Slayer (Kimetsu no Yaiba):** *Water / Sun / Flame / Moon Breathing*, *Hinokami Kagura* (`سەمای خوداوەندی ئاگر`), *Thunderclap and Flash*, *"Set your heart ablaze!"* (`دڵت بگەشێنەوە و گڕی تێبەرە!`).
- **Dragon Ball:** *Ultra Instinct* (`غەریزەی باڵا`), *Ultra Ego*, *Super Saiyan Blue*, *Kamehameha*, *Spirit Bomb* (`گێنکی داما`), *Kaio-ken*, *Final Flash*, *"It's over 9000!"*.
- **Bleach:** *Bankai* (`بانکای`), *Getsuga Tenshou*, *Mugetsu*, *Senbonzakura Kageyoshi*, *"Since when were you under the impression that I wasn't using Kyoka Suigetsu?"*.
- **JoJo's Bizarre Adventure:** *Ora Ora Ora*, *Muda Muda Muda*, *Za Warudo (Time Stop)*, *Yare Yare Daze*, *Kono Dio Da*.
- **Solo Leveling:** *Arise* (`هەستە سەرپێ! ڕابە`), *Shadow Monarch*, *System Alert*.
- **Vinland Saga:** *"You have no enemies"*, *"A true warrior needs no sword"*.
- **Hunter x Hunter, Death Note, Code Geass & Spy x Family:** *Bungee Gum*, *Godspeed*, *"I will become the god of the new world"*, *All Hail Lelouch*, *Waku Waku*, *Spirit Gun*.

### 🎨 Cartoon Worlds & Legendary Animated Lines
- **Batman & DC Animated:** *"I am vengeance, I am the night, I am Batman!"*, *"Why do we fall? So we can learn to pick ourselves up"*, *"Riddle me this"*.
- **Spider-Man & Marvel Cartoons:** *"With great power comes great responsibility"*, *"Flame on!"*, *"It's clobberin' time!"*, *"Avengers Assemble!"*.
- **Ben 10:** *"It's Hero Time!"* (`کاتی پاڵەوانێتییە!`), *Omnitrix*, *Alien X*.
- **Transformers:** *"Autobots, roll out!"*, *"Decepticons, attack!"*, *"One shall stand, one shall fall"*.
- **SpongeBob SquarePants:** *"I'm ready!"*, *"Aye aye, Captain!"*, *"Who lives in a pineapple under the sea?"*.
- **Looney Tunes:** *"What's up, Doc?"* (`چ باسە دکتۆر؟`), *"That's all, folks!"*, *"I tawt I taw a puddy tat"*.
- **Scooby-Doo:** *Scooby-Dooby-Doo*, *Jinkies!* (`ئەی هاوار چۆن دەبێت!`), *Zoinks!*, *"And I would have gotten away with it too, if it weren't for you meddling kids"*.
- **The Simpsons:** *D'oh!* (`ئاخ لەدەستم!`), *Eat my shorts!* (`دە بڕۆ و وازم لێبێنە!`), *Ay caramba!*.
- **Avatar: The Last Airbender:** *Water, Earth, Fire, Air*, *Yip yip!*, *"There is no war in Ba Sing Se"*, *"My cabbages!"*.
- **Pokémon:** *"Gotta catch 'em all!"*, *"Pikachu, I choose you!"*, *"Prepare for trouble, and make it double!"*.
- **Disney & Pixar:** *Hakuna Matata*, *To infinity and beyond*, *Let it go*, *"You are a toy!"*.

### 🖋️ Kurdish Sorani Linguistic Precision
- **Speech Cut-off & Stutter Preservation:** Interrupted speech (*b-but*, *w-what*, *wh-*, *I-*) maps to Kurdish hyphenated connectors (`بـ-بەڵام`, `چـ-چی`, `مـ-من`, `بـ-بۆستە`).
- **Heavy R (ڕ) & Velarized L (ڵ) Rules:** Automatic phonetic restitution (e.g. `ڕۆژ`, `ڕاست`, `ماڵ`, `بەڵێ`, `خۆشحاڵ`, `منداڵ`, `سڵاو`).
- **Verbal Prefix Rejoining:** Auto-attaches separated prefixes (`دە-`, `نا-`, `نە-`, `مە-`, `هەڵ-`, `تێ-`, `پێ-`, `وەر-`, `دەر-`, `دا-`, `دەست-`).
- **Punctuation & Digits:** Converts English punctuation to Sorani standards (`,` &rarr; `،`, `;` &rarr; `؛`, `?` &rarr; `؟`) and provides an optional toggle for Eastern Arabic digits (٠١٢٣).

---

## ⚡ Core Translation & Multi-API Failover Engine

- **High-Speed Batch Architecture:** Bundles up to 40 subtitle cues per network chunk with literal sentinel line-break protection (`§§`) and non-printing delimiter markers (`\u0001`).
- **Zero-Loss Sub-Batch Halving:** If an endpoint drops a delimiter, the engine dynamically halves the batch recursively until every cue is accurately restored.
- **Failover Routing:** Seamless automatic fallback across Google Translate Web, secondary `/t` endpoints, Lingva instances, and MyMemory with jittered backoff.
- **Tag & Markup Shielding:** Protects ASS styling overrides `{\...}` and HTML tags with opaque control tokens (`\u0002id\u0003`) during transmission.

---

## 🎬 Real-Time Subtitle Player & Cinema Mode

- **Real-Time Playback Clock:** Real-time subtitle simulation without requiring a heavy local video file.
- **Playback Speed Controller:** Adjustable speed from **0.5×** to **2.0×** with audio-tick synchronizer.
- **Interactive Scannable Timeline:** Visual cue tick markers, hover timecode tooltip, and smooth seekbar scrubbing.
- **Cinema Theater Fullscreen Mode:** Distraction-free full-screen environment for reviewing subtitles against black backdrops with large Arabic typography.

---

## 📝 Live Subtitle Editor & Instant Search

- **Bi-Directional Synchronization:** Editing any cue immediately reflects on the live player screen and updates the output download payload.
- **Real-Time Filter & Search:** Search across dialogue lines, cue indices, or timestamps with match counts and <kbd>Enter</kbd> / <kbd>Shift+Enter</kbd> navigation.
- **Undo / Redo Stack:** Multi-step historical state management with standard shortcut support (<kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd>).

---

## 🔍 Kurdish Quality Inspector & Auto-Repair

- **Comprehensive Rule-Based Audit:** Analyzes all subtitle lines for:
  - Untranslated English fragments.
  - Arabic letter relics (`ك`, `ي`, `ة`, decorative Tatweel).
  - Robotic sentence starters (e.g. `ئایا`).
  - Split compound verbs and preverbs.
  - Sub-millisecond timing overlaps between consecutive cues.
- **⚡ 1-Click Auto-Polish & Repair:** Automatically executes all orthographic, dialogue naturalization, and prefix corrections across all cues simultaneously.
- **Overlap Auto-Fixer:** Automatically resolves timing collisions by trimming cue durations to maintain a clean 50ms inter-cue gap.

---

## 🎭 Character Glossary & Speaker Manager

- **Auto-Speaker Extraction:** Automatically identifies dialogue speaker markers (e.g. `LUFFY:`, `[GOJO]`, `ZORO -`).
- **Phonetic Pronunciation Tagging:** Attach customized Sorani spelling and phonetic pronunciation guides.
- **1-Click Global Substitution:** Renames characters throughout the entire subtitle file, live player, and exports.

---

## 📱 PWA Offline Engine & Diagnostics

- **Offline-First PWA:** Full offline usability powered by `sw.js` (pre-caching UI assets, fonts, icons, and player logic).
- **Network Latency Monitor:** Tests real-time API ping speeds across multiple translation endpoints.
- **Cache Management:** Fast in-app refresh, hard cache purge, and version update notifications.

---

## ⌨️ Keyboard Shortcuts Cheat Sheet

| Shortcut | Action | Context |
|---|---|---|
| <kbd>Space</kbd> | Play / Pause Subtitle Player | Player / Preview |
| <kbd>&larr;</kbd> / <kbd>&rarr;</kbd> | Seek &plusmn;5 Seconds | Player / Preview |
| <kbd>&uarr;</kbd> / <kbd>&darr;</kbd> | Jump to Previous / Next Cue | Player / Preview |
| <kbd>F</kbd> | Toggle Theater Fullscreen Mode | Player / Preview |
| <kbd>Esc</kbd> | Exit Fullscreen / Close Modals | Global |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo Last Subtitle Edit | Editor |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> / <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Redo Last Subtitle Edit | Editor |
| <kbd>Enter</kbd> | Next Search Result | Search Bar |
| <kbd>Shift</kbd> + <kbd>Enter</kbd> | Previous Search Result | Search Bar |

---

## 💻 Local Development & Deployment

The application is completely build-free, utilizing vanilla ES6 JavaScript modules with no bundlers or compilers.

```bash
# Run local development server
node server.js
# or: npm run dev

# Syntax check all JavaScript files
node --check assets/js/parser.js && node --check assets/js/translator-dict.js && node --check assets/js/translator.js && node --check assets/js/i18n.js && node --check assets/js/toast.js && node --check assets/js/player.js && node --check assets/js/app-version.js && node --check assets/js/app-tour.js && node --check assets/js/app-quality.js && node --check assets/js/app-fullscreen.js && node --check assets/js/app.js && node --check sw.js
```

### GitHub Pages Deployment
1. Push changes to the `main` branch.
2. Under repository **Settings &rarr; Pages**, select **Deploy from a branch** (`main` / root).
3. The app is immediately live at `https://<username>.github.io/<repository-name>/`.

---

## 📄 License & Community

Open-source project dedicated to Kurdish anime fansubbers, cinema translators, and linguists. Contributions, word suggestions, and feature requests are welcome!
