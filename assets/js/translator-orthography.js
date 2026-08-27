/**
 * translator-orthography.js — Kurdish Sorani Orthography, NLP & Grammar Engine.
 *
 * Handles:
 *  - Arabic-to-Kurdish character normalization (ك/ي/ة/ه -> ک/ی/ە).
 *  - Kurdish Sorani trilled Heavy R (ڕ) rules and velarized Heavy L (ڵ) rules.
 *  - Rejoining split verbal prefixes (دە، نا، نە، مە، بی، تێ، ڕێ، پێ، وەر، دەر، دا، هەڵ، دەست، لێ).
 *  - Idiomatic naturalization of subtitle dialogue (eliminating mechanical machine-translation artifacts).
 *  - Dual-script numeral normalization (ASCII vs. Kurdish-Arabic digits).
 *  - Kurdish punctuation standards (، ؛ ؟).
 *  - Text search normalization (accent/diacritic insensitive matching).
 *  - Line-by-line subtitle quality grading and suggestions.
 */
const TranslatorOrthography = (() => {
  /**
   * Reference the modularized Kurdish Subtitle Lexicon from TranslatorDict.
   */
  const ADVANCED_SUBTITLE_LEXICON = (typeof TranslatorDict !== 'undefined' && TranslatorDict.LEXICON)
    ? TranslatorDict.LEXICON
    : {
        'fuck': { kurdish: 'نەفرەت', context: 'Expletive', alternatives: ['شەیتان', 'دۆزەخ', 'سەگباب'] },
        'shut up': { kurdish: 'دەمت دابخە', context: 'Silence', alternatives: ['بێدەنگ بە', 'دەنگی خۆت ببڕە'] },
        'never mind': { kurdish: 'کێشە نییە، لەبیری کە', context: "Don't worry", alternatives: ['گرنگ نییە', 'بێ خەم بە'] },
        'get out of here': { kurdish: 'بڕۆ دەرەوە', context: 'Dismissal', alternatives: ['لەبەرچاوم ون بە', 'سەری خۆت هەڵگرە'] },
        'make yourself at home': { kurdish: 'ماڵی خۆتە', context: 'Feel comfortable', alternatives: ['ئاسوودە بە', 'تەواو بە ئاسودەیی بە'] },
      };

  /** Normalize numbers based on preference, preserving HTML/ASS tags & bracket tokens intact. */
  function normalizeDigits(str, useKurdishDigits) {
    if (!str) return '';
    if (!useKurdishDigits) {
      return str.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
                .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
    }
    // Only convert digits in plain text, skipping tags and tokens
    return str.replace(/(<[^>]*>|\{[^}]*\}|\[\s*T\s*[\d\u0660-\u0669\u06f0-\u06f9]+\s*\])|([0-9\u06f0-\u06f9]+)/gi, (m, tag, nums) => {
      if (tag) return tag;
      return nums.replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)))
                 .replace(/[\u06f0-\u06f9]/g, (d) => String.fromCharCode(0x0660 + (d.charCodeAt(0) - 0x06f0)));
    });
  }

  /** Normalize Arabic characters to Kurdish Sorani alphabet & orthography conventions. */
  function normalizeSoraniAlphabet(str) {
    if (!str) return '';
    let s = str.replace(/\u0643/g, 'ک')   // Arabic Kaf 'ك' -> Kurdish Keheh 'ک'
               .replace(/\u064A/g, 'ی')   // Arabic Yaa 'ي' -> Kurdish Yeh 'ی'
               .replace(/\u0649/g, 'ی')   // Arabic Alef Maksura 'ى' -> 'ی'
               .replace(/\u0629/g, 'ە')   // Arabic Teh Marbuta 'ة' -> Kurdish Small E 'ە'
               .replace(/[\u06BE\u06C1]/g, 'ه'); // Urdu/Arabic Heh variants -> 'ه'

    // Convert Arabic Heh 'ه' to Kurdish Small E 'ە' at word endings where appropriate (after consonants/non-vowels)
    s = s.replace(/([\u0600-\u06ff])ه(?=\s|$|[.,!?;:،؛؟])/g, (m, p) =>
      (p !== 'ئ' && p !== 'ا' && p !== 'و' && p !== 'ۆ' && p !== 'ە' && p !== 'ێ' && p !== 'ڕ' ? p + 'ە' : m)
    );

    // Fundamental Kurdish Sorani rule: All word-initial R letters are trilled Heavy R (ڕ)
    s = s.replace(/(^|[\s،؛؟.\n(«"'\[{<])ر(?=[\u0600-\u06ff])/gu, '$1ڕ');

    // Specific Kurdish words starting with / containing Heavy R (ڕ)
    s = s.replace(/(^|\s)رویشت(ن|م|ی|ین|ن|ووە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆیشت$2')
         .replace(/(^|\s)رۆیشت(ن|م|ی|ین|ن|ووە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆیشت$2')
         .replace(/(^|\s)رۆشت(ن|م|ی|ین|ن|ووە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆیشت$2')
         .replace(/(^|\s)رۆ(م|یت|ات|ین|ن)(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆ$2')
         .replace(/(^|\s)راست(ە|ی|ەقینە|ەوخۆ|ەکان|کردنەوە|ییەکەی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاست$2')
         .replace(/(^|\s)رێگ(ە|ا|ای|اکە|ایەک|ەی|اکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێگ$2')
         .replace(/(^|\s)رۆژ(انە|گار|باش|نامە|ی|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆژ$2')
         .replace(/(^|\s)رەنگ(ە|ی|اوڕەنگ|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەنگ$2')
         .replace(/(^|\s)رێز(لێنان|م|ت|تان|گرتن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێز$2')
         .replace(/(^|\s)روون(کردنەوە|اک|اکی|ی|کردنەوەی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕوون$2')
         .replace(/(^|\s)رەش(ی|بین|ەبا|ماڵ)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەش$2')
         .replace(/(^|\s)روو(داو|دات|دەدات|ی|خسار|خاو|بەڕوو|داوەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕوو$2')
         .replace(/(^|\s)راپۆرت(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاپۆرت$2')
         .replace(/(^|\s)راگەیاندن(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاگەیاندن$2')
         .replace(/(^|\s)راگەیەندراو(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاگەیەندراو')
         .replace(/(^|\s)رێنمایی(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێنمایی$2')
         .replace(/(^|\s)رێژە(ی|یی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێژە$2')
         .replace(/(^|\s)رزگار(کردن|بوون|بووم)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕزگار$2')
         .replace(/(^|\s)رازی(بوون|م)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕازی$2')
         .replace(/(^|\s)رێبوار(ان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێبوار$2')
         .replace(/(^|\s)رابردوو(ی|دا)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕابردوو$2')
         .replace(/(^|\s)رێپێدان(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێپێدان')
         .replace(/(^|\s)رەوانە(کردن|کرا)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەوانە$2')
         .replace(/(^|\s)رەوشت(ی|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەوشت$2')
         .replace(/(^|\s)رەخنە(گرتن|یەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەخنە$2')
         .replace(/(^|\s)روانین(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕوانین$2')
         .replace(/(^|\s)راهێنان(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاهێنان$2')
         .replace(/(^|\s)راکردن(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاکردن')
         .replace(/(^|\s)راگرتن(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاگرتن')
         .replace(/(^|\s)رێکخستن(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێکخستن$2')
         .replace(/(^|\s)رێکەوتن(نامە|ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێکەوتن$2')
         .replace(/(^|\s)رێسا(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێسا$2')
         .replace(/(^|\s)رۆح(ی|مان|تان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆح$2')
         .replace(/(^|\s)رەوش(ی|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەوش$2')
         .replace(/(^|\s)رێبەر(ی|یکردن|ان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێبەر$2')
         .replace(/(^|\s)رەگ(ی|ەکان|داکوتان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەگ$2')
         .replace(/(^|\s)رووت(ی|کراوە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕووت$2')
         .replace(/(^|\s)رەق(ی|تر|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەق$2')
         .replace(/(^|\s)رق(م|ت|ی|لێبوونەوە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕق$2')
         .replace(/(^|\s)رژێم(ی|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕژێم$2')
         .replace(/(^|\s)راوەست(ە|ان|ین|ن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاوەست$2')
         .replace(/(^|\s)راکە(ن|یت)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاکە$2')
         .replace(/(^|\s)رێنووس(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێنووس')
         .replace(/(^|\s)ریش(ەکە|م|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕیش$2')
         .replace(/(^|\s)ریشە(ی|کان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕیشە$2')
         .replace(/(^|\s)برۆ(ن|یت)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕۆ$2')
         .replace(/(^|\s)مەرۆ(ن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1مەڕۆ$2')
         .replace(/(^|\s)دەرۆ(م|یت|ات|ین|ن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1دەڕۆ$2')
         .replace(/(^|\s)دەروات(?=\s|$|[.,!?;:،؛؟])/g, '$1دەڕوات')
         .replace(/(^|\s)نەروات(?=\s|$|[.,!?;:،؛؟])/g, '$1نەڕوات')
         .replace(/(^|\s)نەرۆ(م|یت|ات|ین|ن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1نەڕۆ$2')
         .replace(/(^|\s)کوری(?=\s|$|[.,!?;:،؛؟])/g, '$1کوڕی')
         .replace(/(^|\s)کور(?=\s|$|[.,!?;:،؛؟])/g, '$1کوڕ')
         .replace(/(^|\s)بریار(دان|ەکان|ی|م|ت)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕیار$2')
         .replace(/(^|\s)بروانە(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕوانە')
         .replace(/(^|\s)بروام(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕوام')
         .replace(/(^|\s)بروابکە(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕوابکە')
         .replace(/(^|\s)بروا(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕوا')
         .replace(/(^|\s)بروانامە(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕوانامە$2')
         .replace(/(^|\s)زور(?=\s|$|[.,!?;:،؛؟])/g, '$1زۆر')
         .replace(/گۆرانکاری/g, 'گۆڕانکاری')
         .replace(/سپاس/g, 'سوپاس');

    // Sorani Kurdish Velarized L (ڵ) corrections
    s = s.replace(/(^|\s)مال(ی|ەوە|مان|تان|یان|ەکەم|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ماڵ$2')
         .replace(/(^|\s)بەلێ(م)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بەڵێ$2')
         .replace(/(^|\s)دەلێ(ت|م|ن|یت|ین)(?=\s|$|[.,!?;:،؛؟])/g, '$1دەڵێ$2')
         .replace(/(^|\s)بلێ(ن|م|یت|ین)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بڵێ$2')
         .replace(/(^|\s)گول(م|ەکان|ی|زار)?(?=\s|$|[.,!?;:،؛؟])/g, '$1گوڵ$2')
         .replace(/(^|\s)سال(ان|ی|ە|انە|ێک|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ساڵ$2')
         .replace(/خۆشحال(ی|ییە| بووم|م)?/g, 'خۆشحاڵ$1')
         .replace(/(^|\s)مندال(ان|ەکە|م|ی|بوون|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1منداڵ$2')
         .replace(/(^|\s)سلاو(تان|ی|ت)?(?=\s|$|[.,!?;:،؛؟])/g, '$1سڵاو$2')
         .replace(/(^|\s)گەلا(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1گەڵا$2')
         .replace(/(^|\s)کەلەک(ەم|ی|ە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵەک$2')
         .replace(/(^|\s)چۆل(ە|ی|کردن|ەوانی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1چۆڵ$2')
         .replace(/(^|\s)تەلە(ی|کان|کە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1تەڵە$2')
         .replace(/(^|\s)خال(ی|م|ەکان|ۆ)?(?=\s|$|[.,!?;:،؛؟])/g, '$1خاڵ$2')
         .replace(/(^|\s)تال(ە|ی|تر|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1تاڵ$2')
         .replace(/(^|\s)پیالە(ی|یک|کان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1پیاڵە$2')
         .replace(/(^|\s)دل(م|ت|ی|خۆش|تەنگ|نیام|نیابە|نیا|سۆز|پاک|داری)?(?=\s|$|[.,!?;:،؛؟])/g, '$1دڵ$2')
         .replace(/(^|\s)پۆلا(?=\s|$|[.,!?;:،؛؟])/g, '$1پۆڵا')
         .replace(/(^|\s)قولپ(?=\s|$|[.,!?;:،؛؟])/g, '$1قوڵپ')
         .replace(/(^|\s)کەلەشێر(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵەشێر')
         .replace(/(^|\s)کەلک(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵک')
         .replace(/(^|\s)کەلەپوور(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵەپوور')
         .replace(/(^|\s)خەلوز(?=\s|$|[.,!?;:،؛؟])/g, '$1خەڵووز')
         .replace(/(^|\s)چەپەل(?=\s|$|[.,!?;:،؛؟])/g, '$1چەپەڵ')
         .replace(/(^|\s)بالا(بەرز)?(?=\s|$|[.,!?;:،؛؟])/g, '$1باڵا$2')
         .replace(/(^|\s)قەلا(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1قەڵا$2')
         .replace(/(^|\s)چەپلە(?=\s|$|[.,!?;:،؛؟])/g, '$1چەپڵە')
         .replace(/(^|\s)کۆمەل(گا|ایەتی|ەکان|ی|ە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1کۆمەڵ$2')
         .replace(/(^|\s)ئالۆز(ی|تر)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ئاڵۆز$2')
         .replace(/(^|\s)هەلە(کان|ی|یە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵە$2')
         .replace(/(^|\s)تێکەل(کردن|او)?(?=\s|$|[.,!?;:،؛؟])/g, '$1تێکەڵ$2')
         .replace(/(^|\s)گەلالە(?=\s|$|[.,!?;:،؛؟])/g, '$1گەڵاڵە')
         .replace(/(^|\s)کۆلان(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1کۆڵان$2')
         .replace(/(^|\s)قوول(ی|تر|ایی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1قووڵ$2')
         .replace(/(^|\s)قول(ی|تر|ایی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1قووڵ$2')
         .replace(/(^|\s)بالندە(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1باڵندە$2')
         .replace(/(^|\s)ئالا(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ئاڵا$2')
         .replace(/(^|\s)خەلک(ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1خەڵک$2')
         .replace(/(^|\s)خەلات(کردن|ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1خەڵات$2')
         .replace(/(^|\s)بەلگە(نامە|کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بەڵگە$2')
         .replace(/(^|\s)بەلێن(دان|ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بەڵێن$2')
         .replace(/(^|\s)شەپۆل(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1شەپۆڵ$2')
         .replace(/(^|\s)خۆل(ەمێش|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1خۆڵ$2')
         .replace(/(^|\s)قەلەم(?=\s|$|[.,!?;:،؛؟])/g, '$1قەڵەم')
         .replace(/(^|\s)کەلەگا(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵەگا')
         .replace(/(^|\s)تۆپەل(?=\s|$|[.,!?;:،؛؟])/g, '$1تۆپەڵ')
         .replace(/(^|\s)چقل(?=\s|$|[.,!?;:،؛؟])/g, '$1چقڵ')
         .replace(/(^|\s)هەلبژاردن(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵبژاردن')
         .replace(/(^|\s)هەلسان(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵسان')
         .replace(/(^|\s)هەلگرتن(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵگرتن')
         .replace(/(^|\s)هەلهاتن(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵهاتن')
         .replace(/(^|\s)هەلمەت(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵمەت')
         .replace(/(^|\s)هەلوێست(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵوێست')
         .replace(/(^|\s)هەلکەوتوو(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵکەوتوو')
         .replace(/(^|\s)هەلچوون(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵچوون')
         .replace(/(^|\s)هەلسەنگاندن(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵسەنگاندن')
         .replace(/(^|\s)هەلوەشاندنەوە(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵوەشاندنەوە');

    return s;
  }

  /** Rejoin split Sorani Kurdish verbal affixes & compound preverbs. */
  function rejoinVerbalAffixes(str) {
    if (!str) return '';
    return str
      .replace(/(^|\s)دە\s+(بێت|بم|بیت|بین|بن|زانم|زانی|زانێت|زانین|زانن|کات|کەم|کەیت|کەین|کەن|توانی|توانم|توانێت|توانین|توانن|چێت|چم|چیت|چین|چن|ڕۆم|رۆم|ڕۆیت|رۆیت|ڕوات|روات|ڕۆین|رۆین|ڕۆن|رۆن|ڵێت|ڵێم|ڵێیت|ڵێین|ڵێن|هێنێت|هێنم|هێنیت|هێنین|هێنن|یەوێت|خوات|خۆم|خۆین|خۆن|کراو|بینم|بینێت|بینین|بینن|وەستێت|گەڕێتەوە|نووسێت|نووسم|نووسین|دات|دەین|بەن|بەین|دێت|دەبێتەوە|فرۆشێت|کڕێت|ژیم|ژیت|ژی|ژیین|ژین|مرێت|بیستێت|گرێت|بەستێت|گەین|کەویت|بارێت|گۆڕێت|بەخشێت|شارێتەوە|ڕژێت|نێرێت|ناسێت|کوژێت|پارێزێت|سووتێت|تەقێت|ترسێت|فڕێت|پشکنێت|ڕوانێت)(?=\s|$|[.,!?;:،؛؟])/g, '$1دە$2')
      .replace(/(^|\s)ئە\s+(بێت|بم|بیت|بین|بن|زانم|زانی|زانێت|کات|کەم|کەیت|کەین|چێت|چم|چیت|چین|ڕۆم|ڕۆیت|ڕوات|ڕۆین|ڵێت|ڵێم|هێنێت|هێنم|یەوێت|خوات|خۆم|بینم|بینێت|دات|دێت)(?=\s|$|[.,!?;:،؛؟])/g, '$1ئە$2')
      .replace(/(^|\s)نا\s+(زانم|زانی|زانێت|زانین|زانن|کات|کەم|کەیت|کەن|بێت|بم|بیت|بین|بن|کرێت|کرێن|توانی|توانم|توانێت|توانین|توانن|چێت|چم|چیت|چین|چن|ڵێم|ڵێت|ڵێن|گەڕێتەوە|بینم|بینێت|وێت|نامەوێت|ناوێت|خۆم|خوات|دات|نادەم|دەین|کەوم|کەوێت|ڕوات|روات|مرێت|بیستم|بیستێت|ڕۆم|ڕۆیت|ڕۆین|ڕۆن|نووسم|فرۆشم|کڕم|گەم|گۆڕێت|ناسم|کوژم|پارێزم)(?=\s|$|[.,!?;:،؛؟])/g, '$1نا$2')
      .replace(/(^|\s)نە\s+(بێت|کات|کرێت|بوو|بووم|بوویت|بووین|بوون|ڕۆیشت|رویشت|هات|هاتم|هاتیت|هاتین|هاتن|زانی|زانیم|زانیت|توانی|دیت|کرد|کردم|کردت|کردمان|چوو|چووم|چوویت|چووین|چوون|گەیی|گەیشت|دەبوو|بینرا|خورا|کوژرا|شکێنرا|خوێندەوە|فرۆشت|ناسرا|دۆزرایەوە)(?=\s|$|[.,!?;:،؛؟])/g, '$1نە$2')
      .replace(/(^|\s)مە\s+(کە|ڕۆ|رۆ|کەیت|بۆوە|چۆ|چن|بڕۆ|برۆ|گەڕێ|بە|بن|کەن|ترسە|ترسن|گری|گرین|شکێنە|کوژە|خۆ|خۆن|دە|دەن|هێنە|نووسە|گرە|بڕە|خوێنەوە|بەخشە|شارەوە|دەستنیشانکە)(?=\s|$|[.,!?;:،؛؟])/g, '$1مە$2')
      .replace(/(^|\s)بی\s+(کە|بە|بینە|گەیەنە|خۆ|نووسە|هێنە|بەخشە|پارێزە|کوژە|دە|خوێنەوە|شکێنە|دۆزەرەوە|پشکنە|گرە)(?=\s|$|[.,!?;:،؛؟])/g, '$1بی$2')
      .replace(/(^|\s)تێ\s+(دەگەم|بگە|دەگەیت|دەگەن|دەگەین|پەڕی|پەڕین|ناگەم|پەڕیوە|گەیشتم|گەیشتین)(?=\s|$|[.,!?;:،؛؟])/g, '$1تێ$2')
      .replace(/(^|\s)ڕێ\s+(گرتن|دەگرێت|بگرە|ناگرێت|بگرن|کەوتن|کەوتین|کەوتنەوە|کەوتووە)(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێ$2')
      .replace(/(^|\s)پێ\s+(دان|دەدات|دەڵێت|دەبەخشێت|بڵێ|بڵێن|بدە|نادەم|نادات|بەخشی|مبڵێ|یبڵێ|مانبڵێ|یانبڵێ|موایە|مباشە|مخۆشە|تانخۆشە)(?=\s|$|[.,!?;:،؛؟])/g, '$1پێ$2')
      .replace(/(^|\s)وەر\s+(بگرە|گرتن|دەگرێت|ناگرێت|مەگرە|گیرا|گیراوە)(?=\s|$|[.,!?;:،؛؟])/g, '$1وەر$2')
      .replace(/(^|\s)دەر\s+(کەوت|کەوتن|چوون|چوونی|بێنە|هێنانی|دەچێت|دەخات|دەکەوێت|کەوتووە|هێنان)(?=\s|$|[.,!?;:،؛؟])/g, '$1دەر$2')
      .replace(/(^|\s)دا\s+(نیشە|دەنیشێت|پۆشە|خستن|داخە|دابخە|گرتن|بەزین|بەزی|مەپۆشە|نان)(?=\s|$|[.,!?;:،؛؟])/g, '$1دا$2')
      .replace(/(^|\s)[هھ]ەڵ\s+(بگرە|ستە|دەستێت|گرتن|گرە|بژێرە|بڕژێ|کشان|واسە|مەگرە|سان|دڕین|سوڕان|قووڵین|مژین)(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵ$2')
      .replace(/(^|\s)دەست\s+(پێکرد|پێبکە|پێدەکات|پێکردن|پێ بگە|بەردار|نیشان|پێکە)(?=\s|$|[.,!?;:،؛؟])/g, '$1دەست$2')
      .replace(/(^|\s)لێ\s+(پرسینەوە|کردنەوە|گەڕێ|دەگەڕێت|بدە|دایت|ستاندن|بوردن|دەبورێت)(?=\s|$|[.,!?;:،؛؟])/g, '$1لێ$2')
      .replace(/(^|\s)(من|تۆ|ئەو|ئێمە|ئێوە|ئەوان|خۆم|خۆت|خۆی|ئەم|ئەمە|ئەوە|کار|شت)\s+یش(?=\s|$|[.,!?;:،؛؟])/g, '$1$2یش')
      .replace(/([\p{L}\u0600-\u06FF]+)\s+ترین(?=\s|$|[.,!?;:،؛؟])/gu, '$1ترین');
  }

  /** Naturalize machine-translated subtitle dialogue for fluent Sorani Kurdish. */
  function naturalizeDialogue(str) {
    if (!str) return '';
    let res = str
      // Remove mechanical, non-dialogue question particle "ئایا" at start of sentences
      .replace(/(^|[\s،؛؟.\n])ئایا\s+/g, '$1')
      .replace(/ئۆ خوای من/g, 'ئەی خوایە')
      .replace(/خوای من/g, 'ئەی خوایە')
      .replace(/ئەی خوای گەورە/g, 'ئەی خوایە')
      .replace(/ئۆهـ خوای من/g, 'ئەی خوایە')
      .replace(/سەیر بکە،/g, 'سەیرکە،')
      .replace(/سەیر بکە/g, 'سەیرکە')
      .replace(/من زۆر سوپاستان دەکەم/g, 'زۆر سوپاس')
      .replace(/هیچ کێشەیەک نییە/g, 'کێشە نییە')
      .replace(/کێشەیەک نییە/g, 'کێشە نییە')
      .replace(/بە دڵنیاییەوە/g, 'بێگومان')
      .replace(/سوپاس بۆ تۆ/g, 'سوپاس')
      .replace(/زۆر سوپاس بۆ تۆ/g, 'زۆر سوپاس')
      .replace(/بە ڵێ/g, 'بەڵێ')
      .replace(/بەل ێ/g, 'بەڵێ')
      .replace(/دە ڵێ/g, 'دەڵێ')
      .replace(/سو پاس/g, 'سوپاس')
      .replace(/س ڵاو/g, 'سڵاو')
      .replace(/سڵا و/g, 'سڵاو')
      .replace(/خۆ شحاڵ/g, 'خۆشحاڵ')
      .replace(/خۆش حاڵ/g, 'خۆشحاڵ')
      .replace(/خۆشحاڵم بتبینم/g, 'خۆشحاڵم بە بینینت')
      .replace(/بێ گومان/g, 'بێگومان')
      .replace(/لە کوێ/g, 'لەکوێ')
      .replace(/بۆ چی/g, 'بۆچی')
      .replace(/لە بەر/g, 'لەبەر')
      .replace(/لە گەڵ/g, 'لەگەڵ')
      .replace(/بە تایبەت/g, 'بەتایبەت')
      .replace(/بە ڕاستی/g, 'بەڕاستی')
      .replace(/لە ڕاستیدا/g, 'لەڕاستیدا')
      .replace(/بێ ئەوەی/g, 'بێئەوەی')
      .replace(/لەبەر ئەوەی/g, 'لەبەرئەوەی')
      .replace(/لێ ببوورە/g, 'لێببوورە')
      .replace(/لێ ببوورن/g, 'لێببوورن')
      .replace(/سەر کەوتن/g, 'سەرکەوتن')
      .replace(/سەر دەکەوێت/g, 'سەردەکەوێت')
      .replace(/تێک دان/g, 'تێکدان')
      .replace(/تێک دەدات/g, 'تێکدەدات')
      .replace(/پێک هاتن/g, 'پێکهاتن')
      .replace(/پێک دەهێنێت/g, 'پێکهێنێت')
      .replace(/بە جێ هێشتن/g, 'بەجێهێشتن')
      .replace(/دەست پێ کردن/g, 'دەستپێکردن')
      .replace(/دەست پێ دەکات/g, 'دەستپێدەکات')
      .replace(/چاودێری کردن/g, 'چاودێریکردن')
      .replace(/یارمەتی دان/g, 'یارمەتیدان')
      .replace(/دە بارەی/g, 'دەربارەی')
      .replace(/دەربارە ی/g, 'دەربارەی')
      .replace(/ڕاستە قینە/g, 'ڕاستەقینە')
      .replace(/پێش ئەوە ی/g, 'پێش ئەوەی')
      .replace(/پاش ئەوە ی/g, 'پاش ئەوەی')
      .replace(/هەر چەندە/g, 'هەرچەندە')
      .replace(/هەر وەها/g, 'هەروەها')
      .replace(/هەر یەک/g, 'هەریەک')
      .replace(/هەر ئێستا/g, 'هەرئێستا')
      .replace(/هەر چۆنێک بێت/g, 'هەرچۆنێک بێت')
      .replace(/لە ئێستادا/g, 'لەئێستادا')
      .replace(/لە ڕاستیدا/g, 'لەڕاستیدا')
      .replace(/بە شێوەیەکی گشتی/g, 'بەگشتی')
      .replace(/بە هیچ شێوەیەک/g, 'بەهیچ شێوەیەک')
      .replace(/جێگای داخە/g, 'بەداخەوە')
      .replace(/بەداخەوەم/g, 'بەداخەوە')
      .replace(/(^|[\s،؛؟.\n])تۆ لە کوێیت(?=\s|$|[.,!?;:،؛؟])/g, '$1لەکوێیت')
      .replace(/(^|[\s،؛؟.\n])لە کوێیت تۆ(?=\s|$|[.,!?;:،؛؟])/g, '$1لەکوێیت')
      .replace(/(^|[\s،؛؟.\n])چۆنیت تۆ(?=\s|$|[.,!?;:،؛؟])/g, '$1چۆنیت')
      .replace(/(^|[\s،؛؟.\n])تۆ چۆنیت(?=\s|$|[.,!?;:،؛؟])/g, '$1چۆنیت')
      .replace(/(^|[\s،؛؟.\n])تۆ کێیت(?=\s|$|[.,!?;:،؛؟])/g, '$1کێیت')
      .replace(/(^|[\s،؛؟.\n])کێیت تۆ(?=\s|$|[.,!?;:،؛؟])/g, '$1کێیت')
      .replace(/بەخێر بێیت/g, 'بەخێربێیت')
      .replace(/بەخێر بێن/g, 'بەخێربێن')
      .replace(/دەستت خۆش بێت/g, 'دەستت خۆش')
      .replace(/خۆشحاڵ بووم بتبینم/g, 'خۆشحاڵ بووم بە بینینت')
      .replace(/ڕۆژ باش/g, 'ڕۆژباش')
      .replace(/شەو باش/g, 'شەوباش')
      .replace(/بەیانی باش/g, 'بەیانیباش')
      .replace(/ماڵ ئاوا/g, 'ماڵئاوا')
      .replace(/سوپاس گوزارم/g, 'سوپاسگوزارم')
      .replace(/لە دەست دان/g, 'لەدەستدان')
      .replace(/لە بیر کردن/g, 'لەبیرکردن')
      .replace(/لە یاد کردن/g, 'لەیادکردن')
      .replace(/لە ناو بردن/g, 'لەناوبردن')
      .replace(/لە خەو هەڵسان/g, 'لەخەوهەڵسان')

      // Drop redundant subjective pronouns in conversational Sorani Kurdish
      .replace(/(^|[\s،؛؟.\n])من نازانم(?=\s|$|[.,!?;:،؛؟])/g, '$1نازانم')
      .replace(/(^|[\s،؛؟.\n])من دەزانم(?=\s|$|[.,!?;:،؛؟])/g, '$1دەزانم')
      .replace(/(^|[\s،؛؟.\n])من دەبێت(?=\s|$|[.,!?;:،؛؟])/g, '$1دەبێت')
      .replace(/(^|[\s،؛؟.\n])من دڵنیام(?=\s|$|[.,!?;:،؛؟])/g, '$1دڵنیام')
      .replace(/(^|[\s،؛؟.\n])من پێم وایە(?=\s|$|[.,!?;:،؛؟])/g, '$1پێم وایە')
      .replace(/(^|[\s،؛؟.\n])من دەمەوێت(?=\s|$|[.,!?;:،؛؟])/g, '$1دەمەوێت')
      .replace(/(^|[\s،؛؟.\n])تۆ دەتوانیت(?=\s|$|[.,!?;:،؛؟])/g, '$1دەتوانیت')
      .replace(/(^|[\s،؛؟.\n])ئێمە دەتوانین(?=\s|$|[.,!?;:،؛؟])/g, '$1دەتوانین')

      // Fix machine-translated word-for-word idioms into fluid Sorani dialogue
      .replace(/ئەوەیە بۆچی/g, 'بۆیە')
      .replace(/ئەوەیە چۆن/g, 'ئاوا')
      .replace(/ئەوەیە کاتێک/g, 'ئەو کاتەی')
      .replace(/ئەوەیە لە کوێ/g, 'لەوێیە کە')
      .replace(/هیچ شتێک نییە/g, 'هیچ نییە')
      .replace(/لێ ى/g, 'لێی')
      .replace(/پێ ى/g, 'پێی')
      .replace(/تێ ى/g, 'تێی')
      .replace(/بۆ ى/g, 'بۆی')
      .replace(/پێ م/g, 'پێم')
      .replace(/لێ م/g, 'لێم')
      .replace(/تێ م/g, 'تێم')
      .replace(/بۆ م/g, 'بۆم')
      .replace(/خۆت لە ماڵەوە بکە/g, 'ماڵی خۆتە')
      .replace(/وەک ماڵی خۆت ڕەفتار بکە/g, 'وەک ماڵی خۆت تەماشای بکە')
      .replace(/وەک ماڵی خۆت سەیر بکە/g, 'وەک ماڵی خۆت تەماشای بکە')
      .replace(/پشوویەکم پێ بدە/g, 'لێم گەڕێ')
      .replace(/لەسەر جەستەی مردووم/g, 'لەسەر تەرمەکەم')
      .replace(/تۆ دەبێت گاڵتەم پێبکەیت/g, 'گاڵتەم لەگەڵ دەکەیت')
      .replace(/تۆ دەبێت گاڵتە بکەیت/g, 'گاڵتەم لەگەڵ دەکەیت')
      .replace(/هەرگیز لە پێش چاوم ڕوونادات/g, 'تا من لێرەبم مەحاڵە')
      .replace(/لە پێش چاوی مندا نا/g, 'تا من لێرەبم مەحاڵە')
      .replace(/چاوەڕێم بە/g, 'چاوەڕێم بکە')
      .replace(/گوێت لە منە/g, 'گوێت لێمە')
      .replace(/گوێت لە من نییە/g, 'گوێت لێم نییە')
      .replace(/سەرت لە کڵاوی خۆت بێت/g, 'دەست لە کارمەوە مەدە')
      .replace(/تەنها بۆ یەک سات/g, 'تەنها بۆ ساتێک')
      .replace(/لە لایەن/g, 'لەلایەن')
      .replace(/لە کاتێکدا/g, 'لەکاتێکدا')
      .replace(/لە هەمان کاتدا/g, 'لەهەمان کاتدا')
      .replace(/لە شوێنی/g, 'لەشوێنی')
      .replace(/پشت بەستن/g, 'پشتبەستن')
      .replace(/خۆ ڕاگرتن/g, 'خۆڕاگرتن')
      .replace(/خۆ بەدەستەوەدان/g, 'خۆبەدەستەوەدان')
      .replace(/سەر سووڕمان/g, 'سەرسوڕمان')
      .replace(/دەست بەجێ/g, 'دەستبەجێ')
      .replace(/جێ بەجێ/g, 'جێبەجێ')
      .replace(/ڕێ پێ دان/g, 'ڕێپێدان')
      .replace(/تێ پەڕین/g, 'تێپەڕین')
      .replace(/ڕوو بەڕوو/g, 'ڕووبەڕوو')
      .replace(/دوور کەوتنەوە/g, 'دوورکەوتنەوە')
      .replace(/نزیک بوونەوە/g, 'نزیکبوونەوە')
      .replace(/کۆ بوونەوە/g, 'کۆبوونەوە')
      .replace(/بڵاو بوونەوە/g, 'بڵاوبوونەوە')
      .replace(/هەست پێ کردن/g, 'هەستپێکردن')
      .replace(/ئاگادار کردنەوە/g, 'ئاگادارکردنەوە')
      .replace(/بڕیار دان/g, 'بڕیاردان')
      .replace(/ڕزگار کردن/g, 'ڕزگارکردن')
      .replace(/لە ناو چوون/g, 'لەناوچوون')
      .replace(/پێشکەش کردن/g, 'پێشکەشکردن')
      .replace(/قبووڵ کردن/g, 'قبووڵکردن')
      .replace(/تێ گەیشتن/g, 'تێگەیشتن')
      .replace(/تێ گەیشتم/g, 'تێگەیشتم')
      .replace(/تێ ناگەم/g, 'تێناگەم')
      .replace(/دەست نیشان کردن/g, 'دەستنیشانکردن')
      .replace(/پشت گوێ خستن/g, 'پشتگوێخستن')
      .replace(/ڕوون کردنەوە/g, 'ڕوونکردنەوە')
      .replace(/چاو پۆشی/g, 'چاوپۆشی')
      .replace(/سوێند خواردن/g, 'سوێندخواردن')
      .replace(/دژایەتی کردن/g, 'دژایەتیکردن')
      .replace(/هاوکاری کردن/g, 'هاوکاریکردن')
      .replace(/خۆش ویستن/g, 'خۆشویستن')
      .replace(/خۆش دەوێت/g, 'خۆشدەوێت')
      .replace(/خۆشم دەوێیت/g, 'خۆشم دەوێیت')

      // Strip robotic formal Arabic question particles (ئایا) in subtitle speech
      .replace(/(^|[\s،؛؟.\n])ئایا\s+(تۆ\s+)?باشیت(?=\s|$|[.,!?;:،؛؟])/g, '$1باشیت')
      .replace(/(^|[\s،؛؟.\n])ئایا\s+دەتوانیت(?=\s|$|[.,!?;:،؛؟])/g, '$1دەتوانیت')
      .replace(/(^|[\s،؛؟.\n])ئایا\s+ئەوە(?=\s|$|[.,!?;:،؛؟])/g, '$1ئەوە')
      .replace(/(^|[\s،؛؟.\n])ئایا\s+کێشەیەک\s+هەیە(?=\s|$|[.,!?;:،؛؟])/g, '$1کێشەیەک هەیە')
      .replace(/(^|[\s،؛؟.\n])ئایا\s+(تۆ\s+)?لەگەڵمندایت(?=\s|$|[.,!?;:،؛؟])/g, '$1لەگەڵمدایت')
      .replace(/(^|[\s،؛؟.\n])ئایا\s+/g, '$1')

      // Naturalize obligations and belief expressions
      .replace(/(^|[\s،؛؟.\n])پێویستە لەسەرت(?=\s|$|[.,!?;:،؛؟])/g, '$1دەبێت')
      .replace(/(^|[\s،؛؟.\n])پێویستە لەسەرم(?=\s|$|[.,!?;:،؛؟])/g, '$1دەبێت')
      .replace(/(^|[\s،؛؟.\n])پێویستە لەسەرمان(?=\s|$|[.,!?;:،؛؟])/g, '$1دەبێت')
      .replace(/(^|[\s،؛؟.\n])من ناتوانم بڕوا بکەم(?=\s|$|[.,!?;:،؛؟])/g, '$1باوەڕ ناکەم')
      .replace(/(^|[\s،؛؟.\n])ناتوانم بڕوا بکەم(?=\s|$|[.,!?;:،؛؟])/g, '$1باوەڕ ناکەم')
      .replace(/(^|[\s،؛؟.\n])بڕوا ناکەم(?=\s|$|[.,!?;:،؛؟])/g, '$1باوەڕ ناکەم')
      .replace(/(^|[\s،؛؟.\n])بڕوام پێ بکە(?=\s|$|[.,!?;:،؛؟])/g, '$1متمانەم پێ بکە')
      .replace(/(^|[\s،؛؟.\n])بڕوام پێ ناکەیت(?=\s|$|[.,!?;:،؛؟])/g, '$1باوەڕم پێ ناکەیت')
      .replace(/بەردەوام بوون/g, 'بەردەوامبوون')
      .replace(/سەر لێ شێواو/g, 'سەرلێشێواو')
      .replace(/دڵ تەنگ/g, 'دڵتەنگ')
      .replace(/دڵ خۆش/g, 'دڵخۆش')
      .replace(/چاوەڕوان نەکراو/g, 'چاوەڕواننەکراو')
      .replace(/جێگەی سەرنج/g, 'جێگای سەرنج')
      .replace(/جێگەی شانازی/g, 'جێگای شانازی')
      .replace(/دەستبەردار بە/g, 'دەستبەرداربە')
      .replace(/دەست بەردار بە/g, 'دەستبەرداربە')
      .replace(/بە هیچ جۆرێک/g, 'بەهیچ جۆرێک')
      .replace(/ئاگاداری خۆت بە/g, 'ئاگات لە خۆت بێت')
      .replace(/تکایە بمبورە/g, 'تکایە ببوورە')
      .replace(/بمبورە/g, 'ببوورە')
      .replace(/تۆ دەتوانیت بیکەیت/g, 'دەتوانیت بیکەیت')
      .replace(/من دەتوانم بیکەم/g, 'دەتوانم بیکەم');

    return res;
  }

  /**
   * Clean up Google's typography and grammar for a subtitle line, applying Sorani Kurdish
   * conventions (r12a orthography notes / Kurdish Academy & subtitle natural dialogue):
   *  - remove stray space before punctuation ("word !" -> "word!")
   *  - pull punctuation that landed on its own line up to the previous line
   *  - normalize Eastern numbers to ASCII or Kurdish numbers based on preference
   *  - convert Arabic characters to Kurdish equivalents (Kaf, Yaa, Teh Marbuta, Heh)
   *  - join split Sorani verbal prefixes/affixes
   *  - naturalize subtitle conversational dialogue
   *  - clean up leftover untranslated English words and handle speech cut-offs
   *  - use Arabic script marks: comma "،", semicolon "؛", question "؟"
   */
  function normalizeText(text, isArabic = true, useKurdishDigits = false) {
    if (!text) return '';
    let t = text
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .replace(/[ \t]+([.,!?;:،؛؟]+)/g, '$1')
      .replace(/\n+([.,!?;:،؛؟]+)/g, '$1');

    if (isArabic) {
      // Strip Arabic short vowel diacritics / Harakat & Tatweel
      t = t.replace(/[\u064b-\u0652\u0670]/g, '').replace(/\u0640/g, '');

      // Normalize digits
      t = normalizeDigits(t, useKurdishDigits);

      // Kurdish alphabet normalization
      t = normalizeSoraniAlphabet(t);

      // Rejoin split Sorani Kurdish verbal affixes
      t = rejoinVerbalAffixes(t);

      // Naturalize dialogue
      t = naturalizeDialogue(t);

      // Speech interruptions & English cleanup
      if (typeof TranslatorDict !== 'undefined') {
        if (TranslatorDict.handleSpeechCutoffs) t = TranslatorDict.handleSpeechCutoffs(t);
        if (TranslatorDict.cleanUntranslatedEnglish) t = TranslatorDict.cleanUntranslatedEnglish(t);
      }

      // Kurdish Punctuation (preserve HTML/ASS tags & bracket tokens)
      t = t.replace(/(<[^>]*>|\{[^}]*\}|\[\s*T\s*[\d\u0660-\u0669\u06f0-\u06f9]+\s*\])|([,;?])/gi, (m, tag, punct) => {
        if (tag) return tag;
        if (punct === ',') return '،';
        if (punct === ';') return '؛';
        if (punct === '?') return '؟';
        return punct;
      });

      // Fix dual-speaker hyphenation in Kurdish RTL:
      // When lines start with dialogue hyphens (- or —), ensure the hyphen stays cleanly at the beginning of each line
      t = t.split('\n').map((line) => {
        let l = line.trim();
        if (/^[-—–•]\s*/.test(l)) {
          l = '- ' + l.replace(/^[-—–•]\s*/, '').trim();
        }
        // Remove rogue trailing hyphens that flipped to line end in RTL
        if (l.startsWith('- ') && l.endsWith(' -')) {
          l = l.slice(0, -2).trim();
        }
        return l;
      }).join('\n');

      // Purge isolated placeholder remnants (like stray 'W', 'w', 'p', 'P', 'T', 't')
      t = t.replace(/(^|[\s،؛؟.\n])[WwPpTt](?=[\s،؛؟.,!?:-]|$)/g, '$1')
           .replace(/[ \t]{2,}/g, ' ');
    }

    return t;
  }

  /**
   * Postprocess a Kurdish subtitle string:
   * - Normalizes Sorani punctuation & typography.
   * - Replaces raw Arabic letters with Kurdish Sorani equivalents.
   * - Naturalizes conversational syntax and fixes compound word spacing.
   * - Optionally applies Kurdish digits and character name glossary replacements.
   */
  function postprocessSorani(text, options = {}) {
    if (text == null) return '';
    const str = typeof text === 'string' ? text : String(text);
    if (!str.trim()) return '';
    let res = normalizeText(str, true, !!options.kurdishDigits);
    res = naturalizeDialogue(res);
    if (typeof TranslatorDict !== 'undefined' && TranslatorDict.cleanUntranslatedEnglish) {
      res = TranslatorDict.cleanUntranslatedEnglish(res);
    }
    return res;
  }

  /**
   * Standardize text for fast, forgiving search matches across Arabic, Persian, Kurdish, and Latin scripts.
   * Strips diacritics, unifies Arabic/Kurdish letter variants, converts numbers to ASCII, and lowercases.
   */
  function normalizeForSearch(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/[\u064b-\u0652\u0670\u0640]/g, '') // strip Arabic diacritics & tatweel
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // Arabic-Indic digits
      .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // Eastern Arabic digits
      .replace(/[\u0622\u0623\u0625\u0626\u0671]/g, 'ا') // آ, أ, إ, ئ, ٱ -> ا
      .replace(/\u0643/g, 'ک') // ك -> ک
      .replace(/[\u064A\u0649\u06CE\u06CC]/g, 'ی') // ي, ى, ێ, ی -> ی
      .replace(/[\u0629\u06BE\u06C1]/g, 'ە') // ة, ھ, ہ -> ە
      .replace(/[\u06B5]/g, 'ل') // ڵ -> ل
      .replace(/[\u0695\u0696]/g, 'ر') // ڕ, ڑ -> ر
      .replace(/[\u06C6\u06C7\u06C8]/g, 'و') // ۆ, ۇ, ۈ -> و
      .replace(/[،,]/g, ' ')
      .replace(/[؟?]/g, ' ')
      .replace(/[؛;]/g, ' ')
      .replace(/[.!:_"-]/g, ' ')
      .replace(/[\u200c\u200d\u200e\u200f]/g, '') // invisible zero-width chars
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check for advanced English phrases in source text and return alternative translations.
   */
  function getAdvancedAlternatives(englishText) {
    if (!englishText) return [];
    if (typeof TranslatorDict !== 'undefined' && TranslatorDict.findMatches) {
      return TranslatorDict.findMatches(englishText);
    }
    const lower = englishText.toLowerCase();
    const found = [];
    const lex = (typeof TranslatorDict !== 'undefined' && TranslatorDict.LEXICON) ? TranslatorDict.LEXICON : ADVANCED_SUBTITLE_LEXICON;
    for (const [expr, data] of Object.entries(lex)) {
      if (lower.includes(expr)) {
        found.push({
          expression: expr,
          kurdish: data.kurdish,
          primary: data.kurdish,
          context: data.context || expr,
          alternatives: data.alternatives || [],
        });
      }
    }
    return found;
  }

  /**
   * Ensure screen placement override tags (like {\an8}, {\pos(x,y)}) and formatting tags
   * maintain their proper leading/trailing position in the translated line despite RTL reordering.
   */
  function fixPlacementAndTagOrder(text, originalText) {
    if (!text || !originalText) return text || '';

    const origLines = originalText.split('\n');
    const transLines = text.split('\n');

    const fixed = transLines.map((tLine, i) => {
      const origLine = origLines[i] || origLines[0] || '';
      let line = tLine;

      // Extract all leading ASS control codes and HTML tags
      const leadTagMatch = origLine.match(/^((?:\{[^}]+\}|<[^>]+>\s*)+)/);
      if (leadTagMatch) {
        const leadTags = leadTagMatch[1].trim();
        // Check for any ASS override command or HTML position/font tags
        if (/^\{[^{}]*\\(?:an?\d+|pos|move|fad|clip|org|c&|1c&|2c&|3c&|4c&|fn|fs|b\d|i\d|u\d|s\d|shad|bord|q\d)[^{}]*\}/i.test(leadTags) || /^<(?:top|mid|font\b|b|i|u)/i.test(leadTags)) {
          if (!line.startsWith(leadTags)) {
            let stripped = line;
            const escaped = leadTags.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            stripped = stripped.replace(new RegExp(escaped, 'g'), '').trim();
            line = leadTags + (stripped ? (leadTags.startsWith('{') ? stripped : ' ' + stripped) : '');
          }
        }
      }

      // Extract trailing HTML tags
      const trailTagMatch = origLine.match(/((?:<\/[a-z0-9]+>\s*)+)$/i);
      if (trailTagMatch) {
        const trailTags = trailTagMatch[1].trim();
        if (!line.endsWith(trailTags)) {
          let stripped = line;
          const escaped = trailTags.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          stripped = stripped.replace(new RegExp(escaped, 'g'), '').trim();
          line = (stripped ? stripped + ' ' : '') + trailTags;
        }
      }

      // Multi-speaker alignment: if original line started with hyphen (- ), ensure translated line also has it
      if (/^[-—–•]\s+/.test(origLine.replace(/^\{[^}]+\}/g, '').trim()) && !/^[-—–•]\s+/.test(line.replace(/^\{[^}]+\}/g, '').trim())) {
        const tagMatch = line.match(/^(\{[\s\S]*?\})/);
        if (tagMatch) {
          const tags = tagMatch[1];
          const rest = line.slice(tags.length).trim();
          line = `${tags}- ${rest}`;
        } else {
          line = `- ${line.trim()}`;
        }
      }

      return line.trim();
    });

    return fixed.join('\n').trim();
  }

  /**
   * Perform line-for-line quality check and Kurdish validation on a subtitle line.
   * Returns a detailed score, detected linguistic or formatting issues, suggestions,
   * detailed issue objects, alternative wordings, and the auto-improved text.
   */
  function checkLineQuality(arg1, arg2 = '') {
    let kurdishLine = typeof arg1 === 'string' ? arg1 : (arg1 != null ? String(arg1) : '');
    let origLine = typeof arg2 === 'string' ? arg2 : (arg2 != null ? String(arg2) : '');

    const hasArabic1 = /[\u0600-\u06ff]/.test(kurdishLine);
    const hasArabic2 = /[\u0600-\u06ff]/.test(origLine);
    if (!hasArabic1 && hasArabic2) {
      const tmp = kurdishLine;
      kurdishLine = origLine;
      origLine = tmp;
    }

    const text = (kurdishLine || '').trim();
    if (!text) {
      return { score: 100, issues: [], suggestions: [], issueDetails: [], alternatives: [], improvedText: '' };
    }

    const issues = [];
    const suggestions = [];
    const issueDetails = [];
    let penalties = 0;

    // 1. Check for untranslated Latin / English words
    const latinWords = text.match(/\b[a-zA-Z]{2,}\b/g);
    if (latinWords && !text.includes('{\\')) {
      const filtered = latinWords.filter((w) => !/^(WEBVTT|NOTE|STYLE|ASS|SSA|pos|an\d|fs|fn|c|b|i|u|s|k|kf|ko|q|r)$/i.test(w));
      if (filtered.length > 0) {
        const msg = `وشەی وەرنەگێڕدراو یان ئینگلیزی: "${filtered.slice(0, 3).join(', ')}"`;
        issues.push(msg);
        suggestions.push('وشە ئینگلیزییەکان وەربگێڕە بۆ کوردی');
        issueDetails.push({
          id: 'untranslated_words',
          category: 'untranslated',
          severity: 'error',
          title: 'وشەی ئینگلیزی وەرنەگێڕدراو',
          description: msg,
          fixAvailable: true,
        });
        penalties += Math.min(30, filtered.length * 15);
      }
    }

    // 2. Check for Arabic letter relics
    const arabicRelics = [];
    if (/[\u0643]/.test(text)) arabicRelics.push('ك');
    if (/[\u064A\u0649]/.test(text)) arabicRelics.push('ي/ى');
    if (/[\u0629]/.test(text)) arabicRelics.push('ة');
    if (/\u0640(?![-—–])/.test(text)) arabicRelics.push('ـ');

    if (arabicRelics.length > 0) {
      const msg = `پیتە عەرەبییەکان لە جێگەی پیتی کوردی بەکارهاتوون (${arabicRelics.join('، ')})`;
      issues.push(msg);
      suggestions.push('پیتەکان بگۆڕە بۆ (ک، ی، ە)');
      issueDetails.push({
        id: 'arabic_relics',
        category: 'orthography',
        severity: 'warning',
        title: 'پیت و نیشانەی نادروستی عەرەبی',
        description: msg,
        fixAvailable: true,
      });
      penalties += arabicRelics.length * 8;
    }

    // 3. Check for mechanical question starter "ئایا"
    if (/(?:^|[\s\n])ئایا\s+/.test(text)) {
      const msg = 'دەستپێکی ڕستە بە "ئایا" لە ژێرنووسی کوردیدا نەگونجاو و ڕۆبۆتییە';
      issues.push(msg);
      suggestions.push('پیت یان وشەی "ئایا" لاببە بۆ ئەوەی ڕستەکە سروشتی و ڕەوان بێت');
      issueDetails.push({
        id: 'mechanical_aya',
        category: 'dialogue',
        severity: 'warning',
        title: 'دەستپێکی نادروستی "ئایا"',
        description: msg,
        fixAvailable: true,
      });
      penalties += 8;
    }

    // 4. Check for split verbal prefixes
    if (/(?:^|\s)(?:دە|ئە|نا|نە|مە|بی|تێ|ڕێ|پێ|وەر|دەر|دا|هەڵ|دەست)\s+(?:بێت|زانم|زانی|کات|کەم|کەن|چێت|چم|چن|ڵێم|ڵێت|توانم|بوو|کرد|کە|ڕۆ|دەگەم|کەوتن|دان|گرتن)/.test(text)) {
      const msg = 'پێشگرە لێکدراوەکانی کردار لێکجیاکراونەتەوە (وەک: دە کات، نا زانم)';
      issues.push(msg);
      suggestions.push('پێشگرەکە بلکێنە بە کردارەکەوە (دەستکاریکردن بۆ: دەکات، نازانم)');
      issueDetails.push({
        id: 'split_verbal_affix',
        category: 'prefix',
        severity: 'warning',
        title: 'لێکجیابوونەوەی پێشگری کردار',
        description: msg,
        fixAvailable: true,
      });
      penalties += 10;
    }

    // 5. Check punctuation marks
    if (/[?;,]/.test(text) && !text.includes('{\\')) {
      const msg = 'هێماکانی خاڵبەندی بە شێوازی لاتینی ماونەتەوە (?, ;, ,)';
      issues.push(msg);
      suggestions.push('خاڵبەندی کوردی بەکاربهێنە (؟، ؛، ،)');
      issueDetails.push({
        id: 'latin_punctuation',
        category: 'punctuation',
        severity: 'info',
        title: 'خاڵبەندی لاتینی لە دەقی کوردی',
        description: msg,
        fixAvailable: true,
      });
      penalties += 5;
    }

    // 6. Check dual-speaker dialogue formatting
    if (origLine && (origLine.includes('\n-') || origLine.startsWith('- ') || origLine.includes(' - '))) {
      if (!text.includes('-')) {
        const msg = 'هێمای دیالۆگی دوو کەس (-) لە ژێرنووسەکەدا نییە';
        issues.push(msg);
        suggestions.push('هێمای - لە سەرەتای هەر دێڕێکی دیالۆگ دابنێ');
        issueDetails.push({
          id: 'dialogue_hyphen_missing',
          category: 'dialogue',
          severity: 'info',
          title: 'دیالۆگی چەندکەسی',
          description: msg,
          fixAvailable: true,
        });
        penalties += 8;
      }
    }

    // 7. Check for bracket token residue
    if (/\[\s*(?:T|W|p)\d*\s*\]|\b[TWp]\d+\b|[\u0001\u0002\u0003§]/.test(text)) {
      const msg = 'کۆدی کاتی پاشماوەی وەرگێڕان یان نیشانەی کاتی ماوەتەوە';
      issues.push(msg);
      suggestions.push('کۆدەکان پاکبکەرەوە');
      issueDetails.push({
        id: 'token_residue',
        category: 'token',
        severity: 'error',
        title: 'پاشماوەی کۆدی تەکنیکی',
        description: msg,
        fixAvailable: true,
      });
      penalties += 20;
    }

    // 8. Line length warning
    const lines = text.split('\n');
    const tooLongLine = lines.find((l) => l.length > 42);
    if (tooLongLine) {
      const msg = `درێژی دێڕ زۆرە (${tooLongLine.length} پیت) و خوێندنەوەی لەسەر شاشە گران دەکات`;
      issues.push(msg);
      suggestions.push('دێڕەکە بەسەر دوو دێڕدا دابەش بکە');
      issueDetails.push({
        id: 'line_length',
        category: 'timing',
        severity: 'info',
        title: 'درێژیی دێڕی ژێرنووس',
        description: msg,
        fixAvailable: false,
      });
      penalties += 5;
    }

    // Alternatives check from Advanced Lexicon
    const alternatives = getAdvancedAlternatives(origLine);

    // Compute improved text
    let improved = normalizeSoraniAlphabet(text);
    improved = rejoinVerbalAffixes(improved);
    improved = naturalizeDialogue(improved);
    if (typeof TranslatorDict !== 'undefined') {
      if (TranslatorDict.handleSpeechCutoffs) improved = TranslatorDict.handleSpeechCutoffs(improved);
      if (TranslatorDict.cleanUntranslatedEnglish) improved = TranslatorDict.cleanUntranslatedEnglish(improved);
    }
    improved = normalizeText(improved, true, false);
    improved = fixPlacementAndTagOrder(improved, origLine);

    const score = Math.max(15, Math.min(100, 100 - penalties));

    return {
      score,
      issues,
      suggestions,
      issueDetails,
      alternatives,
      improvedText: improved,
    };
  }

  return {
    normalizeDigits,
    normalizeSoraniAlphabet,
    rejoinVerbalAffixes,
    naturalizeDialogue,
    normalizeText,
    postprocessSorani,
    normalizeForSearch,
    getAdvancedAlternatives,
    checkLineQuality,
    fixPlacementAndTagOrder,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslatorOrthography;
}
