const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ===== הגדרות =====
const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const GREEN_API_URL = 'https://7107.api.greenapi.com/waInstance' + INSTANCE_ID;
const ALI_TRACKING_ID = 'bot01';
const ALI_APP_KEY = '533908';
const GROUP_CHAT_ID = 'KOL2v0rh8LH3RgfQIVr8gq@g.us';
const ADMIN1 = '972538800370@c.us';
const ADMIN2 = '972557119650@c.us';
const ADMINS = [ADMIN1, ADMIN2];

// ===== זיכרון =====
const userMemory = {};
const searchCount = {};
const frozenUsers = [];
const vipUsers = [];
const warningCount = {};

// ===== רשימות =====
const TRIGGER_WORDS = [
  'אני מחפש', 'אני מחפשת', 'חפש לי', 'חפשי לי',
  'אני צריך', 'אני צריכה', 'מחפש', 'מחפשת',
  'רוצה לקנות', 'מישהו מכיר', 'מישהי מכירה', 'יש מוצר'
];

const BAD_WORDS = [
  'זין', 'כוס', 'שרמוטה', 'זונה', 'מניאק',
  'ממזר', 'אידיוט', 'טמבל', 'מפגר',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard'
];

const SPAM_WORDS = [
  'הצטרפו', 'קבוצה חדשה', 'דרושים',
  'ווטסאפ', 'טלגרם', 'השקעה', 'הרוויחו',
  'ביטקוין', 'הימור', 'קזינו'
];

const TRANSLATIONS = {
  'אוזניות': 'earphones',
  'בלוטות': 'bluetooth',
  'נעליים': 'shoes',
  'שעון': 'watch',
  'טלפון': 'phone',
  'מטען': 'charger',
  'כיסא': 'chair',
  'מאוורר': 'fan',
  'מצלמה': 'camera',
  'תיק': 'bag',
  'בגדים': 'clothes',
  'צמיד': 'bracelet',
  'טבעת': 'ring',
  'משקפיים': 'glasses',
  'ספורט': 'sport',
  'ילדים': 'kids',
  'צעצוע': 'toy',
  'מטבח': 'kitchen',
  'מחשב': 'computer',
  'לפטופ': 'laptop',
  'טאבלט': 'tablet',
  'רמקול': 'speaker',
  'מקלדת': 'keyboard',
  'עכבר': 'mouse',
  'מנורה': 'lamp',
  'שמיכה': 'blanket',
  'כרית': 'pillow',
  'ארנק': 'wallet',
  'כובע': 'hat',
  'גרביים': 'socks',
  'חגורה': 'belt',
  'בושם': 'perfume'
};

const FUNNY = {
  'כיסא': '😂 כיסא? בטח אחרי שעמדת כל היום!',
  'שמיכה': '🥶 שמיכה? קר לך?',
  'בושם': '😏 מישהו רוצה להריח טוב!',
  'טבעת': '💍 מישהו מתחתן?!',
  'צעצוע': '😄 בשביל הילדים... או בשבילך?'
};

const JOKES = [
  'למה הסלמון שחה נגד הזרם? כי הוא לא רצה לקנות דגים קפואים מאלי אקספרס! 😂',
  'מה ההבדל בין אמא לאלי אקספרס? אמא תמיד מגיעה בזמן! 😄',
  'למה הבוט לא ישן? כי הדילים לא ישנים! 🔥'
];

const FACTS = [
  '💡 ידעתם? אלי אקספרס מוכר מעל 100 מיליון מוצרים!',
  '💡 ידעתם? ניתן לחסוך עד 80% לעומת מחירים בישראל!',
  '💡 ידעתם? אלי אקספרס מציע החזר כספי מלא אם המוצר לא הגיע!'
];

// ===== פונקציות עזר =====
function translateToEnglish(text) {
  var result = text;
  for (var key in TRANSLATIONS) {
    result = result.split(key).join(TRANSLATIONS[key]);
  }
  return result;
}

function buildLink(query) {
  var english = translateToEnglish(query);
  var encoded = encodeURIComponent(english);
  return 'https://www.aliexpress.com/wholesale?SearchText=' + encoded + '&SortType=total_tranpro_desc&aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key=' + ALI_TRACKING_ID + '&terminal_id=' + ALI_APP_KEY;
}

function getHeat() {
  var n = Math.floor(Math.random() * 3) + 3;
  var h = '';
  for (var i = 0; i < n; i++) h += '🔥';
  return h;
}

function getGreeting() {
  var hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return '☀️ בוקר טוב!';
  if (hour >= 12 && hour < 17) return '🌤️ צהריים טובים!';
  if (hour >= 17 && hour < 21) return '🌆 ערב טוב!';
  return '🌙 לילה טוב! אני עובד בשבילך!';
}

function isAdmin(phone) {
  return ADMINS.indexOf(phone) !== -1;
}

function isFrozen(phone) {
  return frozenUsers.indexOf(phone) !== -1;
}

function isVIP(phone) {
  return vipUsers.indexOf(phone) !== -1;
}

function hasBadWord(text) {
  var lower = text.toLowerCase();
  for (var i = 0; i < BAD_WORDS.length; i++) {
    if (lower.indexOf(BAD_WORDS[i].toLowerCase()) !== -1) return true;
  }
  return false;
}

function hasSpam(text) {
  for (var i = 0; i < SPAM_WORDS.length; i++) {
    if (text.indexOf(SPAM_WORDS[i]) !== -1) return true;
  }
  return false;
}

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// ===== שליחת הודעות =====
async function sendMsg(chatId, message) {
  try {
    await axios.post(GREEN_API_URL + '/sendMessage/' + API_TOKEN, {
      chatId: chatId,
      message: message
    });
  } catch (e) {
    console.error('שגיאה בשליחה:', e.message);
  }
}

async function sendTyping(chatId) {
  try {
    await axios.post(GREEN_API_URL + '/sendTyping/' + API_TOKEN, {
      chatId: chatId
    });
  } catch (e) {}
}

async function sendToAdmins(message) {
  await sendMsg(ADMIN1, message);
  await sendMsg(ADMIN2, message);
}

// ===== תוכן אוטומטי =====
async function sendDailyDeal() {
  var deals = [
    { name: 'אוזניות בלוטות פרו', query: 'bluetooth earphones pro', saving: 120 },
    { name: 'שעון חכם 2024', query: 'smart watch 2024', saving: 250 },
    { name: 'מטען מהיר 65W', query: 'fast charger 65w', saving: 80 },
    { name: 'רמקול בלוטות עמיד למים', query: 'waterproof bluetooth speaker', saving: 150 },
    { name: 'מצלמת אבטחה WiFi', query: 'security camera wifi', saving: 200 }
  ];
  var deal = deals[Math.floor(Math.random() * deals.length)];
  await sendMsg(GROUP_CHAT_ID,
    '🚨 *דיל היום!* 🚨\n\n' +
    'הדיל הכי חם: *' + deal.name + '*\n\n' +
    '🌡️ חום הדיל: ' + getHeat() + '\n' +
    '💰 חיסכון לעומת ישראל: *₪' + deal.saving + '*\n\n' +
    '👉 ' + buildLink(deal.query) + '\n\n' +
    '⚡ אל תפספסו!'
  );
}

async function sendPoll() {
  await sendMsg(GROUP_CHAT_ID,
    '📊 *סקר שבועי!*\n\n' +
    'מה הכי מעניין אתכם?\n\n' +
    '1️⃣ אוזניות ואביזרי אודיו\n' +
    '2️⃣ שעונים חכמים\n' +
    '3️⃣ מוצרי בית וגאדגטים\n' +
    '4️⃣ ביגוד ואופנה\n' +
    '5️⃣ מוצרי ספורט\n' +
    '6️⃣ אלקטרוניקה\n\n' +
    'ענו עם המספר! 👇'
  );
}

async function sendSurprise() {
  var list = [
    { name: 'גאדגט מטורף', query: 'cool gadget 2024' },
    { name: 'מוצר ויראלי', query: 'viral product tiktok' },
    { name: 'המצאה מדהימה', query: 'amazing invention cheap' }
  ];
  var s = list[Math.floor(Math.random() * list.length)];
  await sendMsg(GROUP_CHAT_ID,
    '🎁 *קופסת הפתעה!*\n\n' +
    'מצאתי לכם משהו מטורף 🤯\n' +
    '*' + s.name + '* — המחיר יפיל אתכם!\n\n' +
    '👉 ' + buildLink(s.query) + '\n\n' +
    'מי ראה כזה דבר?! 😱'
  );
}

async function announceKing() {
  var king = null;
  var max = 0;
  for (var phone in searchCount) {
    if (searchCount[phone] > max) {
      max = searchCount[phone];
      king = phone;
    }
  }
  if (king && max > 0) {
    await sendMsg(GROUP_CHAT_ID,
      '👑 *מלך הקבוצה השבוע!*\n\n' +
      '@' + king.replace('@c.us', '') + ' חיפש/ה *' + max + '* פעמים!\n\n' +
      '🏆 כל הכבוד! 🔥'
    );
    for (var k in searchCount) delete searchCount[k];
  }
}

// ===== לוחות זמנים =====
function scheduleDaily() {
  var now = new Date();
  var next = new Date();
  next.setHours(10, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);
  setTimeout(async function() {
    await sendDailyDeal();
    scheduleDaily();
  }, next - now);
}

function scheduleWeekly() {
  var now = new Date();
  var next = new Date();
  next.setDate(now.getDate() + (7 - now.getDay()));
  next.setHours(11, 0, 0, 0);
  setTimeout(async function() {
    await sendPoll();
    scheduleWeekly();
  }, next - now);
}

function scheduleKing() {
  var now = new Date();
  var next = new Date();
  next.setDate(now.getDate() + (7 - now.getDay()));
  next.setHours(12, 0, 0, 0);
  setTimeout(async function() {
    await announceKing();
    scheduleKing();
  }, next - now);
}

// ===== פקודות מנהל =====
async function handleAdmin(text, phone) {
  var cmd = text.trim();

  if (cmd === '!דיל') {
    await sendDailyDeal();
    await sendMsg(phone, '✅ דיל נשלח לקבוצה!');
    return;
  }

  if (cmd === '!סקר') {
    await sendPoll();
    await sendMsg(phone, '✅ סקר נשלח!');
    return;
  }

  if (cmd === '!הפתעה') {
    await sendSurprise();
    await sendMsg(phone, '✅ הפתעה נשלחה!');
    return;
  }

  if (cmd === '!מלך') {
    await announceKing();
    await sendMsg(phone, '✅ מלך הוכרז!');
    return;
  }

  if (cmd === '!מצב') {
    var total = 0;
    for (var p in searchCount) total += searchCount[p];
    await sendMsg(phone,
      '📊 *סטטוס הבוט:*\n\n' +
      '🔍 סה"כ חיפושים: ' + total + '\n' +
      '❄️ מוקפאים: ' + frozenUsers.length + '\n' +
      '👑 VIP: ' + vipUsers.length + '\n' +
      '👥 משתמשים: ' + Object.keys(searchCount).length
    );
    return;
  }

  if (cmd === '!ניקוי') {
    for (var k in searchCount) delete searchCount[k];
    await sendMsg(phone, '✅ ספירות אופסו!');
    return;
  }

  if (cmd === '!בדיחה') {
    var joke = JOKES[Math.floor(Math.random() * JOKES.length)];
    await sendMsg(GROUP_CHAT_ID, '😂 *בדיחת היום:*\n\n' + joke);
    await sendMsg(phone, '✅ בדיחה נשלחה!');
    return;
  }

  if (cmd === '!עובדה') {
    var fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await sendMsg(GROUP_CHAT_ID, fact);
    await sendMsg(phone, '✅ עובדה נשלחה!');
    return;
  }

  if (cmd === '!תחרות') {
    await sendMsg(GROUP_CHAT_ID,
      '🏆 *תחרות דילים!*\n\n' +
      'מי ימצא את הדיל הכי זול השבוע?\n' +
      'הזוכה מקבל תג 👑 VIP!\n\n' +
      'יאללה! 🔥'
    );
    await sendMsg(phone, '✅ תחרות הושקה!');
    return;
  }

  if (cmd === '!מצב לילה') {
    await sendMsg(GROUP_CHAT_ID, '🌙 *מצב לילה פעיל*\n\nהבוט עובד בלחישות 😴');
    await sendMsg(phone, '✅');
    return;
  }

  if (cmd === '!מצב טירוף') {
    await sendMsg(GROUP_CHAT_ID, '🔥🤯💥 *מצב טירוף!*\n\nיאללה תחפשו דילים! 🚀💰');
    await sendMsg(phone, '✅');
    return;
  }

  if (cmd.indexOf('!הקפא ') === 0) {
    var num = cmd.replace('!הקפא ', '').replace(/^0/, '');
    var fp = '972' + num + '@c.us';
    if (frozenUsers.indexOf(fp) === -1) frozenUsers.push(fp);
    await sendMsg(phone, '✅ ' + fp + ' הוקפא!');
    return;
  }

  if (cmd.indexOf('!שחרר ') === 0) {
    var num2 = cmd.replace('!שחרר ', '').replace(/^0/, '');
    var fp2 = '972' + num2 + '@c.us';
    var idx = frozenUsers.indexOf(fp2);
    if (idx !== -1) frozenUsers.splice(idx, 1);
    await sendMsg(phone, '✅ שוחרר!');
    return;
  }

  if (cmd.indexOf('!VIP ') === 0) {
    var num3 = cmd.replace('!VIP ', '').replace(/^0/, '');
    var vp = '972' + num3 + '@c.us';
    if (vipUsers.indexOf(vp) === -1) vipUsers.push(vp);
    await sendMsg(GROUP_CHAT_ID, '👑 @' + vp.replace('@c.us', '') + ' קיבל/ה תג VIP! 🌟');
    await sendMsg(phone, '✅');
    return;
  }

  if (cmd.indexOf('!אזהרה ') === 0) {
    var num4 = cmd.replace('!אזהרה ', '').replace(/^0/, '');
    var wp = '972' + num4 + '@c.us';
    await sendMsg(wp, '⚠️ *אזהרה מהמנהל!*\n\nאנא שמור על כללי הקבוצה 🙏');
    await sendMsg(phone, '✅ אזהרה נשלחה!');
    return;
  }

  if (cmd.indexOf('!כבוד ') === 0) {
    var num5 = cmd.replace('!כבוד ', '').replace(/^0/, '');
    var hp = '972' + num5 + '@c.us';
    await sendMsg(GROUP_CHAT_ID, '🏆 *גיבור הקבוצה!*\n\n@' + hp.replace('@c.us', '') + ' הוא/היא הגיבור/ת שלנו! ❤️');
    await sendMsg(phone, '✅');
    return;
  }

  if (cmd.indexOf('!הודעה ') === 0) {
    var msg = cmd.replace('!הודעה ', '');
    await sendMsg(GROUP_CHAT_ID, '📢 *הודעה מהמנהל:*\n\n' + msg);
    await sendMsg(phone, '✅ הודעה נשלחה!');
    return;
  }

  if (cmd === '!עזרה') {
    await sendMsg(phone,
      '📋 *פקודות מנהל:*\n\n' +
      '!דיל - שלח דיל\n' +
      '!סקר - שלח סקר\n' +
      '!הפתעה - קופסת הפתעה\n' +
      '!מלך - הכרז מלך\n' +
      '!מצב - סטטוס\n' +
      '!ניקוי - אפס ספירות\n' +
      '!בדיחה - שלח בדיחה\n' +
      '!עובדה - שלח עובדה\n' +
      '!תחרות - פתח תחרות\n' +
      '!מצב לילה\n' +
      '!מצב טירוף\n' +
      '!הקפא [מספר]\n' +
      '!שחרר [מספר]\n' +
      '!VIP [מספר]\n' +
      '!אזהרה [מספר]\n' +
      '!כבוד [מספר]\n' +
      '!הודעה [טקסט]'
    );
    return;
  }
}

// ===== Webhook =====
app.post('/webhook', async function(req, res) {
  res.sendStatus(200);
  try {
    var body = req.body;
    if (!body) return;

    var typeWebhook = body.typeWebhook;
    var senderData = body.senderData || {};
    var messageData = body.messageData || {};
    var senderPhone = senderData.sender || '';
    var senderName = senderData.senderName || 'חבר';
    var chatId = senderData.chatId || '';

    // ===== חבר חדש =====
    if (typeWebhook === 'incomingMessageReceived' && messageData.typeMessage === 'groupInviteMessage') {
      await sendMsg(GROUP_CHAT_ID,
        '👋 ברוכים הבאים *' + senderName + '*!\n\n' +
        'אנחנו קבוצת דילים מאלי אקספרס 🛍️\n\n' +
        'כתוב: *אני מחפש + שם מוצר*\n' +
        'והבוט ימצא לך את הדיל הכי טוב! 🔥\n\n' +
        '⚠️ אסור לקלל או לפרסם ספאם!'
      );
      return;
    }

    if (typeWebhook !== 'incomingMessageReceived') return;
    if (messageData.typeMessage !== 'textMessage') return;

    var text = '';
    if (messageData.textMessageData && messageData.textMessageData.textMessage) {
      text = messageData.textMessageData.textMessage;
    }
    if (!text || !chatId || !senderPhone) return;

    // ===== פקודות מנהל =====
    if (isAdmin(senderPhone) && text.charAt(0) === '!') {
      await handleAdmin(text, senderPhone);
      return;
    }

    // ===== משתמש מוקפא =====
    if (isFrozen(senderPhone)) return;

    // ===== ספאם =====
    if (hasSpam(text)) {
      await sendMsg(chatId,
        '🚫 @' + senderPhone.replace('@c.us', '') + ' פרסומות אסורות בקבוצה! 🙏'
      );
      await sendToAdmins('🚨 *ספאם!*\n' + senderName + ':\n"' + text + '"');
      return;
    }

    // ===== קללות =====
    if (hasBadWord(text)) {
      warningCount[senderPhone] = (warningCount[senderPhone] || 0) + 1;
      var w = warningCount[senderPhone];

      await sendMsg(chatId,
        '⚠️ @' + senderPhone.replace('@c.us', '') + ' אזהרה ' + w + '/3!\n' +
        'שלחתי לך הודעה פרטית 🙏'
      );

      await sendMsg(senderPhone,
        'שלום ' + senderName + ' 👋\n\n' +
        'זוהי אזהרה *' + w + '* מתוך 3.\n' +
        'השפה שהשתמשת בה לא מתאימה לקבוצה 🙏\n\n' +
        (w >= 3 ? '⛔ אזהרה אחרונה! הפעם הבאה תוקפא!' : '😊 בוא נמשיך בצורה נעימה!')
      );

      if (w >= 3) {
        if (frozenUsers.indexOf(senderPhone) === -1) frozenUsers.push(senderPhone);
        await sendMsg(chatId, '❄️ @' + senderPhone.replace('@c.us', '') + ' הוקפא!');
      }

      await sendToAdmins('🚨 *קללה!*\n' + senderName + ' (אזהרה ' + w + '/3):\n"' + text + '"');
      return;
    }

    // ===== חיפוש מוצר =====
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
      await sendMsg(chatId, '🎧 כתוב למשל: אני מחפש אוזניות בלוטות');
      return;
    }

    // עדכון זיכרון
    if (!userMemory[senderPhone]) userMemory[senderPhone] = [];
    userMemory[senderPhone].push(searchQuery);
    searchCount[senderPhone] = (searchCount[senderPhone] || 0) + 1;
    var total = searchCount[senderPhone];
    var mention = '@' + senderPhone.replace('@c.us', '');
    var vipTag = isVIP(senderPhone) ? ' 👑' : '';
    var link = buildLink(searchQuery);
    var saving = Math.floor(Math.random() * 200) + 50;

    // בדיקת תגובה מצחיקה
    var funnyMsg = '';
    for (var fk in FUNNY) {
      if (searchQuery.indexOf(fk) !== -1) {
        funnyMsg = FUNNY[fk];
        break;
      }
    }

    // שליחת הודעת המתנה
    await sendTyping(chatId);
    await sendMsg(chatId, getGreeting() + ' ' + mention + vipTag + '!\n🔍 מחפש *' + searchQuery + '*... רגע אחד!');
    await sleep(2000);
    await sendTyping(chatId);
    await sleep(1500);

    // בניית התשובה
    var reply = mention + vipTag + ' ✅ *מצאתי עבורך ' + searchQuery + '!*\n\n';
    if (funnyMsg) reply += funnyMsg + '\n\n';
    reply += '🌡️ חום הדיל: ' + getHeat() + '\n';
    reply += '💰 חיסכון לעומת ישראל: *₪' + saving + '*\n\n';
    reply += '👇 לחץ לראות:\n' + link + '\n\n';
    reply += '🔥 מחירים מטורפים!';

    if (total === 5) reply += '\n\n🎉 החיפוש ה-5 שלך! מכור לדילים! 😄';
    else if (total === 10) {
      reply += '\n\n🏆 *10 חיפושים!* מלך הדילים! 👑';
      await sendToAdmins('🎉 ' + senderName + ' הגיע ל-10 חיפושים!');
    } else if (total === 20) {
      if (vipUsers.indexOf(senderPhone) === -1) vipUsers.push(senderPhone);
      reply += '\n\n🌟 *20 חיפושים!* קיבלת תג VIP! 👑';
    }

    // חיפוש קודם
    var prevList = userMemory[senderPhone];
    if (prevList.length > 1) {
      var lastSearch = prevList[prevList.length - 2];
      if (lastSearch !== searchQuery) {
        reply += '\n\n💡 *בפעם הקודמת חיפשת:* ' + lastSearch;
      }
    }

    // משדך
    for (var sp in userMemory) {
      if (sp !== senderPhone && userMemory[sp].indexOf(searchQuery) !== -1) {
        reply += '\n\n🤝 גם @' + sp.replace('@c.us', '') + ' חיפש/ה את זה! תעשו הזמנה ביחד! 😄';
        break;
      }
    }

    await sendMsg(chatId, reply);

  } catch (e) {
    console.error('שגיאה:', e.message);
  }
});

app.get('/', function(req, res) {
  res.send('הבוט הפרימיום פועל!');
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('הבוט הפרימיום פועל על פורט ' + PORT);
  scheduleDaily();
  scheduleWeekly();
  scheduleKing();
  setInterval(async function() { await sendSurprise(); }, 7 * 24 * 60 * 60 * 1000);
});
