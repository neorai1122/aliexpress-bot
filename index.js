const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(express.json({limit: '50mb'}));

// ===== הגדרות API וגישה (נהוראי - הכל כאן!) =====
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

// --- שער דולר דינמי ---
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

// --- פונקציית תרגום ---
async function translateText(text, targetLang) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await axios.get(url);
        return res.data[0][0][0];
    } catch (e) { return text; }
}

// --- קיצור לינקים ---
async function shortenLink(url) {
    try {
        const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
        return res.data;
    } catch (e) { return url; }
}

// --- סוכן AI לייצר שאלות הבהרה ---
async function getAgentClarification(queryHe) {
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "You are an expert shopping assistant. Generate 2 clarification questions in HEBREW (q1, q2) with 3 simple options each (options1, options2). Format as JSON." },
                { role: "user", content: `Product: ${queryHe}` }
            ],
            response_format: { type: "json_object" }
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });
        return JSON.parse(response.data.choices[0].message.content);
    } catch (e) { return null; }
}

// ===== ניהול זיכרון =====
const userMemory = {};
const searchCount = {};
const frozenUsers = [];
const vipUsers = [];
const warningCount = {};
const popularSearches = {};
const newUserFlow = {};
const agentFlow = {};
let pollActive = false;
let pollVotes = {};

// ===== דאטה מקורי (הכל כאן!) =====
const TRIGGER_WORDS = ['אני מחפש','חפש לי','אני צריך','אני צריכה','מחפש','תמצא לי','תביא לי'];
const BAD_WORDS = ['זין','כוס','שרמוטה','זונה','מניאק','ממזר','אידיוט','טמבל','מפגר','חרא','בן זונה','fuck','shit','bitch'];
const POLL_OPTIONS = ['🎧 אוזניות','⌚ שעונים חכמים','🏠 מוצרי בית','👗 ביגוד','⚽ ספורט','💻 אלקטרוניקה'];

const WELCOME_INFO = '👋 *ברוכים הבאים לקבוצה!* 🎉\nכתבו: _"אני מחפש + מוצר"_ והסוכן שלנו יחזור אליכם!';
const SURVEY_Q1 = '❓ *שאלה 1/3* - מה הכי מעניין אותך?\n1️⃣ אלקטרוניקה\n2️⃣ ביגוד\n3️⃣ הכל!';
const SURVEY_DONE = '✅ *תודה!* אפשר להתחיל לחפש!';

function getPhone(raw){return raw.replace('@c.us','').replace('@g.us','').replace('@','').trim();}
function isAdmin(raw){return ADMIN_NUMBERS.indexOf(getPhone(raw))!==-1;}
function isFrozen(raw){return frozenUsers.indexOf(getPhone(raw))!==-1;}
function hasBadWord(t){var l=t.toLowerCase();for(var i=0;i<BAD_WORDS.length;i++)if(l.indexOf(BAD_WORDS[i])!==-1)return true;return false;}
function sleep(ms){return new Promise(r => setTimeout(r, ms));}

// --- מנוע סינון רלוונטיות ---
function isStrictlyRelevant(title, queryEn, priceIls) {
    if (!title || !queryEn) return false;
    const t = title.toLowerCase();
    const q = queryEn.toLowerCase();
    if ((q.includes('phone') || q.includes('iphone')) && priceIls < 300) return false;
    const forbidden = ['case', 'cover', 'glass', 'film', 'protector', 'silicone', 'cable'];
    for (let acc of forbidden) if (t.includes(acc)) return false;
    return true;
}

// --- שליחת הודעות ותמונות ---
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

// --- AliExpress API ---
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
        
        let filtered = [];
        for (let p of products) {
            let priceIls = Math.round(parseFloat(p.sale_price) * USD_TO_ILS);
            if (strict && !isStrictlyRelevant(p.product_title, queryEn, priceIls)) continue;
            let titleHe = await translateText(p.product_title, 'iw');
            let shortUrl = await shortenLink(p.promotion_link);
            filtered.push({ title: titleHe.substring(0, 80), price: priceIls, originalPrice: Math.round(parseFloat(p.original_price) * USD_TO_ILS), link: shortUrl, image: p.product_main_image_url });
            if (filtered.length >= 2) break;
        }
        return filtered;
    } catch (e) { return []; }
}

async function sendProduct(chatId, product, num) {
    let caption = `━━━━━━━━━━━━━━━\n${num}️⃣ *${product.title}*\n━━━━━━━━━━━━━━━\n💰 מחיר: *₪${product.price}*\n🔗 ${product.link}\n━━━━━━━━━━━━━━━`;
    if (product.image) await sendImage(chatId, product.image, caption);
    else await sendMsg(chatId, caption);
}

// ===== לוגיקת סוכן (התיקון כאן!) =====
async function startAgentFlow(senderPhone, senderName, chatId, query) {
    const clarification = await getAgentClarification(query);
    if (!clarification) { await doFinalSearch(senderPhone, senderName, chatId, query); return; }

    agentFlow[senderPhone] = { query, step: 1, chatId, clarification, answers: [] };
    
    await sendMsg(chatId, `@${senderName} 🕵️ *הסוכן נכנס לפעולה!*\nשלחתי לך שאלות בפרטי לדיוק החיפוש. 😉`);

    let qMsg = `🕵️ *היי ${senderName}, בוא נדייק את החיפוש!*\n\nמוצר: *${query}*\n\n❓ *${clarification.q1}*\n\n`;
    clarification.options1.forEach((opt, i) => qMsg += `${i+1}️⃣ ${opt}\n`);
    await sendMsg(senderPhone + '@c.us', qMsg + `\n_ענה עם מספר_`);
}

async function handleAgentAnswer(senderPhone, senderName, text) {
    const flow = agentFlow[senderPhone];
    if (!flow) return false;

    const num = parseInt(text.trim());
    if (isNaN(num)) return true;

    if (flow.step === 1) {
        flow.answers.push(flow.clarification.options1[num-1] || text);
        flow.step = 2;
        let qMsg = `🕵️ *מעולה!*\n\n❓ *${flow.clarification.q2}*\n\n`;
        flow.clarification.options2.forEach((opt, i) => qMsg += `${i+1}️⃣ ${opt}\n`);
        await sendMsg(senderPhone + '@c.us', qMsg + `\n_ענה עם מספר_`);
        return true;
    }
    if (flow.step === 2) {
        flow.answers.push(flow.clarification.options2[num-1] || text);
        await sendMsg(senderPhone + '@c.us', `✅ *הבנתי!* אני חוזר לקבוצה עם התוצאות...`);
        await doFinalSearch(senderPhone, senderName, flow.chatId, `${flow.query} ${flow.answers.join(' ')}`);
        delete agentFlow[senderPhone];
        return true;
    }
    return false;
}

async function doFinalSearch(senderPhone, senderName, chatId, finalQuery) {
    await sendMsg(chatId, `🕵️ *הסוכן מצא עבור @${senderName}:* \n(חיפוש: ${finalQuery})`);
    const products = await searchAliExpress(finalQuery, true);
    if (products.length > 0) {
        for (let i = 0; i < products.length; i++) {
            await sendProduct(chatId, products[i], i + 1);
            await sleep(1000);
        }
    } else await sendMsg(chatId, `😕 לא מצאתי משהו מספיק טוב עבור ${finalQuery}.`);
}

// ===== שאלון מצטרף (Survey) =====
async function startNewUserFlow(phone, name) {
    newUserFlow[phone] = { step: 1, name };
    await sendMsg(phone + '@c.us', WELCOME_INFO);
    await sleep(2000);
    await sendMsg(phone + '@c.us', SURVEY_Q1);
}

async function handleNewUserAnswer(phone, text) {
    const flow = newUserFlow[phone]; if (!flow) return false;
    await sendMsg(phone + '@c.us', SURVEY_DONE);
    delete newUserFlow[phone]; return true;
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
        const chatId = body.messageData?.chatId || sd.chatId || '';

        if (body.typeWebhook === 'groupParticipantsAdded') {
            await startNewUserFlow(senderPhone, senderName); return;
        }

        if (body.typeWebhook !== 'incomingMessageReceived') return;
        const md = body.messageData || {};
        const text = md.textMessageData?.textMessage || '';

        // טיפול בתשובות (גם בפרטי וגם בקבוצה)
        if (newUserFlow[senderPhone]) { await handleNewUserAnswer(senderPhone, text); return; }
        if (agentFlow[senderPhone]) { 
            const handled = await handleAgentAnswer(senderPhone, senderName, text); 
            if (handled) return; 
        }

        if (isAdmin(senderRaw) && text.startsWith('!')) { 
            if (text === '!מצב') await sendMsg(chatId, `📊 הבוט עובד!`);
            return; 
        }
        if (isFrozen(senderRaw) || hasBadWord(text)) return;

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

app.get('/', (req, res) => res.send('🤖 AI Shopping Agent is Online!'));
app.listen(process.env.PORT || 3000, () => {
    console.log('🚀 הבוט המלא באוויר!');
    setInterval(() => axios.get('https://' + process.env.RENDER_EXTERNAL_HOSTNAME).catch(() => {}), 25000);
});
