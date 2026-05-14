const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(express.json());

// --- הגדרות מערכת ---
const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const BASE_URL = 'https://7107.api.greenapi.com';
const ALI_APP_KEY = '533908';
const ALI_APP_SECRET = 'iTd8ZOn3s1xmlJ7fXLoe2XYHBkkaF2dF';
const ALI_TRACKING_ID = 'bot01';
const GROUP_CHAT_ID = '120363424186489979@g.us';

// --- מילון תרגום משופר (מומלץ בעתיד להחליף ב-API של גוגל טרנסלייט) ---
const TRANSLATIONS = {
  'אייפון': 'iphone', 'שעון': 'smart watch', 'אוזניות': 'earbuds',
  'מחשב': 'laptop', 'נעליים': 'sneakers', 'בגדים': 'fashion clothes',
  'מטען': 'fast charger', 'טאבלט': 'tablet', 'רמקול': 'bluetooth speaker'
};

// --- פונקציות עזר לתקשורת ---

// שליחת טקסט רגיל
async function sendMsg(chatId, message) {
  try {
    await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`, { chatId, message });
  } catch (e) { console.error('Error sending message:', e.message); }
}

// שליחת תמונה עם כיתוב (הוספה חדשה!)
async function sendImage(chatId, urlFile, caption) {
  try {
    await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/sendFileByUrl/${API_TOKEN}`, {
      chatId: chatId,
      urlFile: urlFile,
      fileName: "product.jpg",
      caption: caption
    });
  } catch (e) { 
    console.error('Error sending image, falling back to text...');
    await sendMsg(chatId, caption); // גיבוי בטקסט אם התמונה נכשלת
  }
}

async function sendTyping(chatId) {
  try { await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/sendTyping/${API_TOKEN}`, { chatId }); } catch (e) {}
}

// --- לוגיקת חיפוש ותרגום ---

function translateToEnglish(text) {
  let r = text.toLowerCase();
  for (let k in TRANSLATIONS) {
    if (r.includes(k)) r = r.replace(k, TRANSLATIONS[k]);
  }
  return r;
}

// חיפוש באלי אקספרס - משופר עם תמונות
async function searchAliExpressOfficial(query) {
  try {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 15) + '000';
    const params = {
      app_key: ALI_APP_KEY,
      method: 'aliexpress.affiliate.product.query',
      sign_method: 'md5',
      timestamp: timestamp,
      v: '2.0',
      keywords: translateToEnglish(query),
      tracking_id: ALI_TRACKING_ID,
      page_size: '3', // מספיק 3 תוצאות טובות
      sort: 'LAST_VOLUME_DESC', // הכי נמכרים
      fields: 'product_id,product_title,sale_price,evaluate_rate,lastest_volume,promotion_link,product_main_image_url'
    };

    // יצירת חתימה (Sign)
    const sortedKeys = Object.keys(params).sort();
    let signStr = ALI_APP_SECRET;
    for (let k of sortedKeys) signStr += k + params[k];
    signStr += ALI_APP_SECRET;
    params.sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();

    const res = await axios.get('https://api-sg.aliexpress.com/sync', { params, timeout: 10000 });
    
    if (res.data?.result?.products?.product) {
      return res.data.result.products.product.map(p => ({
        title: p.product_title.substring(0, 50) + "...",
        price: p.sale_price,
        link: p.promotion_link,
        image: p.product_main_image_url,
        rating: p.evaluate_rate,
        sales: p.lastest_volume
      }));
    }
    return [];
  } catch (e) {
    console.error('AliExpress API Error:', e.message);
    return [];
  }
}

// --- טיפול בהודעות נכנסות ---

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (body.typeWebhook !== 'incomingMessageReceived') return;

  const md = body.messageData;
  if (!md || md.typeMessage !== 'textMessage') return;

  const text = md.textMessageData.textMessage;
  const chatId = body.senderData.chatId;
  const senderName = body.senderData.senderName;

  // בדיקת מילות טריגר
  const TRIGGER_WORDS = ['מחפש', 'תמצא לי', 'אני רוצה', 'יש דיל'];
  let isTriggered = false;
  let query = text;

  for (let t of TRIGGER_WORDS) {
    if (text.includes(t)) {
      isTriggered = true;
      query = query.replace(t, '').trim();
    }
  }

  if (isTriggered && query.length > 1) {
    await sendTyping(chatId);
    
    const products = await searchAliExpressOfficial(query);

    if (products.length === 0) {
        await sendMsg(chatId, `לא מצאתי תוצאה מדויקת ל-"${query}", אבל הנה חיפוש כללי בשבילך: \n https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(query)}`);
        return;
    }

    // שליחת המוצר הראשון עם תמונה (הכי מרשים)
    const topP = products[0];
    const caption = `🔥 *מצאתי לך: ${query}!* \n\n` +
                    `📦 *${topP.title}*\n` +
                    `💰 מחיר: $${topP.price}\n` +
                    `⭐ דירוג: ${topP.rating}\n\n` +
                    `👇 *לרכישה במחיר דיל:* \n${topP.link}`;
    
    await sendImage(chatId, topP.image, caption);

    // אם יש עוד מוצרים, שלח אותם כטקסט קצר
    if (products.length > 1) {
        let extraMsg = "🧐 *עוד אופציות ששווה לבדוק:*\n\n";
        for (let i = 1; i < products.length; i++) {
            extraMsg += `${i+1}️⃣ *${products[i].title}*\n💰 $${products[i].price}\n🔗 ${products[i].link}\n\n`;
        }
        await sendMsg(chatId, extraMsg);
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
