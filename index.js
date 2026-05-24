const express = require('express');
const axios = require('axios');

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================
   GREEN API
========================= */

const INSTANCE_ID = '7107614702';

const API_TOKEN =
  'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';

const GREEN_API_URL =
  `https://7107.api.greenapi.com/waInstance${INSTANCE_ID}`;

/* =========================
   AFFILIATE
========================= */

const ALI_TRACKING_ID = 'bot01';

const ALI_APP_KEY = '533908';

/* =========================
   CACHE
========================= */

const cache = {};

/* =========================
   TRIGGERS
========================= */

const TRIGGERS = [
  'אני מחפש',
  'חפש לי',
  'מחפש',
  'אני צריך'
];

/* =========================
   HELPERS
========================= */

function cleanQuery(text) {

  return text
    .replace('אני מחפש', '')
    .replace('חפש לי', '')
    .replace('מחפש', '')
    .replace('אני צריך', '')
    .replace('בזול', '')
    .replace('טוב', '')
    .trim();
}

function buildAffiliateLink(query) {

  const encoded = encodeURIComponent(query);

  return (
    `https://www.aliexpress.com/wholesale?SearchText=${encoded}` +
    `&SortType=total_tranpro_desc` +
    `&aff_platform=portals-tool` +
    `&sk=_dV4Bh9T` +
    `&aff_trace_key=${ALI_TRACKING_ID}` +
    `&terminal_id=${ALI_APP_KEY}`
  );
}

/* =========================
   SEARCH
========================= */

async function searchProducts(query) {

  if (cache[query]) {

    console.log('CACHE');

    return cache[query];
  }

  const encodedQuery = encodeURIComponent(query);

  const url =
    `https://www.aliexpress.com/wholesale?SearchText=${encodedQuery}`;

  try {

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 5000
    });

    const html = response.data;

    const regex =
      /"title":"(.*?)".*?"minPrice":"(.*?)"/gs;

    const products = [];

    let match;

    let count = 0;

    while ((match = regex.exec(html)) !== null && count < 4) {

      const title = match[1]
        .replace(/\\"/g, '')
        .substring(0, 60);

      const price = match[2];

      products.push({
        title,
        price
      });

      count++;
    }

    if (products.length === 0) {

      products.push({
        title: `חיפוש עבור ${query}`,
        price: 'בדוק באתר'
      });
    }

    cache[query] = products;

    return products;

  } catch (error) {

    console.log(error.message);

    return [
      {
        title: `חיפוש עבור ${query}`,
        price: 'בדוק באתר'
      }
    ];
  }
}

/* =========================
   SEND MESSAGE
========================= */

async function sendMessage(chatId, message) {

  try {

    await axios.post(
      `${GREEN_API_URL}/sendMessage/${API_TOKEN}`,
      {
        chatId,
        message
      }
    );

  } catch (error) {

    console.log(error.message);
  }
}

/* =========================
   BUILD MESSAGE
========================= */

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
    `🔗 לינק:\n` +
    `${buildAffiliateLink(query)}\n\n` +
    `🤝 קנייה דרך הלינק תומכת בבוט`;

  return msg;
}

/* =========================
   WEBHOOK
========================= */

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

    const triggered = TRIGGERS.some(word =>
      text.includes(word)
    );

    if (!triggered) {
      return;
    }

    const query = cleanQuery(text);

    if (!query) {

      await sendMessage(
        chatId,
        '❌ תכתוב למשל:\nאני מחפש אוזניות'
      );

      return;
    }

    await sendMessage(
      chatId,
      `🔍 מחפש עכשיו:\n${query}`
    );

    const products =
      await searchProducts(query);

    const message =
      buildMessage(query, products);

    await sendMessage(chatId, message);

  } catch (error) {

    console.log(error.message);
  }
});

/* =========================
   HOME
========================= */

app.get('/', (req, res) => {

  res.send('BOT WORKING');
});

/* =========================
   START
========================= */

app.listen(PORT, () => {

  console.log(`RUNNING ${PORT}`);
});
