const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const GREEN_API_URL = `https://7107.api.greenapi.com/waInstance${INSTANCE_ID}`;
const ALI_TRACKING_ID = 'bot01';
const ALI_APP_KEY = '533908';
const RAPID_API_KEY = '915dcf0ac5msh93099502b8ca28fp1bae01jsn63a125be6f5f';

const TRIGGER_WORDS = ['אני מחפש', 'חפש לי', 'מישהו מכיר', 'אני צריך', 'מחפש'];

async function searchProducts(query) {
  try {
    const response = await axios.get('https://aliexpress-datahub.p.rapidapi.com/item_search', {
      params: { q: query, page: '1', sort: 'default' },
      headers: {
        'x-rapidapi-key': RAPID_API_KEY,
        'x-rapidapi-host': 'aliexpress-datahub.p.rapidapi.com'
      },
      timeout: 10000
    });
    const items = response.data && response.data.result && response.data.result.resultList;
    if (!items || items.length === 0) return [];
    return items.slice(0, 4).map(item => {
      const info = item.item;
      const productId = info.itemId;
      const title = info.title ? info.title.substring(0, 60) : 'מוצר';
      const price = info.sku && info.sku.def && info.sku.def.promotionPrice ? info.sku.def.promotionPrice : 'לא זמין';
      const sales = info.sales || 0;
      const link = `https://www.aliexpress.com/item/${productId}.html?aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key=${ALI_TRACKING_ID}&terminal_id=${ALI_APP_KEY}`;
      return { title, price, sales, link };
    });
  } catch (error) {
    console.error('שגיאה בחיפוש:', error.message);
    return [];
  }
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

function buildMessage(products, query) {
  if (!products || products.length === 0) {
    const encodedQuery = encodeURIComponent(query);
    const searchLink = `https://www.aliexpress.com/wholesale?SearchText=${encodedQuery}&aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key=${ALI_TRACKING_ID}&terminal_id=${ALI_APP_KEY}`;
    return `לא מצאתי תוצאות ספציפיות, אבל לחץ כאן לחיפוש:\n${searchLink}`;
  }
  let msg = `מצאתי ${products.length} מוצרים עבור: ${query}\n\n`;
  products.forEach((product, index) => {
    msg += `${index + 1}. ${product.title}\n`;
    msg += `מחיר: $${product.price}\n`;
    msg += `מכירות: ${product.sales}\n`;
    msg += `${product.link}\n\n`;
  });
  msg += `קנייה דרך הלינקים תומכת בקבוצה`;
  return msg;
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
    await sendWhatsAppMessage(chatId, `מחפש ${searchQuery} באלי אקספרס... רגע!`);
    const products = await searchProducts(searchQuery);
    const message = buildMessage(products, searchQuery);
    await sendWhatsAppMessage(chatId, message);
  } catch (error) {
    console.error('שגיאה:', error.message);
  }
});

app.get('/', (req, res) => { res.send('הבוט פועל!'); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log('הבוט פועל על פורט ' + PORT); });
