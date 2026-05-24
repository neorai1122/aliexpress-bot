const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(express.json());

/* =========================
   CONFIG
========================= */

const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';

const GREEN_API_URL =
  `https://7107.api.greenapi.com/waInstance${INSTANCE_ID}`;

const ALI_TRACKING_ID = 'bot01';
const ALI_APP_KEY = '533908';

/* =========================
   CACHE
========================= */

const cache = {};
const CACHE_TIME = 1000 * 60 * 5;

/* =========================
   TRIGGERS
========================= */

const TRIGGER_WORDS = [
  'אני מחפש',
  'חפש לי',
  'מישהו מכיר',
  'אני צריך',
  'מחפש'
];

/* =========================
   HEADERS
========================= */

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

/* =========================
   HELPERS
========================= */

function buildAffiliateLink(productId) {
  return `https://www.aliexpress.com/item/${productId}.html?aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key=${ALI_TRACKING_ID}&terminal_id=${ALI_APP_KEY}`;
}

function cleanQuery(query) {
  return query
    .replace(/בזול/g, '')
    .replace(/טובות/g, '')
    .replace(/טוב/g, '')
    .replace(/איכותיות/g, '')
    .replace(/הכי טוב/g, '')
    .replace(/אפשר/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildManualResults(query) {
  const encodedQuery = encodeURIComponent(query);

  return [
    {
      id: 'search',
      title: `חיפוש עבור ${query}`,
      price: 'מחירים שונים',
      link:
        `https://www.aliexpress.com/wholesale?SearchText=${encodedQuery}` +
        `&SortType=total_tranpro_desc` +
        `&aff_platform=portals-tool` +
        `&sk=_dV4Bh9T` +
        `&aff_trace_key=${ALI_TRACKING_ID}` +
        `&terminal_id=${ALI_APP_KEY}`
    }
  ];
}

/* =========================
   SEARCH FUNCTION
========================= */

async function searchAliExpress(query) {

  const cleanedQuery = cleanQuery(query);

  /* ========= CACHE ========= */

  if (cache[cleanedQuery]) {

    const cacheData = cache[cleanedQuery];

    if (Date.now() - cacheData.timestamp < CACHE_TIME) {
      console.log('⚡ CACHE HIT:', cleanedQuery);
      return cacheData.products;
    }
  }

  const encodedQuery = encodeURIComponent(cleanedQuery);

  const searchUrl =
    `https://www.aliexpress.com/wholesale?SearchText=${encodedQuery}&SortType=total_tranpro_desc`;

  /* ========= RETRY ========= */

  for (let attempt = 1; attempt <= 3; attempt++) {

    try {

      console.log(`🔍 ניסיון ${attempt}: ${cleanedQuery}`);

      const response = await axios.get(searchUrl, {
        headers: HEADERS,
        timeout: 6000
      });

      const html = response.data;

      /* ========= BLOCK DETECTION ========= */

      if (
        html.includes('captcha') ||
        html.includes('punish') ||
        html.includes('robot')
      ) {

        console.log('❌ AliExpress Anti Bot');

        await sleep(1000);

        continue;
      }

      const products = [];

      /* ========= JSON REGEX ========= */

      const regex =
        /"productId":"(\d+)".*?"title":"(.*?)".*?"minPrice":"(.*?)"/gs;

      let match;
      let count = 0;

      while ((match = regex.exec(html)) !== null && count < 4) {

        const productId = match[1];

        let title = match[2]
          .replace(/\\u[\dA-F]{4}/gi, '')
          .replace(/\\"/g, '')
          .replace(/&quot;/g, '')
          .replace(/&#39;/g, "'")
          .substring(0, 80);

        const price = match[3];

        if (!title || title.length < 5) {
          continue;
        }

        products.push({
          id: productId,
          title,
          price,
          link: buildAffiliateLink(productId)
        });

        count++;
      }

      /* ========= CHEERIO FALLBACK ========= */

      if (products.length === 0) {

        const $ = cheerio.load(html);

        $('a').each((i, el) => {

          if (products.length >= 4) {
            return false;
          }

          const href = $(el).attr('href') || '';
          const text = $(el).text().trim();

          if (
            href.includes('/item/') &&
            text.length > 10
          ) {

            const productIdMatch = href.match(/\/item\/(\d+)/);

            if (!productIdMatch) {
              return;
            }

            const productId = productIdMatch[1];

            products.push({
              id: productId,
              title: text.substring(0, 80),
              price: 'בדוק מחיר',
              link: buildAffiliateLink(productId)
            });
          }
        });
      }

      /* ========= SUCCESS ========= */

      if (products.length > 0) {

        cache[cleanedQuery] = {
          timestamp: Date.now(),
          products
        };

        console.log(`✅ נמצאו ${products.length} מוצרים`);

        return products;
      }

    } catch (error) {

      console.log(`❌ שגיאה בניסיון ${attempt}:`, error.message);

      await sleep(1000);
    }
  }

  console.log('⚠️ מעבר לחיפוש ידני');

  return buildManualResults(cleanedQuery);
}

/* =========================
   SEND MESSAGE
========================= */

async function sendWhatsAppMessage(chatId, message) {

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

    console.log('❌ שגיאה בשליחה:', error.message);
  }
}

/* =========================
   BUILD MESSAGE
========================= */

function buildMessage(products, query) {

  if (
    products.length === 1 &&
    products[0].id === 'search'
  ) {

    return (
      `🛍️ לא מצאתי תוצאות מדויקות.\n\n` +
      `🔍 לחץ לחיפוש עבור:\n` +
      `*${query}*\n\n` +
      `${products[0].link}\n\n` +
      `_קנייה דרך הלינק תומכת בבוט 🤝_`
    );
  }

  let msg =
    `🛍️ מצאתי מוצרים עבור:\n` +
    `*${query}*\n\n`;

  products.forEach((product, index) => {

    msg +=
      `${index + 1}. ${product.title}\n` +
      `💰 מחיר: ${product.price}$\n` +
      `🔗 ${product.link}\n\n`;
  });

  msg += `🤝 כל הלינקים עם שותפים`;

  return msg;
}

/* =========================
   WEBHOOK
========================= */

app.post('/webhook', async (req, res) => {

  res.sendStatus(200);

  try {

    const body = req.body;

    if (!body) {
      return;
    }

    if (body.typeWebhook !== 'incomingMessageReceived') {
      return;
    }

    const messageData = body.messageData;

    if (!messageData) {
      return;
    }

    if (messageData.typeMessage !== 'textMessage') {
      return;
    }

    const text =
      messageData.textMessageData?.textMessage || '';

    const chatId =
      body.senderData?.chatId || '';

    if (!text || !chatId) {
      return;
    }

    console.log(`📩 הודעה חדשה: ${text}`);

    const triggerWord = TRIGGER_WORDS.find(word =>
      text.includes(word)
    );

    if (!triggerWord) {
      return;
    }

    let searchQuery = text;

    for (const word of TRIGGER_WORDS) {

      searchQuery =
        searchQuery.replace(word, '').trim();
    }

    searchQuery = cleanQuery(searchQuery);

    if (!searchQuery || searchQuery.length < 2) {

      await sendWhatsAppMessage(
        chatId,
        '❌ כתוב למשל:\nאני מחפש אוזניות בלוטות'
      );

      return;
    }

    /* ========= FAST RESPONSE ========= */

    await sendWhatsAppMessage(
      chatId,
      `🔍 מחפש עכשיו:\n*${searchQuery}*\n\nרגע אחד...`
    );

    /* ========= SEARCH ========= */

    const products =
      await searchAliExpress(searchQuery);

    /* ========= BUILD ========= */

    const message =
      buildMessage(products, searchQuery);

    /* ========= SEND ========= */

    await sendWhatsAppMessage(chatId, message);

  } catch (error) {

    console.log('❌ WEBHOOK ERROR:', error.message);
  }
});

/* =========================
   HEALTH CHECK
========================= */

app.get('/', (req, res) => {

  res.send(`
    <h1>✅ WhatsApp Bot עובד</h1>
    <p>AliExpress Search Active</p>
  `);
});

/* =========================
   AUTO CLEAN CACHE
========================= */

setInterval(() => {

  const now = Date.now();

  for (const key in cache) {

    if (now - cache[key].timestamp > CACHE_TIME) {

      delete cache[key];
    }
  }

  console.log('🧹 CACHE CLEANED');

}, 1000 * 60);

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(`🚀 BOT RUNNING ON PORT ${PORT}`);
});
