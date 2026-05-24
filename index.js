require('dotenv').config(); const express = require('express'); const axios = require('axios'); const crypto = require('crypto');

const app = express(); app.use(express.json({ limit: '20mb' }));

// ================= CONFIG ================= const CONFIG = { port: process.env.PORT || 3000,

whatsapp: { instanceId: process.env.INSTANCE_ID, apiToken: process.env.API_TOKEN, baseUrl: https://${process.env.INSTANCE_ID?.slice(0,4)}.api.greenapi.com },

aliexpress: { appKey: process.env.ALI_APP_KEY, appSecret: process.env.ALI_APP_SECRET, trackingId: process.env.ALI_TRACKING_ID },

gemini: { apiKey: process.env.GEMINI_KEY, model: 'gemini-2.0-flash' } };

// ================= MEMORY ================= const CACHE = new Map(); const USER_MEMORY = new Map();

function setCache(key, value, ttl = 1000 * 60 * 60) { CACHE.set(key, { value, expires: Date.now() + ttl }); }

function getCache(key) { const item = CACHE.get(key); if (!item) return null;

if (Date.now() > item.expires) { CACHE.delete(key); return null; }

return item.value; }

// ================= HELPERS ================= function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function sanitizeTitle(title = '') { return title .replace(/2025|HOT SALE|NEW|FREE SHIPPING|Best Seller/gi, '') .replace(/\s+/g, ' ') .trim(); }

function isAccessory(title = '') { const blocked = [ 'case', 'cover', 'strap', 'holder', 'protector', 'sticker', 'repair', 'cleaner', 'film', 'cable' ];

return blocked.some(word => title.toLowerCase().includes(word) ); }

function semanticScore(title, keywords) { const t = title.toLowerCase(); const words = keywords.toLowerCase().split(' ');

let matches = 0;

for (const word of words) { if (t.includes(word)) matches++; }

return matches / Math.max(words.length, 1); }

function buildAffiliateLink(productId) { return https://www.aliexpress.com/item/${productId}.html?aff_platform=portals-tool&aff_trace_key=${CONFIG.aliexpress.trackingId}; }

// ================= GEMINI ================= async function askGemini(prompt) { const url = https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.gemini.model}:generateContent?key=${CONFIG.gemini.apiKey};

const response = await axios.post(url, { contents: [ { parts: [{ text: prompt }] } ] }, { timeout: 12000 });

return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || ''; }

async function analyzeIntent(hebrewText) { const cached = getCache('intent_' + hebrewText); if (cached) return cached;

try { const prompt = ` You are an AI commerce engine.

Hebrew message: ${hebrewText}

Return ONLY JSON: { "intent":"what user wants", "category":"electronics|automotive|fashion|home|tools|other", "keywords":["query1","query2","query3"], "required":["word1","word2"], "blocked":["case","cover","strap"] } `;

const raw = await askGemini(prompt);

const cleaned = raw
  .replace(/```json/g, '')
  .replace(/```/g, '')
  .trim();

const parsed = JSON.parse(cleaned);

setCache('intent_' + hebrewText, parsed, 1000 * 60 * 60 * 24);

return parsed;

} catch (err) { console.log('Gemini error:', err.message);

return {
  intent: hebrewText,
  category: 'other',
  keywords: [hebrewText],
  required: [],
  blocked: ['case', 'cover', 'strap']
};

} }

// ================= ALIEXPRESS ================= async function searchAliExpress(query) { try { const timestamp = Date.now().toString();

const params = {
  app_key: CONFIG.aliexpress.appKey,
  method: 'aliexpress.affiliate.product.query',
  sign_method: 'md5',
  timestamp,
  v: '2.0',
  tracking_id: CONFIG.aliexpress.trackingId,
  keywords: query,
  page_size: '20',
  sort: 'LAST_VOLUME_DESC',
  fields: 'product_id,product_title,sale_price,evaluate_rate,lastest_volume,product_main_image_url,promotion_link'
};

const keys = Object.keys(params).sort();

let signString = CONFIG.aliexpress.appSecret;

for (const key of keys) {
  signString += key + params[key];
}

signString += CONFIG.aliexpress.appSecret;

params.sign = crypto
  .createHash('md5')
  .update(signString)
  .digest('hex')
  .toUpperCase();

const qs = new URLSearchParams(params).toString();

const url = `https://api-sg.aliexpress.com/sync?${qs}`;

const response = await axios.get(url, {
  timeout: 15000
});

return response.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];

} catch (err) { console.log('AliExpress error:', err.message); return []; } }

// ================= PRODUCT ENGINE ================= async function aiCommerceSearch(userText) { console.log('\n=============================='); console.log('SEARCH:', userText); console.log('==============================');

const cacheKey = 'search_' + userText; const cached = getCache(cacheKey);

if (cached) { console.log('Cache hit'); return cached; }

// STEP 1 const intent = await analyzeIntent(userText);

console.log('Intent:', intent.intent); console.log('Queries:', intent.keywords.join(', '));

// STEP 2 const allProducts = []; const seen = new Set();

for (const query of intent.keywords.slice(0, 3)) { const products = await searchAliExpress(query);

for (const product of products) {
  const id = product.product_id;

  if (!id || seen.has(id)) continue;

  seen.add(id);
  allProducts.push(product);
}

}

console.log('Products found:', allProducts.length);

// STEP 3 FILTER const filtered = allProducts .map(product => { const title = sanitizeTitle(product.product_title || '');

if (!title) return null;

  if (isAccessory(title)) return null;

  if (intent.blocked.some(word =>
    title.toLowerCase().includes(word.toLowerCase())
  )) {
    return null;
  }

  const overlap = semanticScore(
    title,
    intent.keywords[0]
  );

  const rating = parseFloat(product.evaluate_rate || 80) / 100;
  const sales = Math.log10(parseInt(product.lastest_volume || 1) + 1);

  const score =
    overlap * 0.5 +
    rating * 0.3 +
    sales * 0.2;

  return {
    ...product,
    cleanTitle: title,
    score
  };
})
.filter(Boolean)
.sort((a, b) => b.score - a.score)
.slice(0, 2);

// STEP 4 FINAL FORMAT const finalProducts = filtered.map(product => ({ id: product.product_id, title: product.cleanTitle, image: product.product_main_image_url, priceUsd: product.sale_price, rating: product.evaluate_rate, sales: product.lastest_volume, affiliate: buildAffiliateLink(product.product_id) }));

const result = { intent, products: finalProducts };

setCache(cacheKey, result);

return result; }

// ================= WHATSAPP ================= async function sendMessage(chatId, message) { try { const url = ${CONFIG.whatsapp.baseUrl}/waInstance${CONFIG.whatsapp.instanceId}/sendMessage/${CONFIG.whatsapp.apiToken};

await axios.post(url, {
  chatId,
  message
});

} catch (err) { console.log('WhatsApp send error:', err.message); } }

async function sendImage(chatId, imageUrl, caption) { try { const url = ${CONFIG.whatsapp.baseUrl}/waInstance${CONFIG.whatsapp.instanceId}/sendFileByUrl/${CONFIG.whatsapp.apiToken};

await axios.post(url, {
  chatId,
  urlFile: imageUrl,
  fileName: 'product.jpg',
  caption
});

} catch (err) { console.log('Image send error:', err.message);

if (caption) {
  await sendMessage(chatId, caption);
}

} }

// ================= WEBHOOK ================= app.post('/webhook', async (req, res) => { res.sendStatus(200);

try { const body = req.body;

if (!body?.messageData?.textMessageData?.textMessage) {
  return;
}

const text = body.messageData.textMessageData.textMessage;
const chatId = body.senderData.chatId;

const triggers = [
  'אני מחפש',
  'חפש לי',
  'אני צריך',
  'תמצא לי',
  'מחפש'
];

const matched = triggers.find(t => text.includes(t));

if (!matched) return;

let query = text;

for (const t of triggers) {
  query = query.replace(t, '').trim();
}

if (query.length < 2) {
  await sendMessage(chatId, 'תכתוב למשל: אני מחפש אוזניות בלוטות');
  return;
}

await sendMessage(chatId, `🔍 מחפש עכשיו: ${query}`);

const result = await aiCommerceSearch(query);

if (!result.products.length) {
  await sendMessage(chatId, '😕 לא מצאתי מוצרים טובים');
  return;
}

for (let i = 0; i < result.products.length; i++) {
  const p = result.products[i];

  const caption =

`🛒 ${i + 1}

${p.title}

💰 $${p.priceUsd} ⭐ ${p.rating} 📦 ${p.sales} sales

🔗 ${p.affiliate}`;

await sendImage(chatId, p.image, caption);

  await sleep(1200);
}

} catch (err) { console.log('Webhook error:', err.message); } });

// ================= HEALTH ================= app.get('/', (_, res) => { res.send('AI Commerce Engine Running'); });

// ================= START ================= app.listen(CONFIG.port, () => { console.log('===================================='); console.log('AI COMMERCE ENGINE STARTED'); console.log('PORT:', CONFIG.port); console.log('===================================='); });
