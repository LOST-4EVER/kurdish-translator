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

    // --- Common Spoken & Conversational Expressions ---
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

    // --- More Common Daily Cinematic Expressions ---
    ['step by step', 'هەنگاو بە هەنگاو', 'Pacing', 'پلە بە پلە,وردە وردە'],
    ['keep an eye on', 'چاوێکت لەسەری بێت', 'Vigilance', 'ئاگاداری بە,چاودێری بکە'],
    ['make sense', 'مانای هەیە و لۆژیکییە', 'Reasoning', 'پەسەندە,لێی تێدەگەم'],
    ["doesn't make sense", 'هیچ مانایەکی نییە', 'Confusion', 'بێمانایە,لۆژیکی نییە'],
    ['in that case', 'لەو حاڵەتەدا', 'Conditional', 'ئەگەر وا بێت,کەواتە'],
    ['no big deal', 'شتێکی ئەوتۆ نییە', 'Reassurance', 'گرنگ نییە,کێشە نییە'],
    ['sounds good', 'زۆر باشە', 'Agreement', 'پێم باشە,ڕێکەوتین'],
    ['let me know', 'ئاگادارم بکەرەوە', 'Request', 'هەواڵم بدەرێ,پێم بڵێ'],
    ['hang in there', 'خۆڕاگر بە!', 'Encouragement', 'بەرگە بگرە,کۆڵ مەدە'],
    ['step aside', 'لاچۆ بە لایەکدا', 'Command', 'ڕێگام بدە,کەمێک لادە'],
    ['get out of my sight', 'لەبەرچاوم ون بە!', 'Anger', 'لێرە نەمێنیت,سەری خۆت هەڵگرە'],
    ['look at me', 'سەیری من بکە', 'Attention', 'ڕووت لە من بێت,سەیرم کە'],
    ['listen to me', 'گوێم لێ بگرە', 'Attention', 'گوێ بدە بە قسەم,سەرنج بدە'],
    ['tell the truth', 'ڕاستییەکە بڵێ', 'Honesty', 'درۆ مەکە,هەموو شتێک بدرکێنە'],
    ["i didn't mean to", 'مەبەستم ئەوە نەبوو', 'Apology', 'بە ئەنقەست نەبوو,بمبوورە'],
    ["don't blame yourself", 'خۆت خەتابار مەکە', 'Comfort', 'هەڵەی تۆ نەبوو,مەشکێنەوە لەسەر خۆت'],
    ["it's not your fault", 'خەتای تۆ نییە', 'Reassurance', 'تۆ تاوانبار نیت,دەستی تۆی تێدا نەبوو'],
    ["it's up to you", 'بڕیار لە دەست خۆتە', 'Choice', 'کەیفی خۆتە,بە دڵی خۆت بکە'],
    ["let's get started", 'با دەست پێبکەین', 'Action', 'کاتی دەستپێکردنە,فەرموون'],
    ['are you out of your mind', 'ئەقڵت لە دەستداوە؟', 'Disbelief', 'شێت بوویت؟,ئەقڵت تەواوە؟'],
    ['what brings you here', 'چ کارێک تۆی هێناوەتە ئێرە؟', 'Inquiry', 'بۆچی هاتووی؟,خێرە لێرەیت؟'],
    ["what's the matter", 'کێشە چییە؟', 'Inquiry', 'چی بووە؟,چیت بەسەرهاتووە؟'],
    ['what happened to you', 'چیت بەسەرهات؟', 'Inquiry', 'چی ڕوویدا بۆ تۆ؟,بۆ وا لێت هات؟'],
    ["how's it going", 'بارودۆخ چۆنە؟', 'Greeting', 'چۆنیت؟,کاروبار چۆن دەڕوات؟'],
    ['long story short', 'بە کورتی و پوختی', 'Summary', 'کورتەی باسەکە,سەرەنجام'],
    ['to be honest', 'بە ڕاستگۆییەوە', 'Honesty', 'ئەگەر ڕاستت دەوێت,لە ڕاستیدا'],
    ['by any chance', 'ئەگەر ڕێککەوت بێت', 'Polite Question', 'ڕەنگە,هیچ دەگونجێت؟'],
    ["don't mention it", 'شایەنی سوپاس نییە', 'Courtesy', 'هیچ نییە,سەرچاو'],
    ['glad to hear that', 'خۆشحاڵم بە بیستنی ئەوە', 'Pleasure', 'هەواڵێکی دڵخۆشکەرە'],
    ['sorry to hear that', 'داخەکانم بە بیستنی ئەوە', 'Sympathy', 'دڵتەنگ بووم بۆت'],
    ["i'm so sorry", 'زۆر داوای لێبوردن دەکەم', 'Apology', 'لە دڵەوە داوای لێبوردن دەکەم'],
    ["for goodness' sake", 'لەبەر خاتری خودا!', 'Exclamation', 'دە بەسە ئیتر,تکایە'],
    ["for god's sake", 'لەبەر خاتری خوا!', 'Exclamation', 'بە خاتری خودا,تکایە بەسە'],
    ['rest in peace', 'ڕۆحی شاد بێت و ئارام بنوێت', 'Eulogy', 'جێگای بەهەشت بێت,سەبووری بۆ کەسوکاری'],
    ['good point', 'خاڵێکی زۆر باشە', 'Agreement', 'سەرنجێکی بەجێیە,ڕاست دەکەیت'],
    ['point taken', 'لە مەبەستت تێگەیشتم', 'Acceptance', 'قسەکەت دروستە,تێگەیشتم'],
    ["i don't care", 'گرنگیی پێ نادەم', 'Indifference', 'خەمم نییە,بۆ من وەک یەکە'],
    ['who cares', 'کێ گرنگی پێدەدات؟', 'Indifference', 'کەس خەمی نییە,گرنگ نییە'],
    ['none of your business', 'پەیوەندی بە تۆوە نییە', 'Rebuff', 'کاری تۆ نییە,دەست وەرمەدە'],
    ['what are you doing here', 'لێرە چی دەکەیت؟', 'Question', 'بۆ لێرەیت؟'],
    ['watch your step', 'ئاگاداری هەنگاوەکانت بە', 'Caution', 'وریا بە لە ڕێگاکەتدا,سەیرکە لەکوێ پێ دادەنێیت'],
    ['stay away', 'دوور بکەوە!', 'Warning', 'نزیک مەبەوە,لێرە مەبە'],
    ['back off', 'بکشێوە دواوە!', 'Command', 'دوور بکەوە لێم,نزیک مەبەوە'],
    ['get back', 'بڕۆ دواوە!', 'Command', 'بگەڕێوە دواوە,مەیەرە پێش'],
    ['hold tight', 'توند دەستت بگرە!', 'Urgency', 'خۆت ڕابگرە,توند بیگرە'],
    ['give it back', 'بیگەڕێنەرەوە بۆم!', 'Demand', 'پێم بدەرەوە,مەیبەرە'],
    ['give up', 'خۆت بەدەستەوە بدە / کۆڵ بدە', 'Surrender', 'وازی لێ بێنە,تەسلیم بە'],
    ["don't give up", 'هەرگیز کۆڵ مەدە!', 'Encouragement', 'بەردەوام بە,خۆت بەدەستەوە مەدە'],
    ['trust me', 'متمانەم پێ بکە', 'Reassurance', 'باوەڕم پێبکە,پشتم پێ ببەستە'],
    ['believe me', 'باوەڕم پێ بکە', 'Assertion', 'ڕاستت پێ دەڵێم,دڵنیا بە'],
    ['keep your promise', 'وەفادار بە بە بەڵێنەکەت', 'Honor', 'بەڵێنەکەت بەجێبگەیەنە'],
    ['break a promise', 'شکاندنی پەیمان و بەڵێن', 'Betrayal', 'پەیمانشکێنی کردن'],
    ['in the blink of an eye', 'لە چاوتروکانێکدا', 'Speed', 'لە یەک چرکەدا,زۆر خێرا'],
    ['from now on', 'لە ئێستاوە بۆ داهاتوو', 'Time', 'لەمەودوا,لە ئێستاوە'],
    ['sooner or later', 'زوو بێت یان درەنگ', 'Certainty', 'ڕۆژێک دادێت کە,لە کۆتاییدا'],
    ['once upon a time', 'لە سەردەمێکی کۆندا', 'Storytelling', 'جارێک لە جاران,لە مێژوودا'],
    ['out of control', 'لە دەست دەرچوو', 'Chaos', 'کۆنتڕۆڵ نەماوە,تێکچووە'],
    ['under control', 'لەژێر کۆنتڕۆڵدایە', 'Stability', 'بارودۆخەکە پارێزراوە,ئارامە'],
    ['lost in thought', 'نوقمی بیرکردنەوە بووە', 'Distraction', 'مێشکی سەرقاڵە,لە هۆشی خۆیدا نییە'],
    ['take a deep breath', 'هەناسەیەکی قووڵ هەڵمژە', 'Calmness', 'ئارام بەوە,پشوو بدە'],
    ['calm yourself', 'خۆت هێمن بکەرەوە', 'Comfort', 'ئارام بگرە,مەشڵەژێ'],
    ["don't rush", 'پەلە مەکە', 'Patience', 'بە هێمنی بیکە,کاتی زۆرمان هەیە'],
    ['no hurry', 'پێویست بە پەلەکردن ناکات', 'Patience', 'کێشە نییە,کاتی خۆت وەربگرە'],
    ['just in case', 'بۆ ئەگەری پێویست', 'Precaution', 'با ئامادە بین بۆ هەر شتێک,بۆ یەدەگ'],
    ['as usual', 'وەک هەمیشە', 'Habitual', 'وەک خووی جاران,بەپێی نەریت'],
    ['as always', 'وەک هەمیشە', 'Consistency', 'هەمیشە بەو جۆرەیە'],
    ['better than nothing', 'لە هیچ باشترە', 'Acceptance', 'قەیناکا لە هیچی چاکترە'],
    ['nothing at all', 'هیچ شتێک لە ئارادا نییە', 'Absence', 'تەواو بەتاڵە,هیچ نییە'],
    ["it doesn't matter", 'هیچ گرنگییەکی نییە', 'Indifference', 'جیاوازی نییە,کێشە نییە'],
    ["what's going on", 'چی ڕوودەدات؟', 'Inquiry', 'چی بووە لێرەدا؟,بارودۆخ چییە؟'],
    ["what's wrong", 'چیتە؟ چی بووە؟', 'Concern', 'چی بەسەرهاتووە؟,کێشە چییە؟'],
    ["what's the rush", 'بۆچی ئەوەندە پەلەتە؟', 'Inquiry', 'پەلە لە چیدا دەکەیت؟'],
    ['slow down', 'خێراییەکەت کەم بکەرەوە / هێواش بە', 'Caution', 'لە سەرخۆ بە,مەپەلێ'],
    ['speed up', 'خێراتر بڕۆ', 'Urgency', 'زووکە,پەلە بکە'],
    ['keep up', 'هاوشانی ئێمە بڕۆ', 'Pace', 'دوامەکەوێت,خێرا بە'],
    ['catch up', 'خۆت بگەیەنە پێمان', 'Urgency', 'بگە پێمان,دوامەکەوێت'],
    ['give me a second', 'تەنها یەک چرکەم بدەرێ', 'Pause', 'بۆستە کەمێک,ساتێک بوەستە'],
    ['just a moment', 'تەنها ساتێک چاوەڕێ بە', 'Pause', 'بۆستە کەمێک,کەمێک کاتم پێ بدە'],
    ['one moment please', 'تکایە ساتێک ڕابوەستە', 'Politeness', 'کەمێک چاوەڕێ بە تکایە'],
    ['wait for me', 'چاوەڕێم بە!', 'Urgency', 'بەجێم مەهێڵە,ڕاوەستە بۆم'],
    ['follow me', 'بە دوای مندا وەرە', 'Direction', 'شوێنم بکەوە,لەگەڵم وەرە'],
    ['lead the way', 'پێشەنگایەتیمان بکە', 'Leadership', 'پێشمان بکەوە,ڕێگامان پیشان بدە'],
    ['after you', 'فەرموو لە پێش منەوە', 'Courtesy', 'پێش من بڕۆ,فەرموو'],
    ['be right back', 'ئێستا دەگەڕێمەوە', 'Short Leave', 'زوو دێمەوە,کەمێکی تر لێرەم'],
    ["i'll be right there", 'ئێستا دەگەمە لای تۆ', 'Arrival', 'بەڕێکەوتم,دەستبەجێ دەگەم'],
    ['see you soon', 'بە زوویی دەتبینمەوە', 'Parting', 'خوات لەگەڵ تا دیداری داهاتوو'],
    ['see you tomorrow', 'سبەینێ دەتبینمەوە', 'Parting', 'خوات لەگەڵ بۆ بەیانی'],
    ['take care of yourself', 'زۆر ئاگاداری خۆت بە', 'Care', 'خۆت بپارێزە,سەلامەت بیت'],
    ['have a good one', 'ڕۆژێکی خۆشت هەبێت', 'Greeting', 'کاتێکی شاد,سەرکەوتوو بیت'],
    ['sleep well', 'خەوێکی ئارامت هەبێت', 'Night Wish', 'شەوێکی ئارام,شەوشاد'],
    ['sweet dreams', 'خەونی خۆشت هەبێت', 'Night Wish', 'خەوی شیرینت بۆ دەخوازم'],
    ['good job', 'دەستخۆش! کارێکی نایابە', 'Praise', 'دەستت خۆش بێت,هەوڵێکی مەزنە'],
    ['well done', 'دەستخۆش، نایاب بوو', 'Praise', 'زۆر چاکە,بژیت'],
    ['nice work', 'دەستت خۆش بۆ ئەم کارە', 'Praise', 'کارێکی جوانە,دەستت خۆش'],
    ['way to go', 'ئافەرم! هەر وا بەردەوام بە', 'Praise', 'بژیت,سەرکەوتوویت'],
    ['proud of you', 'شانازیت پێوە دەکەم', 'Pride', 'جێگای شانازییت,دەستت خۆش بێت'],
    ["i'm proud of you", 'شانازیت پێوە دەکەم', 'Pride', 'بە تۆ شانازی دەکەم'],
    ['shame on you', 'شەرمەزاری بۆت!', 'Reproach', 'شەرم لە خۆت ناکەیت؟,ڕیسوا بیت'],
    ['what a shame', 'چ کارەسات و شەرمەزارییەکە', 'Regret', 'داخەکەم,جێگای داخە'],
    ['what a pity', 'زۆر جێگای بەزەیی و داخە', 'Regret', 'حەیف و مەخابن,داخەکەم'],
    ["that's too bad", 'ئەوە زۆر ناخۆش و خەمناکە', 'Sympathy', 'داخم بۆت,جێگای دڵتەنگییە'],
    ['such a relief', 'ئاسوودەییەکی زۆر گەورەیە', 'Relief', 'خەمێکم لە کۆڵ بووەوە,هەناسەی ئاسوودەیی'],
    ['thank goodness', 'سوپاس بۆ پەروەردگار', 'Relief', 'خوایە سوپاس,ڕزگارمان بوو'],
    ['oh dear', 'ئای داخەکەم', 'Sympathy/Worry', 'ئای خوایە,ناخۆشە'],
    ['oh boy', 'ئای هاوار', 'Exclamation', 'ئەمە کێشەیە,سەیرە'],
    ['my goodness', 'ئەی هاوار لە دەست ئەمە', 'Astonishment', 'خوایە گیان,سەیرە'],
    ["for heaven's sake", 'لەبەر خاتری ئاسمان و خودا', 'Exclamation', 'دە تکایە بەسە'],

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
    ['stand down', 'فەرمانی شەڕ هەڵوەشایەوە / ئارام بن', 'Military Command', 'چەک دابنێن,کۆتایی بە ئۆپەراسیۆن بێنن'],
    ['take cover', 'پەنا بگرن!', 'Combat Alert', 'خۆتان بشارنەوە لە تەقە,پەناگە بدۆزنەوە'],
    ['open fire', 'دەستڕێژی تەقە بکەن!', 'Attack Command', 'تەقە بکەن,لێیان بدەن'],
    ['hold your fire', 'تەقە مەکەن!', 'Restraint Command', 'دەست لە تەقەکردن هەڵگرن,مەتەقێنن'],
    ['secure the perimeter', 'دەوروبەری ناوچەکە بپارێزن و دابخەن', 'Tactical Security', 'کۆنتڕۆڵی سنووری ناوچەکە بکەن'],
    ['hostage situation', 'بارودۆخی بارمتەگرتن', 'Crisis', 'بارمتە گیراوە,مەترسی هەیە'],
    ['enemy spotted', 'دوژمن بینرا / دیاریکرا!', 'Surveillance', 'دوژمن لە پێشەوەیە,وریا بن'],
    ['target acquired', 'ئامانج دەستنیشانکرا و قفڵکرا', 'Military Targeting', 'ئامانج ئامادەیە بۆ لێدان'],
    ['mission accomplished', 'ئەرکەکە بە سەرکەوتوویی تەواو بوو!', 'Victory', 'سەرکەوتین لە ئەرکەکەدا'],
    ['flank them', 'لە باڵەکانەوە گەمارۆیان بدەن!', 'Tactical Maneuver', 'لە تەنیشتەوە هێرش بکەنە سەریان'],
    ['stay alert', 'بە ئاگایی و وریاییەوە بمێننەوە!', 'Vigilance', 'چاوتان کراوە بێت,خافڵ مەبن'],
    ['we have company', 'میوانمان هەیە / کەسانێک هاتن!', 'Warning', 'کەسانی نەناسراو نزیک دەبنەوە,ئامادە بن'],
    ['incoming', 'موشەک / هێرش دێت! خۆتان بپارێزن!', 'Imminent Danger', 'مەترسی لە ڕێگایە,پەنا بگرن'],
    ['hit the dirt', 'پاڵکەون لەسەر زەوی!', 'Urgent Cover', 'خۆتان بخەنە سەر عەرد,مەجوڵێن'],
    ['hands where i can see them', 'دەستەکانت بخەرە شوێنێک کە بیبینم!', 'Police Command', 'دەستت بەرز بکەوە و بیهێنە پێشەوە'],
    ["don't move a muscle", 'یەک بست مەجوڵێ!', 'Command', 'بە تەواوی لە شوێنی خۆت ڕاوەستە'],
    ['officer down', 'ئەفسەرێک بریندار بوو / کەوت!', 'Emergency', 'ئەفسەرمان پێکراوە,فریاگوزاری بنێرن'],

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
    ["i won't let you get away with this", 'هەرگیز ڕێگات پێنادەم بەبێ سزا دەربازت بێت!', 'Justice Vow', 'تۆڵەت لێ دەستێنمەوە,لێت خۆش نابم'],
    ["you're too late", 'درەنگ کەوتیت!', 'Climax Taunt', 'کار لە کار ترازاوە,ئێستا زۆر درەنگە'],
    ['i will protect everyone', 'هەمووان دەپارێزم بە گیانم!', 'Hero Vow', 'ڕێگا نادەم زیانتان پێ بگات,پارێزەرتانم'],
    ["don't you dare", 'نەکەیت بوێریی وا بکەیت!', 'Warning/Threat', 'دەستت نەچێتە شتی وا,وریا بە'],
    ["you haven't seen anything yet", 'هێشتا هیچت نەدیوە!', 'Taunt/Power', 'توانای ڕاستەقینەم لە پێشە,چاوەڕێی هێزم بە'],
    ['is that your true power', 'ئایا ئەوە هێزی ڕاستەقینەتە؟', 'Taunt', 'ئەوە هەموو توانای تۆیە؟'],
    ['i will surpass my limits', 'سنوورەکانی توانام دەبەزێنم!', 'Growth Vow', 'لە هەموو کات بەهێزتر دەبم,بەربەستەکان دەشکێنم'],
    ['i cannot lose here', 'ناتوانم لێرەدا بدۆڕێم!', 'Determination', 'ناشێت لێرەدا شکست بهێنم,کۆڵ نادەم'],
    ['my turn', 'نۆرەی منە!', 'Action', 'ئێستا کاتی هێرشی منە'],
    ['it is time', 'کاتی ئەوە هاتووە!', 'Moment', 'ساتەوەختی یەکلاکەرەوەیە'],
    ["it's time", 'کاتی ئەوە هاتووە!', 'Moment', 'ساتەوەختی یەکلاکەرەوەیە'],
    ['you fool', 'ئەی گەمژە!', 'Anime Taunt', 'ئەی بێئەقڵ,کەسی نەفام'],
    ['impossible', 'مەحاڵە!', 'Shock', 'باوەڕ ناکەم!,ناکرێت شتی وا ڕووبدات'],
    ['how can this be', 'چۆن شتی وا دەبێت؟!', 'Shock', 'چۆن گەیشتە ئەم ئاستە؟'],
    ['curse you', 'نەعلەتت لێ بێت!', 'Curse', 'بە نەفرەت بیت,داخەکەم لە تۆ'],
    ["it's over", 'هەموو شتێک تەواو بوو!', 'Conclusion', 'کۆتایی هات,بڕایەوە'],
    ['farewell', 'ماڵئاوا بۆ هەتاهەتایە', 'Final Parting', 'خواحافیز,بە ئومێدی نەبینینەوە'],
    ['shadow clone', 'کۆپی سێبەر (کاگێ بونشین)', 'Naruto Technique', 'تەکنیکی سێبەری خولقێنەر'],
    ['gear fifth', 'گێڕی پێنجەم (خودای خۆر نیکۆ)', 'One Piece Form', 'دەسەڵاتی ئازادی ڕەها,شێوازی گێڕ پێنج'],
    ['super saiyan', 'سوپەر سایان (شەنگەجەنگاوەری زێڕین)', 'Dragon Ball Form', 'جەنگاوەری گۆڕاو,شێوازی سایانی بەهێز'],
    ['magic circle', 'بازنەی جادوویی', 'Fantasy Magic', 'خولگەی هێزی ئەفسووناوی'],
    ['demon king', 'پاشای دێوەکان / شەیتانەکان', 'Fantasy Title', 'سەرکردەی تاریکی,ئیمپراتۆری دێوەکان'],
    ['hero of legend', 'پاڵەوانی ئەفسانەیی', 'Fantasy Title', 'ڕزگارکەری هەڵبژێردراو,پاڵەوانی مێژوو'],

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
    'prof': 'پڕۆفیسۆر',
    'professor': 'پڕۆفیسۆر',
    'captain': 'کاپتن',
    'commander': 'فەرماندە',
    'general': 'ژەنەڕاڵ',
    'colonel': 'عەقید',
    'lieutenant': 'ملازم',
    'sergeant': 'سەرباز / عەریف',
    'major': 'ڕائد',
    'officer': 'ئەفسەر',
    'chief': 'سەرۆک',
    'detective': 'لێکۆڵەر',
    'inspector': 'پشکنەر',
    'agent': 'بریکار / سیخوڕ',
    'boss': 'بەرپرس / گەورەم',
    'king': 'پاشا',
    'queen': 'شاژن',
    'prince': 'شازادە',
    'princess': 'شازادە خاتوون',
    'lord': 'لۆرد / گەورەم',
    'lady': 'خانم',
    'emperor': 'ئیمپراتۆر',
    'empress': 'شاژنی ئیمپراتۆر',
    'master': 'مامۆستا / گەورەم',
    'sensei': 'مامۆستا (سێنسێی)',
    'senpai': 'پلەبەرزتر (سێمپای)',
    'kohai': 'تازەکار (کۆهای)',
    'sama': 'ڕێزدار',
    'san': 'بەڕێز',
    'kun': 'گیان',
    'chan': 'خاتوون',
    'bro': 'برا',
    'brother': 'برا',
    'sis': 'خوشکە',
    'sister': 'خوشک',
    'dude': 'هاوڕێ',
    'buddy': 'هاوڕێ',
    'pal': 'هاوڕێکەم',
    'mate': 'هاوڕێ',
    'sweetheart': 'عەزیزەکەم',
    'honey': 'ئازیزم',
    'darling': 'خۆشەویستم',
    'babe': 'ئازیزەکەم',
    'baby': 'ئازیزم',
    'mom': 'دایکە',
    'dad': 'باوکە',
    'papa': 'بابە',
    'mama': 'دایە',
    'grandpa': 'باپیرە',
    'grandma': 'داپیرە',
    'uncle': 'مامە / خاڵە',
    'aunt': 'پوورێ',
    'aunty': 'پوورێ',
    'cousin': 'ئامۆزا / خاڵۆزا',
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
      const re = new RegExp('(^|[\\s،؛؟.,!?:;\\-—–\'"«»\\[{(<])' + word + '([\\s،؛؟.,!?:;\\-—–\'"«»\\]})>]|$)', 'gi');
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
