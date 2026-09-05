/**
 * translator-orthography.js — Advanced Kurdish Sorani & Kurmanji Orthography,
 * NLP, Grammar Engine, and Subtitle Quality Inspector.
 *
 * Core Capabilities:
 *  - Arabic-to-Kurdish character normalization (ك/ي/ة/ه -> ک/ی/ە).
 *  - Kurdish Sorani Heavy R (ڕ) rules and Velarized L (ڵ) rules.
 *  - Verbal prefix attachment (دە، نا، نە، مە، بی، تێ، پێ، لێ، ڕێ، وەر، دەر، دا، هەڵ).
 *  - Idiomatic naturalization of subtitle dialogue.
 *  - Kurdish Arabic digits vs ASCII numeral converter (٠١٢٣).
 *  - Standard Kurdish punctuation (، ؛ ؟ « »).
 *  - Hawar Latin Kurdish (Kurmanji / CKB Latin) transliteration tools.
 *  - Line-by-line subtitle reading speed (CPS) and quality inspector.
 */
const TranslatorOrthography = (() => {
  const getLexicon = () => {
    if (typeof TranslatorDict !== 'undefined' && TranslatorDict.LEXICON) {
      return TranslatorDict.LEXICON;
    }
    return {};
  };

  /** Normalize numbers, preserving HTML tags, ASS format codes, and tokens. */
  function normalizeDigits(str, useKurdishDigits) {
    if (!str) return '';
    if (!useKurdishDigits) {
      return str
        .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
        .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
    }
    return str.replace(/(<[^>]*>|\{[^}]*\}|\[\s*T\s*[\d\u0660-\u0669\u06f0-\u06f9]+\s*\])|([0-9\u06f0-\u06f9]+)/gi, (m, tag, nums) => {
      if (tag) return tag;
      return nums
        .replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)))
        .replace(/[\u06f0-\u06f9]/g, (d) => String.fromCharCode(0x0660 + (d.charCodeAt(0) - 0x06f0)));
    });
  }

  // Stems for Sorani Kurdish Heavy R (ڕ)
  const HEAVY_R_STEMS = [
    'ویشت', 'ۆیشت', 'ۆشت', 'ۆ', 'است', 'ێگ', 'ۆژ', 'ەنگ', 'ێز', 'وون',
    'ەش', 'وو', 'اپۆرت', 'اگەیاندن', 'اگەیەندراو', 'ێنمایی', 'ێژە', 'زگار',
    'ازی', 'ێبوار', 'ابردوو', 'ێپێدان', 'ێباز', 'ەوت', 'ەها', 'ەتکردنەوە',
    'ەوانە', 'ەوشت', 'ەخنە', 'وانین', 'اهێنان', 'اکردن', 'اگرتن', 'اکێشان',
    'اوکردن', 'ێکخستن', 'ێکەوتن', 'ێسا', 'ۆح', 'ەوش', 'ێبەر', 'ەگ', 'ووت',
    'ەق', 'ق', 'ژێم', 'اوەست', 'اکە', 'ێنووس', 'یش', 'یشە', 'ەنج', 'ێژن',
    'ازاوە', 'ووناک', 'ەشپۆش', 'ەنگاوڕەنگ', 'ەگەز', 'ەزامەندی', 'ێچکە',
    'اوەستان', 'اگواستن', 'اپێچ', 'زگاربوون', 'شتن', 'ژان', 'ەچاو', 'ەنجبەری',
    'ەسەن', 'کابەر', 'ەقەم', 'اپەڕین'
  ];
  const HEAVY_R_PREFIX_REGEX = new RegExp('(^|\\s)ر(' + HEAVY_R_STEMS.join('|') + ')(?=[\\u0600-\\u06ff]*)(?=\\s|$|[.,!?;:،؛؟])', 'g');

  // Stems for Sorani Kurdish Velarized L (ڵ)
  const VELARIZED_L_STEMS = [
    ['مال', 'ماڵ'], ['بەلێ', 'بەڵێ'], ['دەلێ', 'دەڵێ'], ['بلێ', 'بڵێ'],
    ['گول', 'گوڵ'], ['سال', 'ساڵ'], ['خۆشحال', 'خۆشحاڵ'], ['مندال', 'منداڵ'],
    ['سلاو', 'سڵاو'], ['گەلا', 'گەڵا'], ['کەلەک', 'کەڵەک'], ['چۆل', 'چۆڵ'],
    ['تەلە', 'تەڵە'], ['خال', 'خاڵ'], ['تال', 'تاڵ'], ['پیالە', 'پیاڵە'],
    ['دل', 'دڵ'], ['پۆلا', 'پۆڵا'], ['قولپ', 'قوڵپ'], ['کەلەشێر', 'کەڵەشێر'],
    ['مۆلەت', 'مۆڵەت'], ['قەلەباڵغ', 'قەڵەباڵغ'], ['خەلک', 'خەڵک'], ['گۆل', 'گۆڵ'],
    ['هەل', 'هەڵ'], ['کەلەپووت', 'کەڵەپووت'], ['کەلەگا', 'کەڵەگا'], ['بەلام', 'بەڵام'],
    ['زولم', 'زوڵم'], ['شەلال', 'شەڵاڵ'], ['قەلا', 'قەڵا'], ['تەپل', 'تەپڵ'],
    ['بلاو', 'بڵاو'], ['تێکەل', 'تێکەڵ'], ['بەربلاو', 'بەربڵاو'], ['هەلە', 'هەڵە'],
    ['کەلک', 'کەڵک'], ['کۆمەل', 'کۆمەڵ'], ['جەنجال', 'جەنجاڵ'], ['قەلەم', 'قەڵەم']
  ];

  /** Normalize Arabic characters into Kurdish Sorani alphabet & orthography. */
  function normalizeSoraniAlphabet(str) {
    if (!str) return '';
    let s = str
      .replace(/\u0643/g, 'ک')
      .replace(/[\u064A\u0649]/g, 'ی')
      .replace(/\u0629/g, 'ە')
      .replace(/[\u06BE\u06C1]/g, 'ه');

    // Arabic Heh 'ه' to Kurdish Small E 'ە' at word ends after non-vowels
    s = s.replace(/([\u0600-\u06ff])ه(?=\s|$|[.,!?;:،؛؟])/g, (m, p) =>
      (p !== 'ئ' && p !== 'ا' && p !== 'و' && p !== 'ۆ' && p !== 'ە' && p !== 'ێ' && p !== 'ڕ' ? p + 'ە' : m)
    );

    // Initial R in Kurdish Sorani is universally trilled Heavy R (ڕ)
    s = s.replace(/(^|[\s،؛؟.\n(«"'\[{<])ر(?=[\u0600-\u06ff])/gu, '$1ڕ');

    // Heavy R vocabulary corrections
    s = s.replace(HEAVY_R_PREFIX_REGEX, '$1ڕ$2')
      .replace(/(^|\s)برۆ(ن|یت|م|ین)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕۆ$2')
      .replace(/(^|\s)مەرۆ(ن|ین)?(?=\s|$|[.,!?;:،؛؟])/g, '$1مەڕۆ$2')
      .replace(/(^|\s)دەرۆ(م|یت|ات|ین|ن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1دەڕۆ$2')
      .replace(/(^|\s)دەروات(?=\s|$|[.,!?;:،؛؟])/g, '$1دەڕوات')
      .replace(/(^|\s)نەروات(?=\s|$|[.,!?;:،؛؟])/g, '$1نەڕوات')
      .replace(/(^|\s)نەرۆ(م|یت|ات|ین|ن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1نەڕۆ$2')
      .replace(/(^|\s)کوری?(?=\s|$|[.,!?;:،؛؟])/g, '$1کوڕی')
      .replace(/(^|\s)بریار(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕیار')
      .replace(/(^|\s)بروا(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕوا')
      .replace(/(^|\s)بروابکە(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕوابکە')
      .replace(/(^|\s)بروانە(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕوانە')
      .replace(/(^|\s)زور(?=\s|$|[.,!?;:،؛؟])/g, '$1زۆر')
      .replace(/گۆرانکاری/g, 'گۆڕانکاری')
      .replace(/سپاس/g, 'سوپاس');

    // Velarized L (ڵ) corrections
    VELARIZED_L_STEMS.forEach(([plain, velar]) => {
      const re = new RegExp('(^|\\s)' + plain + '([\\u0600-\\u06ff]*)(?=\\s|$|[.,!?;:،؛؟])', 'g');
      s = s.replace(re, '$1' + velar + '$2');
    });

    return s;
  }

  /** Rejoin split Sorani Kurdish verbal affixes & compound preverbs. */
  function rejoinVerbalAffixes(str) {
    if (!str) return '';
    return str
      .replace(/(^|\s)دە\s+(بێت|بم|بیت|بین|بن|زانم|زانی|زانێت|زانین|زانن|کات|کەم|کەیت|کەین|کەن|توانی|توانم|توانێت|توانین|توانن|چێت|چم|چیت|چین|چن|ڕۆم|رۆم|ڕۆیت|رۆیت|ڕوات|روات|ڕۆین|رۆین|ڕۆن|رۆن|ڵێت|ڵێم|ڵێیت|ڵێین|ڵێن|هێنێت|هێنم|هێنیت|هێنین|هێنن|یەوێت|خوات|خۆم|خۆین|خۆن|کراو|بینم|بینێت|بینین|بینن|وەستێت|گەڕێتەوە|نووسێت|نووسم|نووسین|دات|دەین|دەکان|بەن|بەین|دێت|دەبێتەوە|فرۆشێت|کڕێت|ژیم|ژیت|ژی|ژیین|ژین|مرێت|بیستێت|گرێت|بەستێت|گەین|کەویت|بارێت|گۆڕێت|بەخشێت|شارێتەوە|ڕژێت|نێرێت|ناسێت|کوژێت|پارێزێت|سووتێت|تەقێت|ترسێت|فڕێت|پشکنێت|ڕوانێت)(?=\s|$|[.,!?;:،؛؟])/g, '$1دە$2')
      .replace(/(^|\s)ئە\s+(بێت|بم|بیت|بین|بن|زانم|زانی|زانێت|کات|کەم|کەیت|کەین|چێت|چم|چیت|چین|ڕۆم|ڕۆیت|ڕوات|ڕۆین|ڵێت|ڵێم|هێنێت|هێنم|یەوێت|خوات|خۆم|بینم|بینێت|دات|دێت)(?=\s|$|[.,!?;:،؛؟])/g, '$1ئە$2')
      .replace(/(^|\s)نا\s+(زانم|زانی|زانێت|زانین|زانن|کات|کەم|کەیت|کەن|ناکەین|بێت|بم|بیت|بین|بن|کرێت|کرێن|توانی|توانم|توانێت|توانین|توانن|چێت|چم|چیت|چین|چن|ڵێم|ڵێت|ڵێن|گەڕێتەوە|بینم|بینێت|وێت|نامەوێت|ناوێت|خۆم|خوات|دات|نادەم|دەین|کەوم|کەوێت|ڕوات|روات|مرێت|بیستم|بیستێت|ڕۆم|ڕۆیت|ڕۆین|ڕۆن|نووسم|فرۆشم|کڕم|گەم|گۆڕێت|ناسم|کوژم|پارێزم)(?=\s|$|[.,!?;:،؛؟])/g, '$1نا$2')
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
      .replace(/([\p{L}\u0600-\u06FF]+)\s+تر(?=\s|$|[.,!?;:،؛؟])/gu, '$1تر')
      .replace(/([\p{L}\u0600-\u06FF]+)\s+ترین(?=\s|$|[.,!?;:،؛؟])/gu, '$1ترین')
      .replace(/([\p{L}\u0600-\u06FF]+)\s+ەوە(?=\s|$|[.,!?;:،؛؟])/gu, '$1ەوە')
      .replace(/([\p{L}\u0600-\u06FF]+)\s+یش(?=\s|$|[.,!?;:،؛؟])/gu, '$1یش')
      .replace(/([\p{L}\u0600-\u06FF]+)\s+(مان|تان|یان|ەکەم|ەکەت|ەکەی|ەکەمان|ەکەتان|ەکەیان|ەکان)(?=\s|$|[.,!?;:،؛؟])/gu, '$1$2');
  }

  // Common phrase replacements for natural Kurdish dialogue
  const DIALOGUE_NATURALIZATIONS = [
    [/ئۆ خوای من|خوای من|ئەی خوای گەورە|ئۆهـ خوای من|ئەی هاوار خوایە/g, 'ئەی خوایە'],
    [/سەیر بکە،?/g, 'سەیرکە'],
    [/گوێ بگرە،?/g, 'گوێ بگرە'],
    [/من زۆر سوپاستان دەکەم/g, 'زۆر سوپاس'],
    [/هیچ کێشەیەک نییە|کێشەیەک نییە/g, 'کێشە نییە'],
    [/بە دڵنیاییەوە/g, 'بێگومان'],
    [/سوپاس بۆ تۆ/g, 'سوپاس'],
    [/زۆر سوپاس بۆ تۆ/g, 'زۆر سوپاس'],
    [/بە ڵێ|بەل ێ/g, 'بەڵێ'],
    [/دە ڵێ/g, 'دەڵێ'],
    [/سو پاس/g, 'سوپاس'],
    [/س ڵاو|سڵا و/g, 'سڵاو'],
    [/خۆ شحاڵ|خۆش حاڵ/g, 'خۆشحاڵ'],
    [/خۆشحاڵم بتبینم/g, 'خۆشحاڵم بە بینینت'],
    [/بێ گومان/g, 'بێگومان'],
    [/لە کوێ/g, 'لەکوێ'],
    [/بۆ چی/g, 'بۆچی'],
    [/لە بەر/g, 'لەبەر'],
    [/لە گەڵ/g, 'لەگەڵ'],
    [/بە تایبەت/g, 'بەتایبەت'],
    [/بە ڕاستی/g, 'بەڕاستی'],
    [/لە ڕاستیدا/g, 'لەڕاستیدا'],
    [/بێ ئەوەی/g, 'بێئەوەی'],
    [/لەبەر ئەوەی/g, 'لەبەرئەوەی'],
    [/ئەمە لەبەر ئەوەیە کە/g, 'چونکە'],
    [/سەر کەوتن/g, 'سەرکەوتن'],
    [/سەر دەکەوێت/g, 'سەردەکەوێت'],
    [/دەست پێ کردن/g, 'دەستپێکردن'],
    [/دەست پێ دەکات/g, 'دەستپێدەکات'],
    [/دە بارەی|دەربارە ی/g, 'دەربارەی'],
    [/ڕاستە قینە/g, 'ڕاستەقینە'],
    [/بەخێر بێیت/g, 'بەخێربێیت'],
    [/بەخێر بێن/g, 'بەخێربێن'],
    [/دەستت خۆش بێت/g, 'دەستت خۆش'],
    [/ڕۆژ باش/g, 'ڕۆژباش'],
    [/شەو باش/g, 'شەوباش'],
    [/بەیانی باش/g, 'بەیانیباش'],
    [/ماڵ ئاوا/g, 'ماڵئاوا'],
    [/سوپاس گوزارم/g, 'سوپاسگوزارم'],
    [/لە دەست دان/g, 'لەدەستدان'],
    [/لە بیر کردن/g, 'لەبیرکردن'],
    [/لە یاد کردن/g, 'لەیادکردن'],
    [/لە ناو بردن/g, 'لەناوبردن'],
    [/ئەوەیە بۆچی/g, 'بۆیە'],
    [/ئەوەیە چۆن/g, 'ئاوا'],
    [/ئەوەیە کاتێک/g, 'ئەو کاتەی'],
    [/ئەوەیە لە کوێ/g, 'لەوێیە کە'],
    [/هیچ شتێک نییە/g, 'هیچ نییە'],
    [/هیچ مانایەکی نییە/g, 'هیچ مانای نییە'],
    [/ئەوە مانای چییە/g, 'مەبەستت چییە؟'],
    [/چاوەڕێ بە/g, 'بۆستە'],
    [/هێمن بە|ئارام بەوە/g, 'هێمن ببەوە'],
    [/لێ ى/g, 'لێی'],
    [/پێ ى/g, 'پێی'],
    [/تێ ى/g, 'تێی'],
    [/خۆت لە ماڵەوە بکە|وەک ماڵی خۆت ڕەفتار بکە/g, 'ماڵی خۆتە'],
    [/پشوویەکم پێ بدە/g, 'دە لێم گەڕێ'],
    [/لەسەر جەستەی مردووم|تەنها لەسەر لاشەی من/g, 'تەنها لەسەر تەرمەکەم'],
    [/تۆ دەبێت گاڵتەم پێبکەیت|تۆ دەبێت گاڵتە بکەیت/g, 'گاڵتەم لەگەڵ دەکەیت؟'],
    [/لە پێش چاوی مندا نا/g, 'تا من لێرەبم مەحاڵە'],
    [/تەنها بۆ یەک سات/g, 'تەنها بۆ ساتێک'],
    [/لە لایەن/g, 'لەلایەن'],
    [/لە کاتێکدا/g, 'لەکاتێکدا'],
    [/لە هەمان کاتدا/g, 'لەهەمان کاتدا'],
    [/لە شوێنی/g, 'لەشوێنی'],
    [/دەست بەجێ/g, 'دەستبەجێ'],
    [/جێ بەجێ/g, 'جێبەجێ'],
    [/ڕێ پێ دان/g, 'ڕێپێدان'],
    [/تێ پەڕین/g, 'تێپەڕین'],
    [/ڕوو بەڕوو/g, 'ڕووبەڕوو'],
    [/دەستبەردار بە|دەست بەردار بە/g, 'دەستبەرداربە'],
    [/تکایە بمبورە|بمبورە/g, 'تکایە لێمببوورە'],
    [/ئەوە چی بوو/g, 'ئەوە چی بوو؟'],
    [/چی ڕوویدا/g, 'چی ڕوویدا؟'],
    [/چی ڕوودەدات/g, 'چی ڕوودەدات؟'],
    [/کێشە چییە/g, 'کێشە چییە؟'],
    [/چیت بەسەرهاتووە/g, 'چیت بەسەرهاتووە؟'],
    [/ئەمە چییە/g, 'ئەمە چییە؟'],
    [/دەمت داخە/g, 'دەمت دابخە'],
    [/وەرە سەرەوە/g, 'دەی!'],
    [/وەرە پیاو/g, 'دەی برام!'],
    [/پشتم بگرە/g, 'پشتیوانیم لێبکە'],
    [/بە دڵنیاییەوە بەڵێ/g, 'بێگومان بەڵێ'],
    [/پێویستم بە تۆیە/g, 'پێویستم پێتە'],
    [/پێویستت بە منە/g, 'پێویستت پێمە'],
    [/لەگەڵ من وەرە/g, 'لەگەڵم وەرە'],
    [/من ناتوانم چاوەڕێ بکەم/g, 'بێسەبرانە چاوەڕێم'],
    [/کۆنتڕۆڵت لەدەست مەدە/g, 'خۆت کۆنتڕۆڵ بکە'],
    [/با بڕۆین/g, 'با بچین'],
  ];

  /** Naturalize machine-translated subtitle dialogue for fluent Sorani Kurdish. */
  function naturalizeDialogue(str) {
    if (!str) return '';
    let res = str.replace(/(^|[\s،؛؟.\n])ئایا\s+/g, '$1');

    DIALOGUE_NATURALIZATIONS.forEach(([pattern, replacement]) => {
      res = res.replace(pattern, replacement);
    });

    // Drop redundant subject pronouns in spoken Kurdish
    res = res
      .replace(/(^|[\s،؛؟.\n])من نازانم(?=\s|$|[.,!?;:،؛؟])/g, '$1نازانم')
      .replace(/(^|[\s،؛؟.\n])من دەزانم(?=\s|$|[.,!?;:،؛؟])/g, '$1دەزانم')
      .replace(/(^|[\s،؛؟.\n])من دەبێت(?=\s|$|[.,!?;:،؛؟])/g, '$1دەبێت')
      .replace(/(^|[\s،؛؟.\n])من دڵنیام(?=\s|$|[.,!?;:،؛؟])/g, '$1دڵنیام')
      .replace(/(^|[\s،؛؟.\n])من پێم وایە(?=\s|$|[.,!?;:،؛؟])/g, '$1پێم وایە')
      .replace(/(^|[\s،؛؟.\n])من دەمەوێت(?=\s|$|[.,!?;:،؛؟])/g, '$1دەمەوێت')
      .replace(/(^|[\s،؛؟.\n])من دەتوانم(?=\s|$|[.,!?;:،؛؟])/g, '$1دەتوانم')
      .replace(/(^|[\s،؛؟.\n])من باوەڕ ناکەم(?=\s|$|[.,!?;:،؛؟])/g, '$1باوەڕ ناکەم')
      .replace(/(^|[\s،؛؟.\n])من سوێند دەخۆم(?=\s|$|[.,!?;:،؛؟])/g, '$1سوێند دەخۆم')
      .replace(/(^|[\s،؛؟.\n])من بەڵێن دەدەم(?=\s|$|[.,!?;:،؛؟])/g, '$1بەڵێن دەدەم')
      .replace(/(^|[\s،؛؟.\n])من هەست دەکەم(?=\s|$|[.,!?;:،؛؟])/g, '$1هەست دەکەم')
      .replace(/(^|[\s،؛؟.\n])من هەوڵ دەدەم(?=\s|$|[.,!?;:،؛؟])/g, '$1هەوڵ دەدەم')
      .replace(/(^|[\s،؛؟.\n])تۆ دەتوانیت(?=\s|$|[.,!?;:،؛؟])/g, '$1دەتوانیت')
      .replace(/(^|[\s،؛؟.\n])تۆ دڵنیایت(?=\s|$|[.,!?;:،؛؟])/g, '$1دڵنیایت؟')
      .replace(/(^|[\s،؛؟.\n])تۆ پێویستە(?=\s|$|[.,!?;:،؛؟])/g, '$1پێویستە')
      .replace(/(^|[\s،؛؟.\n])ئێمە دەتوانین(?=\s|$|[.,!?;:،؛؟])/g, '$1دەتوانین')
      .replace(/(^|[\s،؛؟.\n])ئەوان دەتوانن(?=\s|$|[.,!?;:،؛؟])/g, '$1دەتوانن');

    return res;
  }

  /** Kurdish Punctuation & Orthographic Normalization */
  function normalizeText(text, cleanPunctuation = true, useKurdishDigits = false) {
    if (!text) return '';
    let s = text.replace(/[\u200E\u200F\u202A-\u202E]/g, '');

    s = normalizeSoraniAlphabet(s);
    s = rejoinVerbalAffixes(s);
    s = naturalizeDialogue(s);
    s = normalizeDigits(s, useKurdishDigits);

    if (cleanPunctuation) {
      s = s.replace(/,/g, '،')
           .replace(/;/g, '؛')
           .replace(/\?/g, '؟')
           .replace(/\s+([،؛؟.!])/g, '$1')
           .replace(/\n\s*([،؛؟.!])/g, '$1')
           .replace(/([،؛؟])([^\s\n])/g, '$1 $2')
           .replace(/[ \t]{2,}/g, ' ')
           .trim();
    }
    return s;
  }

  /** Complete post-processing pipeline for Kurdish Sorani subtitles. */
  function postprocessSorani(text, options = {}) {
    if (!text) return '';
    return normalizeText(text, true, !!options.kurdishDigits);
  }

  /** Text search normalization (accent/diacritic/heavy letter insensitive). */
  function normalizeForSearch(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .replace(/[ڕر]/g, 'ر')
      .replace(/[ڵل]/g, 'ل')
      .replace(/[ێیىي]/g, 'ی')
      .replace(/[ۆوو]/g, 'و')
      .replace(/[ەههـة]/g, 'ە')
      .replace(/[گکك]/g, 'ک')
      .replace(/[پب]/g, 'ب')
      .replace(/[چج]/g, 'ج')
      .replace(/[ژز]/g, 'ز')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[.,!?;:،؛؟"'«»\-_(){}[\]<>/\\#*&^%$@~`|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Kurdish Hawar Latin (Kurmanji) Transliteration Table */
  const SORANI_TO_HAWAR = [
    ['ئا', 'a'], ['ئە', 'e'], ['ئی', 'î'], ['ئێ', 'ê'], ['ئو', 'u'], ['ئۆ', 'o'], ['ئوو', 'û'],
    ['ا', 'a'], ['ە', 'e'], ['ێ', 'ê'], ['ۆ', 'o'], ['وو', 'û'], ['و', 'w'], ['ی', 'y'],
    ['ب', 'b'], ['پ', 'p'], ['ت', 't'], ['ج', 'c'], ['چ', 'ç'], ['ح', 'h'], ['خ', 'x'],
    ['د', 'd'], ['ر', 'r'], ['ڕ', 'rr'], ['ز', 'z'], ['ژ', 'j'], ['س', 's'], ['ش', 'ş'],
    ['ع', "'"], ['غ', 'ẍ'], ['ف', 'f'], ['ڤ', 'v'], ['ق', 'q'], ['ک', 'k'], ['گ', 'g'],
    ['ل', 'l'], ['ڵ', 'll'], ['م', 'm'], ['ن', 'n'], ['ه', 'h'], ['ھ', 'h']
  ];

  /** Transliterate Kurdish Sorani Arabic-script text to Kurdish Hawar Latin. */
  function toHawarLatin(str) {
    if (!str) return '';
    let res = str;
    SORANI_TO_HAWAR.forEach(([ar, lat]) => {
      res = res.split(ar).join(lat);
    });
    return res;
  }

  /** Get alternative idiom translations from dictionary. */
  function getAdvancedAlternatives(englishText) {
    if (!englishText) return [];
    const lex = getLexicon();
    const clean = englishText.toLowerCase().trim();
    if (lex[clean] && lex[clean].alternatives) {
      return lex[clean].alternatives;
    }
    return [];
  }

  /**
   * Intelligently split an overly long single-line Kurdish subtitle into two balanced lines.
   * Handles speaker dialogue hyphens, conjunctions, and punctuation.
   */
  function splitLongKurdishLine(text, maxLineChars = 38) {
    if (!text || typeof text !== 'string') return '';
    if (text.includes('\n')) return text;
    const cleanText = text.trim();
    if (cleanText.length <= maxLineChars) return cleanText;

    const multiSpeakerMatch = cleanText.match(/^([-—–]\s*[^\n]+?)\s+([-—–]\s*[^\n]+)$/);
    if (multiSpeakerMatch) {
      return `${multiSpeakerMatch[1].trim()}\n${multiSpeakerMatch[2].trim()}`;
    }

    const words = cleanText.split(/\s+/);
    if (words.length <= 2) return cleanText;

    const midChar = Math.floor(cleanText.length / 2);
    let bestIndex = -1;
    let minDistance = Infinity;
    let runningCharCount = 0;

    for (let i = 0; i < words.length - 1; i++) {
      runningCharCount += words[i].length + 1;
      const nextWord = words[i + 1];
      const distance = Math.abs(runningCharCount - midChar);

      const hasComma = words[i].endsWith('،') || words[i].endsWith(',') || words[i].endsWith('؛') || words[i].endsWith(';');
      const hasSpeakerDash = /^[-—–]/.test(nextWord);
      const isConjunction = /^(وە|کە|چونکە|بەڵام|بۆیە|لەبەرئەوەی|یان|تەنانەت|ئەگەر|کاتێک|تاوەکو|ئاخۆ|لەگەڵ)$/.test(nextWord);

      let weight = distance;
      if (hasSpeakerDash) weight -= 20;
      if (hasComma) weight -= 12;
      if (isConjunction) weight -= 8;

      if (weight < minDistance) {
        minDistance = weight;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      const line1 = words.slice(0, bestIndex + 1).join(' ');
      const line2 = words.slice(bestIndex + 1).join(' ');
      return `${line1}\n${line2}`;
    }
    return cleanText;
  }

  /**
   * Fix markup and token placement order in RTL subtitle lines.
   */
  function fixPlacementAndTagOrder(text) {
    if (!text) return '';
    return text.replace(/(\{\\an\d+\})\s*([\s\S]+)/g, '$1 $2');
  }

  /**
   * Deep line-by-line quality analyzer for Kurdish subtitles.
   */
  function checkLineQuality(cue, originalText) {
    if (!cue) return { score: 100, issues: [], suggestions: [], improvedText: '' };
    const text = cue.text || '';
    const duration = Math.max(0.2, ((cue.end || 0) - (cue.start || 0)) / 1000);
    const charCount = text.replace(/<[^>]*>|\{[^}]*\}/g, '').trim().length;
    const cps = duration > 0 ? (charCount / duration) : 0;

    const issues = [];
    const suggestions = [];
    const issueDetails = [];

    // 1. Reading Speed (Characters Per Second)
    if (cps > 24) {
      issues.push('cps_too_fast');
      suggestions.push(`Reading speed too fast (${cps.toFixed(1)} CPS). Consider shortening or extending duration.`);
      issueDetails.push({ code: 'CPS_TOO_FAST', severity: 'warning', message: `Fast reading speed: ${cps.toFixed(1)} chars/sec` });
    }

    // 2. Arabic letter remnants
    if (/[\u0643\u064A\u0649\u0629]/.test(text)) {
      issues.push('arabic_letters');
      suggestions.push('Contains non-Kurdish Arabic letters (ك, ي, ى, ة). Auto-fix to convert to (ک, ی, ە).');
      issueDetails.push({ code: 'ARABIC_LETTERS', severity: 'warning', message: 'Contains Arabic letters instead of Kurdish script' });
    }

    // 3. Split verbal prefixes
    if (/(?:^|\s)(?:دە|نا|نە|مە|بی|تێ|پێ|لێ)\s+[\u0600-\u06ff]+/.test(text)) {
      issues.push('split_prefixes');
      suggestions.push('Split verbal prefixes detected (دە، نا، نە...).');
      issueDetails.push({ code: 'SPLIT_PREFIXES', severity: 'info', message: 'Kurdish verbal prefixes should be joined' });
    }

    // 4. Overly long lines
    const lines = text.split('\n');
    const hasLongLine = lines.some((l) => l.trim().length > 42);
    if (hasLongLine) {
      issues.push('long_line');
      suggestions.push('Line exceeds 42 characters. Consider breaking into two lines.');
      issueDetails.push({ code: 'LONG_LINE', severity: 'info', message: 'Line is long for comfortable subtitle reading' });
    }

    // Generate improved text
    let improved = normalizeText(text, true, false);
    if (hasLongLine && lines.length === 1) {
      improved = splitLongKurdishLine(improved);
    }

    const alternatives = originalText ? getAdvancedAlternatives(originalText) : [];

    let score = 100;
    score -= issues.length * 12;
    if (score < 40) score = 40;

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
    toHawarLatin,
    getAdvancedAlternatives,
    checkLineQuality,
    fixPlacementAndTagOrder,
    splitLongKurdishLine,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslatorOrthography;
}
