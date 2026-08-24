/**
 * translator-dict.js — Comprehensive dictionary of Subtitle Idioms,
 * Cinema Profanities, Colloquial Expressions, and Kurdish Sorani Mappings.
 *
 * Exposes TranslatorDict as a global in browsers and supports Node.js require().
 */
const TranslatorDict = (() => {
  const ADVANCED_SUBTITLE_LEXICON = {
    // Cinema Profanity, Expletives & Subtitle Curse Translations
    'fuck': { kurdish: 'نەفرەت', context: 'Expletive', alternatives: ['شەیتان', 'دۆزەخ', 'سەگباب'] },
    'fucking': { kurdish: 'نەفرەتی', context: 'Emphasis', alternatives: ['سەگباب', 'نەعلەتی', 'دۆزەخ'] },
    'fuck off': { kurdish: 'سەری خۆت هەڵگرە', context: 'Dismissal', alternatives: ['لەبەرچاوم وون بە', 'بڕۆ بۆ دۆزەخ', 'بە نەفرەت بێت'] },
    'fuck you': { kurdish: 'نەفرەتت لێ بێت', context: 'Invective', alternatives: ['بە نەفرەت بێت', 'تۆ بڕۆ بۆ دۆزەخ'] },
    'fuck it': { kurdish: 'بە نەفرەت بێت', context: 'Resignation', alternatives: ['واز لەوە بێنە', 'خەمیم نییە'] },
    'what the fuck': { kurdish: 'چی دۆزەخێکە', context: 'Shock/Anger', alternatives: ['چی نەعلەتییەکە', 'ئەمە چی نەفرەتییەکە', 'چی گویەکە'] },
    'wtf': { kurdish: 'چی دۆزەخێکە', context: 'Shock', alternatives: ['چی نەعلەتییەکە', 'ئەمە چییە'] },
    'shut the fuck up': { kurdish: 'دەمت دابخە', context: 'Silencing', alternatives: ['دەمپیس دەمت دابخە', 'دەمت بەستە', 'دەنگی خۆت ببڕە'] },
    'shit': { kurdish: 'نەفرەت', context: 'Frustration', alternatives: ['پیسایی', 'کەریەتی', 'دۆزەخ'] },
    'holy shit': { kurdish: 'ئەی هاوار', context: 'Astonishment', alternatives: ['ئەی خوایە', 'خوایە گیان', 'بەڕاستی سەیرە'] },
    'bullshit': { kurdish: 'قسەی پووچ', context: 'Lies/Nonsense', alternatives: ['قسەی بێمانا', 'ڕیسوایی', 'درۆی شاخدار'] },
    'damn': { kurdish: 'نەفرەتی', context: 'Disappointment', alternatives: ['داخەکەم', 'نەعلەتی', 'دۆزەخ'] },
    'goddamn': { kurdish: 'نەفرەتی', context: 'Emphasis', alternatives: ['نەعلەتی', 'سەگباب'] },
    'bastard': { kurdish: 'سەگباب', context: 'Insult', alternatives: ['حەرامزادە', 'کەڵەگا', 'سووک'] },
    'bitch': { kurdish: 'سووک', context: 'Insult', alternatives: ['پێڵاوپیس', 'سەگباب', 'چەتەڵ'] },
    'son of a bitch': { kurdish: 'سەگباب', context: 'Insult', alternatives: ['کوڕی سەگ', 'کوڕی پێڵاوپیس'] },
    'motherfucker': { kurdish: 'نەعلەتی', context: 'Insult', alternatives: ['سەگباب', 'سەگی بێباوک', 'سووک'] },
    'asshole': { kurdish: 'سووک', context: 'Insult', alternatives: ['سەگباب', 'گەمژەی بێئابڕوو', 'کەر'] },
    'dickhead': { kurdish: 'گەمژە', context: 'Insult', alternatives: ['کەر', 'کەلەپووت', 'بێئەقڵ'] },
    'dumbass': { kurdish: 'گەمژە', context: 'Insult', alternatives: ['کەر', 'نەفام', 'سەربەتاڵ'] },
    'idiot': { kurdish: 'گەمژە', context: 'Insult', alternatives: ['نەفام', 'کەر', 'بێئەقڵ'] },
    'screw you': { kurdish: 'نەعلەتت لێ بێت', context: 'Dismissal', alternatives: ['بڕۆ بۆ دۆزەخ', 'بە نەفرەت بێت'] },
    'screw it': { kurdish: 'واز لەوە بێنە', context: 'Dismissal', alternatives: ['خەمیم نییە', 'گرنگ نییە'] },
    'go to hell': { kurdish: 'بڕۆ بۆ دۆزەخ', context: 'Curse', alternatives: ['تۆ بڕۆ بۆ جەهەننەم', 'لەناو بچیت'] },
    'kiss my ass': { kurdish: 'واز لە من بێنە', context: 'Defiance', alternatives: ['سەری خۆت بدە لە بەرد', 'گرنگی بە تۆ نادەم'] },
    'get lost': { kurdish: 'لەبەرچاوم وون بە', context: 'Dismissal', alternatives: ['تێپەڕە لە لای من', 'سەری خۆت هەڵگرە'] },
    'shut up': { kurdish: 'دەمت دابخە', context: 'Silence', alternatives: ['بێدەنگ بە', 'دەنگی خۆت ببڕە'] },
    'shut your mouth': { kurdish: 'دەمت دابخە', context: 'Silence', alternatives: ['دەنگ مەکە', 'قسە مەکە'] },
    'piece of shit': { kurdish: 'پیاوی سووک', context: 'Insult', alternatives: ['سەگباب', 'کەسی بێئابڕوو'] },
    'freaking': { kurdish: 'نەفرەتی', context: 'Emphasis', alternatives: ['زۆر', 'بە نەفرەت'] },

    // Film & TV Subtitle Idioms and Conversational Phrases
    'are you out of your mind': { kurdish: 'تۆ شێت بوویت؟', context: 'Disbelief', alternatives: ['ئەقڵت لەدەستداوە؟', 'سەرت گەرم بووە؟'] },
    'are you crazy': { kurdish: 'تۆ شێت بوویت؟', context: 'Disbelief', alternatives: ['ئاوێتەی شێتی بوویت؟', 'هۆشت لەسەر نییە؟'] },
    'what on earth': { kurdish: 'چی گوزەر دەکات', context: 'Inquiry', alternatives: ['ئەمە چییە', 'چی ڕوویداوە'] },
    'what the hell': { kurdish: 'چی دۆزەخێکە', context: 'Shock', alternatives: ['چی گوزەر دەکات', 'ئەمە چییە'] },
    'you gotta be kidding me': { kurdish: 'گاڵتەم لەگەڵ دەکەیت؟', context: 'Incredulity', alternatives: ['ڕاست ناکەیت؟', 'پێم ڕابوێرە!'] },
    'you must be kidding': { kurdish: 'گاڵتەم لەگەڵ دەکەیت؟', context: 'Incredulity', alternatives: ['ڕاست ناکەیت؟', 'باوڕ ناکەم'] },
    'no offense': { kurdish: 'بێ ڕێزی نەبێت', context: 'Politeness', alternatives: ['مەبەستم بێڕێزی نییە', 'خۆت بێزار مەکە'] },
    'none of your business': { kurdish: 'پەیوەندی بە تۆوە نییە', context: 'Privacy', alternatives: ['کاری تۆ نییە', 'سەری خۆت بە کارتەوە بێت'] },
    // Action, Conflict, Cinematic Stakes & Everyday Dialogue
    'are you insane': { kurdish: 'شێت بوویت؟', context: 'Shock / Confrontation', alternatives: ['عەقڵت لەدەستداوە؟', 'هۆشت لەسەر خۆتە؟'] },
    'are you crazy': { kurdish: 'شێت بوویت؟', context: 'Shock / Confrontation', alternatives: ['هۆشت لەدەستداوە؟', 'تۆ لە هۆش خۆتی؟'] },
    'are you out of your mind': { kurdish: 'عەقڵت لەدەستداوە؟', context: 'Disbelief / Anger', alternatives: ['تۆ شێت بوویت؟', 'لە هۆش خۆت دەرچوویت؟'] },
    'calm down': { kurdish: 'هێمن بەرەوە', context: 'De-escalation', alternatives: ['ئارام بەرەوە', 'خۆت هێور بکەرەوە', 'پەلە مەکە'] },
    'keep calm': { kurdish: 'ئارام بە', context: 'De-escalation', alternatives: ['هێمن بە', 'خۆت کۆنتڕۆڵ بکە'] },
    'get a grip': { kurdish: 'خۆت کۆبکەرەوە', context: 'Urgent control', alternatives: ['هۆشت بێنەرەوە سەر خۆت', 'ئارام بگرە'] },
    'listen to me': { kurdish: 'گوێم لێ بگرە', context: 'Command / Appeal', alternatives: ['گوێ بگرە بۆ من', 'سەرنجت لای قسەم بێت'] },
    'look at me': { kurdish: 'سەیرم بکە', context: 'Command / Drama', alternatives: ['ڕووت لە من بێت', 'تەماشام بکە'] },
    'look into my eyes': { kurdish: 'سەیری ناو چاوم بکە', context: 'Dramatic Appeal', alternatives: ['ڕاستەوخۆ تەماشام بکە'] },
    'trust me': { kurdish: 'متمانەم پێ بکە', context: 'Reassurance', alternatives: ['باوەڕم پێ بکە', 'پشتم پێ ببەستە'] },
    'i promise': { kurdish: 'بەڵێن دەدەم', context: 'Pledge', alternatives: ['پەیمان بێت', 'پەیمانت پێ دەدەم'] },
    'i promise you': { kurdish: 'بەڵێنت پێ دەدەم', context: 'Pledge', alternatives: ['پەیمانم پێتدابێت', 'دڵنیابە لە قسەم'] },
    'you have my word': { kurdish: 'بەڵێنت پێ دەدەم', context: 'Formal Pledge', alternatives: ['پەیمانی پیاوانەیە', 'قسەی من قسەیە'] },
    'i give you my word': { kurdish: 'پەیمانت پێ دەدەم', context: 'Formal Pledge', alternatives: ['بەڵێنت پێ دەدەم', 'قسەی من بەهێزە'] },
    'no way': { kurdish: 'مەحاڵە!', context: 'Disbelief / Denial', alternatives: ['ڕێی تێناچێت!', 'بە هیچ جۆرێک نا!'] },
    'no way in hell': { kurdish: 'بە هیچ جۆرێک مەحاڵە', context: 'Strong Denial', alternatives: ['هەرگیز و بە هیچ شێوەیەک نا!'] },
    'not a chance': { kurdish: 'هیچ دەرفەتێک نییە', context: 'Refusal / Impossibility', alternatives: ['مەحاڵە', 'بە خەویش نایبینیت'] },
    'in your dreams': { kurdish: 'مەگەر لە خەودا بیبینیت', context: 'Dismissal', alternatives: ['لە خەیاڵتدا', 'مەحاڵە بۆت'] },
    'dream on': { kurdish: 'لە خەیاڵتدا بمێنەرەوە', context: 'Mockery / Dismissal', alternatives: ['خەوی پێوە ببینە'] },
    'let me go': { kurdish: 'بەرم بدە', context: 'Plea / Struggle', alternatives: ['دەستم لێ هەڵگرە', 'لێم گەڕێ با بڕۆم'] },
    'leave me alone': { kurdish: 'لێم گەڕێ بە تەنیا', context: 'Dismissal / Pain', alternatives: ['تەنیا بمکەرەوە', 'دەست لە کارم وەرمەدە'] },
    'wake up': { kurdish: 'خەبەرت بێتەوە', context: 'Urgent Alert', alternatives: ['بەئاگا وەرەوە', 'هۆشیار بە'] },
    'get up': { kurdish: 'هەستە سەرپێ', context: 'Encouragement / Action', alternatives: ['هەستە', 'بەپێوە بوەستە'] },
    'stand up': { kurdish: 'هەستە سەرپێ', context: 'Command', alternatives: ['بوەستە بەپێوە'] },
    'don\'t look': { kurdish: 'سەیر مەکە', context: 'Warning / Fear', alternatives: ['تەماشا مەکە', 'چاوەکانت دابخە'] },
    'shut up': { kurdish: 'دەمت داخە', context: 'Aggression / Silencing', alternatives: ['بێدەنگ بە', 'قسە مەکە'] },
    'shut your mouth': { kurdish: 'دەمت دابخە', context: 'Hostile Command', alternatives: ['بێدەنگ بە', 'قسە مەبڕە'] },
    'keep quiet': { kurdish: 'بێدەنگ بە', context: 'Caution', alternatives: ['دەنگ مەکە', 'هێمن بە'] },
    'what happened': { kurdish: 'چی ڕوویدا؟', context: 'Query', alternatives: ['چی بووە؟', 'چ ڕووداوێک ڕوویدا؟'] },
    'what is happening': { kurdish: 'چی ڕوودەدات؟', context: 'Urgent Query', alternatives: ['ئەمە چییە دەگوزەرێت؟', 'چی ڕوویداوە؟'] },
    "what's happening": { kurdish: 'چی ڕوودەدات؟', context: 'Urgent Query', alternatives: ['ئەمە چییە دەگوزەرێت؟'] },
    'who are you': { kurdish: 'تۆ کێیت؟', context: 'Identity Query', alternatives: ['خۆت بناسێنە', 'تۆ کێیت لێرە؟'] },
    'where are we': { kurdish: 'ئێمە لەکوێین؟', context: 'Location Query', alternatives: ['ئەم شوێنە کوێیە؟'] },
    'how is this possible': { kurdish: 'چۆن شتی وا دەبێت؟', context: 'Astonishment', alternatives: ['چۆن ڕوودانی مومکینە؟', 'ئەمە چۆن دەکرێت؟'] },
    'this cannot be happening': { kurdish: 'مەحاڵە شتی وا ڕووبدات!', context: 'Denial / Shock', alternatives: ['باوەڕناکەم ئەمە ڕووبدات!', 'ئەمە ڕاست نییە!'] },
    "this can't be happening": { kurdish: 'مەحاڵە شتی وا ڕووبدات!', context: 'Denial / Shock', alternatives: ['باوەڕ ناکەم شتی وا بێت!'] },
    'we have no time to lose': { kurdish: 'هیچ کاتێکمان بۆ لەدەستدان نییە', context: 'Urgency', alternatives: ['کاتمان زۆر تەنگە', 'دەبێت خێراکەین'] },
    'there is no time': { kurdish: 'کات نەماوە', context: 'Urgency', alternatives: ['کاتمان بەدەستەوە نییە', 'زووکەن'] },
    'stay out of this': { kurdish: 'تۆ دەستت لەمەدا نەبێت', context: 'Warning / Boundary', alternatives: ['خۆت تێکەڵ بەمە مەکە', 'دەست لە کارم وەرمەدە'] },
    'it is a matter of life and death': { kurdish: 'مەسەلەی مەرگ و ژیانە', context: 'Critical Stakes', alternatives: ['بابەتەکە ژیان و مردنە'] },
    "it's a matter of life and death": { kurdish: 'مەسەلەی مەرگ و ژیانە', context: 'Critical Stakes', alternatives: ['کێشەی ژیان و مەرگە'] },
    'you have my respect': { kurdish: 'ڕێزم بۆت هەیە', context: 'Respect', alternatives: ['شایستەی ڕێزی', 'ڕێزت لێ دەنێم'] },
    'i owe you one': { kurdish: 'قەرزاری تۆم', context: 'Gratitude', alternatives: ['چاکەی تۆم لەبیر ناچێت', 'قەرزارت بووم'] },
    'i owe you my life': { kurdish: 'قەرزاری ژیانمی', context: 'Deep Gratitude', alternatives: ['ژیانم بە تۆ بەستراوەتەوە', 'تۆ منت ڕزگارکرد'] },
    'don\'t make me do this': { kurdish: 'ناچارم مەکە ئەمە بکەم', context: 'Hesitation / Threat', alternatives: ['مەمخەرە دۆخێکەوە ئەمە بکەم'] },
    'do not make me do this': { kurdish: 'ناچارم مەکە ئەمە بکەم', context: 'Hesitation', alternatives: ['ناچارم مەکە'] },
    'running out of time': { kurdish: 'کات تەواو دەبێت', context: 'Countdown / Stakes', alternatives: ['کات بەرەو کۆتایی دەچێت', 'کاتی کەم ماوە'] },
    'it is now or never': { kurdish: 'یان ئێستا یان هەرگیز', context: 'Decisive Moment', alternatives: ['دەرفەت تەنها ئێستایە', 'ئەمڕۆ دەرفەتی کۆتاییە'] },
    "it's now or never": { kurdish: 'یان ئێستا یان هەرگیز', context: 'Decisive Moment', alternatives: ['دەرفەت تەنها ئێستایە'] },
    'keep moving forward': { kurdish: 'بەرەو پێشەوە بەردەوام بە', context: 'AoT / Eren / Resolve', alternatives: ['هەر بەرەو پێش بچۆ', 'کۆڵ مەدە'] },
    'never betray my friends': { kurdish: 'هەرگیز خیانەت لە هاوڕێکانم ناکەم', context: 'Loyalty / Anime Trope', alternatives: ['پشت لە هاوڕێکانم ناکەم'] },
    'there is no escape': { kurdish: 'هیچ دەربازبوونێک نییە', context: 'Trap / Villain Trope', alternatives: ['ڕێگەی هەڵاتن نییە', 'گەمارۆ دراویت'] },
    'prepare yourself': { kurdish: 'خۆت ئامادە بکە', context: 'Battle Warning', alternatives: ['خۆت بۆ شەڕ ئامادە بکە', 'وریا بە'] },
    'cannot hide from me': { kurdish: 'ناتوانیت خۆت لە من بشاریتەوە', context: 'Villain / Stalker Trope', alternatives: ['خۆشاردنەوە بێسوودە'] },
    'justice will prevail': { kurdish: 'دادپەروەری سەردەکەوێت', context: 'Heroic Statement', alternatives: ['حەق بەسەر باتڵدا سەردەکەوێت'] },
    'i will avenge you': { kurdish: 'تۆڵەت دەکەمەوە', context: 'Vengeance / Drama', alternatives: ['تۆڵەی خوێنت دەستێنمەوە'] },
    "i'll avenge you": { kurdish: 'تۆڵەت دەکەمەوە', context: 'Vengeance' },
    'don\'t push your luck': { kurdish: 'بەختی خۆت تاقی مەکەرەوە', context: 'Warning', alternatives: ['سنووری خۆت مەبەزێنە', 'زیاد لە پێویست باوەڕت بە بەخت نەبێت'] },
    'follow my lead': { kurdish: 'شوێنم بکەوە', context: 'Tactical Command', alternatives: ['وەک من بکە', 'پێڕەوی من بکە'] },
    'stick to the plan': { kurdish: 'پابەندی پلانەکە بن', context: 'Tactical Command', alternatives: ['لە پلانەکە لامەدەن', 'بەپێی نەخشەکە بڕۆن'] },
    'we did it': { kurdish: 'سەرکەوتین!', context: 'Celebration / Victory', alternatives: ['کارەکەمان ئەنجامدا!', 'تەواومان کرد!'] },
    'it is too late': { kurdish: 'زۆر درەنگە', context: 'Regret / Doom', alternatives: ['کاتی بەسەرچوو', 'هەموو شت تەواو بوو'] },
    "it's too late": { kurdish: 'زۆر درەنگە', context: 'Regret / Doom', alternatives: ['کاتی بەسەرچوو'] },
    'i am your ally': { kurdish: 'من هاوپەیمانتم', context: 'Alliance', alternatives: ['هاوڕێ و پشتیوانتم'] },
    "i'm your ally": { kurdish: 'من هاوپەیمانتم', context: 'Alliance' },
    'i will destroy you': { kurdish: 'لەناوت دەبەم!', context: 'Villain / Battle Threat', alternatives: ['تێکت دەشکێنم!', 'وێرانت دەکەم!'] },
    "i'll destroy you": { kurdish: 'لەناوت دەبەم!', context: 'Battle Threat', alternatives: ['تێکت دەشکێنم!'] },
    'take cover': { kurdish: 'پەنا بگرن!', context: 'Combat / Explosion Warning', alternatives: ['خۆتان بشارنەوە!', 'سەنگەر بگرن!'] },
    'fire at will': { kurdish: 'بە ئارەزووی خۆتان تەقە بکەن!', context: 'Military Command', alternatives: ['دەست بکەن بە تەقەکردن!'] },
    'hold your fire': { kurdish: 'تەقە ڕاگرن!', context: 'Military Command', alternatives: ['تەقەمەکەن!', 'دەست لە چەک هەڵگرن!'] },
    'it is an ambush': { kurdish: 'ئەمە بۆسەیە!', context: 'Combat / Trap', alternatives: ['کەوتینە بۆسەوە!'] },
    "it's an ambush": { kurdish: 'ئەمە بۆسەیە!', context: 'Combat / Trap', alternatives: ['کەوتینە بۆسەوە!'] },
    'we are surrounded': { kurdish: 'گەمارۆ دراوین!', context: 'Combat Alarm', alternatives: ['دەورە دراوین لە هەموو لایەکەوە!'] },
    "we're surrounded": { kurdish: 'گەمارۆ دراوین!', context: 'Combat Alarm', alternatives: ['دەورە دراوین!'] },
    'call for backup': { kurdish: 'داوای هێزی پشتیوانی بکەن', context: 'Police / Action', alternatives: ['داوای یارمەتی فریاگوزاری بکەن'] },
    'reinforcements are coming': { kurdish: 'هێزی پشتیوانی لە ڕێگایە', context: 'Action / Hope', alternatives: ['یارمەتی نزیکە'] },
    'cover me': { kurdish: 'پەنام بدە! (پشتم بگرە لە تەقەکردندا)', context: 'Action Tactical', alternatives: ['تەقە بکە تا دەڕۆم', 'بەرگریم لێ بکە'] },
    'watch out': { kurdish: 'وریا بە!', context: 'Danger Warning', alternatives: ['ئاگاداربە!', 'خۆت بپارێزە!'] },
    'look out': { kurdish: 'ئاگاداربە!', context: 'Danger Warning', alternatives: ['وریا بە!', 'پەنا بگرە!'] },
    'heads up': { kurdish: 'ئاگاداربە!', context: 'Warning', alternatives: ['سەرنجت بدە!', 'وریا بن!'] },
    'incoming': { kurdish: 'موشەک / مەترسی لە ڕێگایە!', context: 'Danger Alert', alternatives: ['خۆتان لادەن!', 'بەربوونەوە لە ڕێگایە!'] },
    'stay with me': { kurdish: 'لەگەڵمدا بمێنەرەوە', context: 'Emotional / Medical Emergency', alternatives: ['چاوەکانت دامەخە', 'کۆڵ مەدە لە ژیان'] },
    "don't die on me": { kurdish: 'مەمرە لێم!', context: 'Desperation / Cinema Trope', alternatives: ['بژی و کۆڵ مەدە!', 'چاوەکانت دامەخە!'] },
    "i won't let you die": { kurdish: 'ناهێڵم بمریت!', context: 'Heroic Devotion', alternatives: ['دەتبەم بۆ سەلامەتی!', 'ڕزگارت دەکەم!'] },
    'rest in peace': { kurdish: 'ڕۆحت شاد بێت', context: 'Eulogy / Condolence', alternatives: ['بە ئارامی بنوو', 'خوات لەگەڵ بێت'] },
    'may you rest in peace': { kurdish: 'ڕۆحت شاد و ئارام بێت', context: 'Eulogy', alternatives: ['خوات لەگەڵ بێت'] },
    'it is an honor': { kurdish: 'شەرەفێکی گەورەیە', context: 'Formal Respect', alternatives: ['شانازییە بۆ من'] },
    "it's an honor": { kurdish: 'شەرەفێکی گەورەیە', context: 'Formal Respect', alternatives: ['شانازییە بۆ من'] },
    'till we meet again': { kurdish: 'تا دیداری داهاتوو', context: 'Farewell', alternatives: ['تا دووبارە دەتبینمەوە', 'بەخێر بچیت'] },
    'farewell': { kurdish: 'ماڵئاوا بۆ هەمیشە', context: 'Formal / Tragic Farewell', alternatives: ['خوات لەگەڵ', 'سەفەرت خێر'] },
    'see you around': { kurdish: 'دواتر دەتبینمەوە', context: 'Casual Goodbye', alternatives: ['تا دیداری تر', 'کاتت شاد'] },
    'catch you later': { kurdish: 'دواتر قسە دەکەینەوە', context: 'Casual Goodbye', alternatives: ['دواتر یەک دەبینینەوە'] },
    'take care of yourself': { kurdish: 'ئاگاداری خۆت بە', context: 'Affectionate Farewell', alternatives: ['خۆت بپارێزە', 'ئاگات لە خۆت بێت'] },
    'welcome back': { kurdish: 'بەخێربێیتەوە', context: 'Greeting', alternatives: ['بەخێرهاتنەوەت پیرۆز بێت', 'چاوەکانت ڕووناک'] },
    'welcome home': { kurdish: 'بەخێربێیتەوە بۆ ماڵەوە', context: 'Heartfelt Greeting', alternatives: ['ماڵت ڕووناک کردەوە'] },
    'long time no see': { kurdish: 'مێژوویەکە نەمدیویت', context: 'Greeting', alternatives: ['لە مێژە یەکمان نەدیوە', 'کۆنە دیدار'] },
    "what's up": { kurdish: 'چ هەواڵ؟', context: 'Casual Greeting', alternatives: ['چ باسە؟', 'هەواڵت چۆنە؟'] },
    'how is it going': { kurdish: 'کاروبارت چۆن دەڕوات؟', context: 'Casual Greeting', alternatives: ['بارودۆخت چۆنە؟', 'دەگوزەرێت؟'] },
    "how's it going": { kurdish: 'بارودۆخت چۆن دەڕوات؟', context: 'Casual Greeting', alternatives: ['کارەکان چۆنن؟'] },
    'what brings you here': { kurdish: 'خێرە هاتووی بۆ ئێرە؟', context: 'Encounter Query', alternatives: ['چی هێناویەتی بۆ ئێرە؟'] },
    'glad to see you': { kurdish: 'دڵخۆشم بە بینینت', context: 'Warm Greeting', alternatives: ['خۆشحاڵم بە چاوپێکەوتنت'] },
    'nice to meet you': { kurdish: 'خۆشحاڵم بە ناسینت', context: 'Greeting', alternatives: ['شەرەفمەند بووم بە ناسینت'] },
    'my pleasure': { kurdish: 'شایەنی نییە / بە خۆشحاڵییەوە', context: 'Polite Response', alternatives: ['جێی شانازییە بۆ من', 'بە سەرچاو'] },
    'don\'t mention it': { kurdish: 'شایەنی باس نییە', context: 'Polite Response', alternatives: ['سوپاس ناوێت', 'شتێکی وا نەبووە'] },
    'pardon me': { kurdish: 'ببوورە لە من', context: 'Polite Request', alternatives: ['لێم ببورە', 'داوای لێبوردن دەکەم'] },
    'excuse me': { kurdish: 'ببوورە', context: 'Polite Interruption', alternatives: ['ڕێگەم بدە', 'دەکرێت بپرسم'] },
    'my bad': { kurdish: 'هەڵەی من بوو', context: 'Casual Apology', alternatives: ['کەمتەرخەمی لە من بوو', 'ببوورە'] },
    'i apologize': { kurdish: 'داوای لێبوردن دەکەم', context: 'Formal Apology', alternatives: ['ببوورە', 'داوای لێخۆشبوون دەکەم'] },
    'no problem': { kurdish: 'هیچ کێشە نییە', context: 'Reassurance', alternatives: ['خەمی ناوێت', 'ئاساییە'] },
    'no worries': { kurdish: 'خەمت نەبێت', context: 'Reassurance', alternatives: ['کێشە نییە', 'دڵگران مەبە'] },
    'sounds good': { kurdish: 'پێشنیارێکی باشە', context: 'Agreement', alternatives: ['پێم باشە', 'ڕێکەوتین'] },
    'sounds like a plan': { kurdish: 'پلانێکی نایابە', context: 'Enthusiastic Agreement', alternatives: ['پێشنیارێکی زۆر باشە', 'با بەو جۆرە بێت'] },
    'count me in': { kurdish: 'ناوی منیش بنووسە (لەگەڵتانم)', context: 'Participation', alternatives: ['منیش بەشدارم', 'من لەگەڵتانم'] },
    'count me out': { kurdish: 'من لەگەڵتان نیم', context: 'Refusal', alternatives: ['من بەشدار نابم', 'لەمەدا مەمژمێرن'] },
    'deal with it': { kurdish: 'ڕابێ لەگەڵیدا', context: 'Dismissive Advice', alternatives: ['چارەسەری بکە بۆ خۆت', 'قبووڵی بکە'] },
    'hands off': { kurdish: 'دەستت لابدە!', context: 'Defensive Command', alternatives: ['دەستی لێ مەدە!', 'دەستبەردار بە!'] },
    'freeze': { kurdish: 'لە شوێنی خۆت مەجوڵێ!', context: 'Police / Action Command', alternatives: ['بوەستە و نەجوڵێیت!', 'دەستەکانت بەرزکەرەوە!'] },
    'on your knees': { kurdish: 'لەسەر چۆک دابنیشە!', context: 'Action / Hostile Command', alternatives: ['چۆک دابدە!'] },
    'over my dead body': { kurdish: 'مەحاڵە تا زیندوم', context: 'Defiance', alternatives: ['لەسەر جەستەی من ڕوودەدات', 'هەرگیز نا'] },
    "I don't give a damn": { kurdish: 'گرنگی پێ نادەم', context: 'Indifference', alternatives: ['تەنانەت باکشم نییە', 'باکم بەوە نییە'] },
    "I don't care": { kurdish: 'گرنگی پێ نادەم', context: 'Indifference', alternatives: ['خەمم نییە', 'باکم نییە'] },
    "I don't give a shit": { kurdish: 'هیچ باکم نییە', context: 'Strong Indifference', alternatives: ['گرنگی پێ نادەم', 'سەر لەوە نادەم'] },
    'keep your mouth shut': { kurdish: 'دەمت بپۆشە', context: 'Secrecy', alternatives: ['قسە مەکە', 'دەمت دابخە'] },
    'cut it out': { kurdish: 'بەسی بکە', context: 'Stop it', alternatives: ['ڕایبگرە', 'واز لەوە بێنە'] },
    'knock it off': { kurdish: 'بەسی بکە', context: 'Stop it', alternatives: ['خۆت کۆبکەرەوە', 'وەستاو بێت'] },
    'get out of my face': { kurdish: 'لەبەرچاوم دوورکەوەرەوە', context: 'Anger', alternatives: ['لەبەرچاوم وون بە', 'تێپەڕە'] },
    'give me a break': { kurdish: 'مۆڵەتم بدە', context: 'Exasperation', alternatives: ['واز لە من بێنە', 'دەستم لێ هەڵگرە'] },
    'watch your tongue': { kurdish: 'ئاگاداری زمانت بە', context: 'Warning', alternatives: ['بە ڕێزەوە قسە بکە', 'زمانت بپێچەوە'] },
    'watch your mouth': { kurdish: 'ئاگاداری دەمت بە', context: 'Warning', alternatives: ['بە ڕێزەوە قسە بکە', 'قسەی ناشیرین مەکە'] },
    'dead serious': { kurdish: 'بە تەواوی ڕاستمە', context: 'Seriousness', alternatives: ['پێکەنینی تێدا نییە', 'بە هەموو جدییەتێکەوە'] },
    'piece of cake': { kurdish: 'کارێکی زۆر ئاسان', context: 'Very easy', alternatives: ['وەک ئاو خواردنەوە', 'زۆر سادەیە', 'ئاسانتر لەوەی بیرت لێ دەکردەوە'] },
    'break a leg': { kurdish: 'بەهیوای سەرکەوتن', context: 'Good luck', alternatives: ['بەختێکی باش', 'سەرکەوتوو بیت', 'بەخت لەگەڵت بێت'] },
    'out of the blue': { kurdish: 'لەناکاو', context: 'Unexpectedly', alternatives: ['کتوپڕ', 'بەبێ چاوەڕوانی', 'لە پڕێکدا', 'لە هیچ کۆیەکەوە'] },
    'all of a sudden': { kurdish: 'لەپڕدا', context: 'Suddenly', alternatives: ['لەناکاو', 'کتوپڕ', 'بە بێئاگایی'] },
    'at the end of the day': { kurdish: 'لە کۆتاییدا', context: 'Ultimately', alternatives: ['سەرەنجام', 'لە ئەنجامدا', 'لە دەرئەنجامدا', 'بە کورتی'] },
    'make sense': { kurdish: 'مانای هەیە', context: 'Logical/clear', alternatives: ['لۆژیکییە', 'جێی باوەڕە', 'تێگەیشتنی ئاسانە', 'ڕاست دەردەکەوێت'] },
    'does not make sense': { kurdish: 'هیچ مانایەکی نییە', context: 'Nonsense', alternatives: ['جێی تێگەیشتن نییە', 'بێ مانایە', 'سەری لێ دەرناچێت'] },
    "doesn't make sense": { kurdish: 'هیچ مانایەکی نییە', context: 'Nonsense', alternatives: ['جێی تێگەیشتن نییە', 'بێ مانایە', 'سەری لێ دەرناچێت'] },
    'never mind': { kurdish: 'کێشە نییە، لەبیری کە', context: 'Don\'t worry / ignore', alternatives: ['گرنگ نییە', 'بێ خەم بە', 'واز لەوە بێنە', 'لەبیریبکە'] },
    'as a matter of fact': { kurdish: 'لە ڕاستیدا', context: 'In reality', alternatives: ['بە پێچەوانەوە، لە واقیعدا', 'لە حەقیقەتدا', 'ڕاستییەکەی'] },
    'in fact': { kurdish: 'لە ڕاستیدا', context: 'Actually', alternatives: ['بە ڕاستی', 'لە واقیعدا', 'ڕاستییەکەی'] },
    'by the way': { kurdish: 'لەم نێوەندەدا / بە بۆنەیەوە', context: 'Incidentally', alternatives: ['بە ڕێکەوت', 'لێرەدا شتێک بڵێم', 'بەنۆبەی خۆی'] },
    'on the other hand': { kurdish: 'لە لایەکی ترەوە', context: 'Conversely', alternatives: ['بە پێچەوانەوە', 'لە ڕوانگەیەکی ترەوە', 'لە ڕوویەکی دیکەوە'] },
    'sooner or later': { kurdish: 'زوو بێت یان درەنگ', context: 'Inevitably', alternatives: ['ڕۆژێک لە ڕۆژان', 'لە کۆتاییدا هەر ڕوودەدات', 'سەرەنجام'] },
    'take it easy': { kurdish: 'ئارام بە، خەمت نەبێت', context: 'Relax / calm down', alternatives: ['هێمن بەوە', 'ئاسان وەریگرە', 'خۆت تێک مەدە'] },
    'hang in there': { kurdish: 'خۆڕاگر بە', context: 'Stay strong', alternatives: ['بەردەوام بە و کۆڵ مەدە', 'ئارام بگرە', 'ورەت نەبەزێت'] },
    'pull yourself together': { kurdish: 'خۆت کۆبکەرەوە', context: 'Control emotions', alternatives: ['ئاگات لە خۆت بێت', 'هێمن بەرەوە', 'هۆشت کۆبکەرەوە'] },
    'call it a day': { kurdish: 'با کۆتایی پێ بهێنین', context: 'Finish work for today', alternatives: ['بۆ ئەمڕۆ بەسە', 'کارەکان کۆتایی پێبهێنین', 'بەسی بکەین'] },
    'no big deal': { kurdish: 'شتێکی ئەوتۆ نییە', context: 'Not important', alternatives: ['کێشەیەکی گەورە نییە', 'گرنگ نییە', 'خەمی ناوێت'] },
    'fair enough': { kurdish: 'قسەیەکی بەجێیە', context: 'Acceptable point', alternatives: ['قبووڵکراوە', 'پێم باشە', 'ڕاست دەکەیت'] },
    'for what it is worth': { kurdish: 'ئەگەر سودی هەبێت', context: 'If helpful', alternatives: ['بە ڕای من', 'تەنها بۆ زانیاری', 'ئەگەر یارمەتیدەر بێت'] },
    "for what it's worth": { kurdish: 'ئەگەر سودی هەبێت', context: 'If helpful', alternatives: ['بە ڕای من', 'تەنها بۆ زانیاری', 'ئەگەر یارمەتیدەر بێت'] },
    'ring a bell': { kurdish: 'ئاشنا دیارە', context: 'Sounds familiar', alternatives: ['وەبیرم دێتەوە', 'ناسیاوە', 'ناوی ئاشنایە'] },
    'hands down': { kurdish: 'بێگومان', context: 'Undoubtedly', alternatives: ['بە دڵنیاییەوە', 'بێ ڕکابەر', 'بێ چەندوچۆن', 'بە تەواوی'] },
    'keep an eye on': { kurdish: 'ئاگاداری بە', context: 'Watch closely', alternatives: ['چاوێکی لێ بێت', 'چاودێری بکە', 'چاو لەسەر دانێ'] },
    'read between the lines': { kurdish: 'لە مەبەستە شاراوەکە تێبگە', context: 'Hidden meaning', alternatives: ['لە نهێنییەکان تێبگە', 'قووڵتر بیربکەرەوە', 'وەردبە'] },
    'think outside the box': { kurdish: 'جیاواز بیربکەرەوە', context: 'Creative thinking', alternatives: ['داهێنەرانە بیربکەرەوە', 'لە دەرەوەی چوارچێوە بیربکەرەوە'] },
    'cost an arm and a leg': { kurdish: 'زۆر گرانە', context: 'Very expensive', alternatives: ['نرخێکی خەیاڵیی هەیە', 'بە پارەیەکی زۆرە'] },
    'spill the beans': { kurdish: 'نهێنییەکە ئاشکرا بکە', context: 'Reveal secret', alternatives: ['ڕاستییەکان بدرکێنە', 'قسە بکە', 'ڕاستییەکە بڵێ'] },
    'safe and sound': { kurdish: 'ساغ و سەلامەت', context: 'Unharmed', alternatives: ['بە سەلامەتی', 'بێ زیان', 'ساغ و وڵاغ'] },
    'in a nutshell': { kurdish: 'بە کورتی', context: 'Briefly', alternatives: ['بە کورت و پوختی', 'پوختەکەی', 'پوختەی قسە'] },
    'from scratch': { kurdish: 'لە سەرەتاوە', context: 'From beginning', alternatives: ['لە بنەڕەتەوە', 'لە سفرەوە', 'لە بنچینەوە'] },
    'by all means': { kurdish: 'بێگومان', context: 'Certainly', alternatives: ['بە دڵنیاییەوە', 'بە هەموو شێوەیەک', 'دڵنیابە'] },
    'point of view': { kurdish: 'دیدگا', context: 'Perspective', alternatives: ['بۆچوون', 'ڕوانگە', 'تێڕوانین', 'گۆشەنیگا'] },
    'day in and day out': { kurdish: 'ڕۆژ لە دوای ڕۆژ', context: 'Continuously', alternatives: ['بە بەردەوامی', 'هەموو ڕۆژێک', 'بە ڕۆژ و شەو'] },
    'time will tell': { kurdish: 'کات هەموو شتێک دەردەخات', context: 'Future will reveal', alternatives: ['ڕۆژگار دەیسەلمێنێت', 'پاشان دەردەکەوێت'] },
    'figure out': { kurdish: 'تێبگە', context: 'Understand/solve', alternatives: ['چارەسەر بدۆزەرەوە', 'پێی بزانیت', 'سەری لێ دەربکەیت'] },
    'come up with': { kurdish: 'بدۆزەرەوە', context: 'Propose/create', alternatives: ['پێشنیار بکە', 'بەرهەم بهێنە'] },
    'call off': { kurdish: 'هەڵوەشاندنەوە', context: 'Cancel', alternatives: ['ڕاگرتن', 'بەتاڵکردنەوە'] },
    'put off': { kurdish: 'دواخستن', context: 'Postpone', alternatives: ['وەپاشخستن', 'پاشخستن'] },
    'look forward to': { kurdish: 'بەپەرۆشەوە چاوەڕێم', context: 'Eagerly anticipate', alternatives: ['بە تامەزرۆییەوە چاوەڕوانی دەکەم', 'چاوەڕوانم'] },
    'bear in mind': { kurdish: 'لەبیرت بێت', context: 'Remember', alternatives: ['لەبەرچاوی بگرە', 'لە یادتبێت'] },
    'take for granted': { kurdish: 'بە ئاسایی وەریگرە', context: 'Underestimate', alternatives: ['قەدری نەزانیت', 'بە کەم سەیریکردن'] },
    'cross the line': { kurdish: 'سنوور بەزاندن', context: 'Go too far', alternatives: ['لە سنوور دەرچوون', 'پێشێلکردن'] },
    'get out of hand': { kurdish: 'لە کۆنتڕۆڵ دەرچوون', context: 'Out of control', alternatives: ['لە دەست دەربچێت', 'ئاڵۆز بوون'] },
    'get rid of': { kurdish: 'ڕزگاربوون لێی', context: 'Eliminate', alternatives: ['خۆ دەربازکردن', 'لە کۆڵکردنەوە', 'فڕێدان'] },
    'hit the road': { kurdish: 'کەوتنە ڕێ', context: 'Depart', alternatives: ['بەڕێکەوتن', 'دەست بە گەشتکردن'] },
    'under the weather': { kurdish: 'تەندروستیم باش نییە', context: 'Feeling unwell', alternatives: ['کەمێک ناڕەحەتم', 'هەست بە نەخۆشی دەکەم'] },
    'bite the bullet': { kurdish: 'بەرگەی بگرە', context: 'Endure difficulty', alternatives: ['سەبر بگرە', 'قبووڵی بکە'] },
    'face the music': { kurdish: 'ڕووبەڕووی لێکەوتەکان ببەرەوە', context: 'Accept consequences', alternatives: ['باجەکەی بدە', 'ئەنجامەکەی قبووڵ بکە'] },
    'once in a blue moon': { kurdish: 'زۆر بە دەگمەن', context: 'Very rarely', alternatives: ['هەر لە کەونارا جارێک', 'جاروبارێکی کەم'] },
    'see eye to eye': { kurdish: 'هاوڕابوون', context: 'Agree fully', alternatives: ['ڕێککەوتن', 'یەکهەڵوێست بوون'] },
    'speak of the devil': { kurdish: 'ناوی هات و خۆی هات', context: 'Speaking of person', alternatives: ['هەر باسی تۆمان دەکرد'] },
    'burn the midnight oil': { kurdish: 'شەونخوونی کردن', context: 'Work late', alternatives: ['تا درەنگ کارکردن'] },
    'cut corners': { kurdish: 'کەمکردنەوەی کوالیتی', context: 'Rush work cheaply', alternatives: ['ڕێگەی کورت گرتنەبەر'] },
    'on the fence': { kurdish: 'دوودڵ', context: 'Undecided', alternatives: ['بڕیارنەدراو', 'لە نێوان دوو بڕیاردا'] },
    'pull someone leg': { kurdish: 'گاڵتەکردن لەگەڵ کەسێک', context: 'Tease someone', alternatives: ['ڕابواردن', 'فریودانی بە گاڵتە'] },
    "pull someone's leg": { kurdish: 'گاڵتەکردن لەگەڵ کەسێک', context: 'Tease someone', alternatives: ['ڕابواردن', 'فریودانی بە گاڵتە'] },
    'the elephant in the room': { kurdish: 'بابەتە گرنگە پشتگوێخراوەکە', context: 'Obvious problem', alternatives: ['کێشە سەرەکییە نەبینراوەکە'] },
    'through thick and thin': { kurdish: 'لە خۆشی و لە ناخۆشیدا', context: 'In all circumstances', alternatives: ['لە هەموو بارودۆخێکدا'] },
    'actions speak louder than words': { kurdish: 'کردار لە قسە بەهێزترە', context: 'Action over words', alternatives: ['کردار شەرتە نەک قسە'] },
    'better safe than sorry': { kurdish: 'خۆپاراستن لە پەشیمانی باشترە', context: 'Caution is best', alternatives: ['وریا بە'] },
    'easier said than done': { kurdish: 'قسەکردن لە کردار ئاسانترە', context: 'Hard to do', alternatives: ['کرداری قورسە'] },
    'every cloud has a silver lining': { kurdish: 'لە هەموو ناخۆشییەکدا خێرێک هەیە', context: 'Silver lining', alternatives: ['هیوایەک هەیە'] },
    'leave no stone unturned': { kurdish: 'هەموو هەوڵێک بدە', context: 'Search everywhere', alternatives: ['هەموو شوێنێک بگەڕێ'] },
    'look before you leap': { kurdish: 'پێش هەنگاونان بیربکەرەوە', context: 'Think before acting', alternatives: ['بە ژیری مامەڵە بکە'] },
    'no pain no gain': { kurdish: 'بێ ڕەنج کێشان بەرهەم نابێت', context: 'Effort brings results', alternatives: ['هەوڵدان پێویستە'] },
    'practice makes perfect': { kurdish: 'ڕاهێنان دەبێتە هۆی لێهاتوویی', context: 'Practice makes skill', alternatives: ['بە مەشق دەگەیتە ئامانج'] },
    'the early bird catches the worm': { kurdish: 'سەحەرخێز بەختەوەرە', context: 'Early starter wins', alternatives: ['زوو دەستپێکردن سەرکەوتنە'] },
    'time is money': { kurdish: 'کات زێڕە', context: 'Time is valuable', alternatives: ['کات بەنرخە'] },
    'back to square one': { kurdish: 'گەڕانەوە بۆ خاڵی سەرەتا', context: 'Start over', alternatives: ['دەستپێکردنەوە لە سەرەتاوە'] },
    'burn bridges': { kurdish: 'پردەکانی پەیوەندی بپچڕێنە', context: 'Cut all ties', alternatives: ['ڕێگەی گەڕانەوە مەهێڵەرەوە'] },
    'drive someone crazy': { kurdish: 'کەسێک شێت کردن', context: 'Infuriate', alternatives: ['لە هۆش خۆ بردن', 'بێزارکردنی توند'] },
    'curiosity killed the cat': { kurdish: 'زۆرزانی زیانی هەیە', context: 'Excess curiosity', alternatives: ['لە هەموو شت مەکۆڵەرەوە'] },
    'mind your own business': { kurdish: 'دەست لە کارمەوە مەدە', context: 'Stay out of it', alternatives: ['ئاگاداری کاری خۆت بە', 'سەری خۆت بە کارتەوە بێت'] },
    'step by step': { kurdish: 'هەنگاو بە هەنگاو', context: 'Gradually', alternatives: ['کەم کەم', 'پلە بە پلە'] },
    'as long as': { kurdish: 'مادام', context: 'Provided that', alternatives: ['تا ئەو کاتەی', 'ئەگەر'] },
    'no matter what': { kurdish: 'چی ڕووبدات', context: 'In any case', alternatives: ['بە هەموو بارێکدا', 'بە هەر نرخێک بێت'] },
    "it's up to you": { kurdish: 'بڕیارەکە لای تۆیە', context: 'Your choice', alternatives: ['تۆ بڕیار بدە', 'وەک خۆت دەتەوێت'] },
    'it is up to you': { kurdish: 'بڕیارەکە لای تۆیە', context: 'Your choice', alternatives: ['تۆ بڕیار بدە', 'وەک خۆت دەتەوێت'] },
    'make yourself at home': { kurdish: 'ماڵی خۆتە', context: 'Feel comfortable', alternatives: ['ئاسوودە بە', 'تەواو بە ئاسودەیی بە'] },
    "for god's sake": { kurdish: 'لەبەر خاتری خوا', context: 'For goodness sake', alternatives: ['پێ خاتری خوا', 'لەپێناو خوادا'] },
    'on my way': { kurdish: 'لە ڕێگام', context: 'Coming now', alternatives: ['بەڕێوەم', 'ئێستا دێم'] },
    'give me a hand': { kurdish: 'یارمەتیم بدە', context: 'Help me', alternatives: ['دەستم بگرە', 'کەمێک هاوکاریم بکە'] },
    'hit the hay': { kurdish: 'چوون بۆ خەوتن', context: 'Go to sleep', alternatives: ['خەوتن', 'پاڵکەوتن'] },
    'out of order': { kurdish: 'لەکارکەوتووە', context: 'Not working', alternatives: ['خراپبووە', 'تێکچووە'] },
    'back and forth': { kurdish: 'هاتووچۆ', context: 'Repeatedly', alternatives: ['پێش و پاش', 'بەردەوام هەڵبەز و دابەز'] },
    'so be it': { kurdish: 'با وابێت', context: 'Let it be', alternatives: ['با ڕووبدات', 'باشە بەو شێوەیە'] },
    'in the blink of an eye': { kurdish: 'لە چاوتروکانێکدا', context: 'Instantly', alternatives: ['بە خێرایی بەرق', 'زۆر بە پەلە'] },
    'ubiquitous': { kurdish: 'لە هەموو شوێنێک بەربڵاو', context: 'Everywhere', alternatives: ['گشتگیر', 'هەمەلایەنە'] },
    'ephemeral': { kurdish: 'تەمەن کورت و کاتی', context: 'Short-lived', alternatives: ['زووگوزەر', 'نەبڕاوە'] },
    'resilience': { kurdish: 'خۆڕاگری', context: 'Toughness', alternatives: ['پشوودرێژی', 'توانای بەردەوامی'] },
    'paradigm shift': { kurdish: 'گۆڕانکاری بنەڕەتی', context: 'Fundamental change', alternatives: ['وەرچەرخانی مێژوویی', 'سەرلەنوێ داڕشتنەوە'] },
    'meticulous': { kurdish: 'زۆر بە دیقەت و وردبین', context: 'Detailed/careful', alternatives: ['وردکار', 'بە سەلیقە'] },
    'quintessential': { kurdish: 'نموونەی باڵا', context: 'Perfect example', alternatives: ['پوختەی سەرەکی', 'بەرجەستەکەری تەواو'] },
    'serendipity': { kurdish: 'ڕێکەوتی بەختەوەرانە', context: 'Lucky discovery', alternatives: ['دەستکەوتی چاوەڕواننەکراو', 'بەختی چاک'] },
    'inevitable': { kurdish: 'حەتمی و چاوەڕوانکراو', context: 'Unavoidable', alternatives: ['خۆلێلادان مەحاڵ', 'ڕوودانی مسۆگەرە'] },
    'ambiguous': { kurdish: 'ناڕوون و دوومانادار', context: 'Unclear', alternatives: ['تەمومژاوی', 'لێڵ'] },
    'eloquent': { kurdish: 'ڕەوانبێژ و زمانپاراو', context: 'Well-spoken', alternatives: ['قسەزان', 'شیرین زمان'] },
    'profound': { kurdish: 'قووڵ و پڕواتا', context: 'Deep meaning', alternatives: ['کاریگەر', 'بنەڕەتی'] },
    'lucid': { kurdish: 'ڕوون و ئاشکرا', context: 'Clear/bright', alternatives: ['ڕۆشن', 'هۆشیار'] },
    'pragmatic': { kurdish: 'واقیعبین و کردارەکی', context: 'Realistic/practical', alternatives: ['سوودخواز', 'پراکتیکی'] },
    'superfluous': { kurdish: 'زیادە و ناپێویست', context: 'Unnecessary', alternatives: ['بێسوود', 'پێویست پێی نەکراو'] },

    // Philosophical, Existential & Rich World Concepts
    'zeitgeist': { kurdish: 'ڕۆحی سەردەم', context: 'Spirit of the Age', alternatives: ['کەشوهەوای قۆناغ', 'هزری زاڵی سەردەم'] },
    'weltanschauung': { kurdish: 'جیهانبینی', context: 'Worldview', alternatives: ['تێڕوانین بۆ گەردوون', 'گۆشەنیگای ژیان'] },
    'existential': { kurdish: 'بوونی و چارەنووسساز', context: 'Existence / Survival', alternatives: ['پەیوەست بە بوون', 'بنەڕەتی'] },
    'existential crisis': { kurdish: 'قەیرانی بوونگەری', context: 'Identity / Meaning Crisis', alternatives: ['قەیرانی مانا و ناسنامە', 'سەرلێشێواوی دەروونی'] },
    'catharsis': { kurdish: 'داماڵین و ئارامبوونەوەی دەروونی', context: 'Emotional Release', alternatives: ['پاکبوونەوەی هەست', 'دەربڕینی ئازار'] },
    'hubris': { kurdish: 'لووتبەرزی و لەخۆباییبوونی وێرانکەر', context: 'Fatal Pride', alternatives: ['فیز و کەلەڕەقی', 'خۆبەگەورەزانی'] },
    'sublime': { kurdish: 'شاکار و بێوێنە', context: 'Awe-inspiring Beauty', alternatives: ['شکۆدار', 'بەرز و پیرۆز', 'سەرنجڕاکێشی بێسنوور'] },
    'epiphany': { kurdish: 'تێگەیشتنی کتوپڕ و ڕووناکبوونەوە', context: 'Sudden Realization', alternatives: ['وەحی و ئیلهام', 'دۆزینەوەی حەقیقەت'] },
    'transcendent': { kurdish: 'سەرووی سنووری ماددە و تێگەیشتن', context: 'Beyond Normal Limits', alternatives: ['باڵا و مەزن', 'سەرووسروشتی'] },
    'ethereal': { kurdish: 'ناسکی ئاسمانی و ڕۆحانی', context: 'Heavenly / Delicate', alternatives: ['تەمومژاوی ناسک', 'ڕۆحانی'] },
    'oblivion': { kurdish: 'فەوتان و لەبیرچوونەوەی تەواو', context: 'Complete Forgetfulness / Extinction', alternatives: ['نەمان', 'ناوچوون', 'تاریکی بێبن'] },
    'nihilism': { kurdish: 'پووچگەری و بێمانایی بوون', context: 'Meaninglessness of Life', alternatives: ['ڕەتکردنەوەی بەهاکان', 'نیهیلیزم'] },
    'stoicism': { kurdish: 'پشوودرێژی و خۆڕاگریی ساردی فەلسەفی', context: 'Endurance Without Emotion', alternatives: ['بێدەنگی بەرامبەر ئازار', 'دانبەخۆداگرتن'] },
    'introspection': { kurdish: 'خۆڕوانین و قووڵبوونەوە لە دەروون', context: 'Self-examination', alternatives: ['لێکۆڵینەوە لە ناخی خۆ', 'خۆهەڵسەنگاندن'] },
    'nostalgia': { kurdish: 'حەسرەتی ڕابردوو و یادی کۆن', context: 'Longing for the Past', alternatives: ['تامەزرۆیی کاتی پێشوو', 'دڵتەنگی بۆ وڵات و ڕابردوو'] },
    'melancholy': { kurdish: 'دڵتەنگییەکی قووڵی هێمن', context: 'Poetic Sadness', alternatives: ['خەمۆکی ئارام', 'ماتەمی'] },
    'solitude': { kurdish: 'تەنیاییەکی ئارام و پڕبەها', context: 'Peaceful Aloneness', alternatives: ['دوورەپەرێزی سوودبەخش', 'گۆشەگیری ئارام'] },
    'labyrinth': { kurdish: 'تۆڕی ئاڵۆز و ڕێگەی سەرلێشێوێنەر', context: 'Maze / Complex Mystery', alternatives: ['تەڵەی پێچاوپێچ', 'ئاڵۆزکاو'] },
    'eternity': { kurdish: 'هەتاهەتایی و بێپایانی', context: 'Infinite Time', alternatives: ['نەمری', 'تەمەنی بێسنوور'] },
    'uncanny': { kurdish: 'ترسناک و نامۆ بە شێوەیەکی نادیار', context: 'Strange & Mysterious', alternatives: ['سەرسوڕهێنەری سامناک', 'نائاسایی'] },
    'duality': { kurdish: 'دووانەیی و دووفاقی', context: 'Twofold Nature', alternatives: ['دووڕوویی سروشت', 'دژایەتی ناوخۆیی'] },
    'metamorphosis': { kurdish: 'وەرچەرخان و گۆڕانی بنەڕەتی', context: 'Transformation', alternatives: ['گۆڕانی شێوە و جەستە', 'نوێبوونەوە'] },
    'paradox': { kurdish: 'دژبێژی و پارادۆکس', context: 'Contradiction', alternatives: ['ناکۆکی دیاریکراو', 'شتێکی دژبەیەک بەڵام ڕاست'] },
    'consciousness': { kurdish: 'هۆشیاری و ئاگاداری', context: 'Awareness', alternatives: ['تێگەیشتنی زیندوو', 'هەستی هۆش'] },
    'subconscious': { kurdish: 'ناهۆشیار و ناخی دەروون', context: 'Below Conscious Mind', alternatives: ['ژێرهۆش', 'دەرکی پەنهان'] },
    'redemption': { kurdish: 'کەفارەت و ڕزگاربوون لە گوناھ', context: 'Spiritual Rescue', alternatives: ['قەرەبووی هەڵە', 'بەدەستهێنانەوەی شەرەف'] },
    'reckoning': { kurdish: 'کاتی لێپرسینەوە و باجدان', context: 'Time of Judgment', alternatives: ['ڕۆژی دادگاییکردن', 'حیسابکردنەوە'] },
    'apocalypse': { kurdish: 'کۆتایی جیهان و وێرانی گەورە', context: 'World Destruction', alternatives: ['ڕۆژی قیامەت', 'مەحشەر'] },
    'genesis': { kurdish: 'سەرەتا و سەرچاوەی دروستبوون', context: 'Beginning / Creation', alternatives: ['دەستپێکی ژیان', 'خولقاندن'] },
    'dystopia': { kurdish: 'کۆمەڵگەی تاریک و ستەمکار', context: 'Oppressive Future', alternatives: ['جیهانی وێرانکراو', 'دۆزەخی سەر زەوی'] },
    'utopia': { kurdish: 'شاری نموونەیی و بەهەشتی خەیاڵی', context: 'Perfect World', alternatives: ['کۆمەڵگەی بێکەمۆکوڕی', 'ئارامگەی ئاواتەکان'] },
    'anomaly': { kurdish: 'دیاردەی نائاسایی و نامۆ', context: 'Irregularity', alternatives: ['شاز و جیاواز', 'تێکچوونی ڕێسا'] },
    'singularity': { kurdish: 'خاڵی بێوێنە و تاکانەیی ڕەها', context: 'Gravitational/Tech Event', alternatives: ['تەقینەوەی هۆش', 'چەقی بێکۆتایی'] },
    'abyss': { kurdish: 'تەمتومانی قوڵ و تاریکی بێبن', context: 'Bottomless Chasm', alternatives: ['قووڵایی دۆزەخ', 'کەلێنی بێسەروبن'] },
    'vortex': { kurdish: 'گێژاو و سووڕانی بەهێز', context: 'Whirlpool / Energy Core', alternatives: ['باداو', 'گێژەڵووکەی ڕاکێشەر'] },
    'entropy': { kurdish: 'شێواوی و تێکچوونی سیستەم', context: 'Disorder / Decay', alternatives: ['پاشاگەردانی سروشتی', 'ڕووخان'] },
    'catalyst': { kurdish: 'هۆکاری خێراکەر و بزوێنەر', context: 'Trigger / Accelerator', alternatives: ['دەستپێکەری گۆڕانکاری', 'سەرچاوەی پریشک'] },
    'nexus': { kurdish: 'خاڵی بەستنەوە و چەقی بەیەکگەیشتن', context: 'Central Connection', alternatives: ['تەونی سەرەکی', 'چەقی پەیوەندییەکان'] },
    'threshold': { kurdish: 'بەردەرکە و سنووری دەستپێک', context: 'Boundary / Gateway', alternatives: ['ئاستی دەستپێکردن', 'لێواری گۆڕان'] },
    'hegemony': { kurdish: 'دەسەڵاتی ڕەها و باڵادەستی', context: 'Dominance', alternatives: ['هەژموون', 'کۆنتڕۆڵی سەروەر'] },
    'anarchy': { kurdish: 'پاشاگەردانی و بێسەروپەری', context: 'Lawlessness', alternatives: ['نەمانی یاسا', 'ئاژاوە'] },
    'stalemate': { kurdish: 'بنبەست و چەقبەستوویی شەڕ', context: 'Deadlock', alternatives: ['ڕاوەستانی بێئەنجام', 'یەکسانبوونی مەترسیدار'] },
    'monologue': { kurdish: 'تاکبێژی', context: 'Solo Speech', alternatives: ['قسەکردن لەگەڵ خۆدا', 'دەنگدانەوەی ناخ'] },
    'protagonist': { kurdish: 'پاڵەوانی سەرەکی', context: 'Lead Character', alternatives: ['کارەکتەری سەرەکی', 'پێشەنگی چیرۆک'] },
    'antagonist': { kurdish: 'نەیار و دژبەری سەرەکی', context: 'Opposing Force', alternatives: ['دوژمنی پاڵەوان', 'خراپەکاری سەرەکی'] },
    'nemesis': { kurdish: 'دوژمنی سەرسەخت و تۆڵەسێنەر', context: 'Archnemesis', alternatives: ['ڕکابەری لەناوبەر', 'سزای حەتمی'] },

    // Action, Thriller & Cinematic Dialogue Subtitle Expressions
    'on the run': { kurdish: 'لە هەڵهاتندا', context: 'Action/Escape', alternatives: ['ڕاکردوو', 'لەژێر داواکارییدا'] },
    'take cover': { kurdish: 'پەنا ببەرە', context: 'Tactical Warning', alternatives: ['خۆت بپۆشە', 'خۆت بشارەوە'] },
    'watch your back': { kurdish: 'ئاگاداری پشت سەرت بە', context: 'Threat Warning', alternatives: ['وریا بە', 'ئاگات لە خۆت بێت'] },
    'double cross': { kurdish: 'خەیانەتکردن', context: 'Treachery', alternatives: ['پشتکردنە هاوڕێ', 'فریودان'] },
    'lock and load': { kurdish: 'چەکەکانتان ئامادە بکەن', context: 'Combat Ready', alternatives: ['ئامادەبن بۆ شەڕ', 'خۆتان کۆبکەنەوە'] },
    'undercover': { kurdish: 'بە نهێنی', context: 'Spy/Police', alternatives: ['بە جلی سڤیلەوە', 'شانۆگەری نهێنی'] },
    'code red': { kurdish: 'باری لەناکاوی سوور', context: 'Emergency', alternatives: ['خەتەری توند', 'مەترسیی ئاستی بەرز'] },
    'keep your head down': { kurdish: 'سەرت نەوی بکە', context: 'Combat Caution', alternatives: ['خۆت بشارەوە', 'سەرت هەڵمەبرە'] },
    "don't mess with me": { kurdish: 'دەست لە کارمەوە مەدە', context: 'Warning', alternatives: ['یاری بە ئاگری من مەکە', 'تێکەڵم مەبە'] },
    "i got your back": { kurdish: 'پشتیوانیت دەکەم', context: 'Loyalty', alternatives: ['پشتت دەگرم', 'ئاگام لە تۆ دەبێت'] },
    'make no mistake': { kurdish: 'هیچ گومانێک مەهێڵەرەوە', context: 'Certainty', alternatives: ['دڵنیابە', 'دڵنیا بەوەی'] },
    'mind-boggling': { kurdish: 'سەرسوڕهێنەر', context: 'Amazement', alternatives: ['ئەقڵڕفێن', 'سەیر و سەمەرە'] },
    'breathtaking': { kurdish: 'سەرنجڕاکێشی بێئەندازە', context: 'Awe', alternatives: ['دڵڕفێن', 'شاکار'] },
    'flabbergasted': { kurdish: 'پڕ لە سەرسوڕمان', context: 'Shock', alternatives: ['سەرسامبوو', 'دەمتەقێن'] },
    'relentless': { kurdish: 'بێبەزەییانە و نەپچڕاو', context: 'Persistence', alternatives: ['بێوەستان', 'توند'] },
    'formidable': { kurdish: 'سەخت و بەهێز', context: 'Strength', alternatives: ['سامناک', 'بەهێز'] },

    // British English Specific Colloquialisms, Slang & Idiomatic Subtitle Expressions
    'bloody hell': { kurdish: 'ئەی هاوار', context: 'British Expletive/Shock', alternatives: ['نەفرەت', 'چی دۆزەخێکە', 'ئەی خوایە'] },
    'bloody': { kurdish: 'نەفرەتی', context: 'British Emphasis', alternatives: ['زۆر', 'نەعلەتی'] },
    'bollocks': { kurdish: 'قسەی پووچ', context: 'British Slang (Nonsense/Frustration)', alternatives: ['درۆی شاخدار', 'نەفرەت', 'قسەی بێمانا'] },
    'bugger off': { kurdish: 'سەری خۆت هەڵگرە', context: 'British Dismissal', alternatives: ['لەبەرچاوم ون بە', 'بڕۆ لێرە'] },
    'bugger': { kurdish: 'نەفرەت', context: 'British Expletive', alternatives: ['سەگباب', 'نەعلەتی'] },
    'blimey': { kurdish: 'ئەی هاوار', context: 'British Surprise', alternatives: ['سەیرە', 'خوایە گیان'] },
    'chuffed': { kurdish: 'زۆر دڵخۆش', context: 'British Slang (Delighted)', alternatives: ['شادی پێوە دیارە', 'تەواو ڕازی'] },
    'gutted': { kurdish: 'زۆر دڵتەنگ و تێکشکاو', context: 'British Slang (Devastated)', alternatives: ['بێهیوا بوو', 'داخ لە دڵ'] },
    'dodgy': { kurdish: 'گوماناوی و نەشیاو', context: 'British Slang (Suspicious/Unreliable)', alternatives: ['جێی متمانە نییە', 'خراپ'] },
    'knackered': { kurdish: 'زۆر ماندوو و بێتاقەت', context: 'British Slang (Exhausted)', alternatives: ['لەپێ کەوتوو', 'ماندووی مردوو'] },
    'rubbish': { kurdish: 'قسەی پووچ و بێسوود', context: 'British (Nonsense/Garbage)', alternatives: ['پیسایی', 'خراپ', 'بێ بەها'] },
    'cheerio': { kurdish: 'ماڵئاوا', context: 'British Greeting (Goodbye)', alternatives: ['بەخێر بچیت', 'خوا حافیز'] },
    'proper': { kurdish: 'ڕاستەقینە و تەواو', context: 'British Emphasis', alternatives: ['بەپێی ڕێسا', 'تەواو گونجاو'] },
    'mate': { kurdish: 'هاوڕێ', context: 'British/Colloquial (Friend)', alternatives: ['برام', 'کاکە', 'هاوڕێ گیان'] },
    'cheers': { kurdish: 'سوپاس', context: 'British (Thanks/Cheers)', alternatives: ['نۆشی گیان بێت', 'دەستت خۆش'] },
    'pissed off': { kurdish: 'زۆر تووڕە و بێزار', context: 'Anger', alternatives: ['قەڵس بوو', 'تێکچوو'] },
    'piss off': { kurdish: 'سەری خۆت هەڵگرە', context: 'Dismissal', alternatives: ['لەبەرچاوم وون بە', 'تێپەڕە'] },
    'taking the piss': { kurdish: 'گاڵتەکردن و ڕابواردن', context: 'British (Mocking/Teasing)', alternatives: ['پێم ڕادەبوێریت', 'دەستخستنە سەر'] },
    'sorted': { kurdish: 'چارەسەرکرا و ڕێکخرا', context: 'British Slang (Arranged/Resolved)', alternatives: ['تەواو بوو', 'هەموو شت ئامادەیە'] },
    'fancy': { kurdish: 'حەزلێکردن', context: 'British (Desire/Like)', alternatives: ['پێم باشە', 'دڵم دەخوازێت'] },
    'quid': { kurdish: 'پاوەند', context: 'British Currency', alternatives: ['لیرە', 'پارە'] },
    'chap': { kurdish: 'پیاو', context: 'British (Guy/Man)', alternatives: ['کوڕە', 'کابرایە'] },
    'bloke': { kurdish: 'کابرا', context: 'British (Guy/Man)', alternatives: ['پیاو', 'نێرە'] },
    'lad': { kurdish: 'لاو / کوڕ', context: 'British (Young man)', alternatives: ['گەنج', 'کوڕی چاک'] },
    'lass': { kurdish: 'کیژ / کچ', context: 'British (Young woman)', alternatives: ['کچە', 'خاتوون'] },
    'innit': { kurdish: 'وایە، وانییە؟', context: 'British Tag (Isn\'t it)', alternatives: ['ڕاستە؟', 'وایە؟'] },
    'not my cup of tea': { kurdish: 'بە دڵی من نییە', context: 'British Idiom', alternatives: ['ئارەزووی ناکەم', 'حەزم لێی نییە'] },
    'ring up': { kurdish: 'پەیوەندی تەلەفۆنی پێوەکردن', context: 'British (Call)', alternatives: ['تەلەفۆنکردن', 'پەیوەندیکردن'] },
    'bob\'s your uncle': { kurdish: 'هەموو شت ئاسان و ئامادەیە', context: 'British Idiom', alternatives: ['تەواو کارەکە کرا', 'ئاسانە'] },
    'give someone a bell': { kurdish: 'تەلەفۆن بۆ کەسێک کردن', context: 'British Idiom', alternatives: ['پەیوەندیکردن'] },
    'have a word': { kurdish: 'کەمێک قسەکردن', context: 'British Idiom', alternatives: ['دەستپێکردنی گفتوگۆ'] },
    'full of beans': { kurdish: 'پڕ لە وزە و چالاکی', context: 'British Idiom', alternatives: ['بە گوڕوتین', 'چالاک'] },

    // Iconic Anime, Battle Lines, Catchphrases & Japanese Subtitle Tropes
    'omae wa mou shindeiru': { kurdish: 'تۆ هەر ئێستا مردوویت', context: 'Fist of the North Star / Iconic Anime', alternatives: ['لە ئێستاوە مردووی', 'کارت تەواوە'] },
    'you are already dead': { kurdish: 'تۆ هەر ئێستا مردوویت', context: 'Fist of the North Star / Anime Trope', alternatives: ['لە ئێستاوە مردووی', 'کارت تەواوە'] },
    "you're already dead": { kurdish: 'تۆ هەر ئێستا مردوویت', context: 'Fist of the North Star / Anime Trope', alternatives: ['لە ئێستاوە مردووی'] },
    'i will be the pirate king': { kurdish: 'دەبمە پاشای چەتەکانی دەریا!', context: 'One Piece / Luffy Catchphrase', alternatives: ['دەبم بە پاشای چەتەکان!', 'پاشای چەتەکانی دەریا دەبم'] },
    "i'm gonna be king of the pirates": { kurdish: 'دەبمە پاشای چەتەکانی دەریا!', context: 'One Piece / Luffy', alternatives: ['دەبم بە پاشای چەتەکان!'] },
    "i'm going to become the pirate king": { kurdish: 'دەبمە پاشای چەتەکانی دەریا!', context: 'One Piece / Luffy', alternatives: ['دەبم بە پاشای چەتەکان!'] },
    'plus ultra': { kurdish: 'پڵەس ئۆڵترا! (بۆ سەرکەوتنی بێسنوور)', context: 'My Hero Academia / All Might', alternatives: ['هەمیشە بەرەو لوتکە!', 'تێپەڕاندنی هەموو سنوورەکان!'] },
    'bankai': { kurdish: 'بانکای (ڕزگارکردنی کۆتایی شمشێر)', context: 'Bleach / Ichigo Kurosaki', alternatives: ['بانکای!', 'هێزی کۆتایی شمشێر'] },
    'shinra tensei': { kurdish: 'پاڵنەری گەردوونی (شینرا تێنسێی)!', context: 'Naruto / Pain', alternatives: ['شینرا تێنسێی!', 'تەقینەوەی هێزی ڕاکێشان'] },
    'almighty push': { kurdish: 'پاڵنەری گەردوونی!', context: 'Naruto / Pain', alternatives: ['هێزی مەزنی شینرا تێنسێی'] },
    'kamehameha': { kurdish: 'کامێهامێها!', context: 'Dragon Ball / Goku', alternatives: ['شەپۆلی کامێهامێها!'] },
    "it's over 9000": { kurdish: 'لە ٩٠٠٠ زیاترە!', context: 'Dragon Ball Z / Vegeta', alternatives: ['ئاستی هێزەکەی لە سەرووی ٩٠٠٠یە!'] },
    'over 9000': { kurdish: 'لە ٩٠٠٠ زیاترە!', context: 'Dragon Ball Z / Vegeta' },
    'yare yare daze': { kurdish: 'ئاخ لە دەستت... (چەند بێزارکەری)', context: 'JoJo Bizarre Adventure / Jotaro', alternatives: ['دە دەست هەڵگرە...', 'چەندە بێزارکەرە...'] },
    'yare yare': { kurdish: 'ئاخ لە دەستت...', context: 'Anime Trope (Good Grief)', alternatives: ['دە دەست هەڵگرە...', 'کە بێزارکەری...'] },
    'good grief': { kurdish: 'ئاخ لە دەستت...', context: 'Anime / Cinema Trope (Yare Yare)', alternatives: ['کە بێزارکەری...', 'دە دەست هەڵگرە...'] },
    'give me a break': { kurdish: 'دە دەست هەڵگرە...', context: 'Anime / Cinema Trope', alternatives: ['لێم گەڕێ...', 'ئارامم پێ بدە...'] },
    'if you do not fight you cannot win': { kurdish: 'ئەگەر شەڕ نەکەیت، ناتوانیت سەربکەویت', context: 'Attack on Titan / Eren', alternatives: ['بجەنگە بۆ ئەوەی ببیەیتەوە'] },
    "if you don't fight you can't win": { kurdish: 'ئەگەر شەڕ نەکەیت، ناتوانیت سەربکەویت', context: 'Attack on Titan / Eren', alternatives: ['بجەنگە بۆ ئەوەی ببیەیتەوە'] },
    'tatakae': { kurdish: 'بجەنگە! شەڕ بکە!', context: 'Attack on Titan / Eren Yeager', alternatives: ['شەڕ بکە!', 'کۆڵ مەدە و بجەنگە!'] },
    'fight fight': { kurdish: 'بجەنگە! شەڕ بکە!', context: 'Anime Battle Cry' },
    'a lesson without pain is meaningless': { kurdish: 'وانەیەک بێ ئازار هیچ مانایەکی نییە', context: 'Fullmetal Alchemist / Edward', alternatives: ['فێربوون بێ چەشتنی ئازار ناکرێت'] },
    'in the name of the moon i will punish you': { kurdish: 'بە ناوی مانگەوە سزات دەدەم!', context: 'Sailor Moon', alternatives: ['سزات بە ناوی مانگەوە بەسەردا دەسەپێنم!'] },
    "in the name of the moon i'll punish you": { kurdish: 'بە ناوی مانگەوە سزات دەدەم!', context: 'Sailor Moon' },
    'i will take a potato chip and eat it': { kurdish: 'چپسێک هەڵدەگرم و دەیخۆم!', context: 'Death Note / Light Yagami' },
    "i'll take a potato chip and eat it": { kurdish: 'چپسێک هەڵدەگرم و دەیخۆم!', context: 'Death Note / Light Yagami' },
    'do not believe in yourself believe in me': { kurdish: 'باوەڕت بە خۆت نەبێت، باوەڕت بە من هەبێت کە باوەڕم بە تۆیە!', context: 'Gurren Lagann / Kamina' },
    "don't believe in yourself believe in me": { kurdish: 'باوەڕت بە خۆت نەبێت، باوەڕت بە من هەبێت کە باوەڕم بە تۆیە!', context: 'Gurren Lagann / Kamina' },
    'the world shall know pain': { kurdish: 'جیهان دەبێت ئازار بناسێت!', context: 'Naruto / Pain', alternatives: ['جیهان فێری ئازار دەبێت!'] },
    'know pain': { kurdish: 'ئازار بچێژە!', context: 'Naruto / Pain', alternatives: ['ئازار بناسە!'] },
    'feel pain': { kurdish: 'ئازار بچێژە!', context: 'Naruto / Pain', alternatives: ['ئازار هەست پێ بکە!'] },
    'this is my ninja way': { kurdish: 'ئەمە ڕێبازی نینجاییمە', context: 'Naruto Uzumaki', alternatives: ['ڕێگەی نینجایی من ئەمەیە'] },
    'i will never give up': { kurdish: 'هەرگیز کۆڵ نادەم!', context: 'Shonen Anime Trope', alternatives: ['هەرگیز دەستبەردار نابم!', 'خۆم بەدەستەوە نادەم!'] },
    "i'll never give up": { kurdish: 'هەرگیز کۆڵ نادەم!', context: 'Shonen Anime Trope', alternatives: ['هەرگیز دەستبەردار نابم!'] },
    'i will never forgive you': { kurdish: 'هەرگیز لێت نابوورم!', context: 'Anime Drama / Rivalry', alternatives: ['هەرگیز لێت خۆش نابم!', 'چاوپۆشیت لێ ناکەم!'] },
    "i'll never forgive you": { kurdish: 'هەرگیز لێت نابوورم!', context: 'Anime Drama', alternatives: ['هەرگیز لێت خۆش نابم!'] },
    "you're wide open": { kurdish: 'بەرگریت لاوازە! (کەلێنت هەیە)', context: 'Anime Combat Trope', alternatives: ['ڕێگەت کراوەیە بۆ لێدان!', 'بەرگریت نەماوە!'] },
    'you are wide open': { kurdish: 'بەرگریت لاوازە!', context: 'Anime Combat Trope', alternatives: ['کەلێنت هەیە!'] },
    'too slow': { kurdish: 'زۆر خاویت!', context: 'Anime Combat Trope', alternatives: ['زۆر هێواشیت!', 'دەستت ناگات پێم!'] },
    'is that all you got': { kurdish: 'هەر ئەوەندەت لەدەست دێت؟', context: 'Anime Challenge', alternatives: ['هەر ئەوە بوو هەموو هێزت؟', 'تەواوی تواناکەت ئەمە بوو؟'] },
    "is that all you've got": { kurdish: 'هەر ئەوەندەت لەدەست دێت؟', context: 'Anime Challenge', alternatives: ['هەر ئەوە بوو هەموو هێزت؟'] },
    'this is not even my final form': { kurdish: 'ئەمە هێشتا شێوەی کۆتاییم نییە', context: 'Dragon Ball / Anime Trope', alternatives: ['هێشتا نەگەیشتوومەتە هێزی کۆتایی'] },
    "this isn't even my final form": { kurdish: 'ئەمە هێشتا شێوەی کۆتاییم نییە', context: 'Dragon Ball / Anime Trope' },
    'as expected of you': { kurdish: 'هەر ئەوەت لێ چاوەڕوان دەکرا!', context: 'Anime Trope (Sasuga)', alternatives: ['هەر خۆتی و دەستت خۆش!', 'شایستەی تۆیە!'] },
    'as expected': { kurdish: 'هەر وەک چاوەڕوان دەکرا', context: 'Anime Trope (Sasuga)', alternatives: ['هەر وەک پێشبینی دەکرا', 'هەر ئەوەمان لێ دەوەشایەوە'] },
    'just who do you think i am': { kurdish: 'پێتوایە من کێم؟! (من کەم نیم)', context: 'Anime Defiance (Kamina)', alternatives: ['وا دەزانیت من کێم؟!'] },
    'you are ten years too early': { kurdish: 'دە ساڵ زووە بۆت تا بمبەزێنیت!', context: 'Anime / Martial Arts Trope', alternatives: ['هێشتا ماوتە بمبەزێنیت!'] },
    "you're ten years too early": { kurdish: 'دە ساڵ زووە بۆت تا بمبەزێنیت!', context: 'Anime Trope' },
    'i will surpass my limits': { kurdish: 'سنوورەکانی خۆم تێدەپەڕێنم!', context: 'Anime Power-Up', alternatives: ['هەموو سنوورەکان دەبەزێنم!'] },
    "i'll surpass my limits": { kurdish: 'سنوورەکانی خۆم تێدەپەڕێنم!', context: 'Anime Power-Up' },
    'i have been waiting for this': { kurdish: 'مێژوویەکە چاوەڕێی ئەم ساتەم!', context: 'Anime Showdown', alternatives: ['لە مێژە چاوەڕێی ئەمەم!'] },
    "i've been waiting for this": { kurdish: 'مێژوویەکە چاوەڕێی ئەم ساتەم!', context: 'Anime Showdown' },
    'get out of here': { kurdish: 'بڕۆ دەرەوە', context: 'Dismissal / Disbelief', alternatives: ['لەبەرچاوم ون بە', 'سەری خۆت هەڵگرە', 'مەحاڵە!'] },
    'get the hell out of here': { kurdish: 'زوو لێرە بڕۆ دەرەوە', context: 'Urgent Dismissal', alternatives: ['لەبەرچاوم ون بە', 'بە نەفرەت بیت بڕۆ'] },
    'get the fuck out of here': { kurdish: 'لەبەرچاوم ون بە', context: 'Hostile Dismissal', alternatives: ['سەری خۆت هەڵگرە', 'بڕۆ دەرەوە'] },
    'suit yourself': { kurdish: 'کەیفی خۆتە', context: 'Acceptance / Concession', alternatives: ['بە ئارەزووی خۆت بکە', 'وەک خۆت دەتەوێت'] },
    'it cannot be helped': { kurdish: 'چارە نییە', context: 'Anime Trope (Shikata ga nai)', alternatives: ['دەستمان ناڕوات', 'هیچ چارەیەک نییە', 'ناچارین'] },
    "it can't be helped": { kurdish: 'چارە نییە', context: 'Anime Trope (Shikata ga nai)', alternatives: ['دەستمان ناڕوات', 'هیچ چارەیەک نییە', 'ناچارین'] },
    'there is no helping it': { kurdish: 'چارە نییە', context: 'Anime Trope', alternatives: ['دەستمان ناڕوات', 'هیچ چارەیەک نییە'] },
    'leave it to me': { kurdish: 'بیسپێرە بە من', context: 'Anime Trope (Ore ni makasero)', alternatives: ['لێگەڕێ بۆ من', 'پشتی پێ ببەستە', 'من چارەسەری دەکەم'] },
    "don't get cocky": { kurdish: 'لووتبەرز مەبە', context: 'Anime Trope (Nameru na)', alternatives: ['خۆت مەبینە', 'لووتت بەرز مەکەرەوە', 'فیز مەکە'] },
    'do not get cocky': { kurdish: 'لووتبەرز مەبە', context: 'Anime Trope', alternatives: ['خۆت مەبینە', 'فیز مەکە'] },
    "don't underestimate me": { kurdish: 'بە کەمم مەزانە', context: 'Anime / Dramatic Defiance', alternatives: ['کەمم سەیر مەکە', 'بێ بایەخم مەبینە'] },
    'do not underestimate me': { kurdish: 'بە کەمم مەزانە', context: 'Defiance', alternatives: ['کەمم سەیر مەکە', 'بێ بایەخم مەبینە'] },
    'show me what you got': { kurdish: 'تواناکانت نیشان بدە', context: 'Challenge / Battle', alternatives: ['نیشانم بدە چیت پێیە', 'هەرچیت هەیە بیخەرە ڕوو'] },
    "show me what you've got": { kurdish: 'تواناکانت نیشان بدە', context: 'Challenge / Battle', alternatives: ['نیشانم بدە چیت پێیە', 'هەرچیت هەیە بیخەرە ڕوو'] },
    'give it your all': { kurdish: 'هەموو توانای خۆت بخەرە گەڕ', context: 'Encouragement / Battle', alternatives: ['هەموو هێزت بەکاربهێنە', 'کۆڵ مەدە'] },
    "i've got your back": { kurdish: 'پشتت دەگرم', context: 'Comradeship / Loyalty', alternatives: ['لەگەڵتم', 'پشتیوانیت دەکەم', 'ئاگام لێت دەبێت'] },
    'i have your back': { kurdish: 'پشتت دەگرم', context: 'Comradeship / Loyalty', alternatives: ['لەگەڵتم', 'پشتیوانیت دەکەم'] },
    'got your back': { kurdish: 'پشتت دەگرم', context: 'Loyalty', alternatives: ['لەگەڵتم', 'ئاگام لێتە'] },
    'not on my watch': { kurdish: 'تا من لێرە بم مەحاڵە', context: 'Heroic Protection', alternatives: ['هەرگیز ڕێگەی پێ نادەم', 'لەبەرچاوی مندا نا'] },
    "i won't let you down": { kurdish: 'شەرمەزارت ناکەم', context: 'Heroic Promise', alternatives: ['بێهیوایت ناکەم', 'سەرت بەرز دەکەم'] },
    "i will not let you down": { kurdish: 'شەرمەزارت ناکەم', context: 'Heroic Promise', alternatives: ['بێهیوایت ناکەم'] },
    "don't let me down": { kurdish: 'شەرمەزارم مەکە', context: 'Plea / Expectation', alternatives: ['بێهیوام مەکە', 'ورەم مەڕوخێنە'] },
    'do not let me down': { kurdish: 'شەرمەزارم مەکە', context: 'Plea', alternatives: ['بێهیوام مەکە'] },
    "i'll protect you": { kurdish: 'دەتپارێزم', context: 'Anime / Heroic Pledge', alternatives: ['بەرگریت لێ دەکەم', 'ناهێڵم ئازارت پێ بگات'] },
    'i will protect you': { kurdish: 'دەتپارێزم', context: 'Heroic Pledge', alternatives: ['بەرگریت لێ دەکەم'] },
    'what a pain': { kurdish: 'چەندە بێزارکەرە', context: 'Anime Trope (Mendokusai)', alternatives: ['چ دەردەسەرییەکە', 'بێزارکەری تەواوە'] },
    'what a drag': { kurdish: 'چەندە بێزارکەرە', context: 'Anime Trope (Mendokusai)', alternatives: ['چ دەردەسەرییەکە'] },
    'i have no choice': { kurdish: 'هیچ چارەی ترم نییە', context: 'Anime / Dramatic Resignation', alternatives: ['چارەم نییە', 'بێ بژاردەم', 'ناچارم'] },
    "i've got no choice": { kurdish: 'هیچ چارەی ترم نییە', context: 'Resignation', alternatives: ['چارەم نییە', 'ناچارم'] },
    "it's about time": { kurdish: 'دواجار، کاتی هاتووە', context: 'Relief / Arrival', alternatives: ['کاتی ئەوە هاتووە', 'مێژوویەکە چاوەڕێین'] },
    'it is about time': { kurdish: 'دواجار، کاتی هاتووە', context: 'Relief', alternatives: ['کاتی ئەوە هاتووە'] },
    'stand back': { kurdish: 'بگەڕێوە دواوە', context: 'Tactical Warning', alternatives: ['دوورکەوە', 'لاچۆ بۆ دواوە'] },
    'step back': { kurdish: 'بگەڕێوە دواوە', context: 'Caution', alternatives: ['دوورکەوە', 'لاچۆ'] },
    'are you listening to me': { kurdish: 'گوێت لێمە؟', context: 'Dialogue Question', alternatives: ['گوێم لێ دەگریت؟', 'دەتبیسم؟'] },
    "don't be ridiculous": { kurdish: 'قسەی بێمانا مەکە', context: 'Dismissal', alternatives: ['بێمانا مەبە', 'گاڵتەجاڕ مەبە'] },
    'do not be ridiculous': { kurdish: 'قسەی بێمانا مەکە', context: 'Dismissal', alternatives: ['بێمانا مەبە'] },
    'just in time': { kurdish: 'ڕێک لە کاتی خۆیدا', context: 'Timely Arrival', alternatives: ['لە کاتێکی گونجاودا', 'دەستبەجێ'] },
    "it's not over yet": { kurdish: 'هێشتا کۆتایی نەهاتووە', context: 'Battle / Anime Trope', alternatives: ['تەواو نەبووە', 'شەڕەکە بەردەوامە'] },
    'it is not over yet': { kurdish: 'هێشتا کۆتایی نەهاتووە', context: 'Anime Trope', alternatives: ['تەواو نەبووە'] },
    'you did great': { kurdish: 'دەستت خۆش، کارت بە باشی کرد', context: 'Praise', alternatives: ['نایاب بوویت', 'زۆر چاک بوو'] },
    'hold your horses': { kurdish: 'کەمێک ئارام بگرە', context: 'Patience', alternatives: ['هێمن بە', 'پەلە مەکە'] },
    'believe it': { kurdish: 'باوەڕی پێ بکە', context: 'Anime Trope (Naruto Dattebayo)', alternatives: ['دڵنیابە لێی!', 'باوەڕ بکە!'] },
    'mark my words': { kurdish: 'قسەم لە یاد بێت', context: 'Dramatic Warning', alternatives: ['قسەکانم لەبیر نەکەیت', 'قسەکەم لەبەر چاو بێت'] },
    "don't get me wrong": { kurdish: 'بە هەڵە لێم تێمەگە', context: 'Clarification', alternatives: ['بە هەڵە لە مەبەستم مەتێگە', 'مەبەستم ڕوونە'] },
    'save your breath': { kurdish: 'قسەکانت بەفیڕۆ مەدە', context: 'Dismissal', alternatives: ['خۆت ماندوو مەکە', 'قسەکردنت بێسوودە'] },
    "it's not worth it": { kurdish: 'شایەنی نییە', context: 'Caution', alternatives: ['هێندەی ناکات', 'شایەنی ئەو ماندووبوونە نییە'] },
    'no hard feelings': { kurdish: 'دڵگران مەبە', context: 'Reconciliation', alternatives: ['دڵت نەیەشێت', 'خەم مەخۆ'] },
    'on cloud nine': { kurdish: 'لەوپەڕی دڵخۆشیدا', context: 'Happiness', alternatives: ['زۆر بەختەوەر', 'شادی بێئەندازە'] },
    'spill the tea': { kurdish: 'ڕووداوەکان بگێڕەوە', context: 'Gossip/Colloquial', alternatives: ['ڕاستییەکان بدرکێنە', 'باس بکە'] },
    'cry over spilled milk': { kurdish: 'پەشیمانی بێسوودە', context: 'Proverb', alternatives: ['پەشیمانبوونەوە سودی نییە'] },
    'the ball is in your court': { kurdish: 'بڕیارەکە لای تۆیە', context: 'Decision', alternatives: ['کاتی هەڵوێستی تۆیە'] },
    'miss the boat': { kurdish: 'دەرفەتەکەت لەدەستدا', context: 'Missed Opportunity', alternatives: ['هەلەکەت لەکیس چوو'] },
    'out of my way': { kurdish: 'لە ڕێگەم لاچۆ', context: 'Action Command', alternatives: ['لێم لادە', 'ڕێگەم چۆڵ بکە'] },
    'behind my back': { kurdish: 'لە پشتمەوە', context: 'Betrayal / Secrecy', alternatives: ['بە نهێنی لە دوای من'] },
    'face to face': { kurdish: 'ڕووبەڕوو', context: 'Direct Encounter', alternatives: ['ڕاستەوخۆ', 'دەستەویەخە'] },

    // Famous Cinema, TV & Film Franchise Quotes & Subtitle Idioms
    'may the force be with you': { kurdish: 'با هێزەکە لەگەڵت بێت', context: 'Star Wars / Cinema Icon', alternatives: ['هێزت لەگەڵ بێت', 'بەخت لەگەڵت بێت'] },
    'i have a bad feeling about this': { kurdish: 'هەستێکی خراپم بەرامبەر بەمە هەیە', context: 'Star Wars / Cinema Trope', alternatives: ['هەستم بە مەترسی کردووە', 'دیارە شتێک هەڵەیە'] },
    "here's looking at you kid": { kurdish: 'بەهیوای دیدار خاتوون', context: 'Casablanca / Cinema Classic', alternatives: ['لەگەڵتدا دەمێنمەوە', 'خۆشم دەوێیت'] },
    "i'll be back": { kurdish: 'دەگەڕێمەوە', context: 'Terminator / Action Icon', alternatives: ['دووبارە دێمەوە', 'دیسان دەمبینیتەوە'] },
    'hasta la vista baby': { kurdish: 'ماڵئاوا ئازیزم', context: 'Terminator / Action Icon', alternatives: ['تا دیداری داهاتوو', 'بەخێر بچیت'] },
    'you talking to me': { kurdish: 'قسە لەگەڵ من دەکەیت؟', context: 'Taxi Driver / Drama Icon', alternatives: ['لەگەڵ منیت؟', 'مەبەستت منم؟'] },
    'why so serious': { kurdish: 'بۆچی ئەوەندە جدایت؟', context: 'Dark Knight / Cinema Icon', alternatives: ['بۆ ئەوەندە ڕووگرژیت؟', 'هێمن ببەوە'] },
    'winter is coming': { kurdish: 'زستان لە ڕێگایە', context: 'Game of Thrones / Fantasy Icon', alternatives: ['زستان نزیک دەبێتەوە', 'باری سەخت دەستپێدەکات'] },
    'you know nothing': { kurdish: 'تۆ هیچ نازانیت', context: 'Game of Thrones / Fantasy Icon', alternatives: ['هیچ زانیاریت نییە', 'بێ ئاگایت'] },
    'i am your father': { kurdish: 'من باوکی تۆم', context: 'Star Wars / Cinema Icon', alternatives: ['من باوکت لە ڕاستیدا'] },
    'to infinity and beyond': { kurdish: 'بۆ بێپایانی و ئەولاتریش', context: 'Toy Story / Animation Icon', alternatives: ['بۆ دوورترین ئاسۆکان'] },
    'keep your friends close': { kurdish: 'هاوڕێکانت لە خۆت نزیک بکەرەوە', context: 'Godfather / Cinema Icon', alternatives: ['ئاگاداری هاوڕێکانت بە'] },
    'keep your enemies closer': { kurdish: 'دوژمنەکانت نزیکتر بکەرەوە', context: 'Godfather / Cinema Icon', alternatives: ['ئاگاداری زیاتری دوژمنەکانت بە'] },
    "i'm going to make him an offer he can't refuse": { kurdish: 'پێشنیارێکی پێ دەکەم کە نەتوانێت ڕەتی بکاتەوە', context: 'Godfather / Cinema Icon' },
    "there's no place like home": { kurdish: 'هیچ شوێنێک وەک ماڵ نابێت', context: 'Wizard of Oz / Classic' },
    'show me the money': { kurdish: 'پاره‌كه‌م نیشان بده‌', context: 'Jerry Maguire / Cinema Icon' },
    "you can't handle the truth": { kurdish: 'تۆ بەرگەی ڕاستییەکە ناگریت', context: 'A Few Good Men / Drama Icon', alternatives: ['تۆ ناتوانیت ڕاستییەکە قبووڵ بکەیت'] },
    'elementary my dear watson': { kurdish: 'ئاسانە هاوڕێی ئازیزم', context: 'Sherlock / Mystery Icon' },
    'houston we have a problem': { kurdish: 'هیوستن کێشەیەکمان هەیە', context: 'Apollo 13 / Cinema Icon', alternatives: ['تووشی کێشەیەک بووین'] },
    'i see dead people': { kurdish: 'کەسانی مردوو دەبینم', context: 'The Sixth Sense / Cinema Icon' },
    'my precious': { kurdish: 'ئازیزەکەی من', context: 'Lord of the Rings / Fantasy Icon', alternatives: ['گەوهەرە خۆشەویستەکەم'] },
    'you shall not pass': { kurdish: 'تێپەڕبوونت مەحاڵە!', context: 'Lord of the Rings / Fantasy Icon', alternatives: ['ڕێگەت پێنادرێت تێپەڕ بپەڕیت'] },
    'avengers assemble': { kurdish: 'تۆڵەسێنەران کۆببنەوە', context: 'Marvel / Action Icon' },
    'i am iron man': { kurdish: 'من ئایرۆن مانم', context: 'Marvel / Action Icon' },
    'i can do this all day': { kurdish: 'دەتوانم هەموو ڕۆژەکە بەردەوام بم', context: 'Captain America / Marvel', alternatives: ['تەواو نابم و بەردەوام دەبم'] },
    'with great power comes great responsibility': { kurdish: 'دەسەڵاتی گەورە بەرپرسیارێتی گەورەی لەگەڵدایە', context: 'Spider-Man / Cinema Icon' },
    'wakanda forever': { kurdish: 'واکاندا بۆ هەتاهەتایە', context: 'Black Panther / Marvel' },
    'say hello to my little friend': { kurdish: 'سڵاو لە هاوڕێ بچووکەکەم بکە', context: 'Scarface / Action Icon' },
    'shaken not stirred': { kurdish: 'تەکێنراو نەک شڵەقێنراو', context: '007 / Cinema Icon' },
    'fasten your seatbelts': { kurdish: 'کەمەرپێندەکانتان ببەستن', context: 'Cinema Warning', alternatives: ['خۆتان ئامادە بکەن بۆ گەشتەکە'] },
    'prepare for impact': { kurdish: 'خۆتان بۆ بەربوونەوە ئامادە بکەن', context: 'Action / Disaster Icon', alternatives: ['بەرگەی کێشانەکە بگرن'] },
    'we have a runner': { kurdish: 'کەسێک هەڵهاتووە', context: 'Action / Police Icon', alternatives: ['کەسێک ڕایدەکات'] },
    'stand down': { kurdish: 'پاشەکشە بکە', context: 'Military / Action Command', alternatives: ['دەست لە چەک هەڵگرە', 'بۆستە'] },
    'weapons free': { kurdish: 'تەقەکردن ئازادە', context: 'Action / Military Command' },
    'cease fire': { kurdish: 'تەقەکردن ڕابگرن', context: 'Military Command', alternatives: ['تەقەمەکەن'] },
    'target acquired': { kurdish: 'ئامانجەکە دەستنیشانکرا', context: 'Action / Sci-Fi' },
    'target destroyed': { kurdish: 'ئامانجەکە لەناوبرا', context: 'Action / Sci-Fi' },
    'mission accomplished': { kurdish: 'ئەرکەکە بە سەرکەوتوویی تەواو بوو', context: 'Action / Military' },
    'mission failed': { kurdish: 'ئەرکەکە شکستی هێنا', context: 'Action / Gaming / Cinema' },
    'game over': { kurdish: 'یارییەکە کۆتایی هات', context: 'Cinema / Gaming' },
    'no match for me': { kurdish: 'هاوشانی من نییە', context: 'Action / Anime Challenge', alternatives: ['ڕکابەری من ناکات'] },
    'watch and learn': { kurdish: 'تەماشا بکە و فێربە', context: 'Dialogue Expression', alternatives: ['فێری ببە'] },
    "it's a trap": { kurdish: 'ئەمە تەڵەیە!', context: 'Star Wars / Cinema Icon', alternatives: ['تەڵەی بۆ دانراوە'] },
    "don't look back": { kurdish: 'ئاوڕ لە دواوە مەدەرەوە', context: 'Action / Drama' },
    'stay focused': { kurdish: 'پڕ لە سەرنج بە', context: 'Action / Drama', alternatives: ['ئاگات لە ئامانجەکە بێت'] },
    'never surrender': { kurdish: 'هەرگیز خۆت بەدەستەوە مەدە', context: 'Action Heroic' },
    'against all odds': { kurdish: 'سەرەڕای هەموو ئاستەنگەکان', context: 'Cinema Drama' },
    'do or die': { kurdish: 'یان بردنەوە یان لەناوچوون', context: 'Action / Battle' },
  };

  /**
   * Leftover Untranslated English Subtitle Words -> Kurdish Sorani mappings.
   * Cleans up untranslated Latin remnants left behind by machine translation.
   */
  const UNTRANSLATED_ENGLISH_MAP = {
    // Interjections, greetings & conversational fillers
    'okay': 'باشە',
    'ok': 'باشە',
    'hey': 'سڵاو',
    'heya': 'سڵاو',
    'hello': 'سڵاو',
    'hi': 'سڵاو',
    'bye': 'ماڵئاوا',
    'goodbye': 'ماڵئاوا',
    'yeah': 'بەڵێ',
    'yep': 'بەڵێ',
    'yup': 'بەڵێ',
    'nope': 'نەخێر',
    'nah': 'نەخێر',
    'yes': 'بەڵێ',
    'no': 'نەخێر',
    'please': 'تکایە',
    'pls': 'تکایە',
    'plz': 'تکایە',
    'sorry': 'ببوورە',
    'thanks': 'سوپاس',
    'thank': 'سوپاس',
    'thx': 'سوپاس',
    'welcome': 'بەخێربێیت',
    'dude': 'کابرا',
    'bro': 'برام',
    'brother': 'برا',
    'sister': 'خوشک',
    'buddy': 'هاوڕێ',
    'pal': 'هاوڕێ',
    'mate': 'هاوڕێ',
    'man': 'پیاو',
    'guys': 'هاوڕێیان',
    'sir': 'گەورەم',
    'madam': 'خاتوونم',
    'maam': 'خاتوونم',
    'boss': 'سەرۆک',
    'chief': 'سەرۆک',

    // Titles, Ranks, Movie Roles
    'captain': 'کاپتن',
    'doctor': 'دکتۆر',
    'doc': 'دکتۆر',
    'detective': 'لێکۆڵەر',
    'agent': 'بریکار',
    'officer': 'ئەفسەر',
    'commander': 'فەرماندە',
    'general': 'ژەنەڕاڵ',
    'colonel': 'عەقید',
    'major': 'ڕائد',
    'lieutenant': 'ملازم',
    'sergeant': 'سەرپەل',
    'soldier': 'سەرباز',
    'police': 'پۆلیس',
    'cop': 'پۆلیس',
    'cops': 'پۆلیسەکان',
    'sheriff': 'شەریف',
    'president': 'سەرۆک کۆمار',
    'minister': 'وەزیر',
    'king': 'پاشا',
    'queen': 'شاژن',
    'prince': 'شازادە',
    'princess': 'شازادە خاتوون',
    'knight': 'سووارچاک',
    'lord': 'گەورە',
    'master': 'مامۆستا / گەورە',

    // Tactical, Military, Sci-Fi & Action Terms
    'target': 'ئامانج',
    'targets': 'ئامانجەکان',
    'mission': 'ئەرک',
    'missions': 'ئەرکەکان',
    'system': 'سیستەم',
    'systems': 'سیستەمەکان',
    'code': 'کۆد',
    'base': 'بنکە',
    'zone': 'ناوچە',
    'level': 'ئاست',
    'sector': 'کەرت',
    'unit': 'یەکە',
    'signal': 'ئاماژە',
    'fire': 'تەقە',
    'shoot': 'تەقە بکە',
    'ceasefire': 'ئاگربەست',
    'lock': 'قفڵ',
    'load': 'پڕکردنەوە',
    'cover': 'پەناگە',
    'ambush': 'بۆسە',
    'sniper': 'نیشانەشکێن',
    'bomb': 'بۆمب',
    'bullet': 'فیشەک',
    'bullets': 'فیشەکەکان',
    'gun': 'چەک',
    'guns': 'چەکەکان',
    'weapon': 'چەک',
    'weapons': 'چەکەکان',
    'shield': 'قەڵغان',
    'sword': 'شمشێر',
    'knife': 'چەقۆ',
    'danger': 'مەترسی',
    'warning': 'ئاگاداری',
    'caution': 'وریا بن',
    'emergency': 'باری لەناکاو',
    'secure': 'پارێزراو',
    'clear': 'پاک / پارێزراو',
    'roger': 'تێگەیشتم',
    'copy': 'تێگەیشتم',
    'negative': 'نەخێر',
    'affirmative': 'بەڵێ',
    'mayday': 'فریاگوزاری',
    'sos': 'هانابردن',
    'over': 'تەواو',
    'out': 'دەرەوە',

    // Common Core Verbs & Actions in Dialogue
    'wait': 'بۆستە',
    'stop': 'بوەستە',
    'run': 'ڕابکە',
    'help': 'یارمەتی',
    'look': 'سەیرکە',
    'listen': 'گوێبگرە',
    'watch': 'ئاگاداربە',
    'come': 'وەرە',
    'go': 'بڕۆ',
    'leave': 'بڕۆ',
    'stay': 'بمێنەرەوە',
    'save': 'ڕزگار بکە',
    'protect': 'بپارێزە',
    'kill': 'بکوژە',
    'die': 'بمرە',
    'survive': 'ڕزگاربوون',
    'escape': 'ڕاکردن / هەڵاتن',
    'hide': 'خۆت بشارەوە',
    'fight': 'شەڕ بکە',
    'attack': 'هێرش بکە',
    'defend': 'بەرگری بکە',
    'win': 'بردنەوە',
    'lose': 'دۆڕان',
    'start': 'دەستپێبکە',
    'finish': 'تەواو بکە',
    'ready': 'ئامادە',

    // Fantasy, Sci-Fi & Creatures
    'monster': 'دڕندە',
    'monsters': 'دڕندەکان',
    'alien': 'بوونەوەری نامۆ',
    'aliens': 'بوونەوەرە نامۆکان',
    'demon': 'شەیتان',
    'demons': 'شەیتانەکان',
    'dragon': 'ئەژدیها',
    'dragons': 'ئەژدیهاکان',
    'ghost': 'ڕۆح / پەری',
    'ghosts': 'ڕۆحەکان',
    'vampire': 'خوێنمژ',
    'zombie': 'زۆمبی',
    'robot': 'ڕۆبۆت',
    'cyborg': 'سایبۆرگ',
    'magic': 'جادوو',
    'power': 'هێز',
    'energy': 'وزە',
    'hero': 'پاڵەوان',
    'villain': 'خراپەکار',
    'champion': 'پاڵەوان',
    'legend': 'ئەفسانە',

    // Emotions, States & Adjectives
    'alive': 'زیندوو',
    'dead': 'مردوو',
    'crazy': 'شێت',
    'insane': 'شێت',
    'mad': 'تووڕە / شێت',
    'angry': 'تووڕە',
    'happy': 'دڵخۆش',
    'sad': 'دڵتەنگ',
    'scared': 'ترساو',
    'afraid': 'ترساو',
    'brave': 'ئازا',
    'strong': 'بەهێز',
    'weak': 'لاواز',
    'good': 'باش',
    'bad': 'خراپ',
    'evil': 'خراپەکار',
    'pure': 'پاک',
    'true': 'ڕاستەقینە',
    'false': 'هەڵە / درۆ',
    'real': 'ڕاستەقینە',
    'fake': 'ساختە',
    'easy': 'ئاسان',
    'hard': 'سەخت',
    'fast': 'خێرا',
    'slow': 'هێواش',
    'quiet': 'بێدەنگ',
    'loud': 'دەنگبەرز',
    'perfect': 'نایاب',
    'great': 'نایاب',
    'awesome': 'نایاب',
    'cool': 'نایاب',
    'fine': 'باش',
    'sure': 'دڵنیام',
    'maybe': 'لەوانەیە',
    'never': 'هەرگیز',
    'always': 'هەمیشە',
    'now': 'ئێستا',
    'later': 'دواتر',
    'soon': 'بەمنزیکانە',
    'today': 'ئەمڕۆ',
    'tomorrow': 'بەیانی',
    'yesterday': 'دوێنێ',
    'here': 'لێرە',
    'there': 'لەوێ',

    // World & Elements
    'world': 'جیهان',
    'earth': 'زەوی',
    'universe': 'گەردوون',
    'galaxy': 'کاکێشان',
    'star': 'ئەستێرە',
    'stars': 'ئەستێرەکان',
    'sun': 'خۆر',
    'moon': 'مانگ',
    'sky': 'ئاسمان',
    'sea': 'دەریا',
    'ocean': 'زەریا',
    'fire': 'ئاگر',
    'water': 'ئاو',
    'air': 'هەوا',
    'light': 'ڕووناکی',
    'dark': 'تاریکی',
    'darkness': 'تاریکی',
    'shadow': 'سێبەر',
    'shadows': 'سێبەرەکان',
    'destiny': 'چارەنووس',
    'fate': 'چارەنووس',
    'dream': 'خەون',
    'nightmare': 'مۆتەکە',
    'memory': 'یادەوەری',
    'memories': 'یادەوەرییەکان',
    'truth': 'ڕاستی',
    'secret': 'نهێنی',
    'secrets': 'نهێنییەکان',
    'promise': 'بەڵێن',
    'soul': 'ڕۆح',
    'heart': 'دڵ',
    'mind': 'هۆش / ئەقڵ',
    'blood': 'خوێن',
    'love': 'خۆشەویستی',
    'hate': 'ڕق',
    'friend': 'هاوڕێ',
    'friends': 'هاوڕێکان',
    'enemy': 'دوژمن',
    'enemies': 'دوژمنەکان',
    'family': 'خێزان',
    'father': 'باوک',
    'dad': 'باوکە',
    'mother': 'دایک',
    'mom': 'دایکە',
    'son': 'کوڕ',
    'daughter': 'کچ',
    'baby': 'ئازیزم / منداڵ',
    'honey': 'ئازیزەکەم',
    'darling': 'ئازیزەکەم',
    'sweetheart': 'ئازیزەکەم',
    'people': 'خەڵک',
    'money': 'پارە',
    'car': 'ئۆتۆمبێل',
    'city': 'شار',
    'house': 'ماڵ',
    'home': 'ماڵ',
    'room': 'ژوور',
    'door': 'دەرگا',
    'window': 'پەنجەرە',
    'story': 'چیرۆک',
    'game': 'یاری',
    'movie': 'فیلم',
    'film': 'فیلم',
    'music': 'مۆسیقا',
    'song': 'گۆرانی',
    'voice': 'دەنگ',
    'time': 'کات',
    'space': 'بۆشایی',
    'peace': 'ئاشتی',
    'war': 'شەڕ',
    'battle': 'جەنگ',
    'victory': 'سەرکەوتن',
    'defeat': 'شکست',

    // Anime Specific Short Words, Honorifics & Battle Terms
    'nani': 'چی؟',
    'baka': 'گێژ',
    'kuso': 'نەفرەت',
    'kisama': 'تۆی بێشەرەف',
    'temee': 'تۆی نەفرەتی',
    'yamete': 'بوەستە / مەکە',
    'tasukete': 'یارمەتیم بدەن',
    'hayaku': 'زووکە / خێراکە',
    'ike': 'بڕۆ / هێرش بکە',
    'dame': 'نابێت / نەخێر',
    'urusai': 'دەمت داخە',
    'senpai': 'سینپای (پێشەنگ)',
    'sensei': 'مامۆستا',
    'kohai': 'هاوپۆلی بچووکتر',
    'oniichan': 'برا گەورە',
    'nii-san': 'برا گەورە',
    'oneechan': 'خوشکە گەورە',
    'oneesan': 'خوشکە گەورە',
    'arigato': 'سوپاس',
    'arigatou': 'سوپاس',
    'gomen': 'ببوورە',
    'gomenasai': 'ببوورە',
    'daijoubu': 'خەمت نەبێت / باشم',
    'ganbatte': 'کۆڵ مەدە / هەوڵ بدە',
    'sugoi': 'سەرسوڕهێنەرە',
    'kawaii': 'شیرین و جوان',
    'kowai': 'ترسناکە',
    'wakatta': 'تێگەیشتم',
    'yatta': 'سەرکەوتین!',
    'naruhodo': 'تێگەیشتم',
    'souka': 'ئاوایە کەواتە',
    'itadakimasu': 'سوپاس بۆ خواردنەکە',
    'shinigami': 'شینیگامی (گیانکێش)',
    'hokage': 'هۆکاگی',
    'shinra': 'شینرا',
    'tensei': 'تێنسێی',
    'kamehameha': 'کامێهامێها',
    'tatakae': 'بجەنگە',
    'dattebayo': 'باوەڕ بکە',
    'shannaro': 'یانزە بەڵێ',
    'jutsu': 'جوتسۆ',
    'chakra': 'چاکرا',
    'ki': 'کای',
    'nen': 'نین',
    'haki': 'هاکی',
    'titan': 'تایتان',
    'ghoul': 'غوول',
    'saiyan': 'سایان',
    'nakama': 'هاوڕێی گیانی',
    'otaku': 'ئۆتاکۆ',
    'manga': 'مانگا',
    'anime': 'ئەنیمێ',
    'chibi': 'بچکۆلە',
    'senseis': 'مامۆستایان',
    'senpais': 'پێشەنگەکان',
  };

  /**
   * Handle speech interruptions, cut-offs (e.g. `bu-`, `wh-`, `I-`), and stutters (`b-but`, `w-what`).
   * Properly translates and preserves cut-off dialogue markers for Kurdish Sorani subtitles.
   */
  function handleSpeechCutoffs(text) {
    if (!text || typeof text !== 'string') return text;
    let s = text;

    // Stutters & repeated stutters (e.g. "b-but", "b-b-but" -> "بـ-بەڵام", "w-what" -> "چـ-چی")
    s = s.replace(/\b(?:b[-—–]+)+but\b/gi, 'بـ-بەڵام')
         .replace(/\b(?:w[-—–]+)+what\b/gi, 'چـ-چی')
         .replace(/\b(?:w[-—–]+)+wait\b/gi, 'بـ-بۆستە')
         .replace(/\b(?:n[-—–]+)+no\b/gi, 'نـ-نەخێر')
         .replace(/\b(?:y[-—–]+)+yes\b/gi, 'بـ-بەڵێ')
         .replace(/\b(?:i[-—–]+)+i\b/gi, 'مـ-من')
         .replace(/\b(?:w[-—–]+)+why\b/gi, 'بـ-بۆچی')
         .replace(/\b(?:h[-—–]+)+how\b/gi, 'چـ-چۆن')
         .replace(/\b(?:w[-—–]+)+who\b/gi, 'کـ-کێ')
         .replace(/\b(?:w[-—–]+)+where\b/gi, 'لـ-لەکوێ')
         .replace(/\b(?:w[-—–]+)+when\b/gi, 'کـ-کەی')
         .replace(/\b(?:y[-—–]+)+you\b/gi, 'تـ-تۆ')
         .replace(/\b(?:s[-—–]+)+sorry\b/gi, 'بـ-ببورە')
         .replace(/\b(?:p[-—–]+)+please\b/gi, 'تـ-تکایە')
         .replace(/\b(?:h[-—–]+)+help\b/gi, 'یـ-یارمەتی')
         .replace(/\b(?:d[-—–]+)+don['’]?t\b/gi, 'مـ-مەکە')
         .replace(/\b(?:c[-—–]+)+can['’]?t\b/gi, 'نـ-ناتوانم')
         .replace(/\b(?:m[-—–]+)+maybe\b/gi, 'ڕـ-ڕەنگە')
         .replace(/\b(?:t[-—–]+)+thank\b/gi, 'سـ-سوپاس')
         .replace(/\b(?:l[-—–]+)+look\b/gi, 'سـ-سەیرکە')
         .replace(/\b(?:l[-—–]+)+listen\b/gi, 'گـ-گوێبگرە')
         .replace(/\b(?:k[-—–]+)+know\b/gi, 'دـ-دەزانم')
         .replace(/\b(?:t[-—–]+)+think\b/gi, 'پـ-پێموابوو')
         .replace(/\b(?:j[-—–]+)+just\b/gi, 'تـ-تەنها')
         .replace(/\b(?:r[-—–]+)+really\b/gi, 'بـ-بەڕاست');

    // Interrupted speech single-word cut-offs (e.g., "bu-" -> "بـ-", "wh-" -> "چـ-", "I-" -> "مـ-")
    s = s.replace(/(^|[\s،؛؟.\n([{"'«])bu[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])but[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بەڵا-')
         .replace(/(^|[\s،؛؟.\n([{"'«])wh[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1چـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])wha[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1چی-')
         .replace(/(^|[\s،؛؟.\n([{"'«])what[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1چی-')
         .replace(/(^|[\s،؛؟.\n([{"'«])why[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بۆ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])how[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1چۆ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])who[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1کێ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])where[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1لەکوێ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])when[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1کەی-')
         .replace(/(^|[\s،؛؟.\n([{"'«])wa[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بۆسـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])wai[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بۆسـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])wait[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بۆسـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])st[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بوەسـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])stop[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بوەسـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])no[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1نـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])ye[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])yes[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بەڵێ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])i[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1مـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])yo[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1تـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])you[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1تـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])she[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1ئەو-')
         .replace(/(^|[\s،؛؟.\n([{"'«])he[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1ئەو-')
         .replace(/(^|[\s،؛؟.\n([{"'«])it[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1ئەوە-')
         .replace(/(^|[\s،؛؟.\n([{"'«])th[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1ئە-')
         .replace(/(^|[\s،؛؟.\n([{"'«])the[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1ئە-')
         .replace(/(^|[\s،؛؟.\n([{"'«])they[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1ئەوان-')
         .replace(/(^|[\s،؛؟.\n([{"'«])this[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1ئەمە-')
         .replace(/(^|[\s،؛؟.\n([{"'«])that[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1ئەوە-')
         .replace(/(^|[\s،؛؟.\n([{"'«])do[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1مـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])don['’]?t[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1مەکە-')
         .replace(/(^|[\s،؛؟.\n([{"'«])ca[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1نا-')
         .replace(/(^|[\s،؛؟.\n([{"'«])can[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1دەتوانـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])can['’]?t[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1ناتوانـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])pl[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1تـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])ple[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1تکا-')
         .replace(/(^|[\s،؛؟.\n([{"'«])please[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1تکا-')
         .replace(/(^|[\s،؛؟.\n([{"'«])so[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])sor[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1ببوور-')
         .replace(/(^|[\s،؛؟.\n([{"'«])sorry[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1ببوور-')
         .replace(/(^|[\s،؛؟.\n([{"'«])he[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1یـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])hel[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1یارمەتـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])help[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1یارمەتـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])loo[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1سەیرکـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])look[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1سەیرکـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])lis[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1گوێبگـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])listen[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1گوێبگـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])bec[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1لەبـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])because[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1لەبـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])nev[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1هەرگیـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])never[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1هەرگیـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])alw[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1هەمیـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])always[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1هەمیـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])imp[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1مەحا-')
         .replace(/(^|[\s،؛؟.\n([{"'«])impossible[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1مەحاڵە-')
         .replace(/(^|[\s،؛؟.\n([{"'«])bak[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1گێـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])baka[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1گێژ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])dam[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1نەفـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])damn[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1نەفرەت-')
         .replace(/(^|[\s،؛؟.\n([{"'«])kno[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1نازانـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])know[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1نازانـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])thi[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1پێموابوو-')
         .replace(/(^|[\s،؛؟.\n([{"'«])think[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1پێموابوو-')
         .replace(/(^|[\s،؛؟.\n([{"'«])jus[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1تەنها-')
         .replace(/(^|[\s،؛؟.\n([{"'«])just[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1تەنها-')
         .replace(/(^|[\s،؛؟.\n([{"'«])rea[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بەڕاسـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])really[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بەڕاسـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])run[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1ڕابکـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])kill[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بکوژ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])die[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بمر-')
         .replace(/(^|[\s،؛؟.\n([{"'«])live[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بژی-')
         .replace(/(^|[\s،؛؟.\n([{"'«])com[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1وەر-')
         .replace(/(^|[\s،؛؟.\n([{"'«])come[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1وەر-')
         .replace(/(^|[\s،؛؟.\n([{"'«])go[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1بڕۆ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])tel[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1پێمبڵـ-')
         .replace(/(^|[\s،؛؟.\n([{"'«])tell[-—–]+(?=[\s،؛؟.,!?:'")]|$)/gi, '$1پێمبڵـ-');

    // Kurdish cut-off words ending with hyphen (preserve clean attachment without disconnected spaces)
    s = s.replace(/([\u0600-\u06ff]+)\s+[-—–]+(?=\s|$|[.,!?;:،؛؟])/g, '$1-');

    return s;
  }

  /**
   * Replace leftover English words in translated Kurdish text with their natural Kurdish equivalents.
   * Carefully protects HTML tags (`<...>`), ASS style override tags (`{...}`), and bracket tokens.
   */
  function cleanUntranslatedEnglish(text) {
    if (!text || typeof text !== 'string') return text;
    let s = text;

    // Apply speech cut-offs & stutter translation
    s = handleSpeechCutoffs(s);

    // Replace untranslated English words, preserving tags and code brackets
    s = s.replace(/(<[^>]*>|\{[^}]*\}|\[\s*T\s*[\d\u0660-\u0669\u06f0-\u06f9]+\s*\])|(\b[a-zA-Z]{2,}\b)/gi, (m, tag, word) => {
      if (tag) return tag;
      if (!word) return m;
      const lower = word.toLowerCase();

      // Technical tags / format keywords to keep
      if (/^(webvtt|note|style|ass|ssa|pos|an\d|fs|fn|c|b|i|u|s|k|kf|ko|q|r)$/i.test(word)) {
        return word;
      }

      if (UNTRANSLATED_ENGLISH_MAP[lower]) {
        return UNTRANSLATED_ENGLISH_MAP[lower];
      }

      return word;
    });

    return s;
  }

  /**
   * Enhanced Cinema Idiom & Expression Matching.
   * Matches idioms with flexible punctuation, contraction handling, and orders longer phrases first.
   */
  function findMatches(text) {
    if (!text || typeof text !== 'string') return [];
    const cleanText = text.toLowerCase().replace(/['’]/g, "'").replace(/\s+/g, ' ');
    const matches = [];

    // Sort lexicon entries by key length descending so longer, more specific quotes match first
    const entries = Object.entries(ADVANCED_SUBTITLE_LEXICON);
    entries.sort((a, b) => b[0].length - a[0].length);

    for (const [expr, info] of entries) {
      const cleanExpr = expr.toLowerCase().replace(/['’]/g, "'");
      const escaped = cleanExpr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]?");
      const regex = new RegExp('(?:^|\\s|[,.!?;:"()\\[\\]{}<>])' + escaped + '(?:$|\\s|[,.!?;:"()\\[\\]{}<>])', 'i');
      if (regex.test(cleanText)) {
        matches.push({
          expression: expr,
          kurdish: info.kurdish,
          primary: info.kurdish,
          context: info.context || expr,
          alternatives: info.alternatives || []
        });
      }
    }
    return matches;
  }

  return {
    LEXICON: ADVANCED_SUBTITLE_LEXICON,
    UNTRANSLATED_MAP: UNTRANSLATED_ENGLISH_MAP,
    handleSpeechCutoffs,
    cleanUntranslatedEnglish,
    findMatches,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslatorDict;
}

