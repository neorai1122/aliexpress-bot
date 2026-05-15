const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(express.json({limit: '50mb'}));

// ===== הגדרות מאסטר (נהוראי - Gemini Edition) =====
const GROUP_NAME = 'דילים שווים';
const GEMINI_API_KEY = 'AIzaSyClTG4H6M8kt6bj_yl4f8zJQK8R-MZLvks';
const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const BASE_URL = 'https://7107.api.greenapi.com';
const ALI_APP_KEY = '533908';
const ALI_APP_SECRET = 'iTd8ZOn3s1xmlJ7fXLoe2XYHBkkaF2dF';
const ALI_TRACKING_ID = 'bot01';
const GROUP_CHAT_ID = '120363424186489979@g.us';
const ADMIN_NUMBERS = ['972538800370', '972557119650'];

// --- שער דולר דינמי ---
let USD_TO_ILS = 3.75; 
async function updateExchangeRate() {
    try {
        const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
        if (response.data && response.data.rates && response.data.rates.ILS) {
            USD_TO_ILS = response.data.rates.ILS;
        }
    } catch (e) {}
}
updateExchangeRate();
setInterval(updateExchangeRate, 1000 * 60 * 60 * 12);

// --- Gemini AI - המוח של הבוט ---
async function askGemini(prompt) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        return response.data.candidates[0].content.parts[0].text;
    } catch (e) {
        console.error('Gemini Error:', e.message);
        return null;
    }
}

// --- פונקציות תרגום וקיצור ---
async function translateText(text, targetLang) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await axios.get(url);
        return res.data[0][0][0];
    } catch (e) { return text; }
}

async function shortenLink(url) {
    try {
        const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
        return res.data;
    } catch (e) { return url; }
}

// ===== ניהול זיכרון =====
const searchCount = {};
const frozenUsers = [];
const warningCount = {};
const newUserFlow = {};

// ===== נתוני מערכת מורחבים =====
const TRIGGER_WORDS = ['אני מחפש','אני מחפשת','חפש לי','חפשי לי','אני צריך','אני צריכה','מחפש','מחפשת','תמצא לי','תביא לי'];
const BAD_WORDS = ['זין','כוס','שרמוטה','זונה','מניאק','מפגר','חרא','בן זונה','fuck','shit','bitch'];
const POLL_OPTIONS = ['🎧 אוזניות','⌚ שעונים חכמים','🏠 מוצרי בית','👗 ביגוד','💻 אלקטרוניקה'];

const WELCOME_INFO = '👋 *ברוכים הבאים ל-'+GROUP_NAME+'!* 🎉\n\n🤖 *איך מחפשים מוצר?*\nפשוט תכתבו בקבוצה: _"אני מחפש + מוצר"_\n\nהסוכן החכם שלנו (מבוסס Gemini) ימצא לכם את הדיל הכי משתלם ויכתוב עליו המלצה! 🕵️';
const SURVEY_Q1 = '❓ *שאלה 1/2* - מה הכי מעניין אותך?\n1️⃣ אלקטרוניקה\n2️⃣ ביגוד\n3️⃣ הכל!';
const SURVEY_DONE = '✅ *תודה!* אפשר להתחיל לחפש מוצרים! 🔥';

function getPhone(raw){return raw.replace('@c.us','').replace('@g.us','').replace('@','').trim();}
function isAdmin(raw){return ADMIN_NUMBERS.indexOf(getPhone(raw))!==-1;}
function isFrozen(raw){return frozenUsers.indexOf(getPhone(raw))!==-1;}
function hasBadWord(t){var l=t.toLowerCase();for(var i=0;i<BAD_WORDS.length;i++)if(l.indexOf(BAD_WORDS[i])!==-1)return true;return false;}
function sleep(ms){return new Promise(r => setTimeout(r, ms));}

// --- מנוע סינון רלוונטיות (ANTI-ACCESSORIES) ---
function isStrictlyRelevant(title, queryEn, priceIls) {
    if (!title || !queryEn) return false;
    const t = title.toLowerCase();
    const q = queryEn.toLowerCase();
    const highValue = ['phone', 'laptop', 'tablet', 'camera', 'iphone', 'samsung'];
    if (highValue.some(k => q.includes(k)) && priceIls < 250) return false;
    const forbidden = ['case', 'cover', 'glass', 'film', 'protector', 'silicone', 'tpu', 'strap', 'cable', 'holder', 'sticker'];
    if (!q.includes('case') && !q.includes('cover') && !q.includes('cable')) {
        for (let acc of forbidden) if (t.includes(acc)) return false;
    }
    return true;
}

// --- שליחת הודעות ---
async function sendMsg(chatId, message) {
    try { await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`, { chatId, message }); }
    catch (e) {}
}

async function sendImage(chatId, imageUrl, caption) {
    try {
        await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/sendFileByUrl/${API_TOKEN}`, {
            chatId, urlFile: imageUrl, fileName: 'product.jpg', caption: caption || ''
        });
    } catch (e) { if (caption) await sendMsg(chatId, caption); }
}

// --- AliExpress Gemini Engine ---
async function searchAliExpress(queryHe, strict) {
    try {
        // שלב 1: Gemini הופך את החיפוש לאופטימלי באנגלית
        const optimizedQuery = await askGemini(`Convert this Hebrew product search to the best possible English search term for AliExpress (only return the English words): "${queryHe}"`);
        const queryEn = optimizedQuery || await translateText(queryHe, 'en');

        const timestamp = Date.now().toString();
        const params = {
            app_key: ALI_APP_KEY, method: 'aliexpress.affiliate.product.query',
            sign_method: 'md5', timestamp, v: '2.0', keywords: queryEn,
            tracking_id: ALI_TRACKING_ID, page_size: '20', sort: 'LAST_VOLUME_DESC',
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
        
        let filtered = [];
        for (let p of products) {
            let priceIls = Math.round(parseFloat(p.sale_price) * USD_TO_ILS);
            if (strict && !isStrictlyRelevant(p.product_title, queryEn, priceIls)) continue;
            let titleHe = await translateText(p.product_title, 'iw');
            let shortUrl = await shortenLink(p.promotion_link);
            filtered.push({ title: titleHe.substring(0, 85), price: priceIls, originalPrice: Math.round(parseFloat(p.original_price) * USD_TO_ILS), link: shortUrl, image: p.product_main_image_url, rating: p.evaluate_rate, sales: p.lastest_volume });
            if (filtered.length >= 3) break;
        }
        return filtered;
    } catch (e) { return []; }
}

// ===== זרימת חיפוש חכמה (הכל בקבוצה!) =====
async function doSmartSearch(senderRaw, senderName, chatId, queryHe) {
    await sendMsg(chatId, `🕵️ *הסוכן החכם Gemini מנתח את הבקשה שלך...* \nמחפש עבור @${senderName} את הדיל הכי משתלם ל"${queryHe}"...`);
    
    const products = await searchAliExpress(queryHe, true);
    
    if (products.length === 0) {
        await sendMsg(chatId, `😕 @${senderName}, לא מצאתי מוצר איכותי שתואם בדיוק את הבקשה. נסה לתאר את המוצר קצת אחרת!`);
        return;
    }

    // שלב 2: Gemini כותב המלצת מומחה על המוצר הכי טוב
    const bestProduct = products[0];
    const aiReview = await askGemini(`Write a very short (2-3 sentences) professional and exciting recommendation in Hebrew for this product: "${bestProduct.title}" with price ₪${bestProduct.price}. Explain why it's a good deal. Use emojis.`);

    let caption = `━━━━━━━━━━━━━━━\n🌟 *בחירת הסוכן החכם* 🌟\n━━━━━━━━━━━━━━━\n\n${aiReview}\n\n`;
    caption += `💎 *${bestProduct.title}*\n`;
    caption += `💰 מחיר: *₪${bestProduct.price}*\n`;
    caption += `📦 מכירות: ${bestProduct.sales}\n`;
    caption += `🔗 ${bestProduct.link}\n━━━━━━━━━━━━━━━`;

    if (bestProduct.image) await sendImage(chatId, bestProduct.image, caption);
    else await sendMsg(chatId, caption);

    // שליחת מוצר נוסף כגיבוי
    if (products.length > 1) {
        await sleep(1500);
        let cap2 = `💡 *אופציה נוספת:*\n*${products[1].title}*\n💰 מחיר: *₪${products[1].price}*\n🔗 ${products[1].link}`;
        await sendMsg(chatId, cap2);
    }
}

// ===== Webhook Handler =====
app.post('/webhook', async (req, res) => {
    res.sendStatus(200);
    try {
        const body = req.body; if (!body) return;
        const sd = body.senderData || {};
        const senderRaw = sd.sender || '';
        const senderPhone = getPhone(senderRaw);
        const senderName = sd.senderName || 'חבר';
        const chatId = body.messageData?.chatId || sd.chatId || '';

        // הצטרפות חברים
        if (body.typeWebhook === 'groupParticipantsAdded') {
            await sendMsg(senderRaw, WELCOME_INFO);
            newUserFlow[senderPhone] = { step: 1 };
            await sendMsg(senderRaw, SURVEY_Q1);
            return;
        }

        if (body.typeWebhook !== 'incomingMessageReceived') return;
        const md = body.messageData || {};
        const text = md.textMessageData?.textMessage || '';

        // שאלון מצטרפים בפרטי
        if (chatId.includes('@c.us') && newUserFlow[senderPhone]) {
            if (newUserFlow[senderPhone].step === 1) { newUserFlow[senderPhone].step = 0; await sendMsg(senderRaw, SURVEY_DONE); return; }
        }

        // הגנות וניהול
        if (isAdmin(senderRaw) && text.startsWith('!')) { 
            if (text === '!מצב') await sendMsg(chatId, `📊 הבוט פעיל ומחובר ל-Gemini AI!`);
            return; 
        }
        if (isFrozen(senderRaw) || hasBadWord(text)) return;

        // זיהוי חיפוש
        let triggerFound = false, searchQuery = text;
        for (let t of TRIGGER_WORDS) {
            if (text.includes(t)) {
                triggerFound = true;
                searchQuery = text.replace(t, '').trim();
                break;
            }
        }

        if (triggerFound && searchQuery.length > 1) {
            searchCount[senderPhone] = (searchCount[senderPhone] || 0) + 1;
            if (searchCount[senderPhone] === 10) await sendMsg(chatId, `👑 @${senderName} אתה מלך החיפושים!`);
            
            await doSmartSearch(senderRaw, senderName, chatId, searchQuery);
        }

    } catch (e) {}
});

app.get('/', (req, res) => res.send('🤖 Gemini AI Master Bot is Online!'));
app.listen(process.env.PORT || 3000, () => {
    console.log('🚀 הבוט המאסטר באוויר!');
    setInterval(() => axios.get('https://' + process.env.RENDER_EXTERNAL_HOSTNAME).catch(() => {}), 25000);
});
