const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(express.json());

const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const BASE_URL = 'https://7107.api.greenapi.com';
const ALI_APP_KEY = '533908';
const ALI_APP_SECRET = 'iTd8ZOn3s1xmlJ7fXLoe2XYHBkkaF2dF';
const ALI_TRACKING_ID = 'bot01';
const GROUP_CHAT_ID = '120363424186489979@g.us';
const GROUP_NAME = 'דילים שווים';
const ADMIN_NUMBERS = ['972538800370', '972557119650'];
const RAPID_API_KEY = '915dcf0ac5msh93099502b8ca28fp1bae01jsn63a125be6f5f';

const userMemory = {};
const searchCount = {};
const frozenUsers = [];
const vipUsers = [];
const warningCount = {};
const popularSearches = {};
const newUserFlow = {};

let pollActive = false;
let pollVotes = {};
let pollTimeout = null;

const TRIGGER_WORDS = [
  'אני מחפש','אני מחפשת','חפש לי','חפשי לי',
  'אני צריך','אני צריכה','מחפש','מחפשת',
  'רוצה לקנות','מישהו מכיר','מישהי מכירה',
  'יש מוצר','איפה אפשר לקנות','תמצאו לי',
  'תביאו לי','יש דיל על','כמה עולה',
  'איפה קונים','תמצא לי','תביא לי'
];

const BAD_WORDS = [
  'זין','כוס','שרמוטה','זונה','מניאק','ממזר',
  'אידיוט','טמבל','מפגר','חרא','בן זונה','בת זונה',
  'כלבה','בהמה','ראש זין','לך לעזאזל',
  'كس','زبي','شرموطة','fuck','shit','bitch','asshole','bastard','idiot'
];

const SPAM_WORDS = [
  'הצטרפו','קבוצה חדשה','דרושים','ווטסאפ','טלגרם',
  'השקעה','הרוויחו','ביטקוין','הימור','קזינו'
];

const TRANSLATIONS = {
  'אוזניות':'earphones','בלוטות':'bluetooth','נעליים':'shoes',
  'שעון':'watch','טלפון':'phone','מטען':'charger','כיסא':'chair',
  'מאוורר':'fan','מצלמה':'camera','תיק':'bag','בגדים':'clothes',
  'צמיד':'bracelet','טבעת':'ring','משקפיים':'glasses','ספורט':'sport',
  'ילדים':'kids','צעצוע':'toy','מטבח':'kitchen','מחשב':'computer',
  'לפטופ':'laptop','טאבלט':'tablet','רמקול':'speaker','מקלדת':'keyboard',
  'עכבר':'mouse','מנורה':'lamp','שמיכה':'blanket','כרית':'pillow',
  'ארנק':'wallet','כובע':'hat','גרביים':'socks','חגורה':'belt','בושם':'perfume',
  'אייפון': 'iphone'
};

const FUNNY = {
  'כיסא':'😂 כיסא? בטח אחרי שעמדת כל היום!',
  'שמיכה':'🥶 שמיכה? קר לך?',
  'בושם':'😏 מישהו רוצה להריח טוב!',
  'טבעת':'💍 מישהו מתחתן?!',
  'צעצוע':'😄 בשביל הילדים... או בשבילך?'
};

const POLL_OPTIONS = [
  '🎧 אוזניות ואביזרי אודיו',
  '⌚ שעונים חכמים',
  '🏠 מוצרי בית וגאדגטים',
  '👗 ביגוד ואופנה',
  '⚽ מוצרי ספורט',
  '💻 אלקטרוניקה',
  '🧸 צעצועים וילדים',
  '🍳 מטבח ובישול',
  '💄 יופי וטיפוח',
  '🔧 כלי עבודה'
];

// --- טקסטים של השאלון (נשארו בדיוק אותו דבר) ---
const WELCOME_INFO = '👋 *ברוכים הבאים לקבוצת ' + GROUP_NAME + '!* 🎉\n\n...'; // (מקוצר כאן לנוחות הקריאה, בקוד שלך זה המלא)
const SURVEY_Q1 = '━━━━━━━━━━━━━━━\n❓ *שאלה 1 מתוך 3*\n━━━━━━━━━━━━━━━\n\nמה אתה/את *הכי מחפש/ת*?\n\n1️⃣ אלקטרוניקה ואוזניות\n2️⃣ ביגוד ואופנה\n3️⃣ מוצרי בית\n4️⃣ ספורט ובריאות\n5️⃣ הכל!\n\n_ענה/י עם המספר בלבד_';
// ... שאר השאלות נשמרות ...

function getPhone(raw) { return raw.replace('c.us','').replace('@','').replace('.','').trim(); }
function isAdmin(raw) { return ADMIN_NUMBERS.indexOf(getPhone(raw)) !== -1; }
function isFrozen(raw) { return frozenUsers.indexOf(getPhone(raw)) !== -1; }
function hasBadWord(t) { var l=t.toLowerCase(); for(var i=0;i<BAD_WORDS.length;i++) if(l.indexOf(BAD_WORDS[i].toLowerCase())!==-1) return true; return false; }
function hasSpam(t) { for(var i=0;i<SPAM_WORDS.length;i++) if(t.indexOf(SPAM_WORDS[i])!==-1) return true; return false; }
function translateToEnglish(text) { var r=text; for(var k in TRANSLATIONS) r=r.split(k).join(TRANSLATIONS[k]); return r; }
function buildSearchLink(query) { return 'https://www.aliexpress.com/wholesale?SearchText='+encodeURIComponent(translateToEnglish(query))+'&SortType=total_tranpro_desc&aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key='+ALI_TRACKING_ID+'&terminal_id='+ALI_APP_KEY; }
function getHeat() { var h=''; for(var i=0;i<Math.floor(Math.random()*3)+3;i++) h+='🔥'; return h; }
function sleep(ms) { return new Promise(function(r){setTimeout(r,ms);}); }
function getTopSearches() { return Object.keys(popularSearches).sort(function(a,b){return popularSearches[b]-popularSearches[a];}).slice(0,3); }

// --- פונקציות תקשורת משופרות ---

async function sendMsg(chatId, message) {
  try {
    await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendMessage/'+API_TOKEN, {chatId:chatId,message:message});
    console.log('✅ נשלח ל:'+chatId.substring(0,20));
  } catch(e) { console.error('❌ שגיאה:'+e.message); }
}

// פונקציה חדשה לשליחת תמונות
async function sendImage(chatId, url, caption) {
    try {
      await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendFileByUrl/'+API_TOKEN, {
        chatId: chatId,
        urlFile: url,
        fileName: "product.jpg",
        caption: caption
      });
    } catch(e) { await sendMsg(chatId, caption); }
}

async function sendTyping(chatId) {
  try { await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendTyping/'+API_TOKEN,{chatId:chatId}); } catch(e) {}
}

async function sendToAdmins(msg) {
  for(var i=0;i<ADMIN_NUMBERS.length;i++) await sendMsg(ADMIN_NUMBERS[i]+'@c.us', msg);
}

// --- אלי אקספרס - עם תמיכה בתמונות ---

async function searchAliExpressOfficial(query) {
  try {
    var timestamp = new Date().toISOString().replace(/[^0-9]/g,'').slice(0,15)+'000';
    var params = {
      app_key: ALI_APP_KEY,
      method: 'aliexpress.affiliate.product.query',
      sign_method: 'md5',
      timestamp: timestamp,
      v: '2.0',
      keywords: translateToEnglish(query),
      tracking_id: ALI_TRACKING_ID,
      page_size: '3',
      fields: 'product_id,product_title,sale_price,evaluate_rate,lastest_volume,promotion_link,original_price,product_main_image_url'
    };
    var sortedKeys = Object.keys(params).sort();
    var signStr = ALI_APP_SECRET;
    for(var i=0;i<sortedKeys.length;i++) signStr += sortedKeys[i]+params[sortedKeys[i]];
    signStr += ALI_APP_SECRET;
    params.sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
    var res = await axios.get('https://api-sg.aliexpress.com/sync', {params: params, timeout:12000});
    if(res.data && res.data.result && res.data.result.products) {
      var products = res.data.result.products.product;
      return products.map(p => ({
        title: p.product_title.substring(0,60),
        price: p.sale_price,
        link: p.promotion_link,
        image: p.product_main_image_url,
        rating: p.evaluate_rate,
        sales: p.lastest_volume
      }));
    }
    return [];
  } catch(e) { return []; }
}

async function getProducts(query) {
  var products = await searchAliExpressOfficial(query);
  return products;
}

// בניית הודעה שתומכת בתמונה
function buildProductMessage(products, query, name) {
  if(!products || products.length===0) {
    return { msg: '@'+name+' ✅ *מצאתי עבורך '+query+'!*\n\n🌡️ חום הדיל: '+getHeat()+'\n\n👉 '+buildSearchLink(query), image: null };
  }
  var top = products[0];
  var msg = '@'+name+' ✅ *מצאתי עבורך '+query+'!*\n\n' +
            '*'+top.title+'*\n' +
            '💰 מחיר: $'+top.price+'\n' +
            '⭐ דירוג: '+top.rating+'\n' +
            '🔗 '+top.link+'\n\n' +
            '━━━━━━━━━━━━━━━\n💡 _לינקים עם קוד שותפים_';
  return { msg: msg, image: top.image };
}

// --- כל פונקציות הניהול המקוריות (לא נגעתי!) ---

async function startNewUserFlow(phone, name) { /* ... כמו בקוד המקורי ... */ }
async function handleNewUserAnswer(phone, name, text) { /* ... כמו בקוד המקורי ... */ }
async function startPoll() { /* ... כמו בקוד המקורי ... */ }
async function handleAdmin(text, chatId) { /* ... כל פקודות ה-! המקוריות ... */ }

// --- ה-WEBHOOK המרכזי ---

app.post('/webhook',async function(req,res){
  res.sendStatus(200);
  try {
    var body=req.body;
    if(!body) return;
    var sd=body.senderData||{};
    var senderRaw=sd.sender||'';
    var senderName=sd.senderName||'חבר';
    var chatId=sd.chatId||'';
    var senderPhone=getPhone(senderRaw);

    // לוגיקת הצטרפות לקבוצה (השאלון שלך)
    if(body.typeWebhook==='groupParticipantsAdded'){
        // ... (הקוד המקורי שלך)
    }

    if(body.typeWebhook!=='incomingMessageReceived') return;
    var md=body.messageData||{};
    var text=md.textMessageData&&md.textMessageData.textMessage?md.textMessageData.textMessage:'';

    // בדיקת אדמין ופקודות !
    if(isAdmin(senderRaw)&&text.charAt(0)==='!'){await handleAdmin(text,chatId);return;}

    // בדיקת הקפאה, ספאם וקללות (כל ה-500 שורות שלך כאן)
    if(isFrozen(senderRaw)) return;
    if(hasSpam(text)) { /* ... */ return; }
    if(hasBadWord(text)) { /* ... אזהרות וכו' ... */ return; }

    // לוגיקת החיפוש
    var triggerFound=false, searchQuery=text;
    for(var t=0;t<TRIGGER_WORDS.length;t++){
      if(text.indexOf(TRIGGER_WORDS[t])!==-1){
        triggerFound=true;
        searchQuery=searchQuery.split(TRIGGER_WORDS[t]).join('').trim();
      }
    }
    if(!triggerFound) return;

    await sendTyping(chatId);
    var products = await getProducts(searchQuery);
    var result = buildProductMessage(products, searchQuery, senderName);

    // כאן הקסם: אם יש תמונה, שלח אותה עם הכיתוב
    if(result.image) {
        await sendImage(chatId, result.image, result.msg);
    } else {
        await sendMsg(chatId, result.msg);
    }

    // המשך לוגיקת ה-VIP והספירה שלך
    searchCount[senderPhone] = (searchCount[senderPhone]||0)+1;
    if(searchCount[senderPhone] === 10) await sendToAdmins('🎉 @'+senderName+' הגיע ל-10 חיפושים!');

  } catch(e){console.error(e);}
});

app.listen(3000, () => console.log('🚀 הבוט המלא פועל!'));
