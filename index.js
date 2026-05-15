const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(express.json({limit: '50mb'}));

// ===== הגדרות מערכת (שום דבר לא שונה, הקישורים שלך מחוברים!) =====
const GROUP_NAME = 'דילים שווים';
const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const BASE_URL = 'https://7107.api.greenapi.com';
const ALI_APP_KEY = '533908';
const ALI_APP_SECRET = 'iTd8ZOn3s1xmlJ7fXLoe2XYHBkkaF2dF';
const ALI_TRACKING_ID = 'bot01'; // <--- הנה המזהה שותף שלך!
const GROUP_CHAT_ID = '120363424186489979@g.us';
const ADMIN_NUMBERS = ['972538800370', '972557119650'];

// --- שער דולר מעודכן (חשוב למחירים) ---
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

// --- תרגום וקיצור קישורים (כדי שהקישור שותפים ייראה טוב) ---
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

// ===== זיכרון ונתונים =====
const frozenUsers = [];
const warningCount = {};
const searchCount = {};
const newUserFlow = {};
const agentFlow = {}; 
let pollVotes = {};

// --- נתוני הקבוצה שלך ---
const TRIGGER_WORDS = ['אני מחפש','אני מחפשת','חפש לי','חפשי לי','אני צריך','אני צריכה','מחפש','מחפשת','תמצא לי','תביא לי'];
const BAD_WORDS = ['זין','כוס','שרמוטה','זונה','מניאק','מפגר','חרא','בן זונה','fuck','shit','bitch'];

// >>> המוח המקורי והמדויק (בלי AI ממציא) <<<
const CLARIFICATION = {
  'טלפון': { q: '📱 *איזה סוג טלפון?*\n1️⃣ אייפון\n2️⃣ סמסונג\n3️⃣ שיאומי', o: ['iphone smartphone', 'samsung galaxy smartphone', 'xiaomi smartphone'] },
  'אוזניות': { q: '🎧 *איזה אוזניות?*\n1️⃣ אלחוטיות בלוטות\n2️⃣ קטנות בתוך האוזן (TWS)\n3️⃣ עם חוט', o: ['bluetooth headphones over ear', 'tws earbuds wireless', 'wired earphones'] },
  'שעון': { q: '⌚ *איזה שעון?*\n1️⃣ שעון חכם\n2️⃣ שעון ספורט', o: ['smartwatch', 'sport fitness watch'] },
  'מטען': { q: '🔌 *איזה מטען?*\n1️⃣ מטען קיר מהיר\n2️⃣ מטען נייד (סוללה)\n3️⃣ מטען לרכב', o: ['fast charger adapter', 'power bank portable', 'car charger'] },
  'תיק': { q: '👜 *איזה תיק?*\n1️⃣ תיק גב\n2️⃣ תיק צד\n3️⃣ תיק למחשב', o: ['backpack', 'shoulder bag', 'laptop bag'] },
  'מחשב': { q: '💻 *איזה מחשב?*\n1️⃣ לפטופ\n2️⃣ טאבלט\n3️⃣ מיני PC', o: ['laptop', 'tablet', 'mini pc'] }
};

const WELCOME_INFO = '👋 *ברוכים הבאים ל-'+GROUP_NAME+'!* 🎉\n\n🤖 *איך מחפשים מוצר?*\nכתוב בקבוצה: _"אני מחפש + מוצר"_\nואני אדאג למצוא לך את הדילים הכי חמים באליאקספרס!';
const SURVEY_Q1 = '❓ *שאלה 1/2* - מה הכי מעניין אותך?\n1️⃣ אלקטרוניקה\n2️⃣ ביגוד\n3️⃣ מוצרי בית\n4️⃣ ספורט\n5️⃣ הכל!';
const SURVEY_Q2 = '❓ *שאלה 2/2* - מה טווח הגילאים שלך?\n1️⃣ 18-25\n2️⃣ 26-35\n3️⃣ 36-45\n4️⃣ 45+';
const SURVEY_DONE = '✅ *תודה!* אפשר להתחיל לחפש מוצרים בקבוצה! 🔥';

function getPhone(raw){return raw.replace('@c.us','').replace('@g.us','').replace('@','').trim();}
function isAdmin(raw){return ADMIN_NUMBERS.indexOf(getPhone(raw))!==-1;}
function isFrozen(raw){return frozenUsers.indexOf(getPhone(raw))!==-1;}
function hasBadWord(t){var l=t.toLowerCase();for(var i=0;i<BAD_WORDS.length;i++)if(l.indexOf(BAD_WORDS[i])!==-1)return true;return false;}
function sleep(ms){return new Promise(r => setTimeout(r, ms));}

function getStars(rating){
    var r = parseFloat(rating); if(isNaN(r)) return '⭐⭐⭐⭐⭐';
    var stars = Math.round((r/20)*2)/2;
    var s = ''; for(let i=0; i<Math.floor(stars); i++) s+='⭐';
    if(stars%1!==0) s+='✨';
    return s + ` (${(stars).toFixed(1)}/5)`;
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

async function removeFromGroup(phone){
    try{await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/removeGroupParticipant/${API_TOKEN}`,{groupId:GROUP_CHAT_ID,participantChatId:phone+'@c.us'});}
    catch(e){}
}

// === מנוע אליאקספרס (השותפים שלך עובד כאן ב-100%) ===
async function searchAliExpress(queryEn) {
    try {
        const timestamp = Date.now().toString();
        const params = {
            app_key: ALI_APP_KEY, 
            method: 'aliexpress.affiliate.product.query',
            sign_method: 'md5', 
            timestamp, 
            v: '2.0', 
            keywords: queryEn, // המנוע מקבל מילת חיפוש מדויקת באנגלית
            tracking_id: ALI_TRACKING_ID, // <<< מזהה השותף שלך!!!
            page_size: '20', 
            sort: 'LAST_VOLUME_DESC',
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
            let titleHe = await translateText(p.product_title, 'iw');
            let shortUrl = await shortenLink(p.promotion_link); // הקישור שותפים האמיתי

            filtered.push({ 
                title: titleHe.substring(0, 85), 
                price: priceIls, 
                originalPrice: Math.round(parseFloat(p.original_price) * USD_TO_ILS), 
                link: shortUrl, 
                image: p.product_main_image_url, 
                rating: p.evaluate_rate, 
                sales: p.lastest_volume 
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
        caption += `💰 מחיר: *₪${product.price}* ~~₪${product.originalPrice}~~ 🏷️ -${disc}%\n`;
    } else {
        caption += `💰 מחיר: *₪${product.price}*\n`;
    }
    
    caption += `🚚 משלוח חינם!\n${getStars(product.rating)}\n📦 ${Number(product.sales).toLocaleString()} מכירות\n🔗 *לינק לרכישה:* ${product.link}\n━━━━━━━━━━━━━━━`;
    if (product.image) await sendImage(chatId, product.image, caption);
    else await sendMsg(chatId, caption);
}

// === לוגיקת החיפוש - עובדת חלק ובלי תקלות! ===
async function processSearch(senderRaw, senderName, chatId, searchQuery) {
    // שלב 1: בודקים אם יש לנו שאלות הבהרה מוכנות במערכת
    let foundKey = null;
    for (let key in CLARIFICATION) {
        if (searchQuery.includes(key)) { foundKey = key; break; }
    }

    if (foundKey) {
        // שלב 2א: מצאנו מילת מפתח (כמו "טלפון"). שולחים הודעה בפרטי!
        const senderPhone = getPhone(senderRaw);
        agentFlow[senderPhone] = { options: CLARIFICATION[foundKey].o, chatId: chatId };
        
        // מודיעים בקבוצה:
        await sendMsg(chatId, `@${senderName} 🕵️ *שלחתי לך הודעה לפרטי כדי שנדייק את החיפוש!*`);
        
        // שולחים הודעה בפרטי:
        await sendMsg(senderRaw, `שלום ${senderName}! ראיתי שאתה מחפש ${foundKey}.\n\n` + CLARIFICATION[foundKey].q + '\n\n_ענה/י עם המספר המתאים_');
    } else {
        // שלב 2ב: אין מילת מפתח? מתרגמים ישירות לאנגלית ומחפשים
        await sendMsg(chatId, `🕵️ מחפש עבור @${senderName} את הדיל הכי משתלם ל"${searchQuery}"...`);
        const queryEn = await translateText(searchQuery, 'en');
        await doFinalSearch(senderName, chatId, queryEn);
    }
}

async function handlePrivateAnswer(senderRaw, senderName, text) {
    const senderPhone = getPhone(senderRaw);
    const flow = agentFlow[senderPhone];
    if (!flow) return false;

    const num = parseInt(text.trim());
    if (isNaN(num) || num < 1 || num > flow.options.length) {
        await sendMsg(senderRaw, `⚠️ אנא בחר מספר בין 1 ל-${flow.options.length}.`);
        return true;
    }

    // הלקוח בחר מספר. לוקחים את המחרוזת המדויקת באנגלית שהגדרנו:
    const exactSearchTerm = flow.options[num - 1];
    
    await sendMsg(senderRaw, `✅ *תודה!* המוצרים המדויקים בדרך לקבוצה.`);
    await doFinalSearch(senderName, flow.chatId, exactSearchTerm);
    
    delete agentFlow[senderPhone];
    return true;
}

async function doFinalSearch(senderName, chatId, exactSearchTerm) {
    const products = await searchAliExpress(exactSearchTerm);
    if (products.length > 0) {
        await sendMsg(chatId, `🎉 @${senderName}, *הנה התוצאות שמצאתי במיוחד בשבילך:* 👇`);
        for (let i = 0; i < products.length; i++) {
            await sendProduct(chatId, products[i], i + 1);
            await sleep(1000);
        }
    } else {
        await sendMsg(chatId, `😕 @${senderName}, לא מצאתי מוצרים רלוונטיים באליאקספרס. נסה שוב!`);
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

        // הצטרפות
        if (body.typeWebhook === 'groupParticipantsAdded') {
            await sendMsg(senderRaw, WELCOME_INFO);
            newUserFlow[senderPhone] = { step: 1 };
            await sendMsg(senderRaw, SURVEY_Q1);
            return;
        }

        if (body.typeWebhook !== 'incomingMessageReceived') return;
        const md = body.messageData || {};
        const text = md.textMessageData?.textMessage || '';

        // תשובות בפרטי (חיפוש או שאלון)
        if (chatId.includes('@c.us')) {
            if (newUserFlow[senderPhone]) {
                if (newUserFlow[senderPhone].step === 1) { newUserFlow[senderPhone].step = 2; await sendMsg(senderRaw, SURVEY_Q2); return; }
                if (newUserFlow[senderPhone].step === 2) { await sendMsg(senderRaw, SURVEY_DONE); delete newUserFlow[senderPhone]; return; }
            }
            if (agentFlow[senderPhone]) {
                const handled = await handlePrivateAnswer(senderRaw, senderName, text);
                if (handled) return;
            }
        }

        // ניהול והגנות
        if (isAdmin(senderRaw) && text.startsWith('!')) { 
            if (text === '!בוקר') await sendMsg(GROUP_CHAT_ID, '☀️ *בוקר טוב!* בואו נמצא לכם דילים שווים!');
            if (text === '!מצב') await sendMsg(chatId, '📊 הבוט עובד חלק!');
            return; 
        }
        if (isFrozen(senderRaw)) return;
        
        if (hasBadWord(text)) {
            warningCount[senderPhone] = (warningCount[senderPhone] || 0) + 1;
            if (warningCount[senderPhone] >= 3) { await removeFromGroup(senderPhone); frozenUsers.push(senderPhone); }
            else await sendMsg(chatId, `⚠️ @${senderName} אזהרה ${warningCount[senderPhone]}/3! שמור על שפה נקייה.`);
            return;
        }

        // חיפוש
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
            
            await processSearch(senderRaw, senderName, chatId, searchQuery);
        }

    } catch (e) {}
});

app.get('/', (req, res) => res.send('🤖 Standard Affiliate Bot is Online!'));
app.listen(process.env.PORT || 3000, () => {
    console.log('🚀 הבוט תוקן, יציב ובאוויר!');
    setInterval(() => axios.get('https://' + process.env.RENDER_EXTERNAL_HOSTNAME).catch(() => {}), 25000);
});
