const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(express.json());

// ===== הגדרות מערכת =====
const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const BASE_URL = 'https://7107.api.greenapi.com';
const ALI_APP_KEY = '533908';
const ALI_APP_SECRET = 'iTd8ZOn3s1xmlJ7fXLoe2XYHBkkaF2dF';
const ALI_TRACKING_ID = 'bot01';
const GROUP_CHAT_ID = '120363424186489979@g.us';
const GROUP_NAME = 'דילים שווים';
const ADMIN_NUMBERS = ['972538800370', '972557119650'];
const BOT_NAME = '🤖 דילים שווים';

// ===== זיכרון מערכת =====
const userMemory = {};
const searchCount = {};
const frozenUsers = [];
const vipUsers = [];
const warningCount = {};
const userLastSearch = {};
const dailyStats = { searches: 0, users: new Set(), topSearches: {} };

// ===== סקר =====
let pollActive = false;
let pollVotes = {};
let pollTimeout = null;
let popularSearches = {};

// ===== מילות מפתח =====
const TRIGGER_WORDS = [
  'אני מחפש', 'אני מחפשת', 'חפש לי', 'חפשי לי',
  'אני צריך', 'אני צריכה', 'מחפש', 'מחפשת',
  'רוצה לקנות', 'מישהו מכיר', 'מישהי מכירה',
  'יש מוצר', 'איפה אפשר לקנות', 'מישהו יודע איפה',
  'מישהי יודעת איפה', 'תמצאו לי', 'תביאו לי',
  'מחפשים', 'צריכים', 'יש דיל על', 'כמה עולה',
  'איפה קונים', 'מאיפה קונים', 'אפשר לקנות',
  'יש פה מישהו שמכיר', 'תמצא לי', 'תביא לי',
  'חפש', 'מחפש את', 'מחפשת את', 'רוצה'
];

// ===== קללות =====
const BAD_WORDS = [
  'זין', 'כוס', 'שרמוטה', 'זונה', 'מניאק', 'ממזר',
  'אידיוט', 'טמבל', 'מפגר', 'חרא', 'בן זונה', 'בת זונה',
  'כלבה', 'בהמה', 'ראש זין', 'פגום', 'מסריח',
  'לך לעזאזל', 'יבאן אמק', 'קס אמק', 'יבן שרמוטה',
  'كس', 'زبي', 'شرموطة', 'ابن زونة', 'يبن شرموطه',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard',
  'idiot', 'stupid', 'damn', 'wtf', 'motherfucker'
];

// ===== ספאם =====
const SPAM_WORDS = [
  'הצטרפו', 'קבוצה חדשה', 'דרושים', 'ווטסאפ', 'טלגרם',
  'השקעה', 'הרוויחו', 'ביטקוין', 'הימור', 'קזינו',
  'לחצו על הלינק', 'הרשמה בחינם', 'רווח מהיר',
  'עשו כסף', 'הזדמנות עסקית', 'פירמידה'
];

// ===== תרגומים =====
const TRANSLATIONS = {
  'אוזניות': 'earphones', 'בלוטות': 'bluetooth', 'נעליים': 'shoes',
  'נעל': 'shoes', 'שעון': 'watch', 'שעונים': 'watches', 'טלפון': 'phone',
  'מטען': 'charger', 'כיסא': 'chair', 'מאוורר': 'fan', 'מצלמה': 'camera',
  'תיק': 'bag', 'תיקים': 'bags', 'בגדים': 'clothes', 'צמיד': 'bracelet',
  'טבעת': 'ring', 'משקפיים': 'glasses', 'ספורט': 'sport', 'ילדים': 'kids',
  'צעצוע': 'toy', 'מטבח': 'kitchen', 'מחשב': 'computer', 'לפטופ': 'laptop',
  'טאבלט': 'tablet', 'רמקול': 'speaker', 'מקלדת': 'keyboard', 'עכבר': 'mouse',
  'מנורה': 'lamp', 'שמיכה': 'blanket', 'כרית': 'pillow', 'ארנק': 'wallet',
  'כובע': 'hat', 'גרביים': 'socks', 'חגורה': 'belt', 'בושם': 'perfume',
  'קרם': 'cream', 'שמפו': 'shampoo', 'מברשת': 'brush', 'מראה': 'mirror',
  'אופניים': 'bicycle', 'קורקינט': 'scooter', 'משקולות': 'dumbbells',
  'מזוודה': 'suitcase', 'כדורגל': 'football', 'כדורסל': 'basketball',
  'גיטרה': 'guitar', 'פסנתר': 'keyboard piano', 'ציור': 'painting',
  'ספר': 'book', 'עיפרון': 'pencil', 'מחברת': 'notebook'
};

// ===== תגובות מצחיקות =====
const FUNNY = {
  'כיסא': '😂 כיסא? בטח אחרי שעמדת כל היום!',
  'שמיכה': '🥶 שמיכה? קר לך? בואו נחמם אתכם עם דילים!',
  'בושם': '😏 מישהו רוצה להריח טוב! אנחנו מוצאים לך!',
  'טבעת': '💍 מישהו מתחתן?! מזל טוב מראש! 🎊',
  'צעצוע': '😄 בשביל הילדים... או בשבילך? לא שופטים! 😉',
  'מראה': '😎 מישהו אוהב להסתכל על עצמו! לגיטימי!',
  'כרית': '😴 מישהו רוצה לישון? קנה כרית טובה!',
  'מזוודה': '✈️ מישהו נוסע? קנה מזוודה לפני!'
};

// ===== קטגוריות סקר =====
const POLL_OPTIONS = [
  '🎧 אוזניות ואביזרי אודיו',
  '⌚ שעונים חכמים',
  '🏠 מוצרי בית וגאדגטים',
  '👗 ביגוד ואופנה',
  '⚽ מוצרי ספורט',
  '💻 אלקטרוניקה ומחשבים',
  '🧸 צעצועים וילדים',
  '🍳 מטבח ובישול',
  '💄 יופי וטיפוח',
  '🔧 כלי עבודה ותחביבים'
];

// ===== ברכות לשעות =====
function getGreeting() {
  var h = new Date().getHours();
  if (h >= 6 && h < 9) return '🌅 בוקר אנרגטי!';
  if (h >= 9 && h < 12) return '☀️ בוקר טוב!';
  if (h >= 12 && h < 14) return '🌤️ צהריים טובים!';
  if (h >= 14 && h < 17) return '🌞 אחר הצהריים טוב!';
  if (h >= 17 && h < 20) return '🌆 ערב טוב!';
  if (h >= 20 && h < 23) return '🌙 ערב נעים!';
  return '🌟 לילה טוב! אני עובד בשבילך גם עכשיו!';
}

// ===== אנימציית חיפוש =====
const SEARCH_MESSAGES = [
  '🔍 מחפש ברחבי אלי אקספרס...',
  '⚡ סורק אלפי מוצרים בשבילך...',
  '🔎 בודק מחירים ומוצא את הכי שווה...',
  '💫 מנתח ביקורות ודירוגים...',
  '🚀 כמעט מצאתי! עוד שנייה...'
];

// ===== הודעות VIP =====
const VIP_MESSAGES = [
  '👑 לקוח VIP! מוצא לך את הכי טוב!',
  '⭐ VIP בא לחפש! מפעיל מצב פרימיום!',
  '💎 כבוד! ה-VIP שלנו חיפש!'
];

// ===== פונקציות עזר =====
function getPhone(raw) {
  return raw.replace('c.us', '').replace('@', '').replace('.', '').trim();
}
function isAdmin(raw) { return ADMIN_NUMBERS.indexOf(getPhone(raw)) !== -1; }
function isFrozen(raw) { return frozenUsers.indexOf(getPhone(raw)) !== -1; }
function isVIP(raw) { return vipUsers.indexOf(getPhone(raw)) !== -1; }

function hasBadWord(t) {
  var l = t.toLowerCase();
  for (var i = 0; i < BAD_WORDS.length; i++)
    if (l.indexOf(BAD_WORDS[i].toLowerCase()) !== -1) return true;
  return false;
}

function hasSpam(t) {
  for (var i = 0; i < SPAM_WORDS.length; i++)
    if (t.indexOf(SPAM_WORDS[i]) !== -1) return true;
  return false;
}

function translateToEnglish(text) {
  var r = text;
  for (var k in TRANSLATIONS) r = r.split(k).join(TRANSLATIONS[k]);
  return r;
}

function buildSearchLink(query) {
  return 'https://www.aliexpress.com/wholesale?SearchText=' + encodeURIComponent(translateToEnglish(query)) +
    '&SortType=total_tranpro_desc&aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key=' + ALI_TRACKING_ID +
    '&terminal_id=' + ALI_APP_KEY;
}

function getHeat() {
  var h = '';
  for (var i = 0; i < Math.floor(Math.random() * 3) + 3; i++) h += '🔥';
  return h;
}

function getRandomSearchMsg() {
  return SEARCH_MESSAGES[Math.floor(Math.random() * SEARCH_MESSAGES.length)];
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function getTopSearches() {
  var sorted = Object.keys(popularSearches).sort(function(a, b) {
    return popularSearches[b] - popularSearches[a];
  });
  return sorted.slice(0, 3);
}

// ===== שליחת הודעות =====
async function sendMsg(chatId, message) {
  try {
    await axios.post(BASE_URL + '/waInstance' + INSTANCE_ID + '/sendMessage/' + API_TOKEN, {
      chatId: chatId,
      message: message
    });
    console.log('✅ נשלח ל:' + chatId.substring(0, 15));
  } catch (e) {
    console.error('❌ שגיאה בשליחה ל:' + chatId + ' | ' + e.message);
  }
}

async function sendTyping(chatId) {
  try {
    await axios.post(BASE_URL + '/waInstance' + INSTANCE_ID + '/sendTyping/' + API_TOKEN, { chatId: chatId });
  } catch (e) {}
}

async function sendToAdmins(msg) {
  for (var i = 0; i < ADMIN_NUMBERS.length; i++)
    await sendMsg(ADMIN_NUMBERS[i] + '@c.us', msg);
}

// ===== חיפוש באלי אקספרס =====
async function searchAliExpress(query) {
  try {
    var timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 15) + '000';
    var params = {
      app_key: ALI_APP_KEY,
      method: 'aliexpress.affiliate.product.query',
      sign_method: 'md5',
      timestamp: timestamp,
      v: '2.0',
      keywords: translateToEnglish(query),
      tracking_id: ALI_TRACKING_ID,
      page_size: '8',
      sort: 'LAST_VOLUME_DESC',
      fields: 'product_id,product_title,sale_price,evaluate_rate,lastest_volume,promotion_link,original_price'
    };
    var sortedKeys = Object.keys(params).sort();
    var signStr = ALI_APP_SECRET;
    for (var i = 0; i < sortedKeys.length; i++) signStr += sortedKeys[i] + params[sortedKeys[i]];
    signStr += ALI_APP_SECRET;
    params.sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
    var queryString = Object.keys(params).map(function(k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    var response = await axios.get(
      'https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.listPromotionProduct/' + ALI_APP_KEY + '?' + queryString,
      { timeout: 12000 }
    );
    if (response.data && response.data.result && response.data.result.products) {
      var products = response.data.result.products.product;
      if (!products || products.length === 0) return [];
      return products
        .filter(function(p) { return p.evaluate_rate && parseFloat(p.evaluate_rate) > 75 && p.promotion_link; })
        .sort(function(a, b) { return parseFloat(b.evaluate_rate) - parseFloat(a.evaluate_rate); })
        .slice(0, 2);
    }
    return [];
  } catch (e) {
    console.error('שגיאה בחיפוש אלי:' + e.message);
    return [];
  }
}

// ===== בניית הודעת מוצר =====
function buildProductMessage(products, query, mention, isVIPUser) {
  var header = isVIPUser ?
    VIP_MESSAGES[Math.floor(Math.random() * VIP_MESSAGES.length)] + '\n\n' : '';

  if (!products || products.length === 0) {
    return header + mention + ' ✅ *מצאתי עבורך ' + query + '!*\n\n' +
      '🌡️ חום הדיל: ' + getHeat() + '\n\n' +
      '👉 ' + buildSearchLink(query) + '\n\n' +
      '🔥 לחץ לראות את הדילים הכי שווים!';
  }

  var msg = header + mention + ' ✅ *מצאתי עבורך ' + query + '!*\n\n';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var title = p.product_title ? p.product_title.substring(0, 55) : 'מוצר מומלץ';
    var price = p.sale_price || '?';
    var originalPrice = p.original_price;
    var rating = p.evaluate_rate ? p.evaluate_rate + '%' : '';
    var sales = p.lastest_volume ? p.lastest_volume + ' מכירות' : '';
    var link = p.promotion_link;

    msg += (i + 1) + '️⃣ *' + title + '*\n';
    if (originalPrice && parseFloat(originalPrice) > parseFloat(price)) {
      var discount = Math.round((1 - parseFloat(price) / parseFloat(originalPrice)) * 100);
      msg += '💰 $' + price + ' ~~$' + originalPrice + '~~ (-' + discount + '%)\n';
    } else {
      msg += '💰 מחיר: $' + price + '\n';
    }
    if (rating) msg += '⭐ דירוג: ' + rating + '\n';
    if (sales) msg += '📦 ' + sales + '\n';
    msg += '🔗 ' + link + '\n\n';
  }
  msg += '━━━━━━━━━━━━━━━\n';
  msg += '💡 _כל הלינקים מאומתים ומוגנים_';
  return msg;
}

// ===== סקר =====
async function startPoll() {
  pollActive = true;
  for (var k in pollVotes) delete pollVotes[k];
  for (var i = 0; i < POLL_OPTIONS.length; i++) pollVotes[i + 1] = 0;

  var top = getTopSearches();
  var topMsg = top.length > 0 ? '\n\n💡 _הכי חיפשתם לאחרונה: ' + top.join(', ') + '_' : '';

  var msg = '━━━━━━━━━━━━━━━\n';
  msg += '📊 *סקר שבועי — מה אתם הכי מחפשים?*\n';
  msg += '━━━━━━━━━━━━━━━\n\n';
  for (var j = 0; j < POLL_OPTIONS.length; j++) {
    msg += (j + 1) + '. ' + POLL_OPTIONS[j] + '\n';
  }
  msg += '\n✍️ *ענו עם המספר בלבד!*';
  msg += topMsg;
  msg += '\n\n⏰ _הסקר פתוח 24 שעות — תוצאות יגיעו מחר!_\n';
  msg += '━━━━━━━━━━━━━━━';

  await sendMsg(GROUP_CHAT_ID, msg);
  if (pollTimeout) clearTimeout(pollTimeout);
  pollTimeout = setTimeout(async function() { await sendPollResults(); }, 24 * 60 * 60 * 1000);
}

async function sendPollResults() {
  pollActive = false;
  var total = 0;
  for (var k in pollVotes) total += pollVotes[k];

  if (total === 0) {
    await sendToAdmins('📊 *תוצאות הסקר:*\n\nאף אחד לא הצביע 😕');
    return;
  }

  var results = Object.keys(pollVotes).map(function(k) {
    return { num: parseInt(k), name: POLL_OPTIONS[parseInt(k) - 1], votes: pollVotes[k] };
  }).sort(function(a, b) { return b.votes - a.votes; });

  var msg = '━━━━━━━━━━━━━━━\n';
  msg += '📊 *תוצאות הסקר!* 🎉\n';
  msg += '━━━━━━━━━━━━━━━\n\n';
  msg += 'הצביעו סה"כ: *' + total + '* אנשים\n\n';

  var medals = ['🥇', '🥈', '🥉'];
  for (var i = 0; i < results.length; i++) {
    if (results[i].votes > 0) {
      var pct = Math.round(results[i].votes / total * 100);
      var bar = '';
      for (var b = 0; b < Math.round(pct / 10); b++) bar += '█';
      msg += (i < 3 ? medals[i] : '▫️') + ' ' + results[i].name + '\n';
      msg += '   ' + bar + ' ' + results[i].votes + ' הצבעות (' + pct + '%)\n\n';
    }
  }

  var winner = results[0];
  msg += '━━━━━━━━━━━━━━━\n';
  msg += '🏆 *הכי מבוקש: ' + winner.name + '!*\n';
  msg += '🔥 הדיל הבא יהיה על זה!\n';
  msg += '━━━━━━━━━━━━━━━';

  await sendMsg(GROUP_CHAT_ID, msg);
  await sendToAdmins('📊 *סיכום סקר נשלח לקבוצה!*\n\nמנצח: ' + winner.name + ' עם ' + winner.votes + ' הצבעות');
}

// ===== דיל יומי =====
async function sendDailyDeal() {
  var topSearches = getTopSearches();
  var query;
  if (topSearches.length > 0) {
    query = topSearches[0];
  } else {
    var queries = ['bluetooth earphones', 'smart watch', 'fast charger', 'bluetooth speaker', 'security camera'];
    query = queries[Math.floor(Math.random() * queries.length)];
  }

  var products = await searchAliExpress(query);
  var msg = '━━━━━━━━━━━━━━━\n';
  msg += '🚨 *דיל היום!* 🚨\n';
  msg += '━━━━━━━━━━━━━━━\n\n';
  msg += '🌡️ חום הדיל: ' + getHeat() + '\n\n';

  if (products && products.length > 0) {
    var p = products[0];
    var title = p.product_title ? p.product_title.substring(0, 55) : query;
    var price = p.sale_price || '?';
    var link = p.promotion_link || buildSearchLink(query);
    var rating = p.evaluate_rate ? p.evaluate_rate + '%' : '';
    var sales = p.lastest_volume ? p.lastest_volume + ' מכירות' : '';

    msg += '*' + title + '*\n\n';
    msg += '💰 מחיר: $' + price + '\n';
    if (rating) msg += '⭐ דירוג: ' + rating + '\n';
    if (sales) msg += '📦 ' + sales + '\n\n';
    msg += '👉 ' + link + '\n\n';
  } else {
    msg += '👉 ' + buildSearchLink(query) + '\n\n';
  }

  msg += '⚡ _המחיר הזה לא יחזיק לאורך זמן!_\n';
  msg += '━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID, msg);
}

// ===== הפתעה חכמה =====
async function sendSurprise() {
  var topSearches = getTopSearches();
  var query;
  if (topSearches.length > 0) {
    query = topSearches[Math.floor(Math.random() * topSearches.length)];
  } else {
    var queries = ['cool gadget 2024', 'viral product', 'amazing invention cheap', 'smart home device'];
    query = queries[Math.floor(Math.random() * queries.length)];
  }

  var products = await searchAliExpress(query);
  var msg = '━━━━━━━━━━━━━━━\n';
  msg += '🎁 *קופסת הפתעה שבועית!* 🎁\n';
  msg += '━━━━━━━━━━━━━━━\n\n';
  msg += '🤯 מצאתי לכם משהו מטורף!\n\n';

  if (products && products.length > 0) {
    var p = products[0];
    var title = p.product_title ? p.product_title.substring(0, 55) : 'מוצר מפתיע';
    var price = p.sale_price || '?';
    var link = p.promotion_link || buildSearchLink(query);
    msg += '*' + title + '*\n';
    msg += '💰 $' + price + '\n\n';
    msg += '👉 ' + link + '\n\n';
  } else {
    msg += '👉 ' + buildSearchLink(query) + '\n\n';
  }

  msg += '😱 _מי ראה כזה דבר?!_\n';
  msg += '━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID, msg);
}

// ===== מלך הקבוצה =====
async function announceKing() {
  var king = null, max = 0;
  for (var p in searchCount) if (searchCount[p] > max) { max = searchCount[p]; king = p; }

  if (king && max > 0) {
    var msg = '━━━━━━━━━━━━━━━\n';
    msg += '👑 *מלך/מלכת הקבוצה השבוע!* 👑\n';
    msg += '━━━━━━━━━━━━━━━\n\n';
    msg += '@' + king + ' חיפש/ה *' + max + '* פעמים השבוע!\n\n';
    msg += '🏆 כל הכבוד! אתה/את מלך/מלכת הדילים! 🔥\n';
    msg += '━━━━━━━━━━━━━━━';
    await sendMsg(GROUP_CHAT_ID, msg);
    for (var k in searchCount) delete searchCount[k];
  }
}

// ===== פקודות מנהל =====
async function handleAdmin(text, chatId) {
  var cmd = text.trim();
  console.log('👑 פקודת מנהל: ' + cmd + ' מ:' + chatId);

  if (cmd === '!דיל') { await sendDailyDeal(); await sendMsg(chatId, '✅ דיל נשלח לקבוצה!'); return; }
  if (cmd === '!סקר') { await startPoll(); await sendMsg(chatId, '✅ סקר נשלח! תוצאות יגיעו עוד 24 שעות 📊'); return; }
  if (cmd === '!תוצאות') { await sendPollResults(); await sendMsg(chatId, '✅ תוצאות נשלחו!'); return; }
  if (cmd === '!הפתעה') { await sendSurprise(); await sendMsg(chatId, '✅ הפתעה נשלחה!'); return; }
  if (cmd === '!מלך') { await announceKing(); await sendMsg(chatId, '✅ מלך הוכרז!'); return; }

  if (cmd === '!מצב') {
    var t = 0; for (var p in searchCount) t += searchCount[p];
    var top = getTopSearches();
    await sendMsg(chatId,
      '📊 *סטטוס הבוט:*\n\n' +
      '🔍 חיפושים היום: ' + dailyStats.searches + '\n' +
      '👥 משתמשים פעילים: ' + dailyStats.users.size + '\n' +
      '❄️ מוקפאים: ' + frozenUsers.length + '\n' +
      '👑 VIP: ' + vipUsers.length + '\n' +
      '📊 סקר פעיל: ' + (pollActive ? 'כן' : 'לא') + '\n' +
      '🔥 הכי נחפש: ' + (top.length > 0 ? top[0] : 'אין עדיין')
    );
    return;
  }

  if (cmd === '!ניקוי') {
    for (var k in searchCount) delete searchCount[k];
    dailyStats.searches = 0;
    dailyStats.users = new Set();
    await sendMsg(chatId, '✅ כל הספירות אופסו!');
    return;
  }

  if (cmd === '!בדיחה') {
    var jokes = [
      'למה הסלמון שחה נגד הזרם? כי הוא לא רצה לקנות דגים קפואים מאלי אקספרס! 😂',
      'מה ההבדל בין אמא לאלי אקספרס? אמא תמיד מגיעה בזמן! 😄',
      'למה הבוט לא ישן? כי הדילים לא ישנים! 🔥',
      'שאלו את הבוט: מה המחיר? ענה: תמיד הכי זול! 💸'
    ];
    await sendMsg(GROUP_CHAT_ID, '😂 *בדיחת היום:*\n\n' + jokes[Math.floor(Math.random() * jokes.length)]);
    await sendMsg(chatId, '✅ בדיחה נשלחה!');
    return;
  }

  if (cmd === '!עובדה') {
    var facts = [
      '💡 ידעתם? אלי אקספרס מוכר מעל 100 מיליון מוצרים!',
      '💡 ידעתם? ניתן לחסוך עד 80% לעומת מחירים בישראל!',
      '💡 ידעתם? אלי אקספרס מציע החזר כספי מלא אם המוצר לא הגיע!',
      '💡 ידעתם? יותר מ-200 מיליון קונים ברחבי העולם!'
    ];
    await sendMsg(GROUP_CHAT_ID, facts[Math.floor(Math.random() * facts.length)]);
    await sendMsg(chatId, '✅ עובדה נשלחה!');
    return;
  }

  if (cmd === '!תחרות') {
    var msg = '━━━━━━━━━━━━━━━\n';
    msg += '🏆 *תחרות דילים!* 🏆\n';
    msg += '━━━━━━━━━━━━━━━\n\n';
    msg += 'מי ימצא את הדיל הכי זול השבוע?\n\n';
    msg += '📌 *איך משתתפים:*\n';
    msg += '1. חפשו מוצר בקבוצה\n';
    msg += '2. שלחו את הלינק עם המחיר\n';
    msg += '3. הזוכה מקבל תג 👑 VIP!\n\n';
    msg += '⏰ התחרות נמשכת שבוע!\n';
    msg += '━━━━━━━━━━━━━━━';
    await sendMsg(GROUP_CHAT_ID, msg);
    await sendMsg(chatId, '✅ תחרות הושקה!');
    return;
  }

  if (cmd === '!בוקר') {
    var morning = '━━━━━━━━━━━━━━━\n';
    morning += '🌅 *בוקר טוב לכולם!* ☀️\n';
    morning += '━━━━━━━━━━━━━━━\n\n';
    morning += 'יום חדש = דילים חדשים! 🔥\n\n';
    morning += 'כתבו *אני מחפש + מה שרוצים*\n';
    morning += 'והבוט ימצא לכם את הכי שווה! 💪\n';
    morning += '━━━━━━━━━━━━━━━';
    await sendMsg(GROUP_CHAT_ID, morning);
    await sendMsg(chatId, '✅ הודעת בוקר נשלחה!');
    return;
  }

  if (cmd === '!ערב') {
    var evening = '━━━━━━━━━━━━━━━\n';
    evening += '🌙 *ערב טוב לכולם!* ✨\n';
    evening += '━━━━━━━━━━━━━━━\n\n';
    evening += 'סיכום דילים יומי עומד לפניכם! 🎯\n\n';
    evening += 'עדיין לא מצאתם מה שחיפשתם?\n';
    evening += 'כתבו ואנחנו נמצא! 🔍\n';
    evening += '━━━━━━━━━━━━━━━';
    await sendMsg(GROUP_CHAT_ID, evening);
    await sendMsg(chatId, '✅ הודעת ערב נשלחה!');
    return;
  }

  if (cmd === '!מצב לילה') {
    await sendMsg(GROUP_CHAT_ID, '🌙 *מצב לילה פעיל*\n\nהבוט עובד בלחישות 😴\nשולח דילים גם בלילה! 💤');
    await sendMsg(chatId, '✅ מצב לילה!');
    return;
  }

  if (cmd === '!מצב טירוף') {
    await sendMsg(GROUP_CHAT_ID, '🔥🤯💥 *מצב טירוף!* 💥🤯🔥\n\nיאללה תחפשו דילים! 🚀💰⚡');
    await sendMsg(chatId, '✅ מצב טירוף!');
    return;
  }

  if (cmd.indexOf('!הקפא ') === 0) {
    var n = cmd.replace('!הקפא ', '').replace(/^0/, '');
    if (frozenUsers.indexOf(n) === -1) frozenUsers.push(n);
    await sendMsg(chatId, '✅ ' + n + ' הוקפא!');
    return;
  }

  if (cmd.indexOf('!שחרר ') === 0) {
    var n2 = cmd.replace('!שחרר ', '').replace(/^0/, '');
    var idx = frozenUsers.indexOf(n2);
    if (idx !== -1) frozenUsers.splice(idx, 1);
    await sendMsg(chatId, '✅ שוחרר!');
    return;
  }

  if (cmd.indexOf('!VIP ') === 0) {
    var n3 = cmd.replace('!VIP ', '').replace(/^0/, '');
    if (vipUsers.indexOf(n3) === -1) vipUsers.push(n3);
    var vipMsg = '━━━━━━━━━━━━━━━\n';
    vipMsg += '👑 *VIP חדש בקבוצה!* 👑\n';
    vipMsg += '━━━━━━━━━━━━━━━\n\n';
    vipMsg += '@' + n3 + ' קיבל/ה תג VIP! 🌟\n';
    vipMsg += 'ברוכים הבאים למועדון! 💎\n';
    vipMsg += '━━━━━━━━━━━━━━━';
    await sendMsg(GROUP_CHAT_ID, vipMsg);
    await sendMsg(chatId, '✅ VIP ניתן!');
    return;
  }

  if (cmd.indexOf('!אזהרה ') === 0) {
    var n4 = cmd.replace('!אזהרה ', '').replace(/^0/, '');
    await sendMsg(n4 + '@c.us', '⚠️ *אזהרה רשמית מהמנהל!*\n\nאנא שמור על כללי הקבוצה 🙏\nאזהרה נוספת עלולה לגרום להקפאה!');
    await sendMsg(chatId, '✅ אזהרה נשלחה!');
    return;
  }

  if (cmd.indexOf('!כבוד ') === 0) {
    var n5 = cmd.replace('!כבוד ', '').replace(/^0/, '');
    var honorMsg = '━━━━━━━━━━━━━━━\n';
    honorMsg += '🏆 *גיבור/ת הקבוצה!* 🏆\n';
    honorMsg += '━━━━━━━━━━━━━━━\n\n';
    honorMsg += '@' + n5 + ' הוא/היא הגיבור/ת שלנו! ❤️\n';
    honorMsg += 'תודה על התרומה לקבוצה! 🙏\n';
    honorMsg += '━━━━━━━━━━━━━━━';
    await sendMsg(GROUP_CHAT_ID, honorMsg);
    await sendMsg(chatId, '✅ כבוד ניתן!');
    return;
  }

  if (cmd.indexOf('!הודעה ') === 0) {
    var adminMsg = '━━━━━━━━━━━━━━━\n';
    adminMsg += '📢 *הודעה מהמנהל:*\n';
    adminMsg += '━━━━━━━━━━━━━━━\n\n';
    adminMsg += cmd.replace('!הודעה ', '') + '\n';
    adminMsg += '━━━━━━━━━━━━━━━';
    await sendMsg(GROUP_CHAT_ID, adminMsg);
    await sendMsg(chatId, '✅ הודעה נשלחה!');
    return;
  }

  if (cmd.indexOf('!חיפוש ') === 0) {
    var searchTerm = cmd.replace('!חיפוש ', '');
    var products = await searchAliExpress(searchTerm);
    var result = buildProductMessage(products, searchTerm, '🔍 תוצאות עבור', false);
    await sendMsg(GROUP_CHAT_ID, result);
    await sendMsg(chatId, '✅ חיפוש נשלח!');
    return;
  }

  if (cmd === '!עזרה') {
    await sendMsg(chatId,
      '━━━━━━━━━━━━━━━\n' +
      '📋 *פקודות מנהל:*\n' +
      '━━━━━━━━━━━━━━━\n\n' +
      '🛍️ *דילים:*\n' +
      '!דיל - שלח דיל יומי\n' +
      '!הפתעה - קופסת הפתעה\n' +
      '!חיפוש [מוצר] - חפש מוצר\n\n' +
      '📊 *סקרים:*\n' +
      '!סקר - שלח סקר 24 שעות\n' +
      '!תוצאות - תוצאות סקר עכשיו\n\n' +
      '👑 *ניהול:*\n' +
      '!מלך - הכרז מלך\n' +
      '!מצב - סטטוס בוט\n' +
      '!ניקוי - אפס ספירות\n' +
      '!הקפא [מספר]\n' +
      '!שחרר [מספר]\n' +
      '!VIP [מספר]\n' +
      '!אזהרה [מספר]\n' +
      '!כבוד [מספר]\n\n' +
      '📢 *הודעות:*\n' +
      '!הודעה [טקסט]\n' +
      '!בוקר - הודעת בוקר\n' +
      '!ערב - הודעת ערב\n' +
      '!בדיחה !עובדה !תחרות\n' +
      '!מצב לילה !מצב טירוף\n' +
      '━━━━━━━━━━━━━━━'
    );
    return;
  }
}

// ===== לוחות זמנים =====
function scheduleDaily() {
  var now = new Date(), next = new Date();
  next.setHours(10, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);
  setTimeout(async function() { await sendDailyDeal(); scheduleDaily(); }, next - now);
}

function scheduleWeeklyPoll() {
  var now = new Date(), next = new Date();
  next.setDate(now.getDate() + (7 - now.getDay()));
  next.setHours(11, 0, 0, 0);
  setTimeout(async function() { await startPoll(); scheduleWeeklyPoll(); }, next - now);
}

function scheduleKing() {
  var now = new Date(), next = new Date();
  next.setDate(now.getDate() + (7 - now.getDay()));
  next.setHours(12, 0, 0, 0);
  setTimeout(async function() { await announceKing(); scheduleKing(); }, next - now);
}

function scheduleMorning() {
  var now = new Date(), next = new Date();
  next.setHours(9, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);
  setTimeout(async function() {
    var msg = '━━━━━━━━━━━━━━━\n☀️ *בוקר טוב לכולם!*\n━━━━━━━━━━━━━━━\n\nיום חדש = דילים חדשים! 🔥\nכתבו *אני מחפש + מה שרוצים* ונמצא לכם! 💪\n━━━━━━━━━━━━━━━';
    await sendMsg(GROUP_CHAT_ID, msg);
    scheduleMorning();
  }, next - now);
}

// ===== Webhook =====
app.post('/webhook', async function(req, res) {
  res.sendStatus(200);
  try {
    var body = req.body;
    if (!body || body.typeWebhook !== 'incomingMessageReceived') return;
    var md = body.messageData || {};
    if (!md || md.typeMessage !== 'textMessage') return;
    var text = '';
    if (md.textMessageData && md.textMessageData.textMessage) text = md.textMessageData.textMessage;
    var sd = body.senderData || {};
    var chatId = sd.chatId || '';
    var senderRaw = sd.sender || '';
    var senderName = sd.senderName || 'חבר';
    var senderPhone = getPhone(senderRaw);
    if (!text || !chatId || !senderPhone) return;

    console.log('📩 ' + senderPhone + ' | admin:' + isAdmin(senderRaw) + ' | ' + text.substring(0, 35));

    // פקודות מנהל
    if (isAdmin(senderRaw) && text.charAt(0) === '!') {
      await handleAdmin(text, chatId);
      return;
    }

    // הצבעה בסקר
    if (pollActive && !isAdmin(senderRaw)) {
      var voteNum = parseInt(text.trim());
      if (!isNaN(voteNum) && voteNum >= 1 && voteNum <= POLL_OPTIONS.length) {
        pollVotes[voteNum]++;
        await sendMsg(chatId, '✅ ' + senderName + ' הצבעת על: *' + POLL_OPTIONS[voteNum - 1] + '*\n\nתודה! 🙏');
        return;
      }
    }

    if (isFrozen(senderRaw)) return;

    // ספאם
    if (hasSpam(text)) {
      await sendMsg(chatId, '🚫 @' + senderPhone + ' פרסומות אסורות בקבוצה! 🙏');
      await sendToAdmins('🚨 *ספאם זוהה!*\n' + senderName + ' (' + senderPhone + '):\n"' + text + '"');
      return;
    }

    // קללות
    if (hasBadWord(text)) {
      warningCount[senderPhone] = (warningCount[senderPhone] || 0) + 1;
      var w = warningCount[senderPhone];
      await sendMsg(chatId, '⚠️ @' + senderPhone + ' אזהרה ' + w + '/3!\nשלחתי לך הודעה פרטית 🙏');
      await sendMsg(senderPhone + '@c.us',
        'שלום ' + senderName + ' 👋\n\n' +
        '⚠️ זוהי אזהרה *' + w + '* מתוך 3.\n\n' +
        'השפה שהשתמשת בה לא מתאימה לקבוצה שלנו 🙏\n' +
        'אנחנו קבוצה של חברים — בוא נשמור על כבוד הדדי!\n\n' +
        (w >= 3 ? '⛔ *זוהי אזהרה אחרונה!*\nהפעם הבאה תוקפא מהקבוצה!' : '😊 בטוח שזה לא מה שאתה רוצה להציג מעצמך!')
      );
      if (w >= 3) {
        if (frozenUsers.indexOf(senderPhone) === -1) frozenUsers.push(senderPhone);
        await sendMsg(chatId, '❄️ @' + senderPhone + ' הוקפא אוטומטית לאחר 3 אזהרות!');
      }
      await sendToAdmins('🚨 *קללה!*\n' + senderName + ' (' + senderPhone + ') אזהרה ' + w + '/3:\n"' + text + '"');
      return;
    }

    // חיפוש מוצר
    var triggerFound = false;
    var searchQuery = text;
    for (var t = 0; t < TRIGGER_WORDS.length; t++) {
      if (text.indexOf(TRIGGER_WORDS[t]) !== -1) {
        triggerFound = true;
        searchQuery = searchQuery.split(TRIGGER_WORDS[t]).join('').trim();
      }
    }
    if (!triggerFound) return;
    if (!searchQuery || searchQuery.length < 2) {
      await sendMsg(chatId, '🎧 כתוב למשל: *אני מחפש אוזניות בלוטות*');
      return;
    }

    // עדכון סטטיסטיקות
    if (!userMemory[senderPhone]) userMemory[senderPhone] = [];
    userMemory[senderPhone].push(searchQuery);
    searchCount[senderPhone] = (searchCount[senderPhone] || 0) + 1;
    dailyStats.searches++;
    dailyStats.users.add(senderPhone);
    popularSearches[searchQuery] = (popularSearches[searchQuery] || 0) + 1;
    userLastSearch[senderPhone] = searchQuery;

    var total = searchCount[senderPhone];
    var mention = '@' + senderPhone;
    var isVIPUser = vipUsers.indexOf(senderPhone) !== -1;
    var funnyMsg = '';
    for (var fk in FUNNY) {
      if (searchQuery.indexOf(fk) !== -1) { funnyMsg = FUNNY[fk]; break; }
    }

    // שלח התראה פרטית
    await sendMsg(senderPhone + '@c.us',
      '🔔 *המוצר שלך נמצא!*\n\n' +
      'חיפשת: *' + searchQuery + '*\n\n' +
      '👉 כנס לקבוצה *' + GROUP_NAME + '* לראות את התוצאות! 🔥\n\n' +
      '_לחץ על שם הקבוצה למעלה_'
    );

    // אנימציית חיפוש
    await sendTyping(chatId);
    var searchAnim = getRandomSearchMsg();
    await sendMsg(chatId, getGreeting() + ' ' + mention + (isVIPUser ? ' 👑' : '') + '!\n' + searchAnim);
    if (funnyMsg) await sendMsg(chatId, funnyMsg);
    await sleep(1500);
    await sendTyping(chatId);
    await sleep(1000);

    // חפש מוצרים
    var products = await searchAliExpress(searchQuery);
    var reply = buildProductMessage(products, searchQuery, mention, isVIPUser);

    // מיילסטונים
    if (total === 3) reply += '\n\n🎯 החיפוש ה-3 שלך! ממשיך כך! 💪';
    else if (total === 5) reply += '\n\n🎉 החיפוש ה-5 שלך! אתה מכור לדילים! 😄';
    else if (total === 10) {
      reply += '\n\n🏆 *10 חיפושים!* מלך/מלכת הדילים! 👑';
      await sendToAdmins('🎉 ' + senderName + ' הגיע/ה ל-10 חיפושים!');
    } else if (total === 20) {
      if (vipUsers.indexOf(senderPhone) === -1) vipUsers.push(senderPhone);
      reply += '\n\n💎 *20 חיפושים!* ברוכים הבאים למועדון VIP! 👑';
    }

    // חיפוש קודם
    var prevList = userMemory[senderPhone];
    if (prevList.length > 1) {
      var lastS = prevList[prevList.length - 2];
      if (lastS !== searchQuery) reply += '\n\n💡 _בפעם הקודמת חיפשת: ' + lastS + '_';
    }

    // משדך
    for (var sp in userMemory) {
      if (sp !== senderPhone && userMemory[sp].indexOf(searchQuery) !== -1) {
        reply += '\n\n🤝 גם @' + sp + ' חיפש/ה את זה! תעשו הזמנה ביחד! 😄';
        break;
      }
    }

    await sendMsg(chatId, reply);

  } catch (e) { console.error('שגיאה כללית:' + e.message); }
});

app.get('/', function(req, res) { res.send('🤖 הבוט הפרימיום פועל!'); });

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('🚀 הבוט הפרימיום פועל על פורט ' + PORT);
  scheduleDaily();
  scheduleWeeklyPoll();
  scheduleKing();
  scheduleMorning();
  setInterval(async function() { await sendSurprise(); }, 7 * 24 * 60 * 60 * 1000);
});
