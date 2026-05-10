aconst express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const GREEN_API_URL = `https://7107.api.greenapi.com/waInstance${INSTANCE_ID}`;
const ALI_TRACKING_ID = 'bot01';
const ALI_APP_KEY = '533908';
const GROUP_CHAT_ID = 'KOL2v0rh8LH3RgfQIVr8gq@g.us';

const ADMINS = ['972538800370@c.us', '972557119650@c.us'];

const userMemory = {};
const searchCount = {};
const frozenUsers = new Set();
const vipUsers = new Set();
const warningCount = {};

const TRIGGER_WORDS = [
  'אני מחפש', 'אני מחפשת', 'חפש לי', 'חפשי לי',
  'אני צריך', 'אני צריכה', 'מחפש', 'מחפשת',
  'איפה אפשר לקנות', 'רוצה לקנות', 'מישהו מכיר',
  'מישהי מכירה', 'יש מוצר'
];

const BAD_WORDS = [
  'זין', 'כוס', 'שרמוטה', 'בן זונה', 'מניאק', 'זונה',
  'לך תזדיין', 'ממזר', 'אידיוט', 'טמבל', 'מפגר',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'idiot'
];

const SPAM_WORDS = [
  'הצטרפו', 'לינק', 'קבוצה חדשה', 'דרושים', 'מבצע מיוחד',
  'ווטסאפ', 'טלגרם', 'השקעה', 'הרוויחו', 'עשירים',
  'קליק', 'ביטקוין', 'הימור', 'קזינו'
];

const TRANSLATIONS = {
  'אוזניות': 'earphones', 'בלוטות': 'bluetooth', 'נעליים': 'shoes',
  'נעל': 'shoes', 'שעון': 'watch', 'טלפון': 'phone', 'מטען': 'charger',
  'כיסא': 'chair', 'מאוורר': 'fan', 'מצלמה': 'camera', 'תיק': 'bag',
  'בגדים': 'clothes', 'צמיד': 'bracelet', 'טבעת': 'ring',
  'משקפיים': 'glasses', 'ספורט': 'sport', 'ילדים': 'kids',
  'צעצוע': 'toy', 'מטבח': 'kitchen', 'עט': 'pen', 'מחשב': 'computer',
  'לפטופ': 'laptop', 'זול': 'cheap', 'כפפות': 'gloves',
  'טאבלט': 'tablet', 'רמקול': 'speaker', 'מקלדת': 'keyboard',
  'עכבר': 'mouse', 'מנורה': 'lamp', 'שמיכה': 'blanket',
  'כרית': 'pillow', 'ארנק': 'wallet', 'כובע': 'hat',
  'גרביים': 'socks', 'חגורה': 'belt', 'מראה': 'mirror',
  'בושם': 'perfume', 'קרם': 'cream', 'שמפו': 'shampoo',
  'אופניים': 'bicycle', 'קורקינט': 'scooter', 'משקולות': 'dumbbells',
  'יוגה': 'yoga mat', 'שטיח': 'carpet', 'וילון': 'curtain'
};

const FUNNY_RESPONSES = {
  'כיסא': '😂 כיסא? בטח אחרי שעמדת כל היום!',
  'שמיכה': '🥶 שמיכה? קר לך?',
  'בושם': '😏 מישהו רוצה להריח טוב!',
  'טבעת': '💍😄 מישהו מתחתן?!',
  'צעצוע': '😄 בשביל הילדים... או בשבילך?',
  'כרית': '😴 מישהו רוצה לישון?',
  'מראה': '😎 מישהו אוהב להסתכל על עצמו!',
  'אופניים': '🚴 יאללה ספורטאי!'
};

const JOKES = [
  'למה הסלמון שחה נגד הזרם? כי הוא לא רצה לקנות דגים קפואים מאלי אקספרס! 😂',
  'מה ההבדל בין אמא לאלי אקספרס? אמא תמיד מגיעה בזמן! 😄',
  'למה הבוט שלי לא ישן? כי הדילים לא ישנים! 🔥',
  'מה אמר הארנק לכרטיס האשראי? אני מרגיש ריק... כנראה קנו שוב באלי! 💸'
];

const FACTS = [
  '💡 ידעתם? אלי אקספרס מוכר מעל 100 מיליון מוצרים!',
  '💡 ידעתם? 60% מהמוצרים באלי אקספרס מגיעים תוך 2 שבועות!',
  '💡 ידעתם? ניתן לחסוך עד 80% לעומת מחירים בישראל!',
  '💡 ידעתם? אלי אקספרס מציע החזר כספי מלא אם המוצר לא הגיע!'
];

function translateToEnglish(text) {
  let result = text;
  for (const [hebrew, english] of Object.entries(TRANSLATIONS)) {
    result = result.replace(new RegExp(hebrew, 'g'), english);
  }
  return result;
}

function buildSearchLink(query) {
  const englishQuery = translateToEnglish(query);
  const encoded = encodeURIComponent(englishQuery);
  return `https://www.aliexpress.com/wholesale?SearchText=${encoded}&SortType=total_tranpro_desc&aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key=${ALI_TRACKING_ID}&terminal_id=${ALI_APP_KEY}`;
}

async function sendMessage(chatId, message) {
  try {
    await axios.post(`${GREEN_API_URL}/sendMessage/${API_TOKEN}`, {
      chatId: chatId,
      message: message
    });
  } catch (error) {
    console.error('שגיאה בשליחה:', error.message);
  }
}

async function sendToAdmins(message) {
  for (const admin of ADMINS) {
    await sendMessage(admin, message);
  }
}

async function sendTyping(chatId) {
  try {
    await axios.post(`${GREEN_API_URL}/sendTyping/${API_TOKEN}`, { chatId });
  } catch (e) {}
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function containsBadWord(text) {
  return BAD_WORDS.some(word => text.toLowerCase().includes(word.toLowerCase()));
}

function containsSpam(text) {
  return SPAM_WORDS.some(word => text.includes(word));
}

function isAdmin(phone) {
  return ADMINS.includes(phone);
}

function getHeat() {
  const score = Math.floor(Math.random() * 3) + 3;
  return '🔥'.repeat(score);
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return '☀️ בוקר טוב!';
  if (hour >= 12 && hour < 17) return '🌤️ צהריים טובים!';
  if (hour >= 17 && hour < 21) return '🌆 ערב טוב!';
  return '🌙 שש... כולם ישנים אבל אני עובד בשבילך!';
}

function getKing() {
  let king = null, max = 0;
  for (const [phone, count] of Object.entries(searchCount)) {
    if (count > max) { max = count; king = phone; }
  }
  return { king, max };
}

// ===== פקודות מנהל =====
async function handleAdminCommand(text, senderPhone) {
  const cmd = text.trim();

  if (cmd === '!דיל') {
    await sendDailyDeal();
    await sendMessage(senderPhone, '✅ דיל יומי נשלח לקבוצה!');
    return true;
  }

  if (cmd === '!סקר') {
    await sendWeeklyPoll();
    await sendMessage(senderPhone, '✅ סקר נשלח לקבוצה!');
    return true;
  }

  if (cmd === '!הפתעה') {
    await sendSurpriseBox();
    await sendMessage(senderPhone, '✅ קופסת הפתעה נשלחה!');
    return true;
  }

  if (cmd === '!מלך') {
    await announceKing();
    await sendMessage(senderPhone, '✅ מלך הקבוצה הוכרז!');
    return true;
  }

  if (cmd === '!מצב') {
    const total = Object.values(searchCount).reduce((a, b) => a + b, 0);
    const frozen = frozenUsers.size;
    const vip = vipUsers.size;
    await sendMessage(senderPhone,
      `📊 *סטטוס הבוט:*\n\n` +
      `🔍 סה"כ חיפושים: ${total}\n` +
      `❄️ משתמשים מוקפאים: ${frozen}\n` +
      `👑 VIP: ${vip}\n` +
      `👥 משתמשים פעילים: ${Object.keys(searchCount).length}`
    );
    return true;
  }

  if (cmd === '!ניקוי') {
    Object.keys(searchCount).forEach(k => delete searchCount[k]);
    await sendMessage(senderPhone, '✅ כל הספירות אופסו!');
    return true;
  }

  if (cmd === '!בדיחה') {
    const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
    await sendMessage(GROUP_CHAT_ID, `😂 *בדיחת היום:*\n\n${joke}`);
    await sendMessage(senderPhone, '✅ בדיחה נשלחה!');
    return true;
  }

  if (cmd === '!עובדה') {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    await sendMessage(GROUP_CHAT_ID, fact);
    await sendMessage(senderPhone, '✅ עובדה נשלחה!');
    return true;
  }

  if (cmd.startsWith('!הקפא ')) {
    const phone = cmd.replace('!הקפא ', '').replace('+', '972').replace(/-/g, '') + '@c.us';
    frozenUsers.add(phone);
    await sendMessage(GROUP_CHAT_ID, `❄️ משתמש הוקפא זמנית על ידי המנהל.`);
    await sendMessage(senderPhone, `✅ ${phone} הוקפא!`);
    return true;
  }

  if (cmd.startsWith('!שחרר ')) {
    const phone = cmd.replace('!שחרר ', '').replace('+', '972').replace(/-/g, '') + '@c.us';
    frozenUsers.delete(phone);
    await sendMessage(senderPhone, `✅ ${phone} שוחרר!`);
    return true;
  }

  if (cmd.startsWith('!VIP ')) {
    const phone = cmd.replace('!VIP ', '').replace('+', '972').replace(/-/g, '') + '@c.us';
    vipUsers.add(phone);
    await sendMessage(GROUP_CHAT_ID, `👑 *מזל טוב!*\n@${phone.replace('@c.us', '')} קיבל/ה תג VIP בקבוצה! 🌟`);
    await sendMessage(senderPhone, `✅ VIP ניתן!`);
    return true;
  }

  if (cmd.startsWith('!אזהרה ')) {
    const phone = cmd.replace('!אזהרה ', '').replace('+', '972').replace(/-/g, '') + '@c.us';
    await sendMessage(phone,
      `⚠️ *אזהרה מהמנהל!*\n\n` +
      `קיבלת אזהרה רשמית מניהול הקבוצה.\n` +
      `אנא שמור על כללי הקבוצה 🙏`
    );
    await sendMessage(senderPhone, `✅ אזהרה נשלחה!`);
    return true;
  }

  if (cmd.startsWith('!כבוד ')) {
    const phone = cmd.replace('!כבוד ', '').replace('+', '972').replace(/-/g, '') + '@c.us';
    await sendMessage(GROUP_CHAT_ID,
      `🏆 *גיבור הקבוצה!*\n\n` +
      `@${phone.replace('@c.us', '')} הוא/היא הגיבור/ת שלנו היום! 🌟\n` +
      `תודה על התרומה לקבוצה! ❤️`
    );
    await sendMessage(senderPhone, `✅ כבוד ניתן!`);
    return true;
  }

  if (cmd.startsWith('!הודעה ')) {
    const msg = cmd.replace('!הודעה ', '');
    await sendMessage(GROUP_CHAT_ID, `📢 *הודעה מהמנהל:*\n\n${msg}`);
    await sendMessage(senderPhone, `✅ הודעה נשלחה!`);
    return true;
  }

  if (cmd === '!מצב לילה') {
    await sendMessage(GROUP_CHAT_ID, `🌙 *מצב לילה פעיל*\n\nשקט... הבוט עובד בלחישות עד הבוקר 😴`);
    await sendMessage(senderPhone, `✅ מצב לילה הופעל!`);
    return true;
  }

  if (cmd === '!מצב טירוף') {
    await sendMessage(GROUP_CHAT_ID, `🔥🤯💥 *מצב טירוף פעיל!* 💥🤯🔥\n\nהבוט במצב אנרגיה מקסימלית! יאללה תחפשו דילים! 🚀🎯💰`);
    await sendMessage(senderPhone, `✅ מצב טירוף הופעל!`);
    return true;
  }

  if (cmd === '!תחרות') {
    await sendMessage(GROUP_CHAT_ID,
      `🏆 *תחרות דילים!*\n\n` +
      `מי ימצא את הדיל הכי זול השבוע?\n\n` +
      `חפשו מוצר, שלחו לינק עם המחיר!\n` +
      `הזוכה מקבל תג 👑 VIP בקבוצה!\n\n` +
      `יאללה תתחילו! 🔥`
    );
    await sendMessage(senderPhone, `✅ תחרות הושקה!`);
    return true;
  }

  if (cmd === '!עזרה') {
    await sendMessage(senderPhone,
      `📋 *פקודות מנהל:*\n\n` +
      `!דיל - שלח דיל יומי\n` +
      `!סקר - שלח סקר\n` +
      `!הפתעה - קופסת הפתעה\n` +
      `!מלך - הכרז מלך\n` +
      `!מצב - סטטוס בוט\n` +
      `!ניקוי - אפס ספירות\n` +
      `!בדיחה - שלח בדיחה\n` +
      `!עובדה - שלח עובדה\n` +
      `!הקפא [מספר] - הקפא משתמש\n` +
      `!שחרר [מספר] - שחרר משתמש\n` +
      `!VIP [מספר] - תן VIP\n` +
      `!אזהרה [מספר] - שלח אזהרה\n` +
      `!כבוד [מספר] - הכרז גיבור\n` +
      `!הודעה [טקסט] - שלח הודעה\n` +
      `!מצב לילה - מצב שקט\n` +
      `!מצב טירוף - מצב אנרגיה\n` +
      `!תחרות - פתח תחרות`
    );
    return true;
  }

  return false;
}

// ===== דיל יומי =====
async function sendDailyDeal() {
  const deals = [
    { name: 'אוזניות בלוטות פרו', query: 'bluetooth earphones pro', saving: 120 },
    { name: 'שעון חכם 2024', query: 'smart watch 2024', saving: 250 },
    { name: 'מטען מהיר 65W', query: 'fast charger 65w', saving: 80 },
    { name: 'רמקול בלוטות עמיד למים', query: 'waterproof bluetooth speaker', saving: 150 },
    { name: 'מצלמת אבטחה WiFi', query: 'security camera wifi 4k', saving: 200 },
    { name: 'מנורת LED חכמה', query: 'smart led lamp rgb', saving: 60 },
    { name: 'כיסא גיימינג', query: 'gaming chair ergonomic', saving: 300 }
  ];
  const deal = deals[Math.floor(Math.random() * deals.length)];
  const link = buildSearchLink(deal.query);

  await sendMessage(GROUP_CHAT_ID,
    `🚨 *דיל היום!* 🚨\n\n` +
    `הדיל הכי חם: *${deal.name}*\n\n` +
    `🌡️ חום הדיל: ${getHeat()}\n` +
    `💰 חיסכון לעומת ישראל: *₪${deal.saving}*\n\n` +
    `👉 ${link}\n\n` +
    `⚡ המחיר לא יחזיק לאורך זמן!`
  );
}

// ===== סקר =====
async function sendWeeklyPoll() {
  await sendMessage(GROUP_CHAT_ID,
    `📊 *סקר שבועי!*\n\n` +
    `מה הכי מעניין אתכם?\n\n` +
    `1️⃣ אוזניות ואביזרי אודיו\n` +
    `2️⃣ שעונים חכמים\n` +
    `3️⃣ מוצרי בית וגאדג'טים\n` +
    `4️⃣ ביגוד ואופנה\n` +
    `5️⃣ מוצרי ספורט\n` +
    `6️⃣ אלקטרוניקה\n\n` +
    `ענו עם המספר! 👇`
  );
}

// ===== קופסת הפתעה =====
async function sendSurpriseBox() {
  const surprises = [
    { name: 'גאדג\'ט מטורף', query: 'cool gadget 2024' },
    { name: 'מוצר ויראלי', query: 'viral product tiktok' },
    { name: 'המצאה מדהימה', query: 'amazing invention cheap' },
    { name: 'מוצר חכם לבית', query: 'smart home gadget' }
  ];
  const surprise = surprises[Math.floor(Math.random() * surprises.length)];
  const link = buildSearchLink(surprise.query);

  await sendMessage(GROUP_CHAT_ID,
    `🎁 *קופסת הפתעה!*\n\n` +
    `מצאתי לכם משהו מטורף 🤯\n` +
    `*${surprise.name}* — המחיר יפיל אתכם!\n\n` +
    `👉 ${link}\n\n` +
    `מי ראה כזה דבר?! 😱`
  );
}

// ===== מלך הקבוצה =====
async function announceKing() {
  const { king, max } = getKing();
  if (king && max > 0) {
    await sendMessage(GROUP_CHAT_ID,
      `👑 *מלך/מלכת הקבוצה!*\n\n` +
      `@${king.replace('@c.us', '')} חיפש/ה *${max}* פעמים!\n\n` +
      `🏆 כל הכבוד! אתה/את המחפש/ת הכי פעיל/ה! 🔥`
    );
    Object.keys(searchCount).forEach(k => delete searchCount[k]);
  }
}

// ===== לוחות זמנים =====
function scheduleDaily() {
  const now = new Date();
  const next = new Date();
  next.setHours(10, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);
  setTimeout(async () => { await sendDailyDeal(); scheduleDaily(); }, next - now);
}

function scheduleWeeklyPoll() {
  const now = new Date();
  const next = new Date();
  next.setDate(now.getDate() + (7 - now.getDay()));
  next.setHours(11, 0, 0, 0);
  setTimeout(async () => { await sendWeeklyPoll(); scheduleWeeklyPoll(); }, next - now);
}

function scheduleKing() {
  const now = new Date();
  const next = new Date();
  next.setDate(now.getDate() + (7 - now.getDay()));
  next.setHours(12, 0, 0, 0);
  setTimeout(async () => { await announceKing(); scheduleKing(); }, next - now);
}

function scheduleSurprise() {
  setInterval(async () => { await sendSurpriseBox(); }, 7 * 24 * 60 * 60 * 1000);
}

// ===== Webhook =====
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (!body || body.typeWebhook !== 'incomingMessageReceived') return;
    const messageData = body.messageData;
    if (!messageData || messageData.typeMessage !== 'textMessage') return;

    const text = messageData.textMessageData && messageData.textMessageData.textMessage ? messageData.textMessageData.textMessage : '';
    const chatId = body.senderData && body.senderData.chatId ? body.senderData.chatId : '';
    const senderName = body.senderData && body.senderData.senderName ? body.senderData.senderName : 'חבר';
    const senderPhone = body.senderData && body.senderData.sender ? body.senderData.sender : '';

    if (!text || !chatId) return;

    // ===== פקודות מנהל =====
    if (isAdmin(senderPhone) && text.startsWith('!')) {
      await handleAdminCommand(text, senderPhone);
      return;
    }

    // ===== משתמש מוקפא =====
    if (frozenUsers.has(senderPhone)) return;

    // ===== זיהוי ספאם =====
    if (containsSpam(text)) {
      await sendMessage(chatId,
        `🚫 @${senderPhone.replace('@c.us', '')} זוהה ספאם/פרסומת!\n` +
        `פרסומות אסורות בקבוצה 🙏`
      );
      await sendToAdmins(
        `🚨 *התראת ספאם!*\n` +
        `${senderName} שלח פרסומת:\n"${text}"`
      );
      return;
    }

    // ===== זיהוי קללות =====
    if (containsBadWord(text)) {
      warningCount[senderPhone] = (warningCount[senderPhone] || 0) + 1;
      const warnings = warningCount[senderPhone];

      await sendMessage(chatId,
        `⚠️ @${senderPhone.replace('@c.us', '')} אזהרה ${warnings}/3!\n` +
        `שפה לא הולמת אסורה בקבוצה 🙏\n` +
        `שלחתי לך הודעה פרטית.`
      );

      await sendMessage(senderPhone,
        `שלום ${senderName} 👋\n\n` +
        `זוהי אזהרה מספר *${warnings}* מתוך 3.\n\n` +
        `השפה שהשתמשת בה לא מתאימה לקבוצה שלנו 🙏\n` +
        `אנחנו קבוצה של חברים — בוא נשמור על כבוד!\n\n` +
        `${warnings >= 3 ? '⛔ זוהי אזהרה אחרונה! הפעם הבאה תוקפא!' : '😊 בוא נמשיך ביחד בצורה נעימה!'}`
      );

      if (warnings >= 3) {
        frozenUsers.add(senderPhone);
        await sendMessage(chatId, `❄️ @${senderPhone.replace('@c.us', '')} הוקפא אוטומטית!`);
      }

      await sendToAdmins(
        `🚨 *התראת קללה!*\n` +
        `${senderName} (אזהרה ${warnings}/3):\n"${text}"`
      );
      return;
    }

    // ===== חיפוש מוצר =====
    const triggerWord = TRIGGER_WORDS.find(word => text.includes(word));
    if (!triggerWord) return;

    let searchQuery = text;
    for (const word of TRIGGER_WORDS) {
      searchQuery = searchQuery.replace(word, '').trim();
    }

    if (!searchQuery || searchQuery.length < 2) {
      await sendMessage(chatId, '🎧 כתוב למשל: אני מחפש אוזניות בלוטות');
      return;
    }

    if (!userMemory[senderPhone]) userMemory[senderPhone] = [];
    userMemory[senderPhone].push(searchQuery);
    searchCount[senderPhone] = (searchCount[senderPhone] || 0) + 1;

    const totalSearches = searchCount[senderPhone];
    const mention = `@${senderPhone.replace('@c.us', '')}`;
    const isVIP = vipUsers.has(senderPhone);
    const greeting = getTimeGreeting();
    const link = buildSearchLink(searchQuery);
    const saving = Math.floor(Math.random() * 200) + 50;
    const funnyResponse = Object.entries(FUNNY_RESPONSES).find(([key]) => searchQuery.includes(key));

    await sendTyping(chatId);
    await sendMessage(chatId,
      `${greeting} ${mention}${isVIP ? ' 👑' : ''}!\n🔍 מחפש *${searchQuery}*... רגע!`
    );
    await sleep(2000);
    await sendTyping(chatId);
    await sleep(1500);

    let message = `${mention}${isVIP ? ' 👑 VIP' : ''} ✅ *מצאתי עבורך ${searchQuery}!*\n\n`;
    if (funnyResponse) message += `${funnyResponse[1]}\n\n`;
    message += `🌡️ חום הדיל: ${getHeat()}\n`;
    message += `💰 חיסכון לעומת ישראל: *₪${saving}*\n\n`;
    message += `👇 לחץ לראות:\n${link}\n\n`;
    message += `🔥 מחירים מטורפים!`;

    if (totalSearches === 5) {
      message += `\n\n🎉 החיפוש ה-5 שלך! אתה מכור לדילים! 😄`;
    } else if (totalSearches === 10) {
      message += `\n\n🏆 *10 חיפושים!* אתה מלך/מלכת הדילים! 👑`;
      await sendToAdmins(`🎉 ${senderName} הגיע ל-10 חיפושים!`);
    } else if (totalSearches === 20) {
      vipUsers.add(senderPhone);
      message += `\n\n🌟 *מדהים! 20 חיפושים!* קיבלת תג VIP! 👑`;
    }

    const previousSearches = userMemory[senderPhone] || [];
    if (previousSearches.length > 1) {
      const lastSearch = previousSearches[previousSearches.length - 2];
      if (lastSearch && lastSearch !== searchQuery) {
        message += `\n\n💡 *בפעם הקודמת חיפשת:* ${lastSearch}`;
      }
    }

    const sameSearchers = Object.entries(userMemory)
      .filter(([phone, searches]) => phone !== senderPhone && searches.includes(searchQuery))
      .map(([phone]) => phone.replace('@c.us', ''));

    if (sameSearchers.length > 0) {
      message += `\n\n🤝 גם @${sameSearchers[0]} חיפש/ה את זה! תעשו הזמנה ביחד! 😄`;
    }

    await sendMessage(chatId, message);

  } catch (error) {
    console.error('שגיאה:', error.message);
  }
});

app.get('/', (req, res) => { res.send('🤖 הבוט הפרימיום פועל!'); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 הבוט הפרימיום פועל על פורט ' + PORT);
  scheduleDaily();
  scheduleWeeklyPoll();
  scheduleKing();
  scheduleSurprise();
});
