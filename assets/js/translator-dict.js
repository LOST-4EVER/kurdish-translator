/**
 * translator-dict.js — Comprehensive Subtitle Idioms, Combat Commands,
 * Anime Tropes, Colloquial Expressions, and Kurdish Sorani Mappings.
 *
 * Uses high-density structured lexicon tables for rapid O(1) lookups,
 * compact footprint, and seamless Node.js / Browser interop.
 */
const TranslatorDict = (() => {
  // Compact tuple schema: [English, Kurdish, Context/Category, Alternatives (comma-separated or array)]
  const RAW_LEXICON = [
    // --- Profanity, Expletives & Subtitle Expressions ---
    ['fuck', 'نەفرەت', 'Expletive', 'شەیتان,دۆزەخ,سەگباب'],
    ['fucking', 'نەفرەتی', 'Emphasis', 'سەگباب,نەعلەتی,دۆزەخ'],
    ['fuck off', 'سەری خۆت هەڵگرە', 'Dismissal', 'لەبەرچاوم ون بە,بڕۆ بۆ دۆزەخ,بە نەفرەت بێت'],
    ['fuck you', 'نەفرەتت لێ بێت', 'Invective', 'بە نەفرەت بێت,تۆ بڕۆ بۆ دۆزەخ'],
    ['fuck it', 'بە نەفرەت بێت', 'Resignation', 'واز لەوە بێنە,خەمیم نییە'],
    ['what the fuck', 'چی دۆزەخێکە', 'Shock/Anger', 'چی نەعلەتییەکە,ئەمە چی نەفرەتییەکە,چی گویەکە'],
    ['wtf', 'چی دۆزەخێکە', 'Shock', 'چی نەعلەتییەکە,ئەمە چییە'],
    ['shut the fuck up', 'دەمت دابخە', 'Silencing', 'دەمپیس دەمت دابخە,دەمت بەستە,دەنگی خۆت ببڕە'],
    ['shit', 'نەفرەت', 'Frustration', 'پیسایی,کەریەتی,دۆزەخ'],
    ['holy shit', 'ئەی هاوار', 'Astonishment', 'ئەی خوایە,خوایە گیان,بەڕاستی سەیرە'],
    ['bullshit', 'قسەی پووچ', 'Lies/Nonsense', 'قسەی بێمانا,ڕیسوایی,درۆی شاخدار'],
    ['damn', 'نەفرەتی', 'Disappointment', 'داخەکەم,نەعلەتی,دۆزەخ'],
    ['goddamn', 'نەفرەتی', 'Emphasis', 'نەعلەتی,سەگباب'],
    ['god dammit', 'نەفرەت', 'Expletive', 'نەعلەتی,داخەکەم'],
    ['goddamn it', 'نەفرەت', 'Expletive', 'نەعلەتی,داخەکەم'],
    ['bastard', 'سەگباب', 'Insult', 'حەرامزادە,کەڵەگا,سووک'],
    ['bitch', 'سووک', 'Insult', 'پێڵاوپیس,سەگباب,چەتەڵ'],
    ['son of a bitch', 'سەگباب', 'Insult', 'کوڕی سەگ,کوڕی پێڵاوپیس'],
    ['motherfucker', 'نەعلەتی', 'Insult', 'سەگباب,سەگی بێباوک,سووک'],
    ['asshole', 'سووک', 'Insult', 'سەگباب,گەمژەی بێئابڕوو,کەر'],
    ['dickhead', 'گەمژە', 'Insult', 'کەر,کەلەپووت,بێئەقڵ'],
    ['dumbass', 'گەمژە', 'Insult', 'کەر,نەفام,سەربەتاڵ'],
    ['idiot', 'گەمژە', 'Insult', 'نەفام,کەر,بێئەقڵ'],
    ['screw you', 'نەعلەتت لێ بێت', 'Dismissal', 'بڕۆ بۆ دۆزەخ,بە نەفرەت بێت'],
    ['screw it', 'واز لەوە بێنە', 'Dismissal', 'خەمیم نییە,گرنگ نییە'],
    ['screw this', 'واز لەمە بێنە', 'Frustration', 'بە نەفرەت بێت ئەمە,چیتر ئەمەم ناوێت'],
    ['screw that', 'واز لەوە بێنە', 'Dismissal', 'بە نەفرەت بێت'],
    ['go to hell', 'بڕۆ بۆ دۆزەخ', 'Curse', 'تۆ بڕۆ بۆ جەهەننەم,لەناو بچیت'],
    ['kiss my ass', 'واز لە من بێنە', 'Defiance', 'سەری خۆت بدە لە بەرد,گرنگی بە تۆ نادەم'],
    ['get lost', 'لەبەرچاوم ون بە', 'Dismissal', 'تێپەڕە لە لای من,سەری خۆت هەڵگرە'],
    ['shut up', 'دەمت دابخە', 'Silence', 'بێدەنگ بە,دەنگی خۆت ببڕە'],
    ['shut your mouth', 'دەمت دابخە', 'Silence', 'دەنگ مەکە,قسە مەکە'],
    ['piece of shit', 'پیاوی سووک', 'Insult', 'سەگباب,کەسی بێئابڕوو'],
    ['freaking', 'نەفرەتی', 'Emphasis', 'زۆر,بە نەفرەت'],
    ['freak out', 'شڵەژان', 'Panic', 'لەترسان شێت بوون,تێکچوونی دەروونی,ترسی زۆر'],
    ['freaking out', 'تەواو شڵەژاو و ترساو', 'Panic', 'لەترسان شێت دەبم,کۆنتڕۆڵم لەدەستداوە'],
    ['freaked out', 'شڵەژا و ترسا', 'Past Panic', 'تەواو ترسا,لە ترسا شێت بوو'],

    // --- Cinematic & Spoken Dialogue Idioms ---
    ['come on', 'دەی!', 'Urgency/Protest', 'دە بەسە!,زووکە!,دەی تکایە!,گاڵتەم لەگەڵ مەکە!'],
    ["c'mon", 'دەی!', 'Urgency/Protest', 'دە بەسە!,زووکە!,دەی تکایە!'],
    ['come on man', 'دەی برام!', 'Colloquial Protest', 'دە بەسە کاکە!,گاڵتەم لەگەڵ مەکە!,دەی هاوڕێ!'],
    ['come on bro', 'دەی برام!', 'Colloquial Appeal', 'دەی براکەم!,دە بەسە!'],
    ['come on dude', 'دەی هاوڕێ!', 'Colloquial Appeal', 'دەی برام!,دە بەسە!'],
    ['come on now', 'دەی ئیتر!', 'Urgency', 'دە بەسە ئیتر!,زووکە ئێستا!'],
    ['oh come on', 'ئۆی دە بەسە!', 'Exasperation', 'دەی گاڵتەم لەگەڵ مەکە!,ئای دەی!'],
    ['you got this', 'تۆ دەتوانیت!', 'Encouragement', 'پشتت بەخۆت بێت!,لە دەستت دێت!,کۆڵ مەدە!'],
    ["you've got this", 'تۆ دەتوانیت!', 'Encouragement', 'پشتت بەخۆت بێت!,لە دەستت دێت!'],
    ['give me a break', 'مۆڵەتم بدە', 'Exasperation', 'دە لێم گەڕێ,دەستم لێ هەڵگرە,گاڵتەم لەگەڵ مەکە'],
    ['cut me some slack', 'چاوپۆشیم لێبکە', 'Leniency', 'ئەوەندە توند مەبە لەگەڵم,بەزەییت پێمدا بێتەوە'],
    ['cut some slack', 'چاوپۆشیکردن', 'Leniency', 'ڕەچاوکردنی بارودۆخ,نەرمبوون لە مامەڵە'],
    ['suit yourself', 'کەیفی خۆتە', 'Choice', 'هەرچۆن ئارەزوو دەکەیت,بە دڵی خۆت بکە'],
    ['take your time', 'پەلە مەکە', 'Patience', 'بە هێمنی بیکە,کاتی خۆتی بۆ تەرخان بکە'],
    ['hold your horses', 'ئارام بگرە', 'Patience', 'پەلە مەکە,بۆستە کەمێک,هێمن بە'],
    ['cold feet', 'پاشگەزبوونەوە لە ترسان', 'Hesitation', 'لەدەستدانی بوێری,ترسان لە کۆتا ساتدا'],
    ['get cold feet', 'لە ترسان پاشگەزبوونەوە', 'Hesitation', 'ترس دەست بەسەرداگرتن'],
    ['out of nowhere', 'لەناکاو', 'Unexpected', 'لە هیچ کوێیەکەوە,بەبێ ئاگاداری پێشوەختە,لەپڕ'],
    ['out of the blue', 'لەناکاو و کتوپڕ', 'Unexpected', 'بەبێ چاوەڕوانی,لەپڕێکدا'],
    ['my bad', 'هەڵەی من بوو', 'Apology', 'بمبوورە، من خەتابارم,کەمتەرخەمی من بوو'],
    ['heads up', 'ئاگاداربە!', 'Alert/Warning', 'سەرنج بدە!,وریا بە!,ئاگاداری پێشوەختە'],
    ['give a heads up', 'ئاگادارکردنەوەی پێشوەختە', 'Warning', 'پێشوەخت هەواڵدان'],
    ['off the hook', 'ڕزگاربوو لە کێشە', 'Escaped Trouble', 'بەخشرا لە سزا,دەربازبوو'],
    ['no brainer', 'پێویستی بە بیرکردنەوە نییە', 'Obvious Choice', 'بڕیارێکی زۆر ڕوونە,کارێکی ئاشکرایە'],
    ['piece of cake', 'زۆر ئاسانە', 'Easy Task', 'وەک ئاو خواردنەوە وایە,هەرگیز قورس نییە'],
    ['bite the bullet', 'دان بەخۆداگرتن لە ناڕەحەتیدا', 'Endurance', 'تەحەمولکردنی ناخۆشی,قبوڵکردنی ئازار'],
    ['break a leg', 'بەختی باشت هەبێت!', 'Encouragement', 'سەرکەوتوو بیت!,هیوای سەرکەوتن'],
    ['spill the beans', 'نهێنییەکە ئاشکرا بکە', 'Reveal Secret', 'ڕاستییەکە بدرکێنە,هەموو شتێک بڵێ'],
    ['under the weather', 'نەخۆش و بێهێز', 'Unwell', 'تەندروستی باش نییە,هەست بە ماندوێتی دەکات'],
    ['face to face', 'ڕووبەڕوو', 'Direct Contact', 'چاو لە چاو,ڕاستەوخۆ'],
    ['out of my way', 'لە ڕێگام لادە', 'Urgent Movement', 'ڕێگام بدە,تێپەڕە'],
    ['never mind', 'کێشە نییە، لەبیری کە', "Don't Worry", 'گرنگ نییە,بێ خەم بە'],
    ['get out of here', 'بڕۆ دەرەوە', 'Dismissal', 'لەبەرچاوم ون بە,سەری خۆت هەڵگرە'],
    ['make yourself at home', 'ماڵی خۆتە', 'Hospitality', 'ئاسوودە بە,تەواو بە ئاسودەیی بە'],
    ['look out', 'وریا بە!', 'Caution', 'ئاگاداربە!,سەیرکە!'],
    ['watch out', 'ئاگاداربە!', 'Caution', 'وریا بە!,خۆت بپارێزە!'],
    ['take care', 'ئاگاداری خۆت بە', 'Parting', 'سەلامەت بیت,خوات لەگەڵ'],
    ['hang on', 'کەمێک چاوەڕێ بکە', 'Pause', 'بۆستە کەمێک,ڕابوەستە'],
    ['hold on', 'ڕابوەستە', 'Pause', 'چاوەڕێ بە,بۆستە'],
    ['hurry up', 'پەلە بکە!', 'Urgency', 'زووکە!,کاتی زۆرمان نییە'],
    ['calm down', 'هێمن بەرەوە', 'Comfort', 'ئارام بە,مەشڵەژێ'],
    ['of course', 'بێگومان', 'Agreement', 'بە دڵنیاییەوە,ڕاستە'],
    ['by the way', 'لەم نێوەندەدا / بە بۆنەیەوە', 'Transition', 'بەڕاستی,قسەم بیرکەوتەوە'],
    ['good luck', 'بەختی باش', 'Well Wishes', 'سەرکەوتوو بیت,هیوای سەرکەوتن'],
    ['oh my god', 'ئەی خوایە گیان!', 'Shock/Awe', 'خوایە گیان,ئەی هاوار,پەروەردگارا'],
    ['omg', 'ئەی خوایە گیان!', 'Exclamation', 'خوایە گیان,ئەی هاوار'],
    ['what the hell', 'چی ڕوودەدات لێرەدا', 'Confusion', 'ئەمە چی نەعلەتییەکە,چی بووە'],
    ['what the heck', 'چی بووە', 'Mild Confusion', 'ئەمە چییە,چی ڕوودەدات'],
    ['are you kidding me', 'گاڵتەم لەگەڵ دەکەیت؟', 'Disbelief', 'بەڕاستتە؟,گاڵتەیە؟'],
    ['are you sure', 'دڵنیایت؟', 'Confirmation', 'تەواو باوەڕت وایە؟'],
    ['thank god', 'سوپاس بۆ خودا', 'Gratitude', 'خوایە سوپاس,سوپاس بۆ پەروەردگار'],
    ['no way', 'مەحاڵە!', 'Disbelief', 'نابێت!,باوەڕ ناکەم!'],
    ['for real', 'بەڕاستی؟', 'Sincerity', 'بە جدی؟,ڕاستە؟'],
    ['fair enough', 'پەسەندە', 'Acceptance', 'باشە قبوڵمە,حەقی خۆتە'],
    ['long time no see', 'مێژوویەکی زۆرە نەمدیوی', 'Greeting', 'زۆر کاتە لێرە نەبوویت,بەخێربێیتەوە'],
    ['catch you later', 'دواتر دەتبینمەوە', 'Parting', 'خوات لەگەڵ بۆ دواتر,بە ئومێدی دیدار'],
    ['keep in touch', 'پەیوەندیمان با بمێنێت', 'Parting', 'هەواڵم بدەرێ,لە پەیوەندیدا بە'],
    ['what is going on', 'چی ڕوودەدات؟', 'Query', 'چی بووە لێرەدا؟,بارودۆخ چۆنە؟'],
    ['are you insane', 'شێت بوویت؟', 'Incredulity', 'ئەقڵت لەدەستداوە؟,شێتی؟'],
    ['how come', 'چۆن ڕوویدا؟ / بۆچی؟', 'Inquiry', 'هۆکارەکەی چییە؟,بۆ وا بوو؟'],
    ['so far so good', 'هەتا ئێستا هەموو شتێک باشە', 'Status', 'بارودۆخ لەبارە,کێشە نییە'],
    ['make up your mind', 'بڕیار بدە', 'Decision', 'بڕیاری کۆتایی بدە,یەکلا بەرەوە'],
    ['count me in', 'منیش لەگەڵتانم', 'Participation', 'ناوم تۆمار بکەن,دێم لەگەڵتان'],
    ['give it a shot', 'تاقیبکەرەوە', 'Encouragement', 'هەوڵێکی بۆ بدە,دەستپێبکە'],
    ['beat it', 'بڕۆ لە لای من', 'Dismissal', 'سەری خۆت هەڵگرە,لێرە نەمێنیت'],
    ['keep it up', 'بەردەوام بە لەسەری', 'Encouragement', 'کۆڵ مەدە,هەر بەو شێوەیە بڕۆ'],
    ['by all means', 'بە دڵنیاییەوە', 'Permission', 'فەرموو,بە خۆشحاڵییەوە'],
    ['i have no idea', 'هیچ زانیاریم نییە', 'Ignorance', 'نازانم,بێئاگام'],
    ['no problem', 'کێشە نییە', 'Reassurance', 'هیچ نییە,فەرموو'],
    ['you are welcome', 'سەرچاو / شایەنی نییە', 'Politeness', 'بەخێربێیت,خۆشحاڵم'],
    ["you're welcome", 'سەرچاو / شایەنی نییە', 'Politeness', 'شایەنی سوپاس نییە,سەرچاو'],
    ["don't worry", 'نیگەران مەبە', 'Comfort', 'خەمت نەبێت,کێشە نییە'],
    ['take it easy', 'ئارام بە', 'Relaxation', 'پەلە مەکە,هێمن بە'],
    ['mind your own business', 'تێکەڵی کاری من مەبە', 'Interference', 'بچۆ بە لای کاری خۆتەوە,کاری تۆ نییە'],
    ['on my way', 'لە ڕێگادام', 'Arrival', 'ئێستا دەگەم,بەڕێکەوتم'],
    ['give me a hand', 'یارمەتیم بدە', 'Help Request', 'دەستم بگرە,هاوکاریم بکە'],

    // --- Action, Combat & Tactical Military Commands ---
    ['lock and load', 'چەکەکانتان ئامادە بکەن', 'Tactical Weaponry', 'چەکدار بن,ئامادەی شەڕ بن'],
    ['fire in the hole', 'مەترسی تەقینەوە! وریا بن!', 'Explosive Alert', 'تەقینەوە دێت,خۆتان بشارنەوە'],
    ['code red', 'باری لەناکاوی زۆر مەترسیدار', 'Emergency Alert', 'زەنگی مەترسی,ئاگاداری پلە یەک'],
    ['all clear', 'ناوچەکە تەواو ئارام و پارێزراوە', 'Safe Status', 'هیچ مەترسییەک نەماوە,هەموو شتێک ئاساییە'],
    ['cease fire', 'تەقەکردن بوەستێنن!', 'Command', 'دەست لە تەقە هەڵگرن,شەڕ ڕابگرن'],
    ['on my mark', 'لەگەڵ ئاماژەی مندا', 'Tactical Timing', 'کاتێک فەرمانم دا,بە نیشانەی من'],
    ['abort mission', 'ئەرکەکە هەڵوەشێننەوە!', 'Command', 'بگەڕێنەوە دواوە,ئەرکەکە ڕابگرن'],
    ['cover me', 'پشتم بگرە / پارێزگاریم لێبکە!', 'Combat Support', 'تەقەی پشتیوانیم بۆ بکە,ئاگات لێم بێت'],
    ['watch your back', 'ئاگاداری پشتەوەت بە!', 'Warning', 'وریا بە لە دواتەوە,ئاگات لە دوای خۆت بێت'],
    ['got your back', 'پشتت دەگرم و دەتپارێزم', 'Loyalty/Support', 'لەگەڵتام,خەمت نەبێت دەتپارێزم'],
    ["i've got your back", 'پشتت دەگرم و دەتپارێزم', 'Loyalty', 'هاوڕێتم و دەتپارێزم,لە پشتتم'],
    ['drop your weapons', 'چەکەکانتان دابنێن!', 'Surrender Order', 'چەک فڕێ بدەن,دەست هەڵبڕن'],
    ['drop your weapon', 'چەکەکەت دابنێ!', 'Surrender Order', 'چەکەکەت فڕێ بدە,دەستت بەرز بکەوە'],
    ['fall back', 'پاشەکشە بکەن!', 'Retreat Command', 'بگەڕێنەوە دواوە,بکشێنەوە'],
    ['keep moving', 'بەردەوام بن لە ڕۆیشتن!', 'Urgency', 'مەوەستن,بڕۆنە پێشەوە'],
    ['hands up', 'دەستەکانت بەرز بکەرەوە!', 'Surrender', 'دەست هەڵبڕە,مەجوڵێ'],
    ['freeze', 'مەجوڵێ لە شوێنی خۆت!', 'Police/Military Order', 'ڕاوەستە,دەستت بەرز بکە'],
    ['call for backup', 'داوای هێزی پشتیوانی بکەن', 'Tactical Reinforcement', 'پەیوەندی بە هێزی فریاگوزارییەوە بکە'],
    ['man down', 'سەربازێک پێکرا / کەوتووە!', 'Casualty Alert', 'بریندارمان هەیە,فریاگوزار بانگ بکەن'],

    // --- Anime, Fantasy & Shonen Tropes ---
    ['i will never forgive you', 'هەرگیز لێت خۆش نابم!', 'Vow/Conflict', 'تۆڵەت لێ دەستێنمەوە,لێت نابوورم'],
    ["you're wide open", 'هیچ بەرگرییەکت نییە!', 'Combat Weakness', 'ڕێگام لەبەردەمدا کراوەیە,بێ پارێزگاریت'],
    ['you are wide open', 'هیچ بەرگرییەکت نییە!', 'Combat Weakness', 'ئامادە نیت,بێ بەرگریت'],
    ['is that all you got', 'ئایا ئەوە هەموو هێزت بوو؟', 'Taunt', 'توانات ئەوەندەیە؟,هێزی زیاترت نییە؟'],
    ["is that all you've got", 'ئایا ئەوە هەموو توانای تۆ بوو؟', 'Taunt', 'ئەوە هەموو هێزتە؟,هیچی ترت پێ نییە؟'],
    ["i won't give up", 'هەرگیز کۆڵ نادەم!', 'Resolution', 'خۆم بەدەستەوە نادەم,تا کۆتایی دەجەنگم'],
    ['prepare to die', 'ئامادەی مردن بە!', 'Threat', 'کۆتاییت هاتووە,مردنت نزیکە'],
    ['this is the end for you', 'ئەمە کۆتایی تۆیە!', 'Climax Battle', 'لێرەدا لەناو دەچیت,چارەنووست بڕایەوە'],
    ['what are you planning', 'پلانت بۆ چی داناوە؟', 'Suspicion', 'نیازی چیت هەیە؟,چیت لەسەردایە؟'],
    ['how dare you', 'چۆن دەوێریت!', 'Outrage', 'چ بوێرییەکت هەیە,چۆن ڕووت دێت'],
    ['show no mercy', 'هیچ بەزەییەک نیشان مەدە!', 'Combat Ruthlessness', 'بە بێبەزەییانە لێیان بدە,بەزەییت نەبێت'],
    ['what in the world', 'ئەمە چییە لەم جیهانەدا؟', 'Disbelief', 'چی ڕوودەدات خوایە,سەیرە'],
    ['believe in yourself', 'بڕوات بە خۆت هەبێت!', 'Inspiration', 'متمانەت بە توانات بێت,کۆڵ مەدە'],
    ['i swear it', 'سوێند بە خودا دەخۆم', 'Oath', 'بەڵێنت پێدەدەم,سوێند دەخۆم'],
    ['i swear to god', 'سوێند بە خودا', 'Oath', 'بە خوا ڕاستە,سوێند بێت'],
    ['domain expansion', 'فراوانکردنی بواری دەسەڵات (دۆمەین)', 'Jujutsu Ability', 'کردنەوەی سنووری جادوویی,دۆمەین ئێکسپانشن'],
    ['infinite void', 'بۆشایی بێسنوور (ئینفینیت ڤۆید)', 'Jujutsu Ability', 'بۆشایی ئەبەدی,دەسەڵاتی گۆجۆ'],
    ['rasengan', 'ڕاسێنگان (گۆی خولاوەی چاکرا)', 'Naruto Jutsu', 'تەپڵە چاکرا,هێرشی ڕاسێنگان'],
    ['chidori', 'چیدۆری (هەزار چۆلەکە)', 'Naruto Jutsu', 'بروسکەی چیدۆری,شمشێری هەورەبروسکە'],
    ['shinzou wo sasageyo', 'دڵەکانتان پێشکەش بکەن!', 'Attack on Titan Vow', 'گیانتان ببەخشن بۆ نیشتمان,تێکۆشان تا سەرکەوتن'],
    ['arise', 'هەستەوە! (ئەرایز)', 'Solo Leveling Command', 'هەستنەوە لە مردن,سوپای سێبەر هەستنەوە'],
    ['bankai', 'بانکای (دەسەڵاتی کۆتایی زانپاکتۆ)', 'Bleach Technique', 'ڕزگارکردنی کۆتایی شمشێر,بانکای'],
    ['kamehameha', 'کامێهامێها!', 'Dragon Ball Attack', 'شەپۆلی وزەی کامێهامێها'],
  ];

  // Build the public ADVANCED_SUBTITLE_LEXICON object
  const ADVANCED_SUBTITLE_LEXICON = {};
  RAW_LEXICON.forEach(([phrase, kurdish, context, alts]) => {
    const alternatives = Array.isArray(alts) ? alts : (alts ? alts.split(',') : []);
    ADVANCED_SUBTITLE_LEXICON[phrase] = { kurdish, context, alternatives };
  });

  // Untranslated English terms, Honorifics, Titles & Subtitle Terminology
  const UNTRANSLATED_ENGLISH_MAP = {
    // Kinship, honorifics & conversational titles
    'sir': 'گەورەم',
    'madam': 'خانمەکەم',
    'maam': 'خانمەکەم',
    "ma'am": 'خانمەکەم',
    'mister': 'بەڕێز',
    'mr': 'بەڕێز',
    'mrs': 'خانم',
    'ms': 'خانم',
    'dr': 'دکتۆر',
    'doctor': 'دکتۆر',
    'captain': 'کاپتن',
    'commander': 'فەرماندە',
    'general': 'ژەنەڕاڵ',
    'colonel': 'عەقید',
    'lieutenant': 'ملازم',
    'sergeant': 'سەرباز / عەریف',
    'officer': 'ئەفسەر',
    'chief': 'سەرۆک',
    'detective': 'لێکۆڵەر',
    'agent': 'بریکار / سیخوڕ',
    'boss': 'بەرپرس / گەورەم',
    'king': 'پاشا',
    'queen': 'شاژن',
    'prince': 'شازادە',
    'princess': 'شازادە خاتوون',
    'lord': 'لۆرد / گەورەم',
    'lady': 'خانم',
    'emperor': 'ئیمپراتۆر',
    'sensei': 'مامۆستا (سێنسێی)',
    'senpai': 'پلەبەرزتر (سێمپای)',
    'sama': 'ڕێزدار',
    'san': 'بەڕێز',
    'kun': 'گیان',
    'chan': 'خاتوون',
    'bro': 'برا',
    'dude': 'هاوڕێ',
    'buddy': 'هاوڕێ',
    'pal': 'هاوڕێکەم',
    'mate': 'هاوڕێ',
    'sweetheart': 'عەزیزەکەم',
    'honey': 'ئازیزم',
    'darling': 'خۆشەویستم',
    'babe': 'ئازیزەکەم',
    'baby': 'ئازیزم',
  };

  /**
   * Handle speech cut-offs and interrupted dialogue dashes.
   */
  function handleSpeechCutoffs(str) {
    if (!str) return '';
    return str
      .replace(/\b([A-Za-z]+)-+(?=\s|$|[.,!?;:])/g, '$1')
      .replace(/(^|\s)I-+(?=\s|$)/g, '$1I ')
      .replace(/(^|\s)W-+(?=\s|$)/g, '$1W ')
      .replace(/([-—–]{2,})/g, '—');
  }

  /**
   * Clean untranslated English remnants in machine-translated subtitle lines.
   */
  function cleanUntranslatedEnglish(str) {
    if (!str || typeof str !== 'string') return '';
    let s = str;
    // Replace isolated English title words with Kurdish equivalents
    Object.keys(UNTRANSLATED_ENGLISH_MAP).forEach((word) => {
      const kurdishWord = UNTRANSLATED_ENGLISH_MAP[word];
      const re = new RegExp('(^|[\\s،؛؟.\'"\\[{(<])' + word + '([\\s،؛؟.\'"\\]})>]|$)', 'gi');
      s = s.replace(re, '$1' + kurdishWord + '$2');
    });
    return s;
  }

  // Pre-compiled matchers for O(1) performance in live quality inspectors
  const PRECOMPILED_LEXICON_MATCHERS = Object.entries(ADVANCED_SUBTITLE_LEXICON)
    .sort((a, b) => b[0].length - a[0].length)
    .map(([expr, info]) => {
      const cleanExpr = expr.toLowerCase().replace(/['’]/g, "'");
      const escaped = cleanExpr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]?");
      const regex = new RegExp('(?:^|\\s|[,.!?;:"()\\[\\]{}<>])' + escaped + '(?:$|\\s|[,.!?;:"()\\[\\]{}<>])', 'i');
      return {
        expr,
        kurdish: info.kurdish,
        primary: info.kurdish,
        context: info.context || expr,
        alternatives: info.alternatives || [],
        regex,
      };
    });

  /**
   * Match cinema idioms and expressions in English subtitle text.
   */
  function findMatches(text) {
    if (!text || typeof text !== 'string') return [];
    const cleanText = text.toLowerCase().replace(/['’]/g, "'").replace(/\s+/g, ' ');
    const matches = [];

    for (let i = 0; i < PRECOMPILED_LEXICON_MATCHERS.length; i++) {
      const item = PRECOMPILED_LEXICON_MATCHERS[i];
      if (item.regex.test(cleanText)) {
        matches.push({
          expression: item.expr,
          kurdish: item.kurdish,
          primary: item.primary,
          context: item.context,
          alternatives: item.alternatives,
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
