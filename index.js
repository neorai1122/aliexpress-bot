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

// --- שיפור: שער דולר דינמי ---
let USD_TO_ILS = 3.75; 
async function updateExchangeRate() {
    try {
        const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
        if (response.data && response.data.rates && response.data.rates.ILS) {
            USD_TO_ILS = response.data.rates.ILS;
            console.log(`✅ שער הדולר עודכן ל: ${USD_TO_ILS}`);
        }
    } catch (e) { console.error('Exchange Rate Error'); }
}
updateExchangeRate();
setInterval(updateExchangeRate, 1000 * 60 * 60 * 12);

// --- שיפור: תרגום (לדיוק בחיפוש ושמות בעברית) ---
async function translateText(text, targetLang) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await axios.get(url);
        return res.data[0][0][0];
    } catch (e) { return text; }
}

// --- שיפור: קיצור לינקים ---
async function shortenLink(url) {
    try {
        const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
        return res.data;
    } catch (e) { return url; }
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

// ===== שאלות הבהרה =====
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

function getPhone(raw){return raw.replace('c.us','').replace('@','').replace('.','').trim();}
function isAdmin(raw){return ADMIN_NUMBERS.indexOf(getPhone(raw))!==-1;}
function isFrozen(raw){return frozenUsers.indexOf(getPhone(raw))!==-1;}
function hasBadWord(t){var l=t.toLowerCase();for(var i=0;i<BAD_WORDS.length;i++)if(l.indexOf(BAD_WORDS[i].toLowerCase())!==-1)return true;return false;}
function hasSpam(t){for(var i=0;i<SPAM_WORDS.length;i++)if(t.indexOf(SPAM_WORDS[i])!==-1)return true;return false;}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function getTopSearches(){return Object.keys(popularSearches).sort(function(a,b){return popularSearches[b]-popularSearches[a];}).slice(0,3);}

function usdToIls(usd){
  var num=parseFloat(usd);
  if(isNaN(num))return null;
  return Math.round(num*USD_TO_ILS);
}

function getStars(rating){
  var r=parseFloat(rating);
  if(isNaN(r))return '';
  var stars5=Math.round((r/20)*2)/2;
  var full=Math.floor(stars5);
  var half=(stars5-full)>=0.5?1:0;
  var empty=5-full-half;
  var s='';
  for(var i=0;i<full;i++)s+='⭐';
  if(half)s+='✨';
  for(var j=0;j<empty;j++)s+='☆';
  return s+' ('+stars5.toFixed(1)+'/5)';
}

// ===== שיפור: סינון רלוונטיות קפדני =====
const EXCLUDED_WORDS = {
  'iphone': ['case','cover','screen protector','tempered glass','sponge','holder','stand','cable','charger','strap','band','ring','wallet','pouch'],
  'earphones': ['case','cover','holder','cable','tip','bag','pouch'],
  'smartphone': ['case','cover','screen protector','holder','cable'],
};

function isStrictlyRelevant(title, queryEn, priceIls) {
  if (!title || !queryEn) return false;
  var t = title.toLowerCase();
  var q = queryEn.toLowerCase();

  // מניעת אביזרים זולים במקום מוצרים יקרים
  if ((q.includes('phone') || q.includes('earphone') || q.includes('watch')) && priceIls < 30) return false;

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

// ===== שליחת הודעות ותמונות =====
async function sendMsg(chatId,message){
  try{await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendMessage/'+API_TOKEN,{chatId:chatId,message:message});}
  catch(e){console.error('❌ sendMsg:'+e.message);}
}

async function sendImage(chatId,imageUrl,caption){
  try{
    await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendFileByUrl/'+API_TOKEN,{
      chatId:chatId,
      urlFile:imageUrl,
      fileName:'product.jpg',
      caption:caption||''
    });
  }catch(e){
    if(caption)await sendMsg(chatId,caption);
  }
}

async function sendTyping(chatId){try{await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendTyping/'+API_TOKEN,{chatId:chatId});}catch(e){}}
async function sendToAdmins(msg){for(var i=0;i<ADMIN_NUMBERS.length;i++)await sendMsg(ADMIN_NUMBERS[i]+'@c.us',msg);}
async function removeFromGroup(phone){
  try{await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/removeGroupParticipant/'+API_TOKEN,{groupId:GROUP_CHAT_ID,participantChatId:phone+'@c.us'});return true;}
  catch(e){return false;}
}

// ===== AliExpress API (משופר עם תרגום וקיצור לינקים) =====
async function searchAliExpress(queryHe,strict){
  try{
    // 1. תרגום החיפוש לאנגלית לדיוק מקסימלי
    const queryEn = await translateText(queryHe, 'en');
    
    var timestamp=Date.now().toString();
    var params={
      app_key:ALI_APP_KEY,
      method:'aliexpress.affiliate.product.query',
      sign_method:'md5',
      timestamp:timestamp,
      v:'2.0',
      keywords:queryEn,
      tracking_id:ALI_TRACKING_ID,
      page_size:'30',
      sort:'LAST_VOLUME_DESC',
      fields:'product_id,product_title,sale_price,evaluate_rate,lastest_volume,promotion_link,original_price,product_main_image_url'
    };
    var keys=Object.keys(params).sort();
    var signStr=ALI_APP_SECRET;
    for(var i=0;i<keys.length;i++)signStr+=keys[i]+params[keys[i]];
    signStr+=ALI_APP_SECRET;
    params.sign=crypto.createHash('md5').update(signStr,'utf8').digest('hex').toUpperCase();
    var qs=Object.keys(params).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(params[k]);}).join('&');
    var res=await axios.get('https://api-sg.aliexpress.com/sync?'+qs,{timeout:15000});
    
    var products = [];
    if (res.data && res.data.aliexpress_affiliate_product_query_response && res.data.aliexpress_affiliate_product_query_response.resp_result) {
        products = res.data.aliexpress_affiliate_product_query_response.resp_result.result.products.product || [];
    }
    
    if(products.length===0) return [];

    var filtered = [];
    for (let p of products) {
        let priceIls = usdToIls(p.sale_price);
        if (strict !== false && !isStrictlyRelevant(p.product_title, queryEn, priceIls)) continue;
        
        let titleHe = await translateText(p.product_title, 'iw');
        let shortUrl = await shortenLink(p.promotion_link);

        filtered.push({
          title: titleHe.substring(0,65),
          price: priceIls,
          originalPrice: usdToIls(p.original_price),
          sales: p.lastest_volume||0,
          rating: p.evaluate_rate||0,
          link: shortUrl,
          image: p.product_main_image_url ? (p.product_main_image_url.startsWith('//') ? 'https:' + p.product_main_image_url : p.product_main_image_url) : null
        });
        if (filtered.length >= 2) break;
    }
    return filtered;
  }catch(e){console.error('AliExpress Error:'+e.message);return[];}
}

async function sendProduct(chatId,product,num){
  var caption='━━━━━━━━━━━━━━━\n';
  caption+=num+'️⃣ *'+product.title+'*\n';
  caption+='━━━━━━━━━━━━━━━\n';
  if(product.originalPrice && product.originalPrice > product.price){
    let disc = Math.round((1-product.price/product.originalPrice)*100);
    caption+='💰 *₪'+product.price+'* ~~₪'+product.originalPrice+'~~ 🏷️ -'+disc+'%\n';
  }else{
    caption+='💰 מחיר: *₪'+product.price+'*\n';
  }
  caption+='🚚 משלוח חינם!\n';
  caption+=getStars(product.rating)+'\n';
  caption+='📦 '+Number(product.sales).toLocaleString()+' מכירות\n';
  caption+='🔗 '+product.link+'\n';
  caption+='━━━━━━━━━━━━━━━';
  if(product.image){await sendImage(chatId,product.image,caption);}
  else{await sendMsg(chatId,caption);}
}

// ===== לוגיקת שאלון חבר חדש =====
async function startNewUserFlow(phone,name){
  newUserFlow[phone]={step:0,name:name,answers:{}};
  await sendMsg(phone+'@c.us',WELCOME_INFO);
  await sleep(1500);
  await sendMsg(phone+'@c.us',SURVEY_Q1);
  newUserFlow[phone].step=1;
}

async function handleNewUserAnswer(phone,name,text){
  var flow=newUserFlow[phone];if(!flow)return false;
  var num=parseInt(text.trim());
  if(flow.step===1){if(isNaN(num)||num<1||num>5){await sendMsg(phone+'@c.us','⚠️ ענה/י עם מספר 1-5');return true;}flow.answers.q1=Q1A[num];await sendMsg(phone+'@c.us',SURVEY_Q2);flow.step=2;return true;}
  if(flow.step===2){if(isNaN(num)||num<1||num>4){await sendMsg(phone+'@c.us','⚠️ ענה/י עם מספר 1-4');return true;}flow.answers.q2=Q2A[num];await sendMsg(phone+'@c.us',SURVEY_Q3);flow.step=3;return true;}
  if(flow.step===3){
    if(isNaN(num)||num<1||num>5){await sendMsg(phone+'@c.us','⚠️ ענה/י עם מספר 1-5');return true;}
    flow.answers.q3=Q3A[num];flow.step=0;
    await sendMsg(phone+'@c.us',SURVEY_DONE);
    await sendToAdmins('📋 *חבר/ה חדש/ה!*\n👤 '+name+'\n📱 '+phone+'\n🔍 '+flow.answers.q1+'\n🎂 '+flow.answers.q2+'\n📣 '+flow.answers.q3);
    await sendMsg(GROUP_CHAT_ID,'🎉 *ברוכים הבאים @'+name+'!*\n\nשמחים שהצטרפת! 😊\nכתוב/י *אני מחפש + מוצר* ונמצא לך! 🔥');
    delete newUserFlow[phone];return true;
  }
  return false;
}

// ===== לוגיקת סקר =====
async function startPoll(){
  pollActive=true;for(var k in pollVotes)delete pollVotes[k];for(var i=0;i<POLL_OPTIONS.length;i++)pollVotes[i+1]=0;
  var top=getTopSearches();var topMsg=top.length>0?'\n\n💡 _הכי חיפשתם: '+top.join(', ')+'_':'';
  var msg='━━━━━━━━━━━━━━━\n📊 *סקר שבועי!*\n━━━━━━━━━━━━━━━\n\n';
  for(var j=0;j<POLL_OPTIONS.length;j++)msg+=(j+1)+'. '+POLL_OPTIONS[j]+'\n';
  msg+='\n✍️ *ענו עם המספר!*'+topMsg+'\n⏰ _פתוח 24 שעות_\n━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID,msg);
  if(pollTimeout)clearTimeout(pollTimeout);
  pollTimeout=setTimeout(async function(){await sendPollResults();},24*60*60*1000);
}

async function sendPollResults(){
  pollActive=false;var total=0;for(var k in pollVotes)total+=pollVotes[k];
  if(total===0){await sendToAdmins('📊 אף אחד לא הצביע 😕');return;}
  var results=Object.keys(pollVotes).map(function(k){return{name:POLL_OPTIONS[parseInt(k)-1],votes:pollVotes[k]};}).sort(function(a,b){return b.votes-a.votes;});
  var msg='━━━━━━━━━━━━━━━\n📊 *תוצאות הסקר!*\n━━━━━━━━━━━━━━━\n\nהצביעו: *'+total+'*\n\n';
  for(var i=0;i<results.length;i++){if(results[i].votes>0){msg+='▫️ '+results[i].name+': '+results[i].votes+'\n';}}
  msg+='\n🏆 *מנצח: '+results[0].name+'!*\n━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID,msg);
}

async function sendDeal(){
  var top=getTopSearches();
  var queries=['bluetooth earphones','smartwatch','fast charger usb-c','bluetooth speaker'];
  var query=top.length>0?top[0]:queries[Math.floor(Math.random()*queries.length)];
  var products=await searchAliExpress(query,false);
  if(!products||products.length===0)return;
  await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n🔥 *דיל חם!* 🔥\n━━━━━━━━━━━━━━━');
  await sendProduct(GROUP_CHAT_ID,products[0],1);
}

async function announceKing(){
  var king=null,max=0;for(var p in searchCount)if(searchCount[p]>max){max=searchCount[p];king=p;}
  if(king&&max>0){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n👑 *מלך הקבוצה!*\n━━━━━━━━━━━━━━━\n\n@'+king+' חיפש/ה *'+max+'* פעמים!\n🏆 כל הכבוד! 🔥\n━━━━━━━━━━━━━━━');for(var k in searchCount)delete searchCount[k];}
}

async function handleAdmin(text,chatId){
  var cmd=text.trim();
  if(cmd==='!דיל'){await sendDeal();await sendMsg(chatId,'✅ דיל נשלח!');return;}
  if(cmd==='!סקר'){await startPoll();await sendMsg(chatId,'✅ סקר נשלח!');return;}
  if(cmd==='!תוצאות'){await sendPollResults();return;}
  if(cmd==='!מלך'){await announceKing();return;}
  if(cmd.indexOf('!הקפא ')===0){var n=cmd.replace('!הקפא ','').replace(/^0/,'');if(frozenUsers.indexOf(n)===-1)frozenUsers.push(n);await sendMsg(chatId,'✅ הוקפא!');return;}
  if(cmd.indexOf('!שחרר ')===0){var n2=cmd.replace('!שחרר ','').replace(/^0/,'');var idx=frozenUsers.indexOf(n2);if(idx!==-1)frozenUsers.splice(idx,1);await sendMsg(chatId,'✅ שוחרר!');return;}
  if(cmd.indexOf('!VIP ')===0){var n3=cmd.replace('!VIP ','').replace(/^0/,'');if(vipUsers.indexOf(n3)===-1)vipUsers.push(n3);await sendMsg(GROUP_CHAT_ID,'👑 @'+n3+' קיבל/ה VIP! 🌟');return;}
  if(cmd.indexOf('!הודעה ')===0){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n📢 *הודעה מהמנהל:*\n━━━━━━━━━━━━━━━\n\n'+cmd.replace('!הודעה ','')+'\n━━━━━━━━━━━━━━━');return;}
  if(cmd==='!עזרה'){await sendMsg(chatId,'!דיל !סקר !תוצאות !מלך !מצב !הקפא [מספר] !שחרר [מספר] !VIP [מספר] !הודעה [טקסט]');return;}
}

async function doSearch(senderPhone,senderName,chatId,searchQuery){
  if(!userMemory[senderPhone])userMemory[senderPhone]=[];
  userMemory[senderPhone].push(searchQuery);
  searchCount[senderPhone]=(searchCount[senderPhone]||0)+1;
  popularSearches[searchQuery]=(popularSearches[searchQuery]||0)+1;
  var total=searchCount[senderPhone];

  await sendMsg(senderPhone+'@c.us','🔔 שלום *'+senderName+'*!\n\nהמוצר שלך בדרך! 📦');
  await sendTyping(chatId);
  await sleep(1500);

  var products=await searchAliExpress(searchQuery,true);

  if(!products||products.length===0){
    await sendMsg(chatId,'@'+senderName+' 😕 לא מצאתי מוצרים מדויקים עבור *'+searchQuery+'*. נסה/י מילים ספציפיות יותר!');
    return;
  }

  await sendMsg(chatId,'@'+senderName+' ✅ *מצאתי עבורך '+searchQuery+'!*');
  await sendProduct(chatId,products[0],1);
  if(products.length>1){await sendProduct(chatId,products[1],2);}

  if(total===5)await sendMsg(chatId,'🎉 @'+senderName+' החיפוש ה-5 שלך!');
  else if(total===10)await sendMsg(chatId,'🏆 @'+senderName+' *10 חיפושים!* מלך הדילים! 👑');
}

function scheduleDeal(){setTimeout(async function(){await sendDeal();setInterval(async function(){await sendDeal();},3*60*60*1000);},2*60*1000);}

// ===== Webhook Handling (כולל הכל!) =====
app.post('/webhook',async function(req,res){
  res.sendStatus(200);
  try{
    var body=req.body;if(!body)return;
    var sd=body.senderData||{};
    var senderRaw=sd.sender||'';var senderName=sd.senderName||'חבר';var chatId=sd.chatId||'';var senderPhone=getPhone(senderRaw);

    if(body.typeWebhook==='groupParticipantsAdded'){
      var newMembers=body.participants||[];
      for(var nm=0;nm<newMembers.length;nm++){var np=getPhone(newMembers[nm].participant||'');if(np)await startNewUserFlow(np,newMembers[nm].participantName||'חבר/ה');}
      return;
    }

    if(body.typeWebhook!=='incomingMessageReceived')return;
    var md=body.messageData||{};
    if(!md||md.typeMessage!=='textMessage')return;
    var text=md.textMessageData.textMessage;

    if(newUserFlow[senderPhone]){var h=await handleNewUserAnswer(senderPhone,senderName,text);if(h)return;}

    if(clarificationFlow[senderPhone]){
      var cf=clarificationFlow[senderPhone];
      var cNum=parseInt(text.trim());
      if(!isNaN(cNum)&&cNum>=1&&cNum<=cf.o.length){
        var chosen=cf.o[cNum-1];
        delete clarificationFlow[senderPhone];
        await doSearch(senderPhone,senderName,chatId,chosen);
        return;
      }
    }

    if(isAdmin(senderRaw)&&text.charAt(0)==='!'){await handleAdmin(text,chatId);return;}
    if(pollActive && !isAdmin(senderRaw)){var vn=parseInt(text.trim());if(!isNaN(vn)&&vn>=1&&vn<=POLL_OPTIONS.length){pollVotes[vn]++;await sendMsg(chatId,'✅ @'+senderName+' הצבעת בהצלחה!');return;}}

    if(isFrozen(senderRaw))return;
    if(hasSpam(text)){await sendMsg(chatId,'🚫 @'+senderName+' פרסומות אסורות!');return;}

    if(hasBadWord(text)){
      warningCount[senderPhone]=(warningCount[senderPhone]||0)+1;var w=warningCount[senderPhone];
      if(w>=3){
        await removeFromGroup(senderPhone);
        await sendMsg(GROUP_CHAT_ID,'🚫 @'+senderName+' הודח עקב קללות.');
        frozenUsers.push(senderPhone);
      }else{
        await sendMsg(chatId,'⚠️ @'+senderName+' אזהרה '+w+'/3! אל תקלל.');
      }
      return;
    }

    var triggerFound=false,searchQuery=text;
    for(var t=0;t<TRIGGER_WORDS.length;t++){if(text.indexOf(TRIGGER_WORDS[t])!==-1){triggerFound=true;searchQuery=searchQuery.split(TRIGGER_WORDS[t]).join('').trim();}}
    
    if(!triggerFound)return;
    if(!searchQuery||searchQuery.length<2){await sendMsg(chatId,'🎧 כתוב/י: *אני מחפש + שם המוצר*');return;}

    // שאלת הבהרה
    for(var ck in CLARIFICATION){
      if(searchQuery===ck||searchQuery.trim()===ck){
        var cq=CLARIFICATION[ck];
        clarificationFlow[senderPhone]={o:cq.o,chatId:chatId};
        await sendMsg(chatId,'@'+senderName+' '+cq.q);
        return;
      }
    }

    await doSearch(senderPhone,senderName,chatId,searchQuery);

  }catch(e){console.error('Error:'+e.message);}
});

app.get('/',function(req,res){res.send('🤖 הבוט הפרימיום פועל!');});
var PORT=process.env.PORT||3000;
app.listen(PORT,function(){
  console.log('🚀 הבוט פועל על פורט '+PORT);
  scheduleDeal();
  setInterval(function(){axios.get('https://aliexpress-bot-brr6.onrender.com').catch(function(){});},25000);
});
