const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const GREEN_API_URL = `https://7107.api.greenapi.com/waInstance${INSTANCE_ID}`;
const ALI_TRACKING_ID = 'bot01';
const ALI_APP_KEY = '533908';

const TRIGGER_WORDS = ['אני מחפש', 'חפש לי', 'מישהו מכיר', 'אני צריך', 'מחפש'];

const TRANSLATIONS = {
  'אוזניות': 'earphones', 'בלוטות': 'bluetooth', 'נעליים': 'shoes',
  'שעון': 'watch', 'טלפון': 'phone', 'מטען': 'charger', 'כיסא': 'chair',
  'מאוורר': 'fan', 'מצלמה': 'camera', 'תיק': 'bag', 'בגדים': 'clothes',
  'צמיד': 'bracelet', 'טבעת': 'ring', 'משקפיים': 'glasses', 'ספורט': 'sport',
  'ילדים': 'kids', 'צעצוע': 'toy', 'מטבח': 'kitchen', 'עט': 'pen',
  'מחשב': 'computer', 'לפטופ': 'laptop', 'אוזניה': 'earphone', 'זול': 'cheap'
};

function translateToEnglish(text) {
  let result = text;
  for (const [hebrew, english] of Object.entries(TRANSLATIONS)) {
    result = result.replace(new RegExp(hebrew, 'g'), english);
  }
  return result;
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

function buildLinks(query) {
  const englishQuery = translateToEnglish(query);
  const encoded = encodeURIComponent(englishQuery);
  const base = `aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key=${ALI_TRACKING_ID}&terminal_id=${ALI_APP_KEY}`;
  
  return {
    search: `https://www.aliexpress.com/wholesale?SearchText=${encoded}&SortType=total_tranpro_desc&${base}`,
    english: englishQuery
  };
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
    if (!text || !chatId) return;

    const triggerWord = TRIGGER_WORDS.find(word => text.includes(word));
    if (!triggerWord) return;

    let searchQuery = text;
    for (const word of TRIGGER_WORDS) {
      searchQuery = searchQuery.replace(word, '').trim();
    }

    if (!searchQuery || searchQuery.length < 2) {
      await sendWhatsAppMessage(chatId, 'כתוב למשל: אני מחפש אוזניות בלוטות');
      return;
    }

    const { search, english } = buildLinks(searchQuery);
    
    const message = `🛍️ תוצאות עבור: *${searchQuery}*\n\n` +
      `לחץ על הלינק לראות את המוצרים הכי נמכרים:\n\n` +
      `👉 ${search}\n\n` +
      `_קנייה דרך הלינק = עמלה לקבוצה_ 💰`;

    await sendWhatsAppMessage(chatId, message);
  } catch (error) {
    console.error('שגיאה:', error.message);
  }
});

app.get('/', (req, res) => { res.send('הבוט פועל!'); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log('הבוט פועל על פורט ' + PORT); });
