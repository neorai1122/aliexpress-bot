const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(express.json({limit: '50mb'}));

// ===== הגדרות API =====
const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const BASE_URL = 'https://7107.api.greenapi.com';
const ALI_APP_KEY = '533908';
const ALI_APP_SECRET = 'iTd8ZOn3s1xmlJ7fXLoe2XYHBkkaF2dF';
const ALI_TRACKING_ID = 'bot01';
const GROUP_CHAT_ID = '120363424186489979@g.us';
const GROUP_NAME = 'דילים שווים';
const ADMIN_NUMBERS = ['972538800370', '972557119650'];

// שער דולר דינמי
let USD_TO_ILS = 3.75; 

// פונקציה לעדכון שער הדולר מהאינטרנט
async function updateExchangeRate() {
    try {
        const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
        if (response.data && response.data.rates && response.data.rates.ILS) {
            USD_TO_ILS = response.data.rates.ILS;
            console.log(`✅ שער הדולר עודכן: ${USD_TO_ILS}`);
        }
    } catch (e) {
        console.error('❌ שגיאה בעדכון שער הדולר, משתמש בברירת מחדל');
    }
}
updateExchangeRate();
setInterval(updateExchangeRate, 1000 * 60 * 60 * 12); // עדכון כל 12 שעות

// פונקציה לקיצור לינקים (TinyURL)
async function shortenLink(url) {
    try {
        const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
        return res.data;
    } catch (e) {
        return url; // אם נכשל, מחזיר את הלינק המקורי
    }
}

const userMemory = {};
const searchCount = {};
const frozenUsers = [];
const vipUsers = [];
const warningCount = {};
const popularSearches = {};
const newUserFlow = {};
const clarificationFlow = {};
let pollActive = false;
let pollVotes = {};
let pollTimeout = null;

// ===== מילות חסימה וסינון רלוונטיות =====
const EXCLUDED_WORDS = {
  'iphone': ['case','cover','screen protector','tempered glass','sponge','holder','stand','cable','charger','strap','band','lens','ring','wallet','bag','pouch','cleaning','brush','stylus'],
  'samsung': ['case','cover','screen protector','tempered glass','holder','stand','cable','strap','band','lens','wallet','bag','cleaning'],
  'smartphone': ['case','cover','screen protector','tempered glass','holder','stand','cable','strap','cleaning'],
  'earphones': ['case','cover','holder','stand','cable','tip','foam','eartip','earbud tip'],
  'smartwatch': ['case','cover','strap','band','screen protector','tempered glass','charger cable'],
  'laptop': ['case','cover','sleeve','bag','stand','cooling','keyboard cover','screen protector'],
};

// בדיקת רלוונטיות משופרת (כולל מחיר מינימלי למוצרי אלקטרוניקה)
function isStrictlyRelevant(title, query, priceIls) {
  if (!title || !query) return false;
  var t = title.toLowerCase();
  var q = query.toLowerCase();

  // מניעת מוצרים זולים מדי כשמחפשים טלפונים (פותר את בעיית המגנים/ספוגים)
  const phoneKeywords = ['iphone', 'samsung', 'xiaomi', 'pixel', 'טלפון', 'סמארטפון'];
  const isLookingForPhone = phoneKeywords.some(key => q.includes(key));
  if (isLookingForPhone && priceIls < 250) {
      console.log(`🚫 מוצר נפסל עקב מחיר נמוך מדי לטלפון: ${priceIls} ש"ח`);
      return false;
  }

  // בדוק מילות חסימה רגילות
  for (var key in EXCLUDED_WORDS) {
    if (q.indexOf(key) !== -1) {
      var excList = EXCLUDED_WORDS[key];
      for (var e = 0; e < excList.length; e++) {
        if (t.indexOf(excList[e]) !== -1) return false;
      }
    }
  }

  return true;
}

// ===== שליחת הודעות ותמונות (מתוקן ל-Green API) =====
async function sendMsg(chatId,message){
  try{await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendMessage/'+API_TOKEN,{chatId:chatId,message:message});}
  catch(e){console.error('❌ sendMsg:'+e.message);}
}

async function sendImage(chatId, imageUrl, caption) {
    try {
        // וודא שה-URL תקין
        if (!imageUrl) throw new Error("No image URL provided");
        
        await axios.post(BASE_URL + '/waInstance' + INSTANCE_ID + '/sendFileByUrl/' + API_TOKEN, {
            chatId: chatId,
            urlFile: imageUrl,
            fileName: 'deal.jpg',
            caption: caption || ''
        });
        console.log('✅ תמונה נשלחה בהצלחה');
    } catch (e) {
        console.error('❌ שגיאה בשליחת תמונה:', e.message);
        // אם השליחה נכשלת (למשל לינק תמונה שבור), שלח לפחות את הטקסט
        if (caption) await sendMsg(chatId, caption);
    }
}

// ===== AliExpress API Logic =====
async function searchAliExpress(query, strict) {
  try {
    var timestamp = Date.now().toString();
    var params = {
      app_key: ALI_APP_KEY,
      method: 'aliexpress.affiliate.product.query',
      sign_method: 'md5',
      timestamp: timestamp,
      v: '2.0',
      keywords: query,
      tracking_id: ALI_TRACKING_ID,
      page_size: '20',
      sort: 'LAST_VOLUME_DESC',
      fields: 'product_id,product_title,sale_price,evaluate_rate,lastest_volume,promotion_link,original_price,product_main_image_url'
    };
    
    // יצירת חתימה (Sign)
    var keys = Object.keys(params).sort();
    var signStr = ALI_APP_SECRET;
    for (var i = 0; i < keys.length; i++) signStr += keys[i] + params[keys[i]];
    signStr += ALI_APP_SECRET;
    params.sign = crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase();
    
    var qs = Object.keys(params).map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    var res = await axios.get('https://api-sg.aliexpress.com/sync?' + qs, { timeout: 15000 });
    
    var products = [];
    if (res.data && res.data.aliexpress_affiliate_product_query_response && res.data.aliexpress_affiliate_product_query_response.resp_result) {
        products = res.data.aliexpress_affiliate_product_query_response.resp_result.result.products.product || [];
    }

    if (products.length === 0) return [];

    var filtered = [];
    for (let p of products) {
        let priceIls = Math.round(parseFloat(p.sale_price) * USD_TO_ILS);
        
        // סינון רלוונטיות
        if (strict !== false && !isStrictlyRelevant(p.product_title, query, priceIls)) continue;
        
        // קיצור לינק
        let shortUrl = await shortenLink(p.promotion_link);

        filtered.push({
            title: p.product_title ? p.product_title.substring(0, 70) + "..." : 'מוצר מעולה',
            price: priceIls,
            originalPrice: Math.round(parseFloat(p.original_price) * USD_TO_ILS),
            sales: p.lastest_volume || 0,
            rating: p.evaluate_rate || "95",
            link: shortUrl,
            image: p.product_main_image_url ? (p.product_main_image_url.startsWith('//') ? 'https:' + p.product_main_image_url : p.product_main_image_url) : null
        });

        if (filtered.length >= 2) break; // מספיק לנו 2 מוצרים
    }

    return filtered;
  } catch (e) {
    console.error('שגיאה בחיפוש אליאקספרס:', e.message);
    return [];
  }
}

// ... שאר הפונקציות שלך (doSearch, handleAdmin וכו') נשארות כמעט אותו דבר ...
// שים לב שעדכנתי את sendProduct שישתמש בלינק המקוצר שכבר נמצא בתוך האובייקט product
async function sendProduct(chatId, product, num) {
    var caption = '━━━━━━━━━━━━━━━\n';
    caption += num + '️⃣ *' + product.title + '*\n';
    caption += '━━━━━━━━━━━━━━━\n';
    
    if (product.originalPrice > product.price) {
        let discount = Math.round((1 - product.price / product.originalPrice) * 100);
        caption += `💰 מחיר: *₪${product.price}* ~~₪${product.originalPrice}~~ 🏷️ -${discount}%\n`;
    } else {
        caption += `💰 מחיר: *₪${product.price}*\n`;
    }

    caption += `🚚 משלוח חינם!\n`;
    caption += `📦 ${Number(product.sales).toLocaleString()} מכירות\n`;
    caption += `🔗 ${product.link}\n`;
    caption += '━━━━━━━━━━━━━━━';
    
    if (product.image) {
        await sendImage(chatId, product.image, caption);
    } else {
        await sendMsg(chatId, caption);
    }
}

// ... המשך הקוד המקורי שלך (Webhook handling) ...
