const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const GREEN_API_URL = `https://7107.api.greenapi.com/waInstance${INSTANCE_ID}`;
const ALI_APP_KEY = '533908';
const ALI_APP_SECRET = 'iTd8ZOn3s1xmlJ7fXLoe2XYHBkkaF2dF';
const ALI_TRACKING_ID = 'bot01';

const TRIGGER_WORDS = ['אני מחפש', 'חפש לי', 'מישהו מכיר', 'יש מוצר', 'אני צריך', 'מחפש'];

async function searchAliExpress(query) {
  try {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15) + '000';
    const params = {
      app_key: ALI_APP_KEY,
      method: 'aliexpress.affiliate.product.query',
      sign_method: 'md5',
      timestamp: timestamp,
      v: '2.0',
      keywords: query,
      tracking_id: ALI_TRACKING_ID,
      sort: 'SALE_PRICE_ASC',
      page_size: 10,
      fields: 'product_id,product_title,sale_price,evaluate_rate,promotion_link'
    };
    const sortedKeys = Object.keys(params).sort();
    let signStr = ALI_APP_SECRET;
    for (const key of sortedKeys) {
      signStr += key + params[key];
    }
    signStr += ALI_APP_SECRET;
    params.sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
    const queryString = new URLSearchParams(params).toString();
    const response = await axios.get(`https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.listPromotionProduct/${ALI_APP_KEY}?${queryString}`);
    if (response.data && response.data.result && response.data.result.products) {
      const products = response.data.result.products.product;
      return products
        .filter(p => p.evaluate_rate && parseFloat(p.evaluate_rate) > 80)
        .sort((a, b) => parseFloat(b.evaluate_rate) - parseFloat(a.evaluate_rate))
        .slice(0, 4);
    }
    return [];
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
    return `לא מצאתי תוצאות עבור "${query}". נסה מילים אחרות!`;
  }
  let msg = `מצאתי ${products.length} מוצרים עבור: ${query}\n\n`;
  products.forEach((product, index) => {
    const rating = product.evaluate_rate ? `${product.evaluate_rate}%` : 'לא זמין';
    const price = product.sale_price || 'לא זמין';
    const title = product.product_title ? product.product_title.substring(0, 60) : 'מוצר';
    const link = product.promotion_link || '';
    msg += `${index + 1}. ${title}\n`;
    msg += `מחיר: $${price}\n`;
    msg += `דירוג: ${rating}\n`;
    msg += `${link}\n\n`;
  });
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
    const products = await searchAliExpress(searchQuery);
    const message = buildMessage(products, searchQuery);
    await sendWhatsAppMessage(chatId, message);
  } catch (error) {
    console.error('שגיאה:', error.message);
  }
});

app.get('/', (req, res) => {
  res.send('הבוט פועל!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('הבוט פועל על פורט ' + PORT);
});
