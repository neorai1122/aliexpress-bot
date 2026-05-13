const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(express.json());

const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const BASE_URL = 'https://7107.api.greenapi.com';
const ALI_APP_KEY = '533908';
const ALI_APP_SECRET = 'iTd8ZOn3s1xmlJ7fXLoe2XYHBkkaF2dhhF';
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
  'ארנק':'wallet','כובע':'hat','גרביים':'socks','חגורה':'belt','בושם':'perfume'
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

const WELCOME_INFO =
  '👋 *ברוכים הבאים לקבוצת ' + GROUP_NAME + '!* 🎉\n\n' +
  '━━━━━━━━━━━━━━━\n' +
  '🤖 *איך מחפשים מוצר?*\n' +
  '━━━━━━━━━━━━━━━\n\n' +
  'פשוט כתוב בקבוצה:\n' +
  '_"אני מחפש + שם המוצר"_\n\n' +
  '📌 *דוגמאות:*\n' +
  '• אני מחפש אוזניות בלוטות\n' +
  '• מחפשת שעון חכם זול\n' +
  '• חפש לי מטען מהיר\n\n' +
  '🎁 *מה תקבל?*\n' +
  '• 2 מוצרים מומלצים עם מחיר\n' +
  '• דירוג וביקורות\n' +
  '• לינק ישיר לרכישה!\n\n' +
  '⚠️ *כללי הקבוצה:*\n' +
  '• אסור לקלל — 3 קללות = הוצאה!\n' +
  '• אסור לפרסם ספאם\n' +
  '• כבוד הדדי תמיד 🙏\n\n' +
  '━━━━━━━━━━━━━━━\n' +
  'עכשיו כמה שאלות קצרות 👇';

const SURVEY_Q1 = '━━━━━━━━━━━━━━━\n❓ *שאלה 1 מתוך 3*\n━━━━━━━━━━━━━━━\n\nמה אתה/את *הכי מחפש/ת*?\n\n1️⃣ אלקטרוניקה ואוזניות\n2️⃣ ביגוד ואופנה\n3️⃣ מוצרי בית\n4️⃣ ספורט ובריאות\n5️⃣ הכל!\n\n_ענה/י עם המספר בלבד_';
const SURVEY_Q2 = '━━━━━━━━━━━━━━━\n❓ *שאלה 2 מתוך 3*\n━━━━━━━━━━━━━━━\n\nמה *הגיל* שלך?\n\n1️⃣ 18-25\n2️⃣ 26-35\n3️⃣ 36-45\n4️⃣ 45+\n\n_ענה/י עם המספר בלבד_';
const SURVEY_Q3 = '━━━━━━━━━━━━━━━\n❓ *שאלה 3 מתוך 3*\n━━━━━━━━━━━━━━━\n\nמאיפה *שמעת עלינו*?\n\n1️⃣ חבר/ה המליץ\n2️⃣ פייסבוק\n3️⃣ אינסטגרם\n4️⃣ טיקטוק\n5️⃣ אחר\n\n_ענה/י עם המספר בלבד_';
const SURVEY_DONE = '━━━━━━━━━━━━━━━\n✅ *מעולה! השאלון הושלם!*\n━━━━━━━━━━━━━━━\n\n🎉 ברוכים הבאים לקבוצה!\nכתוב/י *אני מחפש + מוצר* ונמצא לך! 🔥';

const Q1_ANSWERS = ['','אלקטרוניקה','ביגוד','מוצרי בית','ספורט','הכל'];
const Q2_ANSWERS = ['','18-25','26-35','36-45','45+'];
const Q3_ANSWERS = ['','חבר/ה','פייסבוק','אינסטגרם','טיקטוק','אחר'];

function getPhone(raw) { return raw.replace('c.us','').replace('@','').replace('.','').trim(); }
function isAdmin(raw) { return ADMIN_NUMBERS.indexOf(getPhone(raw)) !== -1; }
function isFrozen(raw) { return frozenUsers.indexOf(getPhone(raw)) !== -1; }
function hasBadWord(t) { var l=t.toLowerCase(); for(var i=0;i<BAD_WORDS.length;i++) if(l.indexOf(BAD_WORDS[i].toLowerCase())!==-1) return true; return false; }
function hasSpam(t) { for(var i=0;i<SPAM_WORDS.length;i++) if(t.indexOf(SPAM_WORDS[i])!==-1) return true; return false; }
function translateToEnglish(text) { var r=text; for(var k in TRANSLATIONS) r=r.split(k).join(TRANSLATIONS[k]); return r; }
function buildSearchLink(query) { return 'https://www.aliexpress.com/wholesale?SearchText='+encodeURIComponent(translateToEnglish(query))+'&SortType=total_tranpro_desc&aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key='+ALI_TRACKING_ID+'&terminal_id='+ALI_APP_KEY; }
function getHeat() { var h=''; for(var i=0;i<Math.floor(Math.random()*3)+3;i++) h+='🔥'; return h; }
function getGreeting() { var h=new Date().getHours(); if(h>=6&&h<12) return '☀️ בוקר טוב'; if(h>=12&&h<17) return '🌤️ צהריים טובים'; if(h>=17&&h<21) return '🌆 ערב טוב'; return '🌙 לילה טוב'; }
function sleep(ms) { return new Promise(function(r){setTimeout(r,ms);}); }
function getTopSearches() { return Object.keys(popularSearches).sort(function(a,b){return popularSearches[b]-popularSearches[a];}).slice(0,3); }

async function sendMsg(chatId, message) {
  try {
    await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendMessage/'+API_TOKEN, {chatId:chatId, message:message});
    console.log('✅ נשלח ל:'+chatId.substring(0,20));
  } catch(e) { console.error('❌ שגיאה:'+e.message); }
}

async function sendTyping(chatId) {
  try { await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendTyping/'+API_TOKEN,{chatId:chatId}); } catch(e) {}
}

async function sendToAdmins(msg) {
  for(var i=0;i<ADMIN_NUMBERS.length;i++) await sendMsg(ADMIN_NUMBERS[i]+'@c.us', msg);
}

async function removeFromGroup(phone) {
  try {
    await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/removeGroupParticipant/'+API_TOKEN, {
      groupId: GROUP_CHAT_ID,
      participantChatId: phone+'@c.us'
    });
    return true;
  } catch(e) { return false; }
}

// ===== חיפוש מוצרים דרך RapidAPI =====
async function searchProducts(query) {
  try {
    var englishQuery = translateToEnglish(query);
    var response = await axios.get('https://aliexpress-datahub.p.rapidapi.com/item_search', {
      params: { q: englishQuery, page: '1', sort: 'default' },
      headers: {
        'x-rapidapi-key': RAPID_API_KEY,
        'x-rapidapi-host': 'aliexpress-datahub.p.rapidapi.com'
      },
      timeout: 15000
    });

    if (response.data && response.data.result && response.data.result.resultList) {
      var items = response.data.result.resultList;
      if (!items || items.length === 0) return [];

      return items.slice(0, 4).map(function(item) {
        var info = item.item || {};
        var productId = info.itemId || '';
        var title = info.title ? info.title.substring(0, 60) : 'מוצר מומלץ';
        var price = info.sku && info.sku.def ? (info.sku.def.promotionPrice || info.sku.def.price || '?') : '?';
        var sales = info.sales || 0;
        var rating = info.averageStarRating || 0;
        var link = 'https://www.aliexpress.com/item/'+productId+'.html?aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key='+ALI_TRACKING_ID+'&terminal_id='+ALI_APP_KEY;
        return { title:title, price:price, sales:sales, rating:rating, link:link };
      }).filter(function(p){ return p.link && p.price !== '?'; }).slice(0,2);
    }
    return [];
  } catch(e) {
    console.error('שגיאה בחיפוש RapidAPI:'+e.message);
    return [];
  }
}

// ===== חיפוש AliExpress API רשמי =====
async function searchAliExpress(query) {
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
      page_size: '6',
      sort: 'LAST_VOLUME_DESC',
      fields: 'product_id,product_title,sale_price,evaluate_rate,lastest_volume,promotion_link,original_price'
    };
    var sortedKeys = Object.keys(params).sort();
    var signStr = ALI_APP_SECRET;
    for(var i=0;i<sortedKeys.length;i++) signStr += sortedKeys[i]+params[sortedKeys[i]];
    signStr += ALI_APP_SECRET;
    params.sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
    var qs = Object.keys(params).map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&');
    var res = await axios.get('https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.listPromotionProduct/'+ALI_APP_KEY+'?'+qs, {timeout:10000});
    if(res.data && res.data.result && res.data.result.products) {
      var products = res.data.result.products.product;
      if(!products || products.length===0) return [];
      return products
        .filter(function(p){ return p.evaluate_rate && parseFloat(p.evaluate_rate)>75 && p.promotion_link; })
        .sort(function(a,b){ return parseFloat(b.evaluate_rate)-parseFloat(a.evaluate_rate); })
        .slice(0,2)
        .map(function(p){
          return {
            title: p.product_title ? p.product_title.substring(0,60) : 'מוצר',
            price: p.sale_price || '?',
            sales: p.lastest_volume || 0,
            rating: p.evaluate_rate || 0,
            link: p.promotion_link
          };
        });
    }
    return [];
  } catch(e) {
    console.error('שגיאה AliExpress API:'+e.message);
    return [];
  }
}

async function getProducts(query) {
  // נסה קודם AliExpress API הרשמי
  var products = await searchAliExpress(query);
  // אם לא מצא — נסה RapidAPI
  if (!products || products.length === 0) {
    products = await searchProducts(query);
  }
  return products;
}

function buildProductMessage(products, query, name) {
  var fallbackLink = buildSearchLink(query);

  if (!products || products.length === 0) {
    return '@'+name+' ✅ *מצאתי עבורך '+query+'!*\n\n' +
      '🌡️ חום הדיל: '+getHeat()+'\n\n' +
      '👉 '+fallbackLink+'\n\n' +
      '🔥 לחץ לראות את הדילים!';
  }

  var msg = '@'+name+' ✅ *מצאתי עבורך '+query+'!*\n\n';
  var bestLink = fallbackLink;

  for(var i=0;i<products.length;i++) {
    var p = products[i];
    if(i===0) bestLink = p.link;
    msg += (i+1)+'️⃣ *'+p.title+'*\n';
    msg += '💰 מחיר: $'+p.price+'\n';
    if(p.rating) msg += '⭐ דירוג: '+p.rating+(p.rating>10?'%':'/5')+'\n';
    if(p.sales) msg += '📦 '+p.sales+' מכירות\n';
    msg += '🔗 '+p.link+'\n\n';
  }
  msg += '━━━━━━━━━━━━━━━\n';
  msg += '💡 _לינקים עם קוד שותפים_';

  return { msg:msg, link:bestLink };
}

// ===== שאלון חבר חדש =====
async function startNewUserFlow(phone, name) {
  newUserFlow[phone] = { step:0, name:name, answers:{} };
  await sendMsg(phone+'@c.us', WELCOME_INFO);
  await sendMsg(phone+'@c.us', SURVEY_Q1);
  newUserFlow[phone].step = 1;
}

async function handleNewUserAnswer(phone, name, text) {
  var flow = newUserFlow[phone];
  if(!flow) return false;
  var num = parseInt(text.trim());

  if(flow.step===1) {
    if(isNaN(num)||num<1||num>5) { await sendMsg(phone+'@c.us','⚠️ אנא ענה/י עם מספר בין 1 ל-5'); return true; }
    flow.answers.q1 = Q1_ANSWERS[num];
    await sendMsg(phone+'@c.us', SURVEY_Q2);
    flow.step = 2;
    return true;
  }
  if(flow.step===2) {
    if(isNaN(num)||num<1||num>4) { await sendMsg(phone+'@c.us','⚠️ אנא ענה/י עם מספר בין 1 ל-4'); return true; }
    flow.answers.q2 = Q2_ANSWERS[num];
    await sendMsg(phone+'@c.us', SURVEY_Q3);
    flow.step = 3;
    return true;
  }
  if(flow.step===3) {
    if(isNaN(num)||num<1||num>5) { await sendMsg(phone+'@c.us','⚠️ אנא ענה/י עם מספר בין 1 ל-5'); return true; }
    flow.answers.q3 = Q3_ANSWERS[num];
    flow.step = 0;
    await sendMsg(phone+'@c.us', SURVEY_DONE);
    await sendToAdmins('📋 *חבר/ה חדש/ה השלים שאלון!*\n\n👤 שם: '+name+'\n📱 מספר: '+phone+'\n\n📊 *תשובות:*\n🔍 מחפש: '+flow.answers.q1+'\n🎂 גיל: '+flow.answers.q2+'\n📣 שמע: '+flow.answers.q3);
    await sendMsg(GROUP_CHAT_ID, '🎉 *ברוכים הבאים @'+name+'!*\n\nשמחים שהצטרפת! 😊\nכתוב/י *אני מחפש + מוצר* ונמצא לך! 🔥');
    delete newUserFlow[phone];
    return true;
  }
  return false;
}

// ===== סקר =====
async function startPoll() {
  pollActive = true;
  for(var k in pollVotes) delete pollVotes[k];
  for(var i=0;i<POLL_OPTIONS.length;i++) pollVotes[i+1] = 0;
  var top = getTopSearches();
  var topMsg = top.length>0 ? '\n\n💡 _הכי חיפשתם: '+top.join(', ')+'_' : '';
  var msg = '━━━━━━━━━━━━━━━\n📊 *סקר שבועי!*\n━━━━━━━━━━━━━━━\n\n';
  for(var j=0;j<POLL_OPTIONS.length;j++) msg += (j+1)+'. '+POLL_OPTIONS[j]+'\n';
  msg += '\n✍️ *ענו עם המספר!*'+topMsg+'\n\n⏰ _פתוח 24 שעות_\n━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID, msg);
  if(pollTimeout) clearTimeout(pollTimeout);
  pollTimeout = setTimeout(async function(){ await sendPollResults(); }, 24*60*60*1000);
}

async function sendPollResults() {
  pollActive = false;
  var total = 0;
  for(var k in pollVotes) total += pollVotes[k];
  if(total===0) { await sendToAdmins('📊 אף אחד לא הצביע 😕'); return; }
  var results = Object.keys(pollVotes).map(function(k){ return {num:parseInt(k),name:POLL_OPTIONS[parseInt(k)-1],votes:pollVotes[k]}; }).sort(function(a,b){return b.votes-a.votes;});
  var msg = '━━━━━━━━━━━━━━━\n📊 *תוצאות הסקר!*\n━━━━━━━━━━━━━━━\n\nהצביעו: *'+total+'*\n\n';
  var medals = ['🥇','🥈','🥉'];
  for(var i=0;i<results.length;i++) { if(results[i].votes>0) { var pct=Math.round(results[i].votes/total*100); msg+=(i<3?medals[i]:'▫️')+' '+results[i].name+': '+results[i].votes+' ('+pct+'%)\n'; } }
  msg += '\n🏆 *מנצח: '+results[0].name+'!*\n━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID, msg);
  await sendToAdmins('📊 מנצח: '+results[0].name);
}

async function sendDailyDeal() {
  var top = getTopSearches();
  var query = top.length>0 ? top[0] : 'bluetooth earphones';
  var products = await getProducts(query);
  var msg = '━━━━━━━━━━━━━━━\n🚨 *דיל היום!* 🚨\n━━━━━━━━━━━━━━━\n\n🌡️ חום: '+getHeat()+'\n\n';
  if(products && products.length>0) {
    var p = products[0];
    msg += '*'+p.title+'*\n💰 $'+p.price+'\n';
    if(p.rating) msg += '⭐ '+p.rating+(p.rating>10?'%':'/5')+'\n';
    msg += '\n👉 '+p.link+'\n\n';
  } else {
    msg += '👉 '+buildSearchLink(query)+'\n\n';
  }
  msg += '⚡ _אל תפספסו!_\n━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID, msg);
}

async function sendSurprise() {
  var top = getTopSearches();
  var query = top.length>0 ? top[Math.floor(Math.random()*top.length)] : 'cool gadget 2024';
  var products = await getProducts(query);
  var msg = '━━━━━━━━━━━━━━━\n🎁 *קופסת הפתעה!*\n━━━━━━━━━━━━━━━\n\n🤯 מצאתי לכם משהו מטורף!\n\n';
  if(products && products.length>0) { var p=products[0]; msg+='*'+p.title+'*\n💰 $'+p.price+'\n\n👉 '+p.link+'\n\n'; }
  else { msg += '👉 '+buildSearchLink(query)+'\n\n'; }
  msg += '😱\n━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID, msg);
}

async function announceKing() {
  var king=null,max=0;
  for(var p in searchCount) if(searchCount[p]>max){max=searchCount[p];king=p;}
  if(king&&max>0) {
    await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n👑 *מלך הקבוצה!*\n━━━━━━━━━━━━━━━\n\n@'+king+' חיפש/ה *'+max+'* פעמים!\n🏆 כל הכבוד! 🔥\n━━━━━━━━━━━━━━━');
    for(var k in searchCount) delete searchCount[k];
  }
}

async function handleAdmin(text, chatId) {
  var cmd = text.trim();
  console.log('👑 פקודה: '+cmd);
  if(cmd==='!דיל'){await sendDailyDeal();await sendMsg(chatId,'✅ דיל נשלח!');return;}
  if(cmd==='!סקר'){await startPoll();await sendMsg(chatId,'✅ סקר נשלח! תוצאות ב-24 שעות');return;}
  if(cmd==='!תוצאות'){await sendPollResults();await sendMsg(chatId,'✅');return;}
  if(cmd==='!הפתעה'){await sendSurprise();await sendMsg(chatId,'✅ הפתעה נשלחה!');return;}
  if(cmd==='!מלך'){await announceKing();await sendMsg(chatId,'✅');return;}
  if(cmd==='!מצב'){var t=0;for(var p in searchCount)t+=searchCount[p];var top=getTopSearches();await sendMsg(chatId,'📊 *סטטוס:*\n🔍 חיפושים: '+t+'\n❄️ מוקפאים: '+frozenUsers.length+'\n👑 VIP: '+vipUsers.length+'\n🔥 הכי נחפש: '+(top[0]||'אין'));return;}
  if(cmd==='!ניקוי'){for(var k in searchCount)delete searchCount[k];await sendMsg(chatId,'✅ אופס!');return;}
  if(cmd==='!בוקר'){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n☀️ *בוקר טוב!*\n━━━━━━━━━━━━━━━\n\nיום חדש = דילים חדשים! 🔥\nכתבו *אני מחפש + מה שרוצים*! 💪\n━━━━━━━━━━━━━━━');await sendMsg(chatId,'✅');return;}
  if(cmd==='!ערב'){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n🌙 *ערב טוב!*\n━━━━━━━━━━━━━━━\n\nעדיין מחפשים? כתבו ונמצא! 🔍\n━━━━━━━━━━━━━━━');await sendMsg(chatId,'✅');return;}
  if(cmd==='!תחרות'){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n🏆 *תחרות דילים!*\n━━━━━━━━━━━━━━━\n\nמי ימצא את הדיל הכי זול?\nהזוכה מקבל 👑 VIP!\n\nיאללה! 🔥\n━━━━━━━━━━━━━━━');await sendMsg(chatId,'✅');return;}
  if(cmd==='!מצב לילה'){await sendMsg(GROUP_CHAT_ID,'🌙 *מצב לילה*\nהבוט עובד בלחישות 😴');await sendMsg(chatId,'✅');return;}
  if(cmd==='!מצב טירוף'){await sendMsg(GROUP_CHAT_ID,'🔥🤯💥 *מצב טירוף!*\nיאללה! 🚀💰');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!הקפא ')===0){var n=cmd.replace('!הקפא ','').replace(/^0/,'');if(frozenUsers.indexOf(n)===-1)frozenUsers.push(n);await sendMsg(chatId,'✅ הוקפא!');return;}
  if(cmd.indexOf('!שחרר ')===0){var n2=cmd.replace('!שחרר ','').replace(/^0/,'');var idx=frozenUsers.indexOf(n2);if(idx!==-1)frozenUsers.splice(idx,1);await sendMsg(chatId,'✅ שוחרר!');return;}
  if(cmd.indexOf('!VIP ')===0){var n3=cmd.replace('!VIP ','').replace(/^0/,'');if(vipUsers.indexOf(n3)===-1)vipUsers.push(n3);await sendMsg(GROUP_CHAT_ID,'👑 @'+n3+' קיבל/ה VIP! 🌟');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!אזהרה ')===0){var n4=cmd.replace('!אזהרה ','').replace(/^0/,'');await sendMsg(n4+'@c.us','⚠️ *אזהרה מהמנהל!*\nאנא שמור על כללי הקבוצה 🙏');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!כבוד ')===0){var n5=cmd.replace('!כבוד ','').replace(/^0/,'');await sendMsg(GROUP_CHAT_ID,'🏆 *גיבור/ת הקבוצה!*\n@'+n5+' הגיבור/ת שלנו! ❤️');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!הודעה ')===0){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n📢 *הודעה מהמנהל:*\n━━━━━━━━━━━━━━━\n\n'+cmd.replace('!הודעה ','')+'\n━━━━━━━━━━━━━━━');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!ברוך ')===0){var nb=cmd.replace('!ברוך ','').replace(/^0/,'');await startNewUserFlow(nb,'חבר/ה חדש/ה');await sendMsg(chatId,'✅ שאלון נשלח!');return;}
  if(cmd==='!עזרה'){await sendMsg(chatId,'━━━━━━━━━━━━━━━\n📋 *פקודות מנהל:*\n━━━━━━━━━━━━━━━\n\n!דיל !סקר !תוצאות !הפתעה !מלך\n!מצב !ניקוי !תחרות !בוקר !ערב\n!מצב לילה !מצב טירוף\n!הקפא [מספר]\n!שחרר [מספר]\n!VIP [מספר]\n!אזהרה [מספר]\n!כבוד [מספר]\n!הודעה [טקסט]\n!ברוך [מספר]\n━━━━━━━━━━━━━━━');return;}
}

function scheduleDaily(){var now=new Date(),next=new Date();next.setHours(10,0,0,0);if(now>=next)next.setDate(next.getDate()+1);setTimeout(async function(){await sendDailyDeal();scheduleDaily();},next-now);}
function scheduleWeekly(){var now=new Date(),next=new Date();next.setDate(now.getDate()+(7-now.getDay()));next.setHours(11,0,0,0);setTimeout(async function(){await startPoll();scheduleWeekly();},next-now);}
function scheduleKing(){var now=new Date(),next=new Date();next.setDate(now.getDate()+(7-now.getDay()));next.setHours(12,0,0,0);setTimeout(async function(){await announceKing();scheduleKing();},next-now);}

app.post('/webhook',async function(req,res){
  res.sendStatus(200);
  try {
    var body = req.body;
    if(!body) return;

    var sd = body.senderData || {};
    var senderRaw = sd.sender || '';
    var senderName = sd.senderName || 'חבר';
    var chatId = sd.chatId || '';
    var senderPhone = getPhone(senderRaw);

    if(body.typeWebhook==='groupParticipantsAdded') {
    if(body.typeWebhook==='incomingMessageReceived' && md && md.typeMessage==='groupInviteMessage') {
      await startNewUserFlow(senderPhone, senderName);
      return;
    }
      var newMembers = body.participants || [];
      for(var nm=0;nm<newMembers.length;nm++) {
        var newPhone = getPhone(newMembers[nm].participant||'');
        var newName = newMembers[nm].participantName||'חבר/ה חדש/ה';
        if(newPhone) await startNewUserFlow(newPhone, newName);
      }
      return;
    }

    if(body.typeWebhook!=='incomingMessageReceived') return;
    var md = body.messageData || {};
    if(!md||md.typeMessage!=='textMessage') return;
    var text = md.textMessageData&&md.textMessageData.textMessage ? md.textMessageData.textMessage : '';
    if(!text||!chatId||!senderPhone) return;

    console.log('📩 '+senderPhone+' ('+senderName+') | admin:'+isAdmin(senderRaw)+' | '+text.substring(0,30));

    if(newUserFlow[senderPhone]) {
      var handled = await handleNewUserAnswer(senderPhone, senderName, text);
      if(handled) return;
    }

    if(isAdmin(senderRaw)&&text.charAt(0)==='!') { await handleAdmin(text,chatId); return; }

    if(pollActive) {
      var voteNum = parseInt(text.trim());
      if(!isNaN(voteNum)&&voteNum>=1&&voteNum<=POLL_OPTIONS.length) {
        pollVotes[voteNum]++;
        await sendMsg(chatId,'✅ @'+senderName+' הצבעת על: *'+POLL_OPTIONS[voteNum-1]+'*\n\nתודה! 🙏');
        return;
      }
    }

    if(isFrozen(senderRaw)) return;

    if(hasSpam(text)) {
      await sendMsg(chatId,'🚫 @'+senderName+' פרסומות אסורות! 🙏');
      await sendToAdmins('🚨 *ספאם!*\n@'+senderName+':\n"'+text+'"');
      return;
    }

    if(hasBadWord(text)) {
      warningCount[senderPhone]=(warningCount[senderPhone]||0)+1;
      var w=warningCount[senderPhone];
      if(w>=3) {
        var removed = await removeFromGroup(senderPhone);
        await sendMsg(GROUP_CHAT_ID,'🚫 @'+senderName+' *הודח מהקבוצה!*\n\nקיללת 3 פעמים! ⛔');
        await sendMsg(senderPhone+'@c.us','⛔ *הודחת מקבוצת '+GROUP_NAME+'!*\n\nקיללת 3 פעמים.\nפנה/י למנהל אם זו טעות 🙏');
        await sendToAdmins('🚫 *'+senderName+' ('+senderPhone+') הודח!'+(removed?'✅':'⚠️ הוצאה ידנית נדרשת!')+'\nסיבה: 3 קללות');
        frozenUsers.push(senderPhone);
      } else {
        await sendMsg(chatId,'⚠️ @'+senderName+' אזהרה *'+w+'/3*!\nעוד '+(3-w)+' קללות ← תודח! 🚫');
        await sendMsg(senderPhone+'@c.us','⚠️ *אזהרה '+w+'/3!*\n\nקיללת בקבוצת '+GROUP_NAME+'.\nעוד '+(3-w)+' קללות ← תודח אוטומטית!\n\n😊 בוא/י נמשיך בצורה נעימה!');
        await sendToAdmins('⚠️ @'+senderName+' אזהרה '+w+'/3:\n"'+text+'"');
      }
      return;
    }

    var triggerFound=false,searchQuery=text;
    for(var t=0;t<TRIGGER_WORDS.length;t++) {
      if(text.indexOf(TRIGGER_WORDS[t])!==-1) {
        triggerFound=true;
        searchQuery=searchQuery.split(TRIGGER_WORDS[t]).join('').trim();
      }
    }
    if(!triggerFound) return;
    if(!searchQuery||searchQuery.length<2) { await sendMsg(chatId,'🎧 כתוב/י: *אני מחפש + שם המוצר*'); return; }

    if(!userMemory[senderPhone]) userMemory[senderPhone]=[];
    userMemory[senderPhone].push(searchQuery);
    searchCount[senderPhone]=(searchCount[senderPhone]||0)+1;
    popularSearches[searchQuery]=(popularSearches[searchQuery]||0)+1;
    var total=searchCount[senderPhone];
    var funnyMsg='';
    for(var fk in FUNNY) { if(searchQuery.indexOf(fk)!==-1) { funnyMsg=FUNNY[fk]; break; } }

    await sendTyping(chatId);
    if(funnyMsg) await sendMsg(chatId,funnyMsg);

    var products = await getProducts(searchQuery);
    var result = buildProductMessage(products, searchQuery, senderName);
    var replyMsg = typeof result==='object' ? result.msg : result;
    var bestLink = typeof result==='object' ? result.link : buildSearchLink(searchQuery);

    if(total===5) replyMsg+='\n\n🎉 החיפוש ה-5 שלך! 😄';
    else if(total===10) { replyMsg+='\n\n🏆 *10 חיפושים!* מלך הדילים! 👑'; await sendToAdmins('🎉 @'+senderName+' הגיע/ה ל-10 חיפושים!'); }
    else if(total===20) { if(vipUsers.indexOf(senderPhone)===-1) vipUsers.push(senderPhone); replyMsg+='\n\n💎 *20 חיפושים!* ברוכים ל-VIP! 👑'; }

    await sendMsg(chatId, replyMsg);

    await sendMsg(senderPhone+'@c.us',
      '🔔 *Hey '+senderName+'! Found '+searchQuery+' for you!*\n\n' +
      '👉 '+bestLink+'\n\n' +
      '📱 כנס/י לקבוצה *'+GROUP_NAME+'* לפרטים!'
    );

  } catch(e) { console.error('שגיאה:'+e.message); }
});

app.get('/',function(req,res){ res.send('🤖 הבוט הפרימיום פועל!'); });

var PORT=process.env.PORT||3000;
app.listen(PORT,function(){
  console.log('🚀 הבוט הפרימיום פועל על פורט '+PORT);
  scheduleDaily();
  scheduleWeekly();
  scheduleKing();
  setInterval(async function(){await sendSurprise();},7*24*60*60*1000);
  setInterval(function(){axios.get('https://aliexpress-bot-brr6.onrender.com').catch(function(){});},25000);
});
