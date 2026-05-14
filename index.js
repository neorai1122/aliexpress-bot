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
const USD_TO_ILS = 2.9;

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
const BAD_WORDS = ['זין','כוס','שרמוטה','זונה','מניאק','ממזר','אידיוט','טמבל','מפגר','חרא','בן זונה','بت زونה','كس','زبي','شرموطة','fuck','shit','bitch','asshole','bastard','idiot'];
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

// ===== מילות חסימה =====
const EXCLUDED_WORDS = {
  'iphone': ['case','cover','screen protector','tempered glass','sponge','holder','stand','cable','charger','strap','band','lens','ring','wallet','bag','pouch','cleaning','brush','stylus'],
  'samsung': ['case','cover','screen protector','tempered glass','holder','stand','cable','strap','band','lens','wallet','bag','cleaning'],
  'smartphone': ['case','cover','screen protector','tempered glass','holder','stand','cable','strap','cleaning'],
  'earphones': ['case','cover','holder','stand','cable','tip','foam','eartip','earbud tip'],
  'smartwatch': ['case','cover','strap','band','screen protector','tempered glass','charger cable'],
  'laptop': ['case','cover','sleeve','bag','stand','cooling','keyboard cover','screen protector'],
};

// ===== בדיקת רלוונטיות קפדנית =====
function isStrictlyRelevant(title, query) {
  if (!title || !query) return false;
  var t = title.toLowerCase();
  var q = query.toLowerCase();

  // בדוק מילות חסימה
  for (var key in EXCLUDED_WORDS) {
    if (q.indexOf(key) !== -1) {
      var excList = EXCLUDED_WORDS[key];
      for (var e = 0; e < excList.length; e++) {
        if (t.indexOf(excList[e]) !== -1) return false;
      }
    }
  }

  // בדוק שהמילה הראשית מופיעה בכותרת
  var words = q.split(' ').filter(function(w){ return w.length > 2; });
  if (words.length === 0) return false;
  var matches = 0;
  for (var j = 0; j < words.length; j++) {
    if (t.indexOf(words[j]) !== -1) matches++;
  }
  return matches >= 1;
}

// ===== שליחת הודעות =====
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
    console.log('✅ תמונה נשלחה');
  }catch(e){
    console.error('❌ תמונה:'+e.message);
    if(caption)await sendMsg(chatId,caption);
  }
}

async function sendTyping(chatId){try{await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendTyping/'+API_TOKEN,{chatId:chatId});}catch(e){}}
async function sendToAdmins(msg){for(var i=0;i<ADMIN_NUMBERS.length;i++)await sendMsg(ADMIN_NUMBERS[i]+'@c.us',msg);}
async function removeFromGroup(phone){
  try{await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/removeGroupParticipant/'+API_TOKEN,{groupId:GROUP_CHAT_ID,participantChatId:phone+'@c.us'});return true;}
  catch(e){return false;}
}

// ===== AliExpress API =====
async function searchAliExpress(query,strict){
  try{
    var timestamp=Date.now().toString();
    var params={
      app_key:ALI_APP_KEY,
      method:'aliexpress.affiliate.product.query',
      sign_method:'md5',
      timestamp:timestamp,
      v:'2.0',
      keywords:query,
      tracking_id:ALI_TRACKING_ID,
      page_size:'20',
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
    var data=res.data;
    var products=null;
    if(data&&data.aliexpress_affiliate_product_query_response){
      var resp=data.aliexpress_affiliate_product_query_response;
      if(resp.resp_result&&resp.resp_result.result&&resp.resp_result.result.products)
        products=resp.resp_result.result.products.product;
    }else if(data&&data.result&&data.result.products){
      products=data.result.products.product;
    }
    if(!products||products.length===0){console.log('AliExpress: אין תוצאות');return[];}
    console.log('AliExpress: '+products.length+' מוצרים');

    var filtered=products.filter(function(p){
      if(!p.promotion_link||!p.sale_price||!p.evaluate_rate)return false;
      if(parseFloat(p.evaluate_rate)<80)return false;
      if(strict!==false)return isStrictlyRelevant(p.product_title,query);
      return true;
    });

    console.log('AliExpress: '+filtered.length+' רלוונטיים');

    return filtered
      .sort(function(a,b){return parseFloat(b.evaluate_rate||0)-parseFloat(a.evaluate_rate||0);})
      .slice(0,2)
      .map(function(p){
        var priceIls=usdToIls(p.sale_price);
        var origIls=usdToIls(p.original_price);
        var disc=(origIls&&priceIls&&origIls>priceIls)?Math.round((1-priceIls/origIls)*100):0;
        return{
          title:p.product_title?p.product_title.substring(0,60):'מוצר',
          price:priceIls,
          originalPrice:origIls,
          discount:disc,
          sales:p.lastest_volume||0,
          rating:p.evaluate_rate||0,
          link:p.promotion_link,
          image:p.product_main_image_url?(p.product_main_image_url.startsWith('//')?'https:'+p.product_main_image_url:p.product_main_image_url):null
        };
      });
  }catch(e){console.error('שגיאה AliExpress:'+e.message);return[];}
}

function buildSearchLink(query){
  return 'https://www.aliexpress.com/wholesale?SearchText='+encodeURIComponent(query)+'&SortType=total_tranpro_desc&aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key='+ALI_TRACKING_ID+'&terminal_id='+ALI_APP_KEY;
}

async function sendProduct(chatId,product,num){
  var caption='━━━━━━━━━━━━━━━\n';
  caption+=num+'️⃣ *'+product.title+'*\n';
  caption+='━━━━━━━━━━━━━━━\n';
  if(product.discount&&product.originalPrice&&product.discount>0){
    caption+='💰 *₪'+product.price+'* ~~₪'+product.originalPrice+'~~ 🏷️ -'+product.discount+'%\n';
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

// ===== שאלון חבר חדש =====
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

// ===== סקר =====
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
  var medals=['🥇','🥈','🥉'];
  for(var i=0;i<results.length;i++){if(results[i].votes>0){msg+=(i<3?medals[i]:'▫️')+' '+results[i].name+': '+results[i].votes+' ('+Math.round(results[i].votes/total*100)+'%)\n';}}
  msg+='\n🏆 *מנצח: '+results[0].name+'!*\n━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID,msg);await sendToAdmins('📊 מנצח: '+results[0].name);
}

async function sendDeal(){
  var top=getTopSearches();
  var queries=['bluetooth earphones','smartwatch','fast charger usb-c','bluetooth speaker','wireless mouse','phone stand','led light'];
  var query=top.length>0?top[0]:queries[Math.floor(Math.random()*queries.length)];
  var products=await searchAliExpress(query,false);
  if(!products||products.length===0)return;
  var p=products[0];
  await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n🔥 *דיל חם!* 🔥\n━━━━━━━━━━━━━━━');
  await sendProduct(GROUP_CHAT_ID,p,1);
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
  if(cmd==='!מצב'){var t=0;for(var p in searchCount)t+=searchCount[p];var top=getTopSearches();await sendMsg(chatId,'📊 *סטטוס:*\n🔍 חיפושים: '+t+'\n❄️ מוקפאים: '+frozenUsers.length+'\n👑 VIP: '+vipUsers.length+'\n🔥 הכי נחפש: '+(top[0]||'אין'));return;}
  if(cmd==='!ניקוי'){for(var k in searchCount)delete searchCount[k];await sendMsg(chatId,'✅');return;}
  if(cmd==='!בוקר'){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n☀️ *בוקר טוב!*\n━━━━━━━━━━━━━━━\n\nיום חדש = דילים חדשים! 🔥\nכתבו *אני מחפש + מה שרוצים*! 💪\n━━━━━━━━━━━━━━━');await sendMsg(chatId,'✅');return;}
  if(cmd==='!ערב'){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n🌙 *ערב טוב!*\n━━━━━━━━━━━━━━━\n\nעדיין מחפשים? כתבו ונמצא! 🔍\n━━━━━━━━━━━━━━━');await sendMsg(chatId,'✅');return;}
  if(cmd==='!תחרות'){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n🏆 *תחרות דילים!*\n━━━━━━━━━━━━━━━\n\nמי ימצא את הדיל הכי זול?\nהזוכה מקבל 👑 VIP!\n━━━━━━━━━━━━━━━');await sendMsg(chatId,'✅');return;}
  if(cmd==='!מצב לילה'){await sendMsg(GROUP_CHAT_ID,'🌙 *מצב לילה*\nהבוט עובד בלחישות 😴');await sendMsg(chatId,'✅');return;}
  if(cmd==='!מצב טירוף'){await sendMsg(GROUP_CHAT_ID,'🔥🤯💥 *מצב טירוף!*\nיאללה! 🚀💰');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!הקפא ')===0){var n=cmd.replace('!הקפא ','').replace(/^0/,'');if(frozenUsers.indexOf(n)===-1)frozenUsers.push(n);await sendMsg(chatId,'✅ הוקפא!');return;}
  if(cmd.indexOf('!שחרר ')===0){var n2=cmd.replace('!שחרר ','').replace(/^0/,'');var idx=frozenUsers.indexOf(n2);if(idx!==-1)frozenUsers.splice(idx,1);await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!VIP ')===0){var n3=cmd.replace('!VIP ','').replace(/^0/,'');if(vipUsers.indexOf(n3)===-1)vipUsers.push(n3);await sendMsg(GROUP_CHAT_ID,'👑 @'+n3+' קיבל/ה VIP! 🌟');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!אזהרה ')===0){var n4=cmd.replace('!אזהרה ','').replace(/^0/,'');await sendMsg(n4+'@c.us','⚠️ *אזהרה מהמנהל!*\nאנא שמור על כללי הקבוצה 🙏');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!כבוד ')===0){var n5=cmd.replace('!כבוד ','').replace(/^0/,'');await sendMsg(GROUP_CHAT_ID,'🏆 *גיבור/ת הקבוצה!*\n@'+n5+' הגיבור/ת שלנו! ❤️');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!הודעה ')===0){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n📢 *הודעה מהמנהל:*\n━━━━━━━━━━━━━━━\n\n'+cmd.replace('!הודעה ','')+'\n━━━━━━━━━━━━━━━');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!ברוך ')===0){var nb=cmd.replace('!ברוך ','').replace(/^0/,'');await startNewUserFlow(nb,'חבר/ה');await sendMsg(chatId,'✅ שאלון נשלח!');return;}
  if(cmd==='!עזרה'){await sendMsg(chatId,'━━━━━━━━━━━━━━━\n📋 *פקודות מנהל:*\n━━━━━━━━━━━━━━━\n\n!דיל !סקר !תוצאות !מלך\n!מצב !ניקוי !תחרות\n!בוקר !ערב\n!מצב לילה !מצב טירוף\n!הקפא [מספר]\n!שחרר [מספר]\n!VIP [מספר]\n!אזהרה [מספר]\n!כבוד [מספר]\n!הודעה [טקסט]\n!ברוך [מספר]\n━━━━━━━━━━━━━━━');return;}
}

async function doSearch(senderPhone,senderName,chatId,searchQuery){
  if(!userMemory[senderPhone])userMemory[senderPhone]=[];
  userMemory[senderPhone].push(searchQuery);
  searchCount[senderPhone]=(searchCount[senderPhone]||0)+1;
  popularSearches[searchQuery]=(popularSearches[searchQuery]||0)+1;
  var total=searchCount[senderPhone];

  // הודעה פרטית מיידית
  await sendMsg(senderPhone+'@c.us',
    '🔔 שלום *'+senderName+'*!\n\n'+
    'המוצר שלך בדרך! 📦\n'+
    'עד שנמצא — תוכל/י לצאת מהקבוצה 😄\n\n'+
    '_מחפש את הדילים הטובים ביותר..._'
  );

  await sendTyping(chatId);
  await sleep(1500);
  await sendTyping(chatId);
  await sleep(1000);

  var products=await searchAliExpress(searchQuery,true);

  if(!products||products.length===0){
    // אין תוצאות — הצע מוצרים דומים
    var similar=null;
    var qLow=searchQuery.toLowerCase();
    for(var key in SIMILAR_PRODUCTS){
      if(qLow.indexOf(key)!==-1){similar=SIMILAR_PRODUCTS[key];break;}
    }

    var msg='@'+senderName+' 😕 לא מצאתי מוצרים מדויקים עבור *'+searchQuery+'*\n\n';
    if(similar&&similar.length>0){
      msg+='💡 *אולי תתעניין/י ב:*\n\n';
      for(var s=0;s<Math.min(similar.length,3);s++){
        msg+='• '+similar[s]+'\n';
      }
      msg+='\n_כתוב/י אחד מהמוצרים למעלה לחיפוש!_';
    } else {
      msg+='💡 נסה/י לחפש עם מילים ספציפיות יותר!\n';
      msg+='_לדוגמה: "אוזניות בלוטות Samsung" במקום "אוזניות"_';
    }
    await sendMsg(chatId,msg);
    return;
  }

  await sendMsg(chatId,'@'+senderName+' ✅ *מצאתי עבורך '+searchQuery+'!*\n\nהנה 2 המוצרים הכי שווים 👇');

  await sendProduct(chatId,products[0],1);
  await sleep(800);
  if(products.length>1){await sendProduct(chatId,products[1],2);}

  if(total===5)await sendMsg(chatId,'🎉 @'+senderName+' החיפוש ה-5 שלך! 😄');
  else if(total===10){await sendMsg(chatId,'🏆 @'+senderName+' *10 חיפושים!* מלך הדילים! 👑');await sendToAdmins('🎉 @'+senderName+' הגיע/ה ל-10 חיפושים!');}
  else if(total===20){if(vipUsers.indexOf(senderPhone)===-1)vipUsers.push(senderPhone);await sendMsg(chatId,'💎 @'+senderName+' *20 חיפושים!* VIP! 👑');}
}

function scheduleDeal(){
  setTimeout(async function(){
    await sendDeal();
    setInterval(async function(){await sendDeal();},3*60*60*1000);
  },2*60*1000);
}
function scheduleWeekly(){var now=new Date(),next=new Date();next.setDate(now.getDate()+(7-now.getDay()));next.setHours(11,0,0,0);setTimeout(async function(){await startPoll();scheduleWeekly();},next-now);}
function scheduleKing(){var now=new Date(),next=new Date();next.setDate(now.getDate()+(7-now.getDay()));next.setHours(12,0,0,0);setTimeout(async function(){await announceKing();scheduleKing();},next-now);}

app.post('/webhook',async function(req,res){
  res.sendStatus(200);
  try{
    var body=req.body;if(!body)return;
    var sd=body.senderData||{};
    var senderRaw=sd.sender||'';var senderName=sd.senderName||'חבר';var chatId=sd.chatId||'';var senderPhone=getPhone(senderRaw);

    if(body.typeWebhook==='groupParticipantsAdded'){
      var newMembers=body.participants||[];
      for(var nm=0;nm<newMembers.length;nm++){var np=getPhone(newMembers[nm].participant||'');var nn=newMembers[nm].participantName||'חבר/ה';if(np)await startNewUserFlow(np,nn);}
      return;
    }

    if(body.typeWebhook!=='incomingMessageReceived')return;
    var md=body.messageData||{};
    if(md.typeMessage==='groupInviteMessage'){await startNewUserFlow(senderPhone,senderName);return;}
    if(!md||md.typeMessage!=='textMessage')return;
    var text=md.textMessageData&&md.textMessageData.textMessage?md.textMessageData.textMessage:'';
    if(!text||!chatId||!senderPhone)return;

    console.log('📩 '+senderPhone+' ('+senderName+') | '+text.substring(0,35));

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

    if(pollActive&&!isAdmin(senderRaw)){var vn=parseInt(text.trim());if(!isNaN(vn)&&vn>=1&&vn<=POLL_OPTIONS.length){pollVotes[vn]++;await sendMsg(chatId,'✅ @'+senderName+' הצבעת על: *'+POLL_OPTIONS[vn-1]+'*\nתודה! 🙏');return;}}

    if(isFrozen(senderRaw))return;

    if(hasSpam(text)){await sendMsg(chatId,'🚫 @'+senderName+' פרסומות אסורות! 🙏');await sendToAdmins('🚨 *ספאם!*\n@'+senderName+':\n"'+text+'"');return;}

    if(hasBadWord(text)){
      warningCount[senderPhone]=(warningCount[senderPhone]||0)+1;var w=warningCount[senderPhone];
      if(w>=3){
        var removed=await removeFromGroup(senderPhone);
        await sendMsg(GROUP_CHAT_ID,'🚫 @'+senderName+' *הודח!*\nקיללת 3 פעמים! ⛔');
        await sendMsg(senderPhone+'@c.us','⛔ *הודחת מקבוצת '+GROUP_NAME+'!*\nקיללת 3 פעמים.\nפנה/י למנהל 🙏');
        await sendToAdmins('🚫 *'+senderName+' הודח!'+(removed?'✅':'⚠️ ידנית!')+'\n3 קללות');
        frozenUsers.push(senderPhone);
      }else{
        await sendMsg(chatId,'⚠️ @'+senderName+' אזהרה *'+w+'/3*!\nעוד '+(3-w)+' קללות ← תודח! 🚫');
        await sendMsg(senderPhone+'@c.us','⚠️ *אזהרה '+w+'/3!*\nקיללת בקבוצת '+GROUP_NAME+'.\nעוד '+(3-w)+' קללות ← תודח!\n\n😊 בוא/י נמשיך בצורה נעימה!');
        await sendToAdmins('⚠️ @'+senderName+' אזהרה '+w+'/3:\n"'+text+'"');
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

  }catch(e){console.error('שגיאה:'+e.message);}
});

app.get('/',function(req,res){res.send('🤖 הבוט הפרימיום פועל!');});
var PORT=process.env.PORT||3000;
app.listen(PORT,function(){
  console.log('🚀 הבוט הפרימיום פועל על פורט '+PORT);
  scheduleDeal();
  scheduleWeekly();
  scheduleKing();
  setInterval(function(){axios.get('https://aliexpress-bot-brr6.onrender.com').catch(function(){});},25000);
});
