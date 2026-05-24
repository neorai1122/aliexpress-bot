# app.js

```js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '50mb' }));

// ===== CONFIG =====
const INSTANCE_ID = 'YOUR_INSTANCE_ID';
const API_TOKEN = 'YOUR_GREEN_API_TOKEN';
const BASE_URL = `https://api.green-api.com`;

const ALI_APP_KEY = 'YOUR_ALI_KEY';
const ALI_SECRET = 'YOUR_ALI_SECRET';
const TRACKING_ID = 'bot01';

const GEMINI_KEY = 'YOUR_GEMINI_KEY';

// ===== CACHE =====
const CACHE = {};

function setCache(key, value) {
  CACHE[key] = {
    value,
    expire: Date.now() + 1000 * 60 * 60
  };
}

function getCache(key) {
  const item = CACHE[key];

  if (!item) return null;

  if (Date.now() > item.expire) {
    delete CACHE[key];
    return null;
  }

  return item.value;
}

// ===== HEBREW MAP =====
const HEBREW_MAP = {
  'גאנטים': 'alloy wheel rim',
  'גנטים': 'alloy wheel rim',
  'ג׳אנטים': 'alloy wheel rim',
  'אוזניות': 'wireless earbuds',
  'אוזניות בלוטוס': 'bluetooth earbuds',
  'שעון': 'smartwatch',
  'מטען': 'fast charger',
  'רמקול': 'bluetooth speaker',
  'מקרן': 'mini projector',
  'עכבר': 'gaming mouse',
  'מקלדת': 'mechanical keyboard'
};

// ===== BLOCKED WORDS =====
const BLOCKED = [
  'case',
  'cover',
  'strap',
  'screen protector',
  'replacement',
  'holder',
  'sticker',
  'cap',
  'repair',
  'adapter'
];

// ===== HELPERS =====
function cleanText(text) {
  return text
    .replace('אני מחפש', '')
    .replace('מחפש', '')
    .replace('חפש לי', '')
    .trim();
}

function mapHebrew(text) {
  for (const key in HEBREW_MAP) {
    if (text.includes(key)) {
      return HEBREW_MAP[key];
    }
  }

  return text;
}

async function sendMessage(chatId, message) {
  try {
    await axios.post(
      `${BASE_URL}/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`,
      {
        chatId,
        message
      }
    );
  } catch (e) {
    console.log(e.message);
  }
}

async function sendImage(chatId, image, caption) {
  try {
    await axios.post(
      `${BASE_URL}/waInstance${INSTANCE_ID}/sendFileByUrl/${API_TOKEN}`,
      {
        chatId,
        urlFile: image,
        fileName: 'product.jpg',
        caption
      }
    );
  } catch (e) {
    console.log(e.message);
  }
}

// ===== GEMINI =====
async function understandIntent(hebrew) {
  const cached = getCache(hebrew);

  if (cached) return cached;

  try {
    const prompt = `
Translate this Hebrew shopping request into perfect AliExpress English keywords.

Hebrew:
${hebrew}

Return ONLY short search keywords.
`;

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      }
    );

    const keyword = res.data.candidates[0].content.parts[0].text
      .replace(/\n/g, ' ')
      .trim();

    setCache(hebrew, keyword);

    return keyword;
  } catch (e) {
    return mapHebrew(hebrew);
  }
}

// ===== ALIEXPRESS SEARCH =====
async function searchAliExpress(keywords) {
  try {
    const timestamp = Date.now().toString();

    const params = {
      app_key: ALI_APP_KEY,
      method: 'aliexpress.affiliate.product.query',
      sign_method: 'md5',
      timestamp,
      v: '2.0',
      keywords,
      tracking_id: TRACKING_ID,
      page_size: '20',
      sort: 'LAST_VOLUME_DESC',
      fields:
        'product_id,product_title,sale_price,evaluate_rate,lastest_volume,promotion_link,product_main_image_url'
    };

    const keys = Object.keys(params).sort();

    let sign = ALI_SECRET;

    for (const key of keys) {
      sign += key + params[key];
    }

    sign += ALI_SECRET;

    params.sign = crypto
      .createHash('md5')
      .update(sign, 'utf8')
      .digest('hex')
      .toUpperCase();

    const query = Object.keys(params)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');

    const response = await axios.get(
      `https://api-sg.aliexpress.com/sync?${query}`
    );

    return (
      response.data?.aliexpress_affiliate_product_query_response?.resp_result
        ?.result?.products?.product || []
    );
  } catch (e) {
    console.log(e.message);
    return [];
  }
}

// ===== FILTER =====
function filterProducts(products, keyword) {
  return products.filter(product => {
    const title = (product.product_title || '').toLowerCase();

    if (BLOCKED.some(w => title.includes(w))) {
      return false;
    }

    if (!title.includes(keyword.split(' ')[0].toLowerCase())) {
      return false;
    }

    const price = parseFloat(product.sale_price || 0);

    if (price < 1) {
      return false;
    }

    return true;
  });
}

// ===== RANK =====
function rankProducts(products) {
  return products
    .map(product => {
      const sales = parseFloat(product.lastest_volume || 0);
      const rating = parseFloat(product.evaluate_rate || 80);

      const score = sales * 0.7 + rating * 0.3;

      return {
        ...product,
        score
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

// ===== MESSAGE =====
function buildMessage(product, index) {
  return `
━━━━━━━━━━━━━━━
${index + 1}. ${product.product_title}
━━━━━━━━━━━━━━━
💰 $${product.sale_price}
⭐ ${product.evaluate_rate}
📦 ${product.lastest_volume} orders
🔗 ${product.promotion_link}
━━━━━━━━━━━━━━━
`;
}

// ===== WEBHOOK =====
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body;

    if (body.typeWebhook !== 'incomingMessageReceived') {
      return;
    }

    const chatId = body.senderData.chatId;

    const text =
      body.messageData?.textMessageData?.textMessage || '';

    if (!text.includes('מחפש')) {
      return;
    }

    await sendMessage(chatId, '🔍 Searching...');

    const clean = cleanText(text);

    let keyword = mapHebrew(clean);

    keyword = await understandIntent(keyword);

    console.log('KEYWORD:', keyword);

    const products = await searchAliExpress(keyword);

    const filtered = filterProducts(products, keyword);

    const ranked = rankProducts(filtered);

    if (!ranked.length) {
      await sendMessage(chatId, '❌ No products found');
      return;
    }

    for (let i = 0; i < ranked.length; i++) {
      const product = ranked[i];

      const msg = buildMessage(product, i);

      await sendImage(
        chatId,
        product.product_main_image_url,
        msg
      );
    }
  } catch (e) {
    console.log(e.message);
  }
});

// ===== ROOT =====
app.get('/', (_, res) => {
  res.send('Bot working');
});

// ===== START =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
```

# package.json

```json
{
  "name": "whatsapp-ai-commerce-bot",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "crypto": "^1.0.1",
    "express": "^4.18.2"
  }
}
```

# Deploy

Upload to Render.

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

Webhook:

```bash
https://YOUR_RENDER_URL/webhook
```
