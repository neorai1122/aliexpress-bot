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

function buildAffiliateLink(productId) {
  return `https://s.click.aliexpress.com/e/_${productId}?aff_id=${ALI_APP_KEY}&aff_sub=${ALI_TRACKING_ID}`;
}

async function searchAliExpress(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.aliexpress.com/wholesale?SearchText=${encodedQuery}&SortType=total_tranpro_desc`;
    
    const response = await axios.get(
      `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`,
      { timeout: 10000 }
    );

    const html = response.data.contents;
    const products = [];
    
    const regex = /"productId":"(\d+)","title":"([^"]+)","price":\{"min":"([^"]+)"/g;
    let match;
    let count = 0;
    
    while ((match = regex.exec(html)) !== null && count < 4) {
      const productId = match[1];
      const title = match[2].replace(/\\u[\dA-F]{4}/gi, '').substring(0, 60);
      const price = match[3];
      
      products.push({
        id: productId,
        title: title,
        price: price,
        link: `https://www.aliexpress.com/item/${productId}.html?aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key=${ALI_TRACKING_ID}&terminal_id=${ALI_APP_KEY}`
      });
      count++;
    }

    if (products.length === 0) {
      return buildManualResults(query);
    }

    return products;
  } catch (error) {
    console.error('שגיאה בחיפוש:', error.message);
    return buildManualResults(query);
  }
}

function buildManualResults(query) {
  const encodedQuery = encodeURIComponent(query);
  return [{
    id: 'search',
    title: `תוצאות חיפוש עבור: ${query}`,
    price: 'מחירים שונים',
    link: `https://www.aliexpress.com/wholesale?SearchText=${encodedQuery}&SortType=total_tranpro_desc&aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key=${ALI_TRACKING_ID}&terminal_id=${ALI_APP_KEY}`
  }];
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
  if (products.length === 1 && products[0].id === 'search') {
    return `🛍️ לחץ כאן לחיפוש *${query}* באלי אקספרס:\n\n${products[0].link}\n\n_קנייה דרך הלינק תומכת בקבוצה_ 🤝`;
  }

  let msg = `🛍️ מצאתי מוצרים עבור: *${query}*\n\n`;
  products.forEach((product, index) => {
    msg += `${index + 1}. ${product.title}\n`;
    msg += `💰 מחיר: $${product.price}\n`;
    msg += `🔗 ${product.link}\n\n`;
  });
  msg += `_כל הלינקים עם הטבות שותפים_ 🤝`;
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

    await sendWhatsAppMessage(chatId, `🔍 מחפש *${searchQuery}* באלי אקספרס... רגע אחד!`);
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
