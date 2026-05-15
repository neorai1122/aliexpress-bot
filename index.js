const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(express.json({limit: '50mb'}));

// ===== הגדרות מפתחות וגישה (נהוראי - הכל כאן!) =====
const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const BASE_URL = 'https://7107.api.greenapi.com';
const ALI_APP_KEY = '533908';
const ALI_APP_SECRET = 'iTd8ZOn3s1xmlJ7fXLoe2XYHBkkaF2dF';
const ALI_TRACKING_ID = 'bot01';
const GROQ_API_KEY = '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';
const GROUP_CHAT_ID = '120363424186489979@g.us';
const GROUP_NAME = 'דילים שווים';
const ADMIN_NUMBERS = ['972538800370', '972557119650'];

// --- שער דולר דינמי (מתעדכן אוטומטית) ---
let USD_TO_ILS = 3.75; 
async function updateExchangeRate() {
    try {
        const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
        if (response.data && response.data.rates && response.data.rates.ILS) {
            USD_TO_ILS = response.data.rates.ILS;
            console.log(`✅ שער הדולר עודכן: ${USD_TO_ILS}`);
        }
    } catch (e) { console.error('Exchange rate error'); }
}
updateExchangeRate();
setInterval(updateExchangeRate, 1000 * 60 * 60 * 12);

// --- פונקציית תרגום (לחיפוש ולשמות מוצרים) ---
async function translateText(text, targetLang) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await axios.get(url);
        return res.data[0][0][0];
    } catch (e) { return text; }
}

// --- קיצור לינקים (TinyURL) ---
async function shortenLink(url) {
    try {
        const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
        return res.data;
    } catch (e) { return url; }
}

// --- סוכן בינה מלאכותית (Groq) לייצור שאלות הבהרה ---
async function getAgentClarification(queryHe) {
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "You are an expert shopping assistant. The user wants to find a product on AliExpress. Generate 2 clarification questions in Hebrew to narrow down the search (type, material, style, etc.). Format your response as a JSON: { 'q1': 'question 1', 'options1': ['opt1', 'opt2', 'opt3'], 'q2': 'question 2', 'options2': ['opt1', 'opt2'] }. Only return JSON." },
                { role: "user", content: `The product is: ${queryHe}` }
            ],
            response_format: { type: "json_object" }
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });
        return JSON.parse(response.data.choices[0].message.content);
    } catch (e) { return null; }
}

const userMemory = {};
const searchCount = {};
const frozenUsers = [];
const vipUsers = [];
const warningCount = {};
const popularSearches = {};
const newUserFlow = {};
const agentFlow = {};
const clarificationFlow = {};
let pollActive = false;
let pollVotes = {};
let pollTimeout = null;

// ===== מוצרים דומים לכל קטגוריה =====
const SIMILAR_PRODUCTS = {
  'iphone': ['samsung smartphone', 'xiaomi smartphone', 'android phone', 'redmi phone'],
  'samsung': ['xiaomi smartphone', 'iphone', 'android phone', 'oppo phone'],
  'bluetooth earphones': ['tws earbuds', 'wireless headphones', 'noise cancelling earphones'],
  'tws earbuds': ['bluetooth earphones', 'wireless earphones', 'airpods'],
  'smartwatch': ['fitness tracker', 'sport watch', 'smart band'],
  'laptop': ['tablet', 'mini pc', 'chromebook'],
  'fast charger': ['wireless charger', 'power bank', 'usb hub'],
};

// ===== שאלות הבהרה (המקוריות שלך) =====
const CLARIFICATION = {
  'טלפון': {
    q: '📱 *איזה סוג טלפון?*\n\n1️⃣ אייפון\n2️⃣ סמסונג\n3️⃣ שיאומי\n4️⃣ אנדרואיד כללי\n5️⃣ הכי זול!',
    o: ['iphone smartphone', 'samsung galaxy smartphone', 'xiaomi smartphone', 'android smartphone', 'budget smartphone']
  },
  'אוזניות': {
    q: '🎧 *איזה אוזניות?*\n\n1️⃣ בלוטות אלחוטיות\n2️⃣ TWS כפתור\n3️⃣ ביטול רעשים\n4️⃣ עם חוט\n5️⃣ הכי זולות!',
    o: ['bluetooth earphones wireless', 'tws earbuds wireless', 'noise cancelling headphones', 'wired earphones', 'cheap earphones']
  },
  'שעון': {
    q: '⌚ *איזה שעון?*\n\n1️⃣ שעון חכם\n2️⃣ ספורט\n3️⃣ אנלוגי\n4️⃣ ילדים',
    o: ['smartwatch', 'sport fitness watch', 'analog watch', 'kids smartwatch']
  },
  'מטען': {
    q: '🔌 *איזה מטען?*\n\n1️⃣ מהיר USB-C\n2️⃣ אלחוטי\n3️⃣ פאוורבנק\n4️⃣ רכב',
    o: ['fast charger usb-c 65w', 'wireless charger', 'power bank portable', 'car charger fast']
  },
  'תיק': {
    q: '👜 *איזה תיק?*\n\n1️⃣ תיק גב\n2️⃣ תיק יד\n3️⃣ תיק כתף\n4️⃣ תיק מחשב',
    o: ['backpack', 'handbag women', 'shoulder bag', 'laptop bag']
  },
  'נעליים': {
    q: '👟 *איזה נעליים?*\n\n1️⃣ ספורט\n2️⃣ קז\'ואל\n3️⃣ עקבים\n4️⃣ סנדלים',
    o: ['running sport shoes', 'casual sneakers', 'high heels women', 'sandals summer']
  },
  'מחשב': {
    q: '💻 *איזה מחשב?*\n\n1️⃣ לפטופ\n2️⃣ טאבלט\n3️⃣ גיימינג\n4️⃣ מיני PC',
    o: ['laptop computer', 'android tablet', 'gaming laptop', 'mini pc computer']
  },
  'רמקול': {
    q: '🔊 *איזה רמקול?*\n\n1️⃣ בלוטות נייד\n2️⃣ עמיד למים\n3️⃣ רמקול בית',
    o: ['bluetooth speaker portable', 'waterproof bluetooth speaker', 'home theater speaker']
  },
  'מצלמה': {
    q: '📷 *איזה מצלמה?*\n\n1️⃣ אבטחה\n2️⃣ ספורט\n3️⃣ וידאו',
    o: ['security camera wifi', 'action camera sport', 'video camera 4k']
  }
};

const TRIGGER_WORDS = ['אני מחפש','אני מחפשת','חפש לי','חפשי לי','אני צריך','אני צריכה','מחפש','מחפשת','רוצה לקנות','מישהו מכיר','מישהי מכירה','יש מוצר','תמצאו לי','תביאו לי','תמצא לי','תביא לי'];
const BAD_WORDS = ['זין','כוס','שרמוטה','זונה','מניאק','ממזר','אידיוט','טמבל','מפגר','חרא','בן זונה','בת זונה','fuck','shit','bitch','asshole','bastard','idiot'];
const SPAM_WORDS = ['הצטרפו','קבוצה חדשה','דרושים','טלגרם','השקעה','הרוויחו','ביטקוין','הימור','קזינו'];
const POLL_OPTIONS = ['🎧 אוזניות','⌚ שעונים חכמים','🏠 מוצרי בית','👗 ביגוד','⚽ ספורט','💻 אלקטרוניקה','🧸 צעצועים','🍳 מטבח','💄 יופי','🔧 כלי עבודה'];

const WELCOME_INFO = '👋 *ברוכים הבאים לקבוצת '+GROUP_NAME+'!* 🎉\n\n━━━━━━━━━━━━━━━\n🤖 *איך מחפשים מוצר?*\n━━━━━━━━━━━━━━━\n\nכתוב בקבוצה:\n_"אני מחפש + שם המוצר"_\n\n📌 *דוגמאות:*\n• אני מחפש אוזניות בלוטות\n• מחפשת שעון חכם\n\n🎁 *מה תקבל?*\n• 2 מוצרים מומלצים עם תמונות\n• מחיר בשקלים\n• ביקורות ודירוג כוכבים\n• לינק לרכישה!\n\n⚠️ *כללי הקבוצה:*\n• אסור לקלל — 3 קללות = הוצאה!\n• אסור לפרסם ספאם 🙏\n\n━━━━━━━━━━━━━━━\nכמה שאלות קצרות 👇';
const SURVEY_Q1 = '━━━━━━━━━━━━━━━\n❓ *שאלה 1/3*\n━━━━━━━━━━━━━━━\n\nמה *הכי מחפש/ת*?\n\n1️⃣ אלקטרוניקה\n2️⃣ ביגוד\n3️⃣ מוצרי בית\n4️⃣ ספורט\n5️⃣ הכל!\n\n_ענה/י עם מספר_';
const SURVEY_Q2 = '━━━━━━━━━━━━━━━\n❓ *שאלה 2/3*\n━━━━━━━━━━━━━━━\n\nמה *הגיל* שלך?\n\n1️⃣ 18-25\n2️⃣ 26-35\n3️⃣ 36-45\n4️⃣ 45+\n\n_ענה/י עם מספר_';
const SURVEY_Q3 = '━━━━━━━━━━━━━━━\n❓ *שאלה 3/3*\n━━━━━━━━━━━━━━━\n\nמאיפה *שמעת עלינו*?\n\n1️⃣ חבר/ה\n2️⃣ פייסבוק\n3️⃣ אינסטגרם\n4️⃣ טיקטוק\n5️⃣ אחר\n\n_ענה/י עם מספר_';
const SURVEY_DONE = '━━━━━━━━━━━━━━━\n✅ *תודה! הכל מוכן!*\n━━━━━━━━━━━━━━━\n\n🎉 ברוכים הבאים!\nכתוב/י *אני מחפש + מוצר* ונמצא לך! 🔥';
const Q1A=['','אלקטרוניקה','ביגוד','מוצרי בית','ספורט','הכל'];
const Q2A=['','18-25','26-35','36-45','45+'];
const Q3A=['','חבר/ה','פייסבוק','אינסטגרם','טיקטוק','אחר'];

// --- פונקציות עזר (נהוראי - ללא שינוי) ---
function getPhone(raw){return raw.replace('c.us','').replace('@','').replace('.','').trim();}
function isAdmin(raw){return ADMIN_NUMBERS.indexOf(getPhone(raw))!==-1;}
function isFrozen(raw){return frozenUsers.indexOf(getPhone(raw))!==-1;}
function hasBadWord(t){var l=t.toLowerCase();for(var i=0;i<BAD_WORDS.length;i++)if(l.indexOf(BAD_WORDS[i].toLowerCase())!==-1)return true;return false;}
function hasSpam(t){for(var i=0;i<SPAM_WORDS.length;i++)if(t.indexOf(SPAM_WORDS[i])!==-1)return true;return false;}
function sleep(ms){return new Promise(r => setTimeout(r, ms));}
function getTopSearches(){return Object.keys(popularSearches).sort((a,b) => popularSearches[b]-popularSearches[a]).slice(0,3);}

function getStars(rating){
  var r=parseFloat(rating); if(isNaN(r))return '';
  var stars5=Math.round((r/20)*2)/2;
  var full=Math.floor(stars5);
  var half=(stars5-full)>=0.5?1:0;
  var empty=5-full-half;
  var s=''; for(var i=0;i<full;i++)s+='⭐';
  if(half)s+='✨'; for(var j=0;j<empty;j++)s+='☆';
  return s+' ('+stars5.toFixed(1)+'/5)';
}

// --- מנוע סינון רלוונטיות קפדני (פותר את בעיית האביזרים) ---
const EXCLUDED_WORDS = {
  'iphone': ['case','cover','screen protector','tempered glass','sponge','holder','stand','cable','charger','strap','band','ring','wallet','pouch'],
  'samsung': ['case','cover','screen protector','tempered glass','holder','stand','cable','strap','band'],
  'smartphone': ['case','cover','screen protector','holder','cable'],
};

function isStrictlyRelevant(title, queryEn, priceIls) {
    if (!title || !queryEn) return false;
    const t = title.toLowerCase();
    const q = queryEn.toLowerCase();
    
    // מניעת מוצרים זולים מדי לקטגוריות יקרות
    const highValue = ['phone', 'laptop', 'tablet', 'camera', 'iphone', 'samsung'];
    if (highValue.some(k => q.includes(k)) && priceIls < 300) return false;
    
    const forbidden = ['case', 'cover', 'film', 'glass', 'protector', 'silicone', 'tpu', 'strap', 'cable', 'plug', 'holder'];
    if (!q.includes('case') && !q.includes('cover')) {
        for (let acc of forbidden) if (t.includes(acc)) return false;
    }
    return true;
}

// --- שליחת הודעות (Green API) ---
async function sendMsg(chatId, message) {
    try { await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`, { chatId, message }); }
    catch (e) { console.error('❌ SendMsg Error'); }
}

async function sendImage(chatId, imageUrl, caption) {
    try {
        await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/sendFileByUrl/${API_TOKEN}`, {
            chatId, urlFile: imageUrl, fileName: 'product.jpg', caption: caption || ''
        });
    } catch (e) { if (caption) await sendMsg(chatId, caption); }
}

async function sendTyping(chatId){try{await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/sendTyping/${API_TOKEN}`,{chatId});}catch(e){}}
async function sendToAdmins(msg){for(var i=0;i<ADMIN_NUMBERS.length;i++)await sendMsg(ADMIN_NUMBERS[i]+'@c.us',msg);}
async function removeFromGroup(phone){
    try{await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/removeGroupParticipant/${API_TOKEN}`,{groupId:GROUP_CHAT_ID,participantChatId:phone+'@c.us'});return true;}
    catch(e){return false;}
}

// --- AliExpress API (הלב של הבוט) ---
async function searchAliExpress(queryHe, strict) {
    try {
        const queryEn = await translateText(queryHe, 'en');
        const timestamp = Date.now().toString();
        const params = {
            app_key: ALI_APP_KEY, method: 'aliexpress.affiliate.product.query',
            sign_method: 'md5', timestamp, v: '2.0', keywords: queryEn,
            tracking_id: ALI_TRACKING_ID, page_size: '40', sort: 'LAST_VOLUME_DESC',
            fields: 'product_id,product_title,sale_price,evaluate_rate,lastest_volume,promotion_link,original_price,product_main_image_url'
        };

        const keys = Object.keys(params).sort();
        let signStr = ALI_APP_SECRET;
        for (let k of keys) signStr += k + params[k];
        signStr += ALI_APP_SECRET;
        params.sign = crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase();
        
        const qs = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
        const res = await axios.get(`https://api-sg.aliexpress.com/sync?${qs}`, { timeout: 15000 });
        
        let products = res.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];
        if (products.length === 0) return [];

        let filtered = [];
        for (let p of products) {
            let priceIls = Math.round(parseFloat(p.sale_price) * USD_TO_ILS);
            if (strict && !isStrictlyRelevant(p.product_title, queryEn, priceIls)) continue;
            
            let titleHe = await translateText(p.product_title, 'iw');
            let shortUrl = await shortenLink(p.promotion_link);

            filtered.push({
                title: titleHe.substring(0, 80), price: priceIls,
                originalPrice: Math.round(parseFloat(p.original_price) * USD_TO_ILS),
                sales: p.lastest_volume || 0, rating: p.evaluate_rate || 0,
                link: shortUrl, image: p.product_main_image_url ? (p.product_main_image_url.startsWith('//') ? 'https:' + p.product_main_image_url : p.product_main_image_url) : null
            });
            if (filtered.length >= 2) break;
        }
        return filtered;
    } catch (e) { return []; }
}

async function sendProduct(chatId, product, num) {
    let caption = `━━━━━━━━━━━━━━━\n${num}️⃣ *${product.title}*\n━━━━━━━━━━━━━━━\n`;
    if (product.originalPrice > product.price) {
        let disc = Math.round((1 - product.price / product.originalPrice) * 100);
        caption += `💰 *₪${product.price}* ~~₪${product.originalPrice}~~ 🏷️ -${disc}%\n`;
    } else caption += `💰 מחיר: *₪${product.price}*\n`;
    
    caption += `🚚 משלוח חינם!\n${getStars(product.rating)}\n📦 ${Number(product.sales).toLocaleString()} מכירות\n🔗 ${product.link}\n━━━━━━━━━━━━━━━`;
    if (product.image) await sendImage(chatId, product.image, caption);
    else await sendMsg(chatId, caption);
}

// ===== לוגיקת סוכן AI אינטראקטיבית (החוויה המקסימלית) =====
async function startAgentFlow(senderPhone, senderName, chatId, query) {
    await sendTyping(chatId);
    const clarification = await getAgentClarification(query);
    if (!clarification) { await doFinalSearch(senderPhone, senderName, chatId, query); return; }

    agentFlow[senderPhone] = { query, step: 1, chatId, clarification, answers: [] };
    await sendMsg(chatId, `@${senderName} 🕵️ *הסוכן נכנס לפעולה!*\nשלחתי לך 2 שאלות בפרטי לדיוק החיפוש. נתראה עוד רגע! 😉`);

    let qMsg = `🕵️ *שלום ${senderName}, אני הסוכן האישי שלך!*\n\nבוא נדייק את החיפוש עבור: *"${query}"*\n\n❓ *${clarification.q1}*\n\n`;
    clarification.options1.forEach((opt, i) => qMsg += `${i+1}️⃣ ${opt}\n`);
    await sendMsg(senderPhone + '@c.us', qMsg + `\n_ענה עם מספר_`);
}

async function handleAgentAnswer(senderPhone, senderName, text) {
    const flow = agentFlow[senderPhone]; if (!flow) return false;
    const num = parseInt(text.trim());
    if (flow.step === 1) {
        if (isNaN(num) || num < 1 || num > flow.clarification.options1.length) return true;
        flow.answers.push(flow.clarification.options1[num-1]); flow.step = 2;
        let qMsg = `🕵️ *מעולה!*\n\n❓ *${flow.clarification.q2}*\n\n`;
        flow.clarification.options2.forEach((opt, i) => qMsg += `${i+1}️⃣ ${opt}\n`);
        await sendMsg(senderPhone + '@c.us', qMsg + `\n_ענה עם מספר_`);
        return true;
    }
    if (flow.step === 2) {
        if (isNaN(num) || num < 1 || num > flow.clarification.options2.length) return true;
        flow.answers.push(flow.clarification.options2[num-1]);
        await sendMsg(senderPhone + '@c.us', `✅ *תודה!* אני חוזר לקבוצה עם התוצאות הכי טובות!`);
        await doFinalSearch(senderPhone, senderName, flow.chatId, `${flow.query} ${flow.answers.join(' ')}`);
        delete agentFlow[senderPhone]; return true;
    }
    return false;
}

async function doFinalSearch(senderPhone, senderName, chatId, finalQuery) {
    await sendMsg(chatId, `🕵️ *הסוכן חזר!* @${senderName}, הנה מה שמצאתי עבור "${finalQuery}" 👇`);
    const products = await searchAliExpress(finalQuery, true);
    if (products.length > 0) {
        for (let i = 0; i < products.length; i++) {
            await sendProduct(chatId, products[i], i + 1);
            await sleep(1000);
        }
    } else await sendMsg(chatId, `😕 לא מצאתי מוצר מספיק איכותי עבור "${finalQuery}".`);
}

// ===== שאלון חבר חדש (Survey Logic) =====
async function startNewUserFlow(phone, name) {
    newUserFlow[phone] = { step: 1, name, answers: {} };
    await sendMsg(phone + '@c.us', WELCOME_INFO);
    await sleep(2000);
    await sendMsg(phone + '@c.us', SURVEY_Q1);
}

async function handleNewUserAnswer(phone, name, text) {
    const flow = newUserFlow[phone]; if (!flow) return false;
    const num = parseInt(text.trim());
    if (flow.step === 1) {
        if (isNaN(num) || num < 1 || num > 5) { await sendMsg(phone + '@c.us', '⚠️ בחר 1-5'); return true; }
        flow.answers.q1 = Q1A[num]; flow.step = 2;
        await sendMsg(phone + '@c.us', SURVEY_Q2); return true;
    }
    if (flow.step === 2) {
        if (isNaN(num) || num < 1 || num > 4) { await sendMsg(phone + '@c.us', '⚠️ בחר 1-4'); return true; }
        flow.answers.q2 = Q2A[num]; flow.step = 3;
        await sendMsg(phone + '@c.us', SURVEY_Q3); return true;
    }
    if (flow.step === 3) {
        if (isNaN(num) || num < 1 || num > 5) { await sendMsg(phone + '@c.us', '⚠️ בחר 1-5'); return true; }
        flow.answers.q3 = Q3A[num]; flow.step = 0;
        await sendMsg(phone + '@c.us', SURVEY_DONE);
        await sendToAdmins(`📋 *חבר/ה חדש/ה!* \n👤 ${name} \n🔍 ${flow.answers.q1} \n📣 ${flow.answers.q3}`);
        delete newUserFlow[phone]; return true;
    }
    return false;
}

// ===== פונקציות ניהול (Admin Commands) =====
async function handleAdmin(text, chatId) {
    const cmd = text.trim();
    if (cmd === '!דיל') { await sendDeal(); return; }
    if (cmd === '!סקר') { await startPoll(); return; }
    if (cmd === '!מצב') { await sendMsg(chatId, `📊 *סטטוס:* ${frozenUsers.length} מוקפאים`); return; }
    if (cmd === '!בוקר') { await sendMsg(GROUP_CHAT_ID, '━━━━━━━━━━━━━━━\n☀️ *בוקר טוב!*\n━━━━━━━━━━━━━━━'); return; }
    if (cmd === '!ערב') { await sendMsg(GROUP_CHAT_ID, '━━━━━━━━━━━━━━━\n🌙 *ערב טוב!*\n━━━━━━━━━━━━━━━'); return; }
    if (cmd.startsWith('!הקפא ')) { frozenUsers.push(cmd.split(' ')[1]); await sendMsg(chatId, '✅ הוקפא'); return; }
    if (cmd === '!עזרה') { await sendMsg(chatId, '!דיל !סקר !מלך !מצב !הקפא !שחרר !VIP !בוקר !ערב'); return; }
}

async function startPoll() {
    pollActive = true; for (let i = 1; i <= POLL_OPTIONS.length; i++) pollVotes[i] = 0;
    let msg = `━━━━━━━━━━━━━━━\n📊 *סקר שבועי!*\n━━━━━━━━━━━━━━━\n\n`;
    POLL_OPTIONS.forEach((opt, i) => msg += `${i+1}. ${opt}\n`);
    msg += `\n✍️ *ענו עם המספר!*`;
    await sendMsg(GROUP_CHAT_ID, msg);
}

async function sendDeal() {
    const products = await searchAliExpress('hot sale gadget', false);
    if (products.length > 0) {
        await sendMsg(GROUP_CHAT_ID, `🔥 *דיל היום מהסוכן!* 🔥`);
        await sendProduct(GROUP_CHAT_ID, products[0], 1);
    }
}

async function announceKing() {
    let king = null, max = 0;
    for (let p in searchCount) if (searchCount[p] > max) { max = searchCount[p]; king = p; }
    if (king) await sendMsg(GROUP_CHAT_ID, `👑 *מלך הקבוצה:* @${king} עם ${max} חיפושים! 🏆`);
}

// ===== Webhook Handler (הכל כאן!) =====
app.post('/webhook', async (req, res) => {
    res.sendStatus(200);
    try {
        const body = req.body; if (!body) return;
        const sd = body.senderData || {};
        const senderRaw = sd.sender || '';
        const senderPhone = getPhone(senderRaw);
        const senderName = sd.senderName || 'חבר';
        const chatId = sd.chatId || '';

        if (body.typeWebhook === 'groupParticipantsAdded') {
            await startNewUserFlow(senderPhone, senderName); return;
        }

        if (body.typeWebhook !== 'incomingMessageReceived') return;
        const md = body.messageData || {};
        if (md.typeMessage !== 'textMessage') return;
        const text = md.textMessageData.textMessage;

        if (chatId.includes('@c.us')) {
            if (newUserFlow[senderPhone]) { await handleNewUserAnswer(senderPhone, senderName, text); return; }
            if (agentFlow[senderPhone]) { await handleAgentAnswer(senderPhone, senderName, text); return; }
        }

        if (isAdmin(senderRaw) && text.startsWith('!')) { await handleAdmin(text, chatId); return; }
        if (isFrozen(senderRaw)) return;
        if (hasBadWord(text)) {
            warningCount[senderPhone] = (warningCount[senderPhone] || 0) + 1;
            if (warningCount[senderPhone] >= 3) { await removeFromGroup(senderPhone); frozenUsers.push(senderPhone); }
            else await sendMsg(chatId, `⚠️ @${senderName} אזהרה ${warningCount[senderPhone]}/3!`);
            return;
        }

        let triggerFound = false, searchQuery = text;
        for (let t of TRIGGER_WORDS) {
            if (text.includes(t)) {
                triggerFound = true;
                searchQuery = text.replace(t, '').trim();
                break;
            }
        }

        if (triggerFound && searchQuery.length > 1) {
            await startAgentFlow(senderPhone, senderName, chatId, searchQuery);
        }

    } catch (e) { console.error('Error'); }
});

app.get('/', (req, res) => res.send('🤖 Full AI Shopping Agent is Online!'));
app.listen(process.env.PORT || 3000, () => {
    console.log('🚀 הבוט המלא פועל!');
    setInterval(() => axios.get('https://aliexpress-bot-brr6.onrender.com').catch(() => {}), 25000);
});
