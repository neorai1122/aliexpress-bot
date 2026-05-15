const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(express.json({limit: '50mb'}));

// ===== הגדרות API וגישה (נהוראי - הכל במקום אחד!) =====
const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const BASE_URL = 'https://7107.api.greenapi.com';
const ALI_APP_KEY = '533908';
const ALI_APP_SECRET = 'iTd8ZOn3s1xmlJ7fXLoe2XYHBkkaF2dF';
const ALI_TRACKING_ID = 'bot01';
const GROQ_API_KEY = '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';
const GROUP_CHAT_ID = '120363424186489979@g.us';
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

// --- קיצור לינקים (TinyURL) ---
async function shortenLink(url) {
    try {
        const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
        return res.data;
    } catch (e) { return url; }
}

// --- סוכן AI חכם (Groq) ---
async function getAgentClarification(queryHe) {
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "You are a professional AI shopping agent for AliExpress. Generate 2 clarification questions in HEBREW to narrow down the user search. Return only JSON format: { 'q1': '...', 'options1': ['...', '...', '...'], 'q2': '...', 'options2': ['...', '...'] }. Use warm and professional language." },
                { role: "user", content: `User is looking for: ${queryHe}` }
            ],
            response_format: { type: "json_object" }
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });
        return JSON.parse(response.data.choices[0].message.content);
    } catch (e) { return null; }
}

// ===== ניהול זיכרון ומצבים =====
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
let pollTimeout = null;

// ===== נתוני מערכת מורחבים (נהוראי - הכל כאן!) =====
const TRIGGER_WORDS = ['אני מחפש','אני מחפשת','חפש לי','חפשי לי','אני צריך','אני צריכה','מחפש','מחפשת','רוצה לקנות','תמצא לי','תביא לי','יש לכם'];
const BAD_WORDS = ['זין','כוס','שרמוטה','זונה','מניאק','ממזר','אידיוט','טמבל','מפגר','חרא','בן זונה','בת זונה','fuck','shit','bitch','asshole'];
const SPAM_WORDS = ['הצטרפו','קבוצה חדשה','דרושים','טלגרם','השקעה','הרוויחו','ביטקוין','הימור'];
const POLL_OPTIONS = ['🎧 אוזניות','⌚ שעונים חכמים','🏠 מוצרי בית','👗 ביגוד','⚽ ספורט','💻 אלקטרוניקה','🧸 צעצועים','🍳 מטבח','💄 יופי','🔧 כלי עבודה'];

const WELCOME_INFO = '👋 *ברוכים הבאים ל-'+GROUP_NAME+'!* 🎉\n\n━━━━━━━━━━━━━━━\n🤖 *איך מחפשים מוצר?*\n━━━━━━━━━━━━━━━\nכתוב בקבוצה:\n_"אני מחפש + שם המוצר"_\n\nהסוכן האישי שלי יפנה אליך בפרטי לדיוק החיפוש! 🕵️\n\n⚠️ *כללי הקבוצה:*\n• אין לקלל — 3 אזהרות = הוצאה!\n• אין לפרסם קבוצות אחרות.\n━━━━━━━━━━━━━━━';
const SURVEY_Q1 = '❓ *שאלה 1/3* - מה הקטגוריה האהובה עליך?\n1️⃣ אלקטרוניקה\n2️⃣ ביגוד\n3️⃣ מוצרי בית\n4️⃣ ספורט\n5️⃣ הכל!';
const SURVEY_Q2 = '❓ *שאלה 2/3* - מה טווח הגילאים שלך?\n1️⃣ 18-25\n2️⃣ 26-35\n3️⃣ 36-45\n4️⃣ 45+';
const SURVEY_DONE = '✅ *תודה!* המערכת הוגדרה עבורך. אפשר להתחיל לחפש מוצרים בקבוצה! 🔥';

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

// --- מנוע סינון רלוונטיות (ANTI-ACCESSORIES) ---
function isStrictlyRelevant(title, queryEn, priceIls) {
    if (!title || !queryEn) return false;
    const t = title.toLowerCase();
    const q = queryEn.toLowerCase();
    
    // סינון לפי מחיר לקטגוריות יקרות
    const highValue = ['phone', 'laptop', 'tablet', 'camera', 'iphone', 'samsung'];
    if (highValue.some(k => q.includes(k)) && priceIls < 250) return false;
    
    // מילים שאסור שיופיעו אם לא התבקשו במפורש
    const forbidden = ['case', 'cover', 'glass', 'film', 'protector', 'silicone', 'tpu', 'strap', 'cable', 'plug', 'holder', 'sticker'];
    if (!q.includes('case') && !q.includes('cover') && !q.includes('cable')) {
        for (let acc of forbidden) if (t.includes(acc)) return false;
    }
    return true;
}

// --- פונקציות שליחה (Green API) ---
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

async function removeFromGroup(phone){
    try{await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/removeGroupParticipant/${API_TOKEN}`,{groupId:GROUP_CHAT_ID,participantChatId:phone+'@c.us'});}
    catch(e){}
}

// --- AliExpress Master Engine ---
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

            filtered.push({
                title: titleHe.substring(0, 85), price: priceIls,
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
        caption += `💰 מחיר: *₪${product.price}* ~~₪${product.originalPrice}~~ 🏷️ -${disc}%\n`;
    } else caption += `💰 מחיר: *₪${product.price}*\n`;
    
    caption += `🚚 משלוח חינם!\n${getStars(product.rating)}\n📦 ${Number(product.sales).toLocaleString()} מכירות\n🔗 ${product.link}\n━━━━━━━━━━━━━━━`;
    if (product.image) await sendImage(chatId, product.image, caption);
    else await sendMsg(chatId, caption);
}

// ===== זרימת סוכן AI אינטראקטיבית (הפתרון המושלם) =====
async function startAgentFlow(senderRaw, senderName, chatId, query) {
    const clarification = await getAgentClarification(query);
    if (!clarification) { await doFinalSearch(senderRaw, senderName, chatId, query); return; }

    const senderPhone = getPhone(senderRaw);
    agentFlow[senderPhone] = { query, step: 1, chatId, clarification, answers: [] };
    
    await sendMsg(chatId, `@${senderName} 🕵️ *סוכן ה-AI שלי בדרך אליך!* \nשלחתי לך הודעה בפרטי כדי לדייק את החיפוש עבור "${query}". נתראה עוד רגע!`);

    let qMsg = `🕵️ *שלום ${senderName}, אני הסוכן האישי שלך!* 🤖\n\nבוא נבחר את האופציה הכי טובה עבור *"${query}"*:\n\n❓ *${clarification.q1}*\n\n`;
    clarification.options1.forEach((opt, i) => qMsg += `${i+1}️⃣ ${opt}\n`);
    await sendMsg(senderRaw, qMsg + `\n_ענה/י עם המספר המתאים_`);
}

async function handleAgentAnswer(senderRaw, senderName, text) {
    const senderPhone = getPhone(senderRaw);
    const flow = agentFlow[senderPhone];
    if (!flow) return false;

    const num = parseInt(text.trim());
    if (isNaN(num)) return true;

    if (flow.step === 1) {
        flow.answers.push(flow.clarification.options1[num-1] || text);
        flow.step = 2;
        let qMsg = `🕵️ *מצוין!*\n\n❓ *${flow.clarification.q2}*\n\n`;
        flow.clarification.options2.forEach((opt, i) => qMsg += `${i+1}️⃣ ${opt}\n`);
        await sendMsg(senderRaw, qMsg + `\n_ענה/י עם המספר המתאים_`);
        return true;
    }
    if (flow.step === 2) {
        flow.answers.push(flow.clarification.options2[num-1] || text);
        await sendMsg(senderRaw, `✅ *הבנתי!* אני חוזר לקבוצה עם הדילים הכי טובים שמצאתי בשבילך.`);
        await doFinalSearch(senderRaw, senderName, flow.chatId, `${flow.query} ${flow.answers.join(' ')}`);
        delete agentFlow[senderPhone];
        return true;
    }
    return false;
}

async function doFinalSearch(senderRaw, senderName, chatId, finalQuery) {
    await sendMsg(chatId, `🕵️ *הסוכן חזר!* @${senderName}, הנה מה שמצאתי עבור "${finalQuery}" 👇`);
    const products = await searchAliExpress(finalQuery, true);
    if (products.length > 0) {
        for (let i = 0; i < products.length; i++) {
            await sendProduct(chatId, products[i], i + 1);
            await sleep(1000);
        }
    } else await sendMsg(chatId, `😕 @${senderName}, לא מצאתי מוצר מספיק איכותי שתואם את הבקשה שלך.`);
}

// ===== פונקציות ניהול (Admin Commands המקוריות שלך!) =====
async function handleAdmin(text, chatId) {
    const cmd = text.trim();
    if (cmd === '!דיל') {
        const p = await searchAliExpress('hot gadget', false);
        if (p.length > 0) await sendProduct(chatId, p[0], '🔥');
        return;
    }
    if (cmd === '!מצב') { await sendMsg(chatId, `📊 *סטטוס בוט:* פעיל \n🤖 *AI Agent:* מחובר \n💰 *USD:* ₪${USD_TO_ILS}`); return; }
    if (cmd === '!בוקר') { await sendMsg(GROUP_CHAT_ID, '━━━━━━━━━━━━━━━\n☀️ *בוקר טוב לכולם!* \n━━━━━━━━━━━━━━━\nיום חדש של דילים מטורפים מתחיל עכשיו! 🔥'); return; }
    if (cmd === '!ערב') { await sendMsg(GROUP_CHAT_ID, '━━━━━━━━━━━━━━━\n🌙 *לילה טוב לכולם!* \n━━━━━━━━━━━━━━━'); return; }
    if (cmd.startsWith('!הקפא ')) { frozenUsers.push(cmd.split(' ')[1]); await sendMsg(chatId, '✅ המשתמש הוקפא!'); return; }
}

async function startPoll() {
    pollActive = true; for (let i = 1; i <= POLL_OPTIONS.length; i++) pollVotes[i] = 0;
    let msg = `━━━━━━━━━━━━━━━\n📊 *סקר שבועי!* \n━━━━━━━━━━━━━━━\n\n`;
    POLL_OPTIONS.forEach((opt, i) => msg += `${i+1}. ${opt}\n`);
    msg += `\n✍️ *ענו עם המספר!*`;
    await sendMsg(GROUP_CHAT_ID, msg);
}

// ===== Webhook Handler (הלב הפועם של הבוט) =====
app.post('/webhook', async (req, res) => {
    res.sendStatus(200);
    try {
        const body = req.body; if (!body) return;
        const sd = body.senderData || {};
        const senderRaw = sd.sender || '';
        const senderPhone = getPhone(senderRaw);
        const senderName = sd.senderName || 'חבר';
        const chatId = body.messageData?.chatId || sd.chatId || '';

        // הצטרפות חברים חדשים
        if (body.typeWebhook === 'groupParticipantsAdded') {
            await sendMsg(senderRaw, WELCOME_INFO);
            newUserFlow[senderPhone] = { step: 1 };
            await sendMsg(senderRaw, SURVEY_Q1);
            return;
        }

        if (body.typeWebhook !== 'incomingMessageReceived') return;
        const md = body.messageData || {};
        const text = md.textMessageData?.textMessage || '';

        // טיפול בפרטי (סוכן AI או שאלון)
        if (chatId.includes('@c.us')) {
            if (newUserFlow[senderPhone]) {
                if (newUserFlow[senderPhone].step === 1) { newUserFlow[senderPhone].step = 2; await sendMsg(senderRaw, SURVEY_Q2); return; }
                if (newUserFlow[senderPhone].step === 2) { await sendMsg(senderRaw, SURVEY_DONE); delete newUserFlow[senderPhone]; return; }
            }
            if (agentFlow[senderPhone]) {
                const handled = await handleAgentAnswer(senderRaw, senderName, text);
                if (handled) return;
            }
        }

        // הגנות וניהול
        if (isAdmin(senderRaw) && text.startsWith('!')) { await handleAdmin(text, chatId); return; }
        if (isFrozen(senderRaw)) return;
        
        if (hasBadWord(text)) {
            warningCount[senderPhone] = (warningCount[senderPhone] || 0) + 1;
            if (warningCount[senderPhone] >= 3) { await removeFromGroup(senderPhone); frozenUsers.push(senderPhone); }
            else await sendMsg(chatId, `⚠️ @${senderName} אזהרה ${warningCount[senderPhone]}/3! שמור על השפה.`);
            return;
        }

        // זיהוי חיפוש מוצר
        let triggerFound = false, searchQuery = text;
        for (let t of TRIGGER_WORDS) {
            if (text.includes(t)) {
                triggerFound = true;
                searchQuery = text.replace(t, '').trim();
                break;
            }
        }

        if (triggerFound && searchQuery.length > 1) {
            // ספירת חיפושים למלך הקבוצה
            searchCount[senderPhone] = (searchCount[senderPhone] || 0) + 1;
            if (searchCount[senderPhone] === 10) await sendMsg(chatId, `👑 @${senderName} אתה מלך החיפושים! כבר 10 חיפושים היום! 🏆`);
            
            // הפעלת סוכן ה-AI
            await startAgentFlow(senderRaw, senderName, chatId, searchQuery);
        }

    } catch (e) { console.error('Webhook Error'); }
});

app.get('/', (req, res) => res.send('🤖 Ultimate AI Shopping Agent is Online!'));
app.listen(process.env.PORT || 3000, () => {
    console.log('🚀 המאסטר-בוט של נהוראי באוויר!');
    setInterval(() => axios.get('https://' + process.env.RENDER_EXTERNAL_HOSTNAME).catch(() => {}), 25000);
});
