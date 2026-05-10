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

const userMemory = {};
const searchCount = {};

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

const FUNNY_RESPONSES = {
  'כיסא': 'כיסא? בטח אחרי שעמדת כל היום! 😂',
  'שמיכה': 'שמיכה? קר לך? 🥶',
  'בושם': 'מישהו רוצה להריח טוב! 😏',
  'טבעת': 'מישהו מתחתן?! 💍😄',
  'צעצוע': 'בשביל הילדים... או בשבילך? 😄'
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

function getHeatEmoji(score) {
  if (score >= 5) return '🔥🔥🔥🔥🔥';
  if (score >= 4) return '🔥🔥🔥🔥';
  if (score >= 3) return '🔥🔥🔥';
  return '🔥🔥';
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return '☀️ בוקר טוב!';
  if (hour >= 12 && hour < 17) return '🌤️ צהריים טובים!';
  if (hour >= 17 && hour < 21) return '🌆 ערב טוב!';
  return '🌙 שש... כולם ישנים אבל אני עובד בשבילך...';
}

function getKingOfGroup() {
  let king = null;
  let maxCount = 0;
  for (const [phone, count] of Object.entries(searchCount)) {
    if (count > maxCount) {
      maxCount = count;
      king = phone;
    }
  }
  return { king, maxCount };
}

function scheduleDaily() {
  const now = new Date();
  const next10am = new Date();
  next10am.setHours(10, 0, 0, 0);
  if (now >= next10am) next10am.setDate(next10am.getDate() + 1);

  setTimeout(async () => {
    const deals = [
      { name: 'אוזניות בלוטות', query: 'bluetooth earphones', saving: 120 },
      { name: 'שעון חכם', query: 'smart watch', saving: 250 },
      { name: 'מטען מהיר', query: 'fast charger', saving: 80 },
      { name: 'רמקול בלוטות', query: 'bluetooth speaker', saving: 150 },
      { name: 'מצלמת אבטחה', query: 'security camera wifi', saving: 200 }
    ];
    const deal = deals[Math.floor(Math.random() * deals.length)];
    const link = buildSearchLink(deal.query);
    const heat = getHeatEmoji(Math.floor(Math.random() * 3) + 3);
    const groupChatId = `${GROUP_ID}@g.us`;

    await sendMessage(groupChatId,
      `🚨 *דיל היום!* 🚨\n\n` +
      `הדיל הכי חם: *${deal.name}*\n\n` +
      `🌡️ חום הדיל: ${heat}\n` +
      `💰 חיסכון לעומת ישראל: *₪${deal.saving}*\n\n` +
      `👉 ${link}\n\n` +
      `⚡ אל תפספסו!`
    );
    scheduleDaily();
  }, next10am - now);
}

function scheduleWeeklyPoll() {
  const now = new Date();
  const nextSunday = new Date();
  nextSunday.setDate(now.getDate() + (7 - now.getDay()));
  nextSunday.setHours(11, 0, 0, 0);

  setTimeout(async () => {
    const groupChatId = `${GROUP_ID}@g.us`;
    await sendMessage(groupChatId,
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
    scheduleWeeklyPoll();
  }, nextSunday - now);
}

function scheduleKingAnnouncement() {
  const now = new Date();
  const nextSunday = new Date();
  nextSunday.setDate(now.getDate() + (7 - now.getDay()));
  nextSunday.setHours(12, 0, 0, 0);

  setTimeout(async () => {
    const { king, maxCount } = getKingOfGroup();
    const groupChatId = `${GROUP_ID}@g.us`;
    if (king && maxCount > 0) {
      await sendMessage(groupChatId,
        `👑 *מלך/מלכת הקבוצה השבוע!*\n\n` +
        `@${king.replace('@c.us', '')} חיפש/ה *${maxCount}* פעמים!\n\n` +
        `🏆 כל הכבוד! אתה/את המחפש/ת הכי פעיל/ה! 🔥`
      );
    }
    Object.keys(searchCount).forEach(key => delete searchCount[key]);
    scheduleKingAnnouncement();
  }, nextSunday - now);
}

function scheduleSurpriseBox() {
  const surprises = [
    { name: 'גאדג\'ט מטורף', query: 'cool gadget 2024' },
    { name: 'מוצר ויראלי', query: 'viral product tiktok' },
    { name: 'המצאה מדהימה', query: 'amazing invention cheap' },
    { name: 'מוצר חכם לבית', query: 'smart home gadget' }
  ];

  setInterval(async () => {
    const surprise = surprises[Math.floor(Math.random() * surprises.length)];
    const link = buildSearchLink(surprise.query);
    const groupChatId = `${GROUP_ID}@g.us`;
    await sendMessage(groupChatId,
      `🎁 *קופסת הפתעה שבועית!*\n\n` +
      `מצאתי לכם משהו מטורף 🤯\n` +
      `*${surprise.name}* — המחיר יפיל אתכם!\n\n` +
      `👉 ${link}\n\n` +
      `מי ראה כזה דבר?! 😱`
    );
  }, 7 * 24 * 60 * 60 * 1000);
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
    const senderName = body.senderData && body.senderData.senderName ? body.senderData.senderName : 'חבר';
    const senderPhone = body.senderData && body.senderData.sender ? body.senderData.sender : '';

    if (!text || !chatId) return;

    if (containsBadWord(text)) {
      // הודעה לקבוצה
      await sendMessage(chatId,
        `⚠️ @${senderPhone.replace('@c.us', '')} שים לב!\n` +
        `שפה כזו לא מתאימה כאן 🙏\n` +
        `שלחתי לך הודעה פרטית.`
      );
      // הודעה פרטית לאותו בן אדם
      await sendMessage(senderPhone,
        `שלום ${senderName} 👋\n\n` +
        `קיבלתי את ההודעה שלך בקבוצה ורציתי לדבר איתך בפרטיות.\n\n` +
        `השפה שהשתמשת בה לא הולמת את האווירה שאנחנו רוצים בקבוצה 🙏\n\n` +
        `אנחנו קבוצה של חברים שאוהבים דילים ומבקשים מכולם להתנהג בכבוד הדדי.\n\n` +
        `אני בטוח שזה לא מה שאתה רוצה להציג מעצמך 😊\n` +
        `בוא נמשיך ביחד בצורה נעימה! 🤝`
      );
      // התראה לבעל הקבוצה
      await sendMessage(OWNER_PHONE,
        `🚨 *התראה!*\n` +
        `${senderName} (${senderPhone.replace('@c.us', '')}) כתב קללה:\n` +
        `"${text}"\n\n` +
        `שלחתי לו הודעה פרטית.`
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
      await sendMessage(chatId, 'כתוב למשל: אני מחפש אוזניות בלוטות 🎧');
      return;
    }

    if (!userMemory[senderPhone]) userMemory[senderPhone] = [];
    userMemory[senderPhone].push(searchQuery);
    searchCount[senderPhone] = (searchCount[senderPhone] || 0) + 1;

    const totalSearches = searchCount[senderPhone];
    const mention = senderPhone ? `@${senderPhone.replace('@c.us', '')}` : senderName;
    const greeting = getTimeGreeting();
    const link = buildSearchLink(searchQuery);
    const heat = getHeatEmoji(Math.floor(Math.random() * 3) + 3);
    const saving = Math.floor(Math.random() * 200) + 50;

    const funnyResponse = Object.entries(FUNNY_RESPONSES).find(([key]) => searchQuery.includes(key));

    await sendTyping(chatId);
    await sendMessage(chatId, `${greeting} ${mention}!\n🔍 מחפש *${searchQuery}*... רגע אחד!`);
    await sleep(2000);
    await sendTyping(chatId);
    await sleep(1500);

    let message = `${mention} ✅ *מצאתי עבורך ${searchQuery}!*\n\n`;
    if (funnyResponse) message += `😂 ${funnyResponse[1]}\n\n`;
    message += `🌡️ חום הדיל: ${heat}\n`;
    message += `💰 חיסכון לעומת ישראל: *₪${saving}*\n\n`;
    message += `👇 לחץ לראות את הדילים:\n${link}\n\n`;
    message += `🔥 מחירים מטורפים!`;

    if (totalSearches === 5) {
      message += `\n\n🎉 זה החיפוש ה-5 שלך! אתה מכור לדילים! 😄`;
    } else if (totalSearches === 10) {
      message += `\n\n🏆 *10 חיפושים!* אתה מלך/מלכת הדילים! 👑`;
      await sendMessage(OWNER_PHONE, `🎉 ${senderName} הגיע ל-10 חיפושים!`);
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

app.get('/', (req, res) => { res.send('🤖 הבוט הכי חזק פועל!'); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 הבוט המטורף פועל על פורט ' + PORT);
  scheduleDaily();
  scheduleWeeklyPoll();
  scheduleKingAnnouncement();
  scheduleSurpriseBox();
});
