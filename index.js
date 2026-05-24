const express = require('express');
const axios = require('axios');

const app = express();

app.use(express.json());

/* ====================================
   CONFIG
==================================== */

const PORT = process.env.PORT || 3000;

const INSTANCE_ID = '7107614702';

const API_TOKEN =
  'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';

const GREEN_API_URL =
  `https://7107.api.greenapi.com/waInstance${INSTANCE_ID}`;

const ALI_TRACKING_ID = 'bot01';

const ALI_APP_KEY = '533908';

/* ====================================
   CACHE
==================================== */

const cache = {};

const CACHE_TIME = 1000 * 60 * 5;

/* ====================================
   TRIGGERS
==================================== */

const TRIGGERS = [
  'אני מחפש',
  'מחפש',
  'חפש לי',
  'אני צריך',
  'מישהו מכיר'
];

/* ====================================
   HELPERS
==================================== */

function sleep(ms) {

  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanQuery(text) {

  return text
    .replace(/אני מחפש/g, '')
    .replace(/מחפש/g, '')
    .replace(/חפש לי/g, '')
    .replace(/אני צריך/g, '')
    .replace(/מישהו מכיר/g, '')
    .replace(/בזול/g, '')
    .replace(/טוב/g, '')
    .replace(/טובות/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAffiliateLink(query) {

  const encodedQuery = encodeURIComponent(query);

  return (
    `https://www.aliexpress.com/wholesale?SearchText=${encodedQuery}` +
    `&SortType=total_tranpro_desc` +
    `&aff_platform=portals-tool` +
    `&sk=_dV4Bh9T` +
    `&aff_trace_key=${ALI_TRACKING_ID}` +
    `&terminal_id=${ALI_APP_KEY}`
  );
}

/* ====================================
   SEARCH PRODUCTS
==================================== */

async function searchProducts(query) {

  /* CACHE */

  if (cache[query]) {

    const saved = cache[query];

    if (Date.now() - saved.time < CACHE_TIME) {

      console.log('⚡ CACHE');

      return saved.products;
    }
  }

  const encodedQuery = encodeURIComponent(query);

  const searchUrl =
    `https://www.aliexpress.com/wholesale?SearchText=${encodedQuery}`;

  /* RETRY SYSTEM */

  for (let attempt = 1; attempt <= 3; attempt++) {

    try {

      console.log(`🔍 SEARCH ${attempt}: ${query}`);

      const response = await axios.get(searchUrl, {

        headers: {

          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',

          'Accept-Language':
            'en-US,en;q=0.9',

          'Accept':
            'text/html,application/xhtml+xml'
        },

        timeout: 7000
      });

      const html = response.data;

      /* BLOCK DETECT */

      if (
        html.includes('captcha') ||
        html.includes('robot') ||
        html.includes('punish')
      ) {

        console.log('❌ BLOCKED');

        await sleep(1000);

        continue;
      }

      const products = [];

      /* REGEX */

      const regex =
        /"title":"(.*?)".*?"minPrice":"(.*?)"/gs;

      let match;

      let count = 0;

      while ((match = regex.exec(html)) !== null && count < 4) {

        let title = match[1]
          .replace(/\\"/g, '')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/\\u[\dA-F]{4}/gi, '')
          .substring(0, 70);

        let price = match[2];

        if (!title || title.length < 5) {
          continue;
        }

        products.push({
          title,
          price
        });

        count++;
      }

      /* FALLBACK */

      if (products.length === 0) {

        products.push({
          title: `🔍 לחץ לפתיחת החיפוש עבור ${query}`,
          price: 'פתח לינק'
        });
      }

      /* SAVE CACHE */

      cache[query] = {
        time: Date.now(),
        products
      };

      return products;

    } catch (error) {

      console.log('❌ ERROR:', error.message);

      await sleep(1000);
    }
  }

  return [
    {
      title: `🔍 לחץ לפתיחת החיפוש עבור ${query}`,
      price: 'פתח לינק'
    }
  ];
}

/* ====================================
   SEND MESSAGE
==================================== */

async function sendMessage(chatId, message) {

  try {

    await axios.post(

      `${GREEN_API_URL}/sendMessage/${API_TOKEN}`,

      {
        chatId,
        message
      },

      {
        timeout: 5000
      }
    );

  } catch (error) {

    console.log('❌ SEND ERROR:', error.message);
  }
}

/* ====================================
   BUILD MESSAGE
==================================== */

function buildMessage(query, products) {

  let msg =
    `🛍️ מצאתי עבור:\n` +
    `*${query}*\n\n`;

  products.forEach((product, index) => {

    msg +=
      `${index + 1}. ${product.title}\n` +
      `💰 ${product.price}$\n\n`;
  });

  msg +=
    `🔗 לינק לחיפוש:\n` +
    `${buildAffiliateLink(query)}\n\n` +
    `🤝 קנייה דרך הלינק תומכת בבוט`;

  return msg;
}

/* ====================================
   WEBHOOK
==================================== */

app.post('/webhook', async (req, res) => {

  res.sendStatus(200);

  try {

    const body = req.body;

    if (
      !body ||
      body.typeWebhook !== 'incomingMessageReceived'
    ) {
      return;
    }

    const messageData = body.messageData;

    if (
      !messageData ||
      messageData.typeMessage !== 'textMessage'
    ) {
      return;
    }

    const text =
      messageData.textMessageData?.textMessage || '';

    const chatId =
      body.senderData?.chatId || '';

    if (!text || !chatId) {
      return;
    }

    console.log('📩 MESSAGE:', text);

    const triggered = TRIGGERS.some(word =>
      text.includes(word)
    );

    if (!triggered) {
      return;
    }

    const query = cleanQuery(text);

    if (!query || query.length < 2) {

      await sendMessage(
        chatId,
        '❌ תכתוב למשל:\nאני מחפש אוזניות בלוטוס'
      );

      return;
    }

    /* FAST RESPONSE */

    await sendMessage(
      chatId,
      `🔍 מחפש עכשיו:\n*${query}*\n\nרגע אחד...`
    );

    /* SEARCH */

    const products =
      await searchProducts(query);

    /* BUILD */

    const message =
      buildMessage(query, products);

    /* SEND */

    await sendMessage(chatId, message);

  } catch (error) {

    console.log('❌ WEBHOOK ERROR:', error.message);
  }
});

/* ====================================
   HOME
==================================== */

app.get('/', (req, res) => {

  res.send('✅ BOT WORKING');
});

/* ====================================
   CACHE CLEANER
==================================== */

setInterval(() => {

  const now = Date.now();

  for (const key in cache) {

    if (now - cache[key].time > CACHE_TIME) {

      delete cache[key];
    }
  }

  console.log('🧹 CACHE CLEAN');

}, 1000 * 60);

/* ====================================
   START
==================================== */

app.listen(PORT, () => {

  console.log(`🚀 BOT RUNNING ON ${PORT}`);
});
