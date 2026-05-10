const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const GREEN_API_URL = `https://7107.api.greenapi.com/waInstance${INSTANCE_ID}`;
const ALI_TRACKING_ID = 'bot01';
const ALI_APP_KEY = '533908';
const OWNER_PHONE = '972538800370@c.us';
const GROUP_ID = 'KOL2v0rh8LH3RgfQIVr8gq';

const TRIGGER_WORDS = [
  'אני מחפש', 'אני מחפשת', 'חפש לי', 'חפשי לי',
  'אני צריך', 'אני צריכה', 'מחפש', 'מחפשת',
  'איפה אפשר לקנות', 'רוצה לקנות', 'מישהו מכיר',
  'מישהי מכירה', 'יש מוצר'
];

const BAD_WORDS = [
  'זין', 'כוס', 'שרמוטה', 'בן זונה', 'מניאק', 'זונה',
  'לך תזדיין', 'ממזר', 'חמור', 'אידיוט',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard'
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
  'בושם': 'perfume', 'קרם': 'cream', 'שמפו': 'shampoo'
};

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

async function sendWhatsAppMessage(chatId, message) {
  try {
    await axios.post(`${GREEN_API_URL}/sendMessage/${API_TOKEN}`, {
      chatId: chatId,
      message: message
    });
  } catch (error) {
    console.error('שגיאה בשליחה:', error.message);
  }
}

async function sendTyping(chatId) {
  try {
    await axios.post(`${GREEN_API_URL}/sendTyping/${API_TOKEN}`, {
      chatId: chatId
    });
  } catch (error) {}
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function containsBadWord(text) {
  const lowerText = text.toLowerCase();
  return BAD_WORDS.some(word => lowerText.includes(word.toLowerCase()));
}

function scheduleDaily() {
  const now = new Date();
  const next10am = new Date();
  next10am.setHours(10, 0, 0, 0);
  if (now >= next10am) {
    next10am.setDate(next10am.getDate() + 1);
  }
  const msUntil10am = next10am - now;

  setTimeout(async () => {
    const deals = [
      { name: 'אוזניות בלוטות', query: 'bluetooth earphones' },
      { name: 'שעון חכם', query: 'smart watch' },
      { name: 'מטען מהיר', query: 'fast charger' },
      { name: 'רמקול בלוטות', query: 'bluetooth speaker' },
      { name: 'מצלמת אבטחה', query: 'security camera wifi' }
    ];
    const deal = deals[Math.floor(Math.random() * deals.length)];
    const link = buildSearchLink(deal.query);
    const groupChatId = `${GROUP_ID}@g.us`;
    await sendWhatsAppMessage(groupChatId,
      `🔥 *דיל היום!*\n\nהדיל הכי חם היום: *${deal.name}*\n\n👉 ${link}\n\n⚡ מחירים מטורפים! אל תפספסו!`
    );
    scheduleDaily();
  }, msUntil10am);
}

function scheduleWeeklyPoll() {
  const now = new Date();
  const nextSunday = new Date();
  nextSunday.setDate(now.getDate() + (7 - now.getDay()));
  nextSunday.setHours(11, 0, 0, 0);
  const msUntilSunday = nextSunday - now;

  setTimeout(async () => {
    const groupChatId = `${GROUP_ID}@g.us`;
    await sendWhatsAppMessage(groupChatId,
      `📊 *סקר שבועי - מה אתם הכי מחפשים?*\n\n1️⃣ אוזניות ואביזרי אודיו\n2️⃣ שעונים חכמים\n3️⃣ מוצרי בית וגאדג'טים\n4️⃣ ביגוד ואביזרי אופנה\n5️⃣ מוצרי ספורט\n\nענו עם המספר! 👇`
    );
    scheduleWeeklyPoll();
  }, msUntilSunday);
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (!body || body.typeWebhook !== 'incomingMessageReceived') return;
    const messageData = body.messageData;
    if (!messageData || messageData.typeMessage !== 'textMessage') return;

    const text = messageData.textMessageData && messageData.textMessageData.textMessage ? messageData.textMessageData.textMessage : '';
    const chatId = body.senderData && body.senderData.chatId ? body.senderData.chatId : '';
    const senderName = body.senderData && body.senderData.senderName ? body.senderData.senderName : 'משתמש';
    const senderPhone = body.senderData && body.senderData.sender ? body.senderData.sender : '';

    if (!text || !chatId) return;

    if (containsBadWord(text)) {
      await sendWhatsAppMessage(chatId,
        `⚠️ @${senderPhone.replace('@c.us', '')} שים לב!\nהשימוש בשפה לא הולמת אסור בקבוצה.\nאנא התנהג בכבוד 🙏`
      );
      await sendWhatsAppMessage(OWNER_PHONE,
        `🚨 *התראה!*\n${senderName} כתב קללה בקבוצה:\n"${text}"`
      );
      return;
    }

    const triggerWord = TRIGGER_WORDS.find(word => text.includes(word));
    if (!triggerWord) return;

    let searchQuery = text;
    for (const word of TRIGGER_WORDS) {
      searchQuery = searchQuery.replace(word, '').trim();
    }

    if (!searchQuery || searchQuery.length < 2) {
      await sendWhatsAppMessage(chatId, 'כתוב למשל: אני מחפש אוזניות בלוטות 🎧');
      return;
    }

    await sendTyping(chatId);
    await sendWhatsAppMessage(chatId, `🔍 מחפש *${searchQuery}*... רגע אחד!`);
    await sleep(3000);
    await sendTyping(chatId);
    await sleep(2000);

    const link = buildSearchLink(searchQuery);
    const mention = senderPhone ? `@${senderPhone.replace('@c.us', '')} ` : '';

    await sendWhatsAppMessage(chatId,
      `${mention}✅ *מצאתי עבורך ${searchQuery}!*\n\n👇 לחץ לראות את הדילים הכי טובים:\n${link}\n\n🔥 מחירים מטורפים!`
    );

  } catch (error) {
    console.error('שגיאה:', error.message);
  }
});

app.get('/', (req, res) => { res.send('הבוט פועל!'); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('הבוט פועל על פורט ' + PORT);
  scheduleDaily();
  scheduleWeeklyPoll();
});
