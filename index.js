const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(express.json({limit: '50mb'}));

const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const BASE_URL = 'https://7107.api.greenapi.com';
const ALI_APP_KEY = '533908';
const ALI_APP_SECRET = 'iTd8ZOn3s1xmlJ7fXLoe2XYHBkkaF2dF';
const ALI_TRACKING_ID = 'bot01';
const GROUP_CHAT_ID = '120363424186489979@g.us';
const GROUP_NAME = 'דילים שווים';
const ADMIN_NUMBERS = ['972538800370', '972557119650'];

// שער דולר אוטומטי
let USD_TO_ILS = 3.75;
async function updateExchangeRate() {
  try {
    const res = await axios.get('https://api.exchangerate-api.com/v4/latest/USD',{timeout:8000});
    if(res.data?.rates?.ILS) { USD_TO_ILS=res.data.rates.ILS; console.log('💱 שער דולר: '+USD_TO_ILS.toFixed(2)); }
  } catch(e) { console.log('שער דולר נכשל, משתמש ב-'+USD_TO_ILS); }
}
updateExchangeRate();
setInterval(updateExchangeRate, 12*60*60*1000);

// ===== פעולה 1: CACHE חכם =====
const searchCache = {};
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 שעות

function getCached(query) {
  const key = query.toLowerCase().trim();
  const cached = searchCache[key];
  if(!cached) return null;
  if(Date.now() - cached.time > CACHE_TTL) { delete searchCache[key]; return null; }
  console.log('⚡ Cache hit: '+query);
  return cached.products;
}

function setCache(query, products) {
  const key = query.toLowerCase().trim();
  searchCache[key] = { products, time: Date.now() };
  console.log('💾 Cache saved: '+query);
}

// ===== פעולה 2: פילטר חכם אוניברסלי =====
const ACCESSORY_WORDS = [
  'case','cover','protector','tempered glass','screen glass',
  'strap','band','bracelet band','watch band',
  'holder','stand','mount','bracket',
  'cable','charging cable','data cable',
  'sponge','cleaning','brush','cloth',
  'replacement','repair','spare part',
  'film','skin','sticker','decal',
  'pouch','sleeve','bag for',
  'adapter','converter','hub'
];

function isMainProduct(title, queryEn) {
  if(!title) return false;
  const t = title.toLowerCase();
  const q = queryEn.toLowerCase();

  // בדוק שהכותרת לא מכילה מילת אביזר
  for(const word of ACCESSORY_WORDS) {
    if(t.includes(word)) {
      console.log('❌ סונן אביזר: '+title.substring(0,40)+' ('+word+')');
      return false;
    }
  }

  // בדוק שלפחות מילה אחת מהחיפוש מופיעה בכותרת
  const words = q.split(' ').filter(w => w.length > 2);
  const found = words.some(w => t.includes(w));
  if(!found) console.log('❌ סונן לא רלוונטי: '+title.substring(0,40));
  return found;
}

// ===== פעולה 3: דיל יומי מתחלף =====
const DEAL_QUERIES = [
  'bluetooth earphones wireless','smartwatch fitness',
  'fast charger usb-c','bluetooth speaker waterproof',
  'wireless mouse','led strip lights rgb',
  'phone stand holder','laptop stand adjustable',
  'mini projector portable','robot vacuum cleaner',
  'electric toothbrush','air fryer small',
  'running shoes sport','sunglasses polarized',
  'backpack waterproof'
];
let dealIndex = 0;

function getNextDealQuery() {
  const query = DEAL_QUERIES[dealIndex % DEAL_QUERIES.length];
  dealIndex++;
  return query;
}

// זיכרון
const searchCount = {};
const frozenUsers = [];
const vipUsers = [];
const warningCount = {};
const popularSearches = {};
const newUserFlow = {};
let pollActive = false;
let pollVotes = {};
let pollTimeout = null;

const TRIGGER_WORDS = ['אני מחפש','אני מחפשת','חפש לי','חפשי לי','אני צריך','אני צריכה','מחפש','מחפשת','תמצא לי','תביא לי','רוצה לקנות','מישהו מכיר','תמצאו לי','תביאו לי'];
const BAD_WORDS = ['זין','כוס','שרמוטה','זונה','מניאק','ממזר','אידיוט','טמבל','מפגר','חרא','בן זונה','كس','زبي','شرموطة','fuck','shit','bitch','asshole','bastard','idiot'];
const SPAM_WORDS = ['הצטרפו','קבוצה חדשה','דרושים','טלגרם','השקעה','הרוויחו','ביטקוין','הימור','קזינו'];

// ===== פעולה 4: סקר תוקן =====
// POLL_OPTIONS חייב להיות מדויק — 10 אפשרויות = מספרים 1-10
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

const WELCOME_INFO = '👋 *ברוכים הבאים לקבוצת '+GROUP_NAME+'!* 🎉\n\n━━━━━━━━━━━━━━━\n🤖 *איך מחפשים מוצר?*\n━━━━━━━━━━━━━━━\n\nכתוב בקבוצה:\n_"אני מחפש + שם המוצר"_\n\n📌 *דוגמאות:*\n• אני מחפש אוזניות בלוטות\n• מחפשת שעון חכם\n• חפש לי מטען מהיר\n\n🎁 *מה תקבל?*\n• 2 מוצרים עם תמונות\n• מחיר בשקלים\n• ביקורות ודירוג\n• לינק קצר לרכישה!\n\n⚠️ *כללי הקבוצה:*\n• אסור לקלל — 3 קללות = הוצאה!\n• אסור ספאם 🙏\n\n━━━━━━━━━━━━━━━\nכמה שאלות קצרות 👇';
const SURVEY_Q1 = '━━━━━━━━━━━━━━━\n❓ *שאלה 1/2*\n━━━━━━━━━━━━━━━\n\nמה *הכי מעניין* אותך?\n\n1️⃣ אלקטרוניקה\n2️⃣ ביגוד\n3️⃣ מוצרי בית\n4️⃣ ספורט\n5️⃣ הכל!\n\n_ענה/י עם מספר_';
const SURVEY_Q2 = '━━━━━━━━━━━━━━━\n❓ *שאלה 2/2*\n━━━━━━━━━━━━━━━\n\nמה *הגיל* שלך?\n\n1️⃣ 18-25\n2️⃣ 26-35\n3️⃣ 36-45\n4️⃣ 45+\n\n_ענה/י עם מספר_';
const SURVEY_DONE = '━━━━━━━━━━━━━━━\n✅ *תודה! הכל מוכן!*\n━━━━━━━━━━━━━━━\n\n🎉 ברוכים הבאים!\nכתוב/י *אני מחפש + מוצר* ונמצא לך! 🔥';

function getPhone(raw){return raw.replace('@c.us','').replace('@g.us','').replace('@','').trim();}
function isAdmin(raw){return ADMIN_NUMBERS.indexOf(getPhone(raw))!==-1;}
function isFrozen(raw){return frozenUsers.indexOf(getPhone(raw))!==-1;}
function hasBadWord(t){const l=t.toLowerCase();for(const b of BAD_WORDS)if(l.includes(b))return true;return false;}
function hasSpam(t){for(const s of SPAM_WORDS)if(t.includes(s))return true;return false;}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function getTopSearches(){return Object.keys(popularSearches).sort((a,b)=>popularSearches[b]-popularSearches[a]).slice(0,3);}

function getStars(rating){
  const r=parseFloat(rating);if(isNaN(r))return '⭐⭐⭐⭐⭐ (5.0/5)';
  const stars=Math.round((r/20)*2)/2;
  let s='';for(let i=0;i<Math.floor(stars);i++)s+='⭐';
  if(stars%1!==0)s+='✨';
  return s+' ('+stars.toFixed(1)+'/5)';
}

async function translateText(text, lang) {
  try {
    const url=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`;
    const res=await axios.get(url,{timeout:6000});
    if(res.data?.[0]?.[0]?.[0]) return res.data[0][0][0];
    return text;
  } catch(e){return text;}
}

async function shortenLink(url) {
  try {
    const res=await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,{timeout:8000});
    if(res.data && typeof res.data==='string' && res.data.startsWith('http')) return res.data.trim();
    return url;
  } catch(e){return url;}
}

async function sendMsg(chatId,msg){
  try{await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`,{chatId,message:msg});}
  catch(e){console.error('❌ sendMsg:'+e.message);}
}

async function sendImage(chatId,imageUrl,caption){
  try{
    if(imageUrl.startsWith('//'))imageUrl='https:'+imageUrl;
    await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/sendFileByUrl/${API_TOKEN}`,{chatId,urlFile:imageUrl,fileName:'product.jpg',caption:caption||''});
    console.log('✅ תמונה נשלחה');
  }catch(e){
    console.error('❌ תמונה:'+e.message);
    if(caption)await sendMsg(chatId,caption);
  }
}

async function sendTyping(chatId){try{await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/sendTyping/${API_TOKEN}`,{chatId});}catch(e){}}
async function sendToAdmins(msg){for(const n of ADMIN_NUMBERS)await sendMsg(n+'@c.us',msg);}
async function removeFromGroup(phone){
  try{await axios.post(`${BASE_URL}/waInstance${INSTANCE_ID}/removeGroupParticipant/${API_TOKEN}`,{groupId:GROUP_CHAT_ID,participantChatId:phone+'@c.us'});return true;}
  catch(e){return false;}
}

// ===== מנוע החיפוש עם Cache + פילטר =====
async function fetchProducts(queryEn) {
  // בדוק Cache קודם
  const cached = getCached(queryEn);
  if(cached) return cached;

  const timestamp = Date.now().toString();
  const params = {
    app_key: ALI_APP_KEY,
    method: 'aliexpress.affiliate.product.query',
    sign_method: 'md5',
    timestamp,
    v: '2.0',
    keywords: queryEn,
    tracking_id: ALI_TRACKING_ID,
    page_size: '20',
    sort: 'LAST_VOLUME_DESC',
    fields: 'product_id,product_title,sale_price,evaluate_rate,lastest_volume,promotion_link,original_price,product_main_image_url'
  };

  const keys = Object.keys(params).sort();
  let signStr = ALI_APP_SECRET;
  for(const k of keys) signStr += k + params[k];
  signStr += ALI_APP_SECRET;
  params.sign = crypto.createHash('md5').update(signStr,'utf8').digest('hex').toUpperCase();

  const qs = Object.keys(params).map(k=>`${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  const res = await axios.get(`https://api-sg.aliexpress.com/sync?${qs}`,{timeout:15000});

  const allProducts = res.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];
  console.log('📦 API החזיר '+allProducts.length+' מוצרים');

  // פילטר חכם אוניברסלי
  const filtered = allProducts.filter(p => p.promotion_link && p.sale_price && isMainProduct(p.product_title, queryEn));
  console.log('✅ '+filtered.length+' מוצרים אחרי פילטר');

  // אם אין מוצרים אחרי פילטר — נסה ללא פילטר עם דירוג גבוה
  const finalProducts = filtered.length > 0 ? filtered : allProducts.filter(p => p.promotion_link && p.sale_price && parseFloat(p.evaluate_rate||0) >= 90);

  // שמור ב-Cache
  if(finalProducts.length > 0) setCache(queryEn, finalProducts);

  return finalProducts;
}

async function searchAndSend(chatId, senderName, queryHe) {
  try {
    const queryEn = await translateText(queryHe, 'en');
    console.log('🔤 "'+queryHe+'" → "'+queryEn+'"');

    const products = await fetchProducts(queryEn);

    if(products.length === 0) {
      await sendMsg(chatId, `😕 @${senderName} לא מצאתי תוצאות עבור "${queryHe}".\n\n💡 נסה לפרט יותר, לדוגמה:\n• "שעון חכם סמסונג"\n• "אוזניות בלוטות"`)
      return;
    }

    await sendMsg(chatId, `✅ @${senderName} מצאתי! הנה הדילים הכי שווים 👇`);

    for(let i=0; i<Math.min(2,products.length); i++){
      const p = products[i];
      const priceIls = Math.round(parseFloat(p.sale_price) * USD_TO_ILS);
      const origIls = Math.round(parseFloat(p.original_price||p.sale_price) * USD_TO_ILS);
      const disc = origIls > priceIls ? Math.round((1-priceIls/origIls)*100) : 0;
      const titleHe = await translateText(p.product_title, 'iw');
      const shortUrl = await shortenLink(p.promotion_link);

      let caption = `━━━━━━━━━━━━━━━\n${i+1}️⃣ *${(titleHe||p.product_title).substring(0,85)}*\n━━━━━━━━━━━━━━━\n`;
      if(disc > 0) caption += `💰 *₪${priceIls}* ~~₪${origIls}~~ 🏷️ -${disc}%\n`;
      else caption += `💰 מחיר: *₪${priceIls}*\n`;
      caption += `🚚 משלוח חינם!\n`;
      caption += `${getStars(p.evaluate_rate)}\n`;
      caption += `📦 ${Number(p.lastest_volume||0).toLocaleString()} מכירות\n`;
      caption += `🔗 ${shortUrl}\n━━━━━━━━━━━━━━━`;

      if(p.product_main_image_url){
        const img = p.product_main_image_url.startsWith('//') ? 'https:'+p.product_main_image_url : p.product_main_image_url;
        await sendImage(chatId, img, caption);
      } else {
        await sendMsg(chatId, caption);
      }
      await sleep(1200);
    }
  } catch(e) {
    console.error('❌ searchAndSend:'+e.message);
    await sendMsg(chatId, `❌ שגיאה בחיפוש. נסה שוב בעוד רגע.`);
  }
}

async function processSearch(senderRaw, senderName, chatId, searchQuery) {
  await sendTyping(chatId);
  await searchAndSend(chatId, senderName, searchQuery);
}

async function startNewUserFlow(phone, name){
  newUserFlow[phone]={step:1,name:name};
  await sendMsg(phone+'@c.us',WELCOME_INFO);
  await sleep(1000);
  await sendMsg(phone+'@c.us',SURVEY_Q1);
}

async function handleNewUserAnswer(phone, name, text){
  const flow=newUserFlow[phone];if(!flow)return false;
  if(flow.step===1){flow.step=2;await sendMsg(phone+'@c.us',SURVEY_Q2);return true;}
  if(flow.step===2){
    await sendMsg(phone+'@c.us',SURVEY_DONE);
    await sendToAdmins('📋 *חבר/ה חדש/ה!*\n👤 '+name+'\n📱 '+phone);
    await sendMsg(GROUP_CHAT_ID,'🎉 *ברוכים הבאים @'+name+'!*\nכתוב/י *אני מחפש + מוצר* ונמצא לך! 🔥');
    delete newUserFlow[phone];return true;
  }
  return false;
}

// סקר
async function startPoll(){
  pollActive=true;for(const k in pollVotes)delete pollVotes[k];
  for(let i=0;i<POLL_OPTIONS.length;i++)pollVotes[i+1]=0;
  const top=getTopSearches();
  const topMsg=top.length>0?'\n\n💡 _הכי חיפשתם: '+top.join(', ')+'_':'';
  let msg='━━━━━━━━━━━━━━━\n📊 *סקר שבועי!*\n━━━━━━━━━━━━━━━\n\n';
  for(let j=0;j<POLL_OPTIONS.length;j++)msg+=(j+1)+'. '+POLL_OPTIONS[j]+'\n';
  msg+='\n✍️ *ענו עם המספר 1-'+POLL_OPTIONS.length+'!*'+topMsg+'\n⏰ _פתוח 24 שעות_\n━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID,msg);
  if(pollTimeout)clearTimeout(pollTimeout);
  pollTimeout=setTimeout(async()=>await sendPollResults(),24*60*60*1000);
}

async function sendPollResults(){
  pollActive=false;let total=0;for(const k in pollVotes)total+=pollVotes[k];
  if(total===0){await sendToAdmins('📊 אף אחד לא הצביע 😕');return;}
  const results=Object.keys(pollVotes).map(k=>({name:POLL_OPTIONS[parseInt(k)-1],votes:pollVotes[k]})).sort((a,b)=>b.votes-a.votes);
  let msg='━━━━━━━━━━━━━━━\n📊 *תוצאות הסקר!*\n━━━━━━━━━━━━━━━\n\nהצביעו: *'+total+'*\n\n';
  const medals=['🥇','🥈','🥉'];
  for(let i=0;i<results.length;i++){if(results[i].votes>0)msg+=(i<3?medals[i]:'▫️')+' '+results[i].name+': '+results[i].votes+' ('+Math.round(results[i].votes/total*100)+'%)\n';}
  msg+='\n🏆 *מנצח: '+results[0].name+'!*\n━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID,msg);
  await sendToAdmins('📊 מנצח: '+results[0].name);
}

// דיל עם רשימה מתחלפת
async function sendDeal(){
  const query = getNextDealQuery();
  console.log('🔥 דיל: '+query);
  await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n🔥 *דיל חם!* 🔥\n━━━━━━━━━━━━━━━');
  await searchAndSend(GROUP_CHAT_ID,'דיל יומי',query);
}

async function announceKing(){
  let king=null,max=0;
  for(const p in searchCount)if(searchCount[p]>max){max=searchCount[p];king=p;}
  if(king&&max>0){
    await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n👑 *מלך הקבוצה!*\n━━━━━━━━━━━━━━━\n\n@'+king+' חיפש/ה *'+max+'* פעמים!\n🏆 כל הכבוד! 🔥\n━━━━━━━━━━━━━━━');
    for(const k in searchCount)delete searchCount[k];
  }
}

async function handleAdmin(text,chatId){
  const cmd=text.trim();
  if(cmd==='!דיל'){await sendDeal();await sendMsg(chatId,'✅ דיל נשלח!');return;}
  if(cmd==='!סקר'){await startPoll();await sendMsg(chatId,'✅ סקר נשלח!');return;}
  if(cmd==='!תוצאות'){await sendPollResults();return;}
  if(cmd==='!מלך'){await announceKing();return;}
  if(cmd==='!מצב'){
    let t=0;for(const p in searchCount)t+=searchCount[p];
    const top=getTopSearches();
    const cacheSize=Object.keys(searchCache).length;
    await sendMsg(chatId,'📊 *סטטוס:*\n🔍 חיפושים: '+t+'\n💾 Cache: '+cacheSize+' פריטים\n❄️ מוקפאים: '+frozenUsers.length+'\n👑 VIP: '+vipUsers.length+'\n💱 $=₪'+USD_TO_ILS.toFixed(2)+'\n🔥 הכי נחפש: '+(top[0]||'אין')+'\n📋 דיל הבא: '+DEAL_QUERIES[dealIndex%DEAL_QUERIES.length]);
    return;
  }
  if(cmd==='!ניקוי'){for(const k in searchCount)delete searchCount[k];await sendMsg(chatId,'✅');return;}
  if(cmd==='!ניקוי cache'){for(const k in searchCache)delete searchCache[k];await sendMsg(chatId,'✅ Cache נוקה!');return;}
  if(cmd==='!בוקר'){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n☀️ *בוקר טוב!*\n━━━━━━━━━━━━━━━\n\nיום חדש = דילים חדשים! 🔥\nכתבו *אני מחפש + מה שרוצים*!\n━━━━━━━━━━━━━━━');await sendMsg(chatId,'✅');return;}
  if(cmd==='!ערב'){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n🌙 *ערב טוב!*\n━━━━━━━━━━━━━━━\n\nעדיין מחפשים? כתבו ונמצא! 🔍\n━━━━━━━━━━━━━━━');await sendMsg(chatId,'✅');return;}
  if(cmd==='!תחרות'){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n🏆 *תחרות דילים!*\n━━━━━━━━━━━━━━━\n\nמי ימצא את הדיל הכי זול?\nהזוכה מקבל 👑 VIP!\n━━━━━━━━━━━━━━━');await sendMsg(chatId,'✅');return;}
  if(cmd==='!מצב לילה'){await sendMsg(GROUP_CHAT_ID,'🌙 *מצב לילה*\nהבוט עובד בלחישות 😴');await sendMsg(chatId,'✅');return;}
  if(cmd==='!מצב טירוף'){await sendMsg(GROUP_CHAT_ID,'🔥🤯💥 *מצב טירוף!*\nיאללה! 🚀💰');await sendMsg(chatId,'✅');return;}
  if(cmd.startsWith('!הקפא ')){const n=cmd.replace('!הקפא ','').replace(/^0/,'');if(!frozenUsers.includes(n))frozenUsers.push(n);await sendMsg(chatId,'✅ הוקפא!');return;}
  if(cmd.startsWith('!שחרר ')){const n2=cmd.replace('!שחרר ','').replace(/^0/,'');const idx=frozenUsers.indexOf(n2);if(idx!==-1)frozenUsers.splice(idx,1);await sendMsg(chatId,'✅');return;}
  if(cmd.startsWith('!VIP ')){const n3=cmd.replace('!VIP ','').replace(/^0/,'');if(!vipUsers.includes(n3))vipUsers.push(n3);await sendMsg(GROUP_CHAT_ID,'👑 @'+n3+' קיבל/ה VIP! 🌟');await sendMsg(chatId,'✅');return;}
  if(cmd.startsWith('!אזהרה ')){const n4=cmd.replace('!אזהרה ','').replace(/^0/,'');await sendMsg(n4+'@c.us','⚠️ *אזהרה מהמנהל!*\nאנא שמור על כללי הקבוצה 🙏');await sendMsg(chatId,'✅');return;}
  if(cmd.startsWith('!כבוד ')){const n5=cmd.replace('!כבוד ','').replace(/^0/,'');await sendMsg(GROUP_CHAT_ID,'🏆 *גיבור/ת הקבוצה!*\n@'+n5+' הגיבור/ת שלנו! ❤️');await sendMsg(chatId,'✅');return;}
  if(cmd.startsWith('!הודעה ')){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n📢 *הודעה מהמנהל:*\n━━━━━━━━━━━━━━━\n\n'+cmd.replace('!הודעה ','')+'\n━━━━━━━━━━━━━━━');await sendMsg(chatId,'✅');return;}
  if(cmd.startsWith('!ברוך ')){const nb=cmd.replace('!ברוך ','').replace(/^0/,'');await startNewUserFlow(nb,'חבר/ה');await sendMsg(chatId,'✅ שאלון נשלח!');return;}
  if(cmd==='!עזרה'){await sendMsg(chatId,'━━━━━━━━━━━━━━━\n📋 *פקודות מנהל:*\n━━━━━━━━━━━━━━━\n\n!דיל - שלח דיל (כל פעם שונה!)\n!סקר - שלח סקר\n!תוצאות - תוצאות סקר\n!מלך - הכרז מלך\n!מצב - סטטוס מלא\n!ניקוי - אפס חיפושים\n!ניקוי cache - נקה Cache\n!תחרות !בוקר !ערב\n!מצב לילה !מצב טירוף\n!הקפא [מספר]\n!שחרר [מספר]\n!VIP [מספר]\n!אזהרה [מספר]\n!כבוד [מספר]\n!הודעה [טקסט]\n!ברוך [מספר]\n━━━━━━━━━━━━━━━');return;}
}

function scheduleDeal(){
  setTimeout(async()=>{
    await sendDeal();
    setInterval(async()=>await sendDeal(),3*60*60*1000);
  },3*60*1000);
}
function scheduleWeekly(){const now=new Date(),next=new Date();next.setDate(now.getDate()+(7-now.getDay()));next.setHours(11,0,0,0);setTimeout(async()=>{await startPoll();scheduleWeekly();},next-now);}
function scheduleKing(){const now=new Date(),next=new Date();next.setDate(now.getDate()+(7-now.getDay()));next.setHours(12,0,0,0);setTimeout(async()=>{await announceKing();scheduleKing();},next-now);}

app.post('/webhook',async(req,res)=>{
  res.sendStatus(200);
  try{
    const body=req.body;if(!body)return;
    const sd=body.senderData||{};
    const senderRaw=sd.sender||'';
    const senderName=sd.senderName||'חבר';
    const chatId=sd.chatId||'';
    const senderPhone=getPhone(senderRaw);

    if(body.typeWebhook==='groupParticipantsAdded'){
      for(const nm of (body.participants||[])){
        const np=getPhone(nm.participant||'');
        const nn=nm.participantName||'חבר/ה';
        if(np)await startNewUserFlow(np,nn);
      }
      return;
    }

    if(body.typeWebhook!=='incomingMessageReceived')return;
    const md=body.messageData||{};
    if(md.typeMessage==='groupInviteMessage'){await startNewUserFlow(senderPhone,senderName);return;}
    if(!md||md.typeMessage!=='textMessage')return;
    const text=md.textMessageData?.textMessage||'';
    if(!text||!chatId||!senderPhone)return;

    console.log('📩 '+senderPhone+' ('+senderName+') | '+text.substring(0,35));

    // שאלון חבר חדש
    if(newUserFlow[senderPhone]){
      const h=await handleNewUserAnswer(senderPhone,senderName,text);
      if(h)return;
    }

    // פקודות מנהל
    if(isAdmin(senderRaw)&&text.startsWith('!')){
      await handleAdmin(text,chatId);
      return;
    }

    // ===== פעולה 4: סקר תוקן =====
    // בודק סקר רק אם פעיל וההודעה היא מספר נקי בלבד
    if(pollActive && !isAdmin(senderRaw)){
      const trimmed = text.trim();
      const vn = parseInt(trimmed);
      // מספר נקי בלבד — לא חלק ממשפט
      if(!isNaN(vn) && vn >= 1 && vn <= POLL_OPTIONS.length && trimmed === String(vn)){
        pollVotes[vn]=(pollVotes[vn]||0)+1;
        await sendMsg(chatId,'✅ @'+senderName+' הצבעת על: *'+POLL_OPTIONS[vn-1]+'*\nתודה! 🙏');
        console.log('🗳️ הצבעה: '+senderName+' → '+POLL_OPTIONS[vn-1]);
        return;
      }
    }

    if(isFrozen(senderRaw))return;

    if(hasSpam(text)){
      await sendMsg(chatId,'🚫 @'+senderName+' פרסומות אסורות! 🙏');
      await sendToAdmins('🚨 ספאם\n@'+senderName+':\n"'+text+'"');
      return;
    }

    if(hasBadWord(text)){
      warningCount[senderPhone]=(warningCount[senderPhone]||0)+1;
      const w=warningCount[senderPhone];
      if(w>=3){
        const removed=await removeFromGroup(senderPhone);
        await sendMsg(GROUP_CHAT_ID,'🚫 @'+senderName+' הודח! קיללת 3 פעמים! ⛔');
        await sendMsg(senderPhone+'@c.us','⛔ הודחת מקבוצת '+GROUP_NAME+'!\nפנה/י למנהל 🙏');
        await sendToAdmins('🚫 '+senderName+' הודח!'+(removed?'✅':'⚠️')+'\n3 קללות');
        frozenUsers.push(senderPhone);
      } else {
        await sendMsg(chatId,'⚠️ @'+senderName+' אזהרה *'+w+'/3*! עוד '+(3-w)+' קללות ← תודח! 🚫');
        await sendMsg(senderPhone+'@c.us','⚠️ אזהרה '+w+'/3!\nעוד '+(3-w)+' קללות ← תודח!');
        await sendToAdmins('⚠️ @'+senderName+' אזהרה '+w+'/3:\n"'+text+'"');
      }
      return;
    }

    // חיפוש מוצר
    let triggerFound=false,searchQuery=text;
    for(const t of TRIGGER_WORDS){
      if(text.includes(t)){
        triggerFound=true;
        searchQuery=text.replace(t,'').trim();
        break;
      }
    }
    if(!triggerFound)return;
    if(!searchQuery||searchQuery.length<2){
      await sendMsg(chatId,'🎧 כתוב/י: *אני מחפש + שם המוצר*\n\nדוגמה: _אני מחפש אוזניות בלוטות_');
      return;
    }

    searchCount[senderPhone]=(searchCount[senderPhone]||0)+1;
    popularSearches[searchQuery]=(popularSearches[searchQuery]||0)+1;
    const total=searchCount[senderPhone];

    if(total===5)await sendMsg(chatId,'🎉 @'+senderName+' החיפוש ה-5 שלך! 😄');
    else if(total===10){await sendMsg(chatId,'🏆 @'+senderName+' 10 חיפושים! מלך הדילים! 👑');await sendToAdmins('🎉 @'+senderName+' הגיע/ה ל-10 חיפושים!');}
    else if(total===20){if(!vipUsers.includes(senderPhone))vipUsers.push(senderPhone);await sendMsg(chatId,'💎 @'+senderName+' 20 חיפושים! VIP! 👑');}

    await processSearch(senderRaw,senderName,chatId,searchQuery);

  }catch(e){console.error('שגיאה:'+e.message);}
});

app.get('/',(req,res)=>res.send('🤖 הבוט הפרימיום פועל!'));
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>{
  console.log('🚀 הבוט הפרימיום פועל על פורט '+PORT);
  scheduleDeal();
  scheduleWeekly();
  scheduleKing();
  setInterval(()=>axios.get('https://aliexpress-bot-brr6.onrender.com').catch(()=>{}),25000);
});
