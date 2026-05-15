const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(express.json({limit: '50mb'}));

// ===== הגדרות =====
const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const BASE_URL = 'https://7107.api.greenapi.com';
const ALI_APP_KEY = '533908';
const ALI_APP_SECRET = 'iTd8ZOn3s1xmlJ7fXLoe2XYHBkkaF2dF';
const ALI_TRACKING_ID = 'bot01';
const GROUP_CHAT_ID = '120363424186489979@g.us';
const GROUP_NAME = 'דילים שווים';
const ADMIN_NUMBERS = ['972538800370', '972557119650'];

// ===== שער דולר אוטומטי =====
let USD_TO_ILS = 3.7;
async function updateExchangeRate() {
  try {
    const res = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
    if (res.data && res.data.rates && res.data.rates.ILS) {
      USD_TO_ILS = res.data.rates.ILS;
      console.log('💱 שער דולר עודכן: ' + USD_TO_ILS);
    }
  } catch(e) {}
}
updateExchangeRate();
setInterval(updateExchangeRate, 12 * 60 * 60 * 1000);

// ===== זיכרון =====
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

// ===== קבועים =====
const TRIGGER_WORDS = ['אני מחפש','אני מחפשת','חפש לי','חפשי לי','אני צריך','אני צריכה','מחפש','מחפשת','תמצא לי','תביא לי','רוצה לקנות','מישהו מכיר','תמצאו לי','תביאו לי'];
const BAD_WORDS = ['זין','כוס','שרמוטה','זונה','מניאק','ממזר','אידיוט','טמבל','מפגר','חרא','בן זונה','بت زونة','كس','زبي','شرموطة','fuck','shit','bitch','asshole','bastard','idiot'];
const SPAM_WORDS = ['הצטרפו','קבוצה חדשה','דרושים','טלגרם','השקעה','הרוויחו','ביטקוין','הימור','קזינו'];
const POLL_OPTIONS = ['🎧 אוזניות','⌚ שעונים חכמים','🏠 מוצרי בית','👗 ביגוד','⚽ ספורט','💻 אלקטרוניקה','🧸 צעצועים','🍳 מטבח','💄 יופי','🔧 כלי עבודה'];

const CLARIFICATION = {
  'טלפון': { q:'📱 *איזה סוג טלפון?*\n\n1️⃣ אייפון\n2️⃣ סמסונג\n3️⃣ שיאומי\n4️⃣ אנדרואיד כללי', o:['iphone smartphone','samsung galaxy smartphone','xiaomi smartphone','android smartphone'] },
  'אוזניות': { q:'🎧 *איזה אוזניות?*\n\n1️⃣ בלוטות אלחוטיות\n2️⃣ TWS כפתור\n3️⃣ ביטול רעשים\n4️⃣ עם חוט', o:['bluetooth headphones over ear','tws earbuds wireless','noise cancelling headphones','wired earphones'] },
  'שעון': { q:'⌚ *איזה שעון?*\n\n1️⃣ שעון חכם\n2️⃣ שעון ספורט\n3️⃣ שעון אנלוגי', o:['smartwatch','sport fitness watch','analog watch'] },
  'מטען': { q:'🔌 *איזה מטען?*\n\n1️⃣ מהיר USB-C\n2️⃣ אלחוטי\n3️⃣ פאוורבנק\n4️⃣ רכב', o:['fast charger adapter usbc','wireless charger','power bank portable','car charger fast'] },
  'תיק': { q:'👜 *איזה תיק?*\n\n1️⃣ תיק גב\n2️⃣ תיק יד\n3️⃣ תיק מחשב', o:['backpack','shoulder handbag','laptop bag'] },
  'מחשב': { q:'💻 *איזה מחשב?*\n\n1️⃣ לפטופ\n2️⃣ טאבלט\n3️⃣ מיני PC', o:['laptop computer','android tablet','mini pc'] },
  'נעליים': { q:'👟 *איזה נעליים?*\n\n1️⃣ ספורט\n2️⃣ קז\'ואל\n3️⃣ עקבים\n4️⃣ סנדלים', o:['running sport shoes','casual sneakers','high heels women','sandals summer'] },
  'רמקול': { q:'🔊 *איזה רמקול?*\n\n1️⃣ בלוטות נייד\n2️⃣ עמיד למים\n3️⃣ רמקול בית', o:['bluetooth speaker portable','waterproof bluetooth speaker','home theater speaker'] }
};

const WELCOME_INFO = '👋 *ברוכים הבאים לקבוצת '+GROUP_NAME+'!* 🎉\n\n━━━━━━━━━━━━━━━\n🤖 *איך מחפשים מוצר?*\n━━━━━━━━━━━━━━━\n\nכתוב בקבוצה:\n_"אני מחפש + שם המוצר"_\n\n📌 *דוגמאות:*\n• אני מחפש אוזניות בלוטות\n• מחפשת שעון חכם\n\n🎁 *מה תקבל?*\n• 2 מוצרים עם תמונות\n• מחיר בשקלים\n• ביקורות ודירוג\n• לינק קצר לרכישה!\n\n⚠️ *כללי הקבוצה:*\n• אסור לקלל — 3 קללות = הוצאה!\n• אסור ספאם 🙏\n\n━━━━━━━━━━━━━━━\nכמה שאלות קצרות 👇';
const SURVEY_Q1 = '━━━━━━━━━━━━━━━\n❓ *שאלה 1/2*\n━━━━━━━━━━━━━━━\n\nמה *הכי מעניין* אותך?\n\n1️⃣ אלקטרוניקה\n2️⃣ ביגוד\n3️⃣ מוצרי בית\n4️⃣ ספורט\n5️⃣ הכל!\n\n_ענה/י עם מספר_';
const SURVEY_Q2 = '━━━━━━━━━━━━━━━\n❓ *שאלה 2/2*\n━━━━━━━━━━━━━━━\n\nמה *הגיל* שלך?\n\n1️⃣ 18-25\n2️⃣ 26-35\n3️⃣ 36-45\n4️⃣ 45+\n\n_ענה/י עם מספר_';
const SURVEY_DONE = '━━━━━━━━━━━━━━━\n✅ *תודה! הכל מוכן!*\n━━━━━━━━━━━━━━━\n\n🎉 ברוכים הבאים!\nכתוב/י *אני מחפש + מוצר* ונמצא לך! 🔥';

// ===== פונקציות עזר =====
function getPhone(raw) { return raw.replace('@c.us','').replace('@g.us','').replace('@','').trim(); }
function isAdmin(raw) { return ADMIN_NUMBERS.indexOf(getPhone(raw)) !== -1; }
function isFrozen(raw) { return frozenUsers.indexOf(getPhone(raw)) !== -1; }
function isVIP(raw) { return vipUsers.indexOf(getPhone(raw)) !== -1; }
function hasBadWord(t) { var l=t.toLowerCase(); for(var i=0;i<BAD_WORDS.length;i++) if(l.indexOf(BAD_WORDS[i])!==-1) return true; return false; }
function hasSpam(t) { for(var i=0;i<SPAM_WORDS.length;i++) if(t.indexOf(SPAM_WORDS[i])!==-1) return true; return false; }
function sleep(ms) { return new Promise(function(r){setTimeout(r,ms);}); }
function getTopSearches() { return Object.keys(popularSearches).sort(function(a,b){return popularSearches[b]-popularSearches[a];}).slice(0,3); }

function getStars(rating) {
  var r = parseFloat(rating); if(isNaN(r)) return '⭐⭐⭐⭐⭐ (5.0/5)';
  var stars = Math.round((r/20)*2)/2;
  var s = ''; for(var i=0;i<Math.floor(stars);i++) s+='⭐';
  if(stars%1!==0) s+='✨';
  return s + ' (' + stars.toFixed(1) + '/5)';
}

// ===== תרגום =====
async function translateText(text, targetLang) {
  try {
    var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl='+targetLang+'&dt=t&q='+encodeURIComponent(text);
    var res = await axios.get(url, {timeout:5000});
    return res.data[0][0][0];
  } catch(e) { return text; }
}

// ===== קיצור קישורים =====
async function shortenLink(url) {
  try {
    var res = await axios.get('https://tinyurl.com/api-create.php?url='+encodeURIComponent(url), {timeout:5000});
    return res.data;
  } catch(e) { return url; }
}

// ===== שליחת הודעות =====
async function sendMsg(chatId, message) {
  try { await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendMessage/'+API_TOKEN,{chatId:chatId,message:message}); }
  catch(e) { console.error('❌ sendMsg:'+e.message); }
}

async function sendImage(chatId, imageUrl, caption) {
  try {
    if(imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
    await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendFileByUrl/'+API_TOKEN,{
      chatId:chatId, urlFile:imageUrl, fileName:'product.jpg', caption:caption||''
    });
    console.log('✅ תמונה נשלחה');
  } catch(e) {
    console.error('❌ תמונה:'+e.message);
    if(caption) await sendMsg(chatId, caption);
  }
}

async function sendTyping(chatId) { try { await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendTyping/'+API_TOKEN,{chatId:chatId}); } catch(e) {} }
async function sendToAdmins(msg) { for(var i=0;i<ADMIN_NUMBERS.length;i++) await sendMsg(ADMIN_NUMBERS[i]+'@c.us',msg); }
async function removeFromGroup(phone) {
  try { await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/removeGroupParticipant/'+API_TOKEN,{groupId:GROUP_CHAT_ID,participantChatId:phone+'@c.us'}); return true; }
  catch(e) { return false; }
}

// ===== AliExpress API =====
async function searchAliExpress(queryEn) {
  try {
    var timestamp = Date.now().toString();
    var params = {
      app_key: ALI_APP_KEY,
      method: 'aliexpress.affiliate.product.query',
      sign_method: 'md5',
      timestamp: timestamp,
      v: '2.0',
      keywords: queryEn,
      tracking_id: ALI_TRACKING_ID,
      page_size: '20',
      sort: 'LAST_VOLUME_DESC',
      fields: 'product_id,product_title,sale_price,evaluate_rate,lastest_volume,promotion_link,original_price,product_main_image_url'
    };
    var keys = Object.keys(params).sort();
    var signStr = ALI_APP_SECRET;
    for(var i=0;i<keys.length;i++) signStr += keys[i] + params[keys[i]];
    signStr += ALI_APP_SECRET;
    params.sign = crypto.createHash('md5').update(signStr,'utf8').digest('hex').toUpperCase();
    var qs = Object.keys(params).map(function(k){ return encodeURIComponent(k)+'='+encodeURIComponent(params[k]); }).join('&');
    var res = await axios.get('https://api-sg.aliexpress.com/sync?'+qs, {timeout:15000});

    var products = null;
    if(res.data && res.data.aliexpress_affiliate_product_query_response) {
      var r = res.data.aliexpress_affiliate_product_query_response;
      if(r.resp_result && r.resp_result.result && r.resp_result.result.products)
        products = r.resp_result.result.products.product;
    } else if(res.data && res.data.result && res.data.result.products) {
      products = res.data.result.products.product;
    }

    if(!products || products.length===0) { console.log('AliExpress: אין תוצאות'); return []; }
    console.log('AliExpress: '+products.length+' מוצרים');

    var filtered = [];
    for(var j=0;j<products.length;j++) {
      var p = products[j];
      if(!p.promotion_link || !p.sale_price) continue;
      if(p.evaluate_rate && parseFloat(p.evaluate_rate) < 75) continue;

      var priceIls = Math.round(parseFloat(p.sale_price) * USD_TO_ILS);
      var origIls = Math.round(parseFloat(p.original_price||p.sale_price) * USD_TO_ILS);

      // תרגום כותרת לעברית
      var titleHe = await translateText(p.product_title, 'iw');

      // קיצור קישור
      var shortLink = await shortenLink(p.promotion_link);

      // תיקון URL תמונה
      var imgUrl = p.product_main_image_url || null;
      if(imgUrl && imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;

      filtered.push({
        title: titleHe ? titleHe.substring(0,80) : p.product_title.substring(0,80),
        price: priceIls,
        originalPrice: origIls,
        discount: origIls > priceIls ? Math.round((1-priceIls/origIls)*100) : 0,
        sales: p.lastest_volume || 0,
        rating: p.evaluate_rate || 0,
        link: shortLink,
        image: imgUrl
      });

      if(filtered.length >= 2) break;
    }
    return filtered;
  } catch(e) {
    console.error('שגיאה AliExpress:'+e.message);
    return [];
  }
}

// ===== שליחת מוצר =====
async function sendProduct(chatId, product, num) {
  var caption = '━━━━━━━━━━━━━━━\n';
  caption += num+'️⃣ *'+product.title+'*\n';
  caption += '━━━━━━━━━━━━━━━\n';
  if(product.discount && product.discount > 0 && product.originalPrice > product.price) {
    caption += '💰 *₪'+product.price+'* ~~₪'+product.originalPrice+'~~ 🏷️ -'+product.discount+'%\n';
  } else {
    caption += '💰 מחיר: *₪'+product.price+'*\n';
  }
  caption += '🚚 משלוח חינם!\n';
  caption += getStars(product.rating)+'\n';
  caption += '📦 '+Number(product.sales).toLocaleString()+' מכירות\n';
  caption += '🔗 '+product.link+'\n';
  caption += '━━━━━━━━━━━━━━━';

  if(product.image) { await sendImage(chatId, product.image, caption); }
  else { await sendMsg(chatId, caption); }
}

// ===== חיפוש סופי =====
async function doFinalSearch(senderName, chatId, queryEn) {
  var products = await searchAliExpress(queryEn);
  if(products.length > 0) {
    await sendMsg(chatId, '🎉 @'+senderName+' *הנה התוצאות שמצאתי:* 👇');
    for(var i=0;i<products.length;i++) {
      await sendProduct(chatId, products[i], i+1);
      await sleep(800);
    }
  } else {
    await sendMsg(chatId, '😕 @'+senderName+' לא מצאתי מוצרים מתאימים. נסה שוב!');
  }
}

// ===== עיבוד חיפוש =====
async function processSearch(senderRaw, senderName, chatId, searchQuery) {
  var senderPhone = getPhone(senderRaw);

  // בדוק שאלת הבהרה
  var foundKey = null;
  for(var key in CLARIFICATION) {
    if(searchQuery.indexOf(key) !== -1) { foundKey = key; break; }
  }

  if(foundKey) {
    // שלח שאלה בפרטי
    agentFlow[senderPhone] = { options: CLARIFICATION[foundKey].o, chatId: chatId };
    await sendMsg(chatId, '@'+senderName+' 🕵️ *שלחתי לך הודעה בפרטי לדייק את החיפוש!*');
    await sendMsg(senderPhone+'@c.us', 'שלום '+senderName+'! ראיתי שאתה מחפש '+foundKey+'.\n\n'+CLARIFICATION[foundKey].q+'\n\n_ענה/י עם המספר המתאים_');
  } else {
    // תרגם וחפש
    await sendTyping(chatId);
    await sendMsg(chatId, '🕵️ מחפש עבור @'+senderName+' את הדיל הכי משתלם ל"'+searchQuery+'"...');
    var queryEn = await translateText(searchQuery, 'en');
    await doFinalSearch(senderName, chatId, queryEn);
  }
}

async function handlePrivateAnswer(senderRaw, senderName, text) {
  var senderPhone = getPhone(senderRaw);
  var flow = agentFlow[senderPhone];
  if(!flow) return false;
  var num = parseInt(text.trim());
  if(isNaN(num) || num < 1 || num > flow.options.length) {
    await sendMsg(senderPhone+'@c.us', '⚠️ אנא בחר מספר בין 1 ל-'+flow.options.length+'.');
    return true;
  }
  var exactQuery = flow.options[num-1];
  await sendMsg(senderPhone+'@c.us', '✅ *תודה!* המוצרים בדרך לקבוצה 🔥');
  await doFinalSearch(senderName, flow.chatId, exactQuery);
  delete agentFlow[senderPhone];
  return true;
}

// ===== שאלון חבר חדש =====
async function startNewUserFlow(phone, name) {
  newUserFlow[phone] = { step:1, name:name };
  await sendMsg(phone+'@c.us', WELCOME_INFO);
  await sleep(1000);
  await sendMsg(phone+'@c.us', SURVEY_Q1);
}

async function handleNewUserAnswer(phone, name, text) {
  var flow = newUserFlow[phone];
  if(!flow) return false;
  if(flow.step===1) { flow.step=2; await sendMsg(phone+'@c.us', SURVEY_Q2); return true; }
  if(flow.step===2) {
    await sendMsg(phone+'@c.us', SURVEY_DONE);
    await sendToAdmins('📋 *חבר/ה חדש/ה!*\n👤 '+name+'\n📱 '+phone);
    await sendMsg(GROUP_CHAT_ID, '🎉 *ברוכים הבאים @'+name+'!*\nכתוב/י *אני מחפש + מוצר* ונמצא לך! 🔥');
    delete newUserFlow[phone];
    return true;
  }
  return false;
}

// ===== סקר =====
async function startPoll() {
  pollActive=true; for(var k in pollVotes) delete pollVotes[k];
  for(var i=0;i<POLL_OPTIONS.length;i++) pollVotes[i+1]=0;
  var top=getTopSearches(); var topMsg=top.length>0?'\n\n💡 _הכי חיפשתם: '+top.join(', ')+'_':'';
  var msg='━━━━━━━━━━━━━━━\n📊 *סקר שבועי!*\n━━━━━━━━━━━━━━━\n\n';
  for(var j=0;j<POLL_OPTIONS.length;j++) msg+=(j+1)+'. '+POLL_OPTIONS[j]+'\n';
  msg+='\n✍️ *ענו עם המספר!*'+topMsg+'\n⏰ _פתוח 24 שעות_\n━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID, msg);
  if(pollTimeout) clearTimeout(pollTimeout);
  pollTimeout=setTimeout(async function(){await sendPollResults();}, 24*60*60*1000);
}

async function sendPollResults() {
  pollActive=false; var total=0; for(var k in pollVotes) total+=pollVotes[k];
  if(total===0){await sendToAdmins('📊 אף אחד לא הצביע 😕');return;}
  var results=Object.keys(pollVotes).map(function(k){return{name:POLL_OPTIONS[parseInt(k)-1],votes:pollVotes[k]};}).sort(function(a,b){return b.votes-a.votes;});
  var msg='━━━━━━━━━━━━━━━\n📊 *תוצאות הסקר!*\n━━━━━━━━━━━━━━━\n\nהצביעו: *'+total+'*\n\n';
  var medals=['🥇','🥈','🥉'];
  for(var i=0;i<results.length;i++){if(results[i].votes>0){msg+=(i<3?medals[i]:'▫️')+' '+results[i].name+': '+results[i].votes+' ('+Math.round(results[i].votes/total*100)+'%)\n';}}
  msg+='\n🏆 *מנצח: '+results[0].name+'!*\n━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID, msg); await sendToAdmins('📊 מנצח: '+results[0].name);
}

async function sendDeal() {
  var top=getTopSearches();
  var queries=['bluetooth earphones','smartwatch','fast charger','bluetooth speaker','wireless mouse'];
  var query=top.length>0?top[0]:queries[Math.floor(Math.random()*queries.length)];
  var products=await searchAliExpress(query);
  if(!products||products.length===0) return;
  await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n🔥 *דיל חם!* 🔥\n━━━━━━━━━━━━━━━');
  await sendProduct(GROUP_CHAT_ID, products[0], 1);
}

async function announceKing() {
  var king=null,max=0;
  for(var p in searchCount) if(searchCount[p]>max){max=searchCount[p];king=p;}
  if(king&&max>0){await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n👑 *מלך הקבוצה!*\n━━━━━━━━━━━━━━━\n\n@'+king+' חיפש/ה *'+max+'* פעמים!\n🏆 כל הכבוד! 🔥\n━━━━━━━━━━━━━━━');for(var k in searchCount)delete searchCount[k];}
}

// ===== פקודות מנהל =====
async function handleAdmin(text, chatId) {
  var cmd=text.trim();
  if(cmd==='!דיל'){await sendDeal();await sendMsg(chatId,'✅ דיל נשלח!');return;}
  if(cmd==='!סקר'){await startPoll();await sendMsg(chatId,'✅ סקר נשלח!');return;}
  if(cmd==='!תוצאות'){await sendPollResults();return;}
  if(cmd==='!מלך'){await announceKing();return;}
  if(cmd==='!מצב'){var t=0;for(var p in searchCount)t+=searchCount[p];var top=getTopSearches();await sendMsg(chatId,'📊 *סטטוס:*\n🔍 חיפושים: '+t+'\n❄️ מוקפאים: '+frozenUsers.length+'\n👑 VIP: '+vipUsers.length+'\n💱 שער $: '+USD_TO_ILS.toFixed(2)+'\n🔥 הכי נחפש: '+(top[0]||'אין'));return;}
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
  if(cmd==='!עזרה'){await sendMsg(chatId,'━━━━━━━━━━━━━━━\n📋 *פקודות מנהל:*\n━━━━━━━━━━━━━━━\n\n!דיל - שלח דיל\n!סקר - שלח סקר\n!תוצאות - תוצאות\n!מלך - הכרז מלך\n!מצב - סטטוס\n!ניקוי - אפס\n!תחרות !בוקר !ערב\n!מצב לילה !מצב טירוף\n!הקפא [מספר]\n!שחרר [מספר]\n!VIP [מספר]\n!אזהרה [מספר]\n!כבוד [מספר]\n!הודעה [טקסט]\n!ברוך [מספר]\n━━━━━━━━━━━━━━━');return;}
}

// ===== לוחות זמנים =====
function scheduleDeal() {
  setTimeout(async function(){
    await sendDeal();
    setInterval(async function(){await sendDeal();}, 3*60*60*1000);
  }, 3*60*1000);
}
function scheduleWeekly(){var now=new Date(),next=new Date();next.setDate(now.getDate()+(7-now.getDay()));next.setHours(11,0,0,0);setTimeout(async function(){await startPoll();scheduleWeekly();},next-now);}
function scheduleKing(){var now=new Date(),next=new Date();next.setDate(now.getDate()+(7-now.getDay()));next.setHours(12,0,0,0);setTimeout(async function(){await announceKing();scheduleKing();},next-now);}

// ===== Webhook =====
app.post('/webhook', async function(req,res) {
  res.sendStatus(200);
  try {
    var body=req.body; if(!body) return;
    var sd=body.senderData||{};
    var senderRaw=sd.sender||''; var senderName=sd.senderName||'חבר';
    var chatId=sd.chatId||''; var senderPhone=getPhone(senderRaw);

    // חבר חדש
    if(body.typeWebhook==='groupParticipantsAdded'){
      var newMembers=body.participants||[];
      for(var nm=0;nm<newMembers.length;nm++){
        var np=getPhone(newMembers[nm].participant||'');
        var nn=newMembers[nm].participantName||'חבר/ה';
        if(np) await startNewUserFlow(np,nn);
      }
      return;
    }

    if(body.typeWebhook!=='incomingMessageReceived') return;
    var md=body.messageData||{};
    if(md.typeMessage==='groupInviteMessage'){await startNewUserFlow(senderPhone,senderName);return;}
    if(!md||md.typeMessage!=='textMessage') return;
    var text=md.textMessageData&&md.textMessageData.textMessage?md.textMessageData.textMessage:'';
    if(!text||!chatId||!senderPhone) return;

    console.log('📩 '+senderPhone+' ('+senderName+') | '+text.substring(0,35));

    // שאלון חבר חדש
    if(newUserFlow[senderPhone]){
      var h=await handleNewUserAnswer(senderPhone,senderName,text);
      if(h) return;
    }

    // תשובה בפרטי לחיפוש
    if(chatId.indexOf('@c.us')!==-1 && agentFlow[senderPhone]){
      var handled=await handlePrivateAnswer(senderRaw,senderName,text);
      if(handled) return;
    }

    // פקודות מנהל
    if(isAdmin(senderRaw)&&text.charAt(0)==='!'){await handleAdmin(text,chatId);return;}

    // הצבעה בסקר
    if(pollActive&&!isAdmin(senderRaw)){
      var vn=parseInt(text.trim());
      if(!isNaN(vn)&&vn>=1&&vn<=POLL_OPTIONS.length){
        pollVotes[vn]++; await sendMsg(chatId,'✅ @'+senderName+' הצבעת על: *'+POLL_OPTIONS[vn-1]+'*\nתודה! 🙏'); return;
      }
    }

    if(isFrozen(senderRaw)) return;

    // ספאם
    if(hasSpam(text)){await sendMsg(chatId,'🚫 @'+senderName+' פרסומות אסורות! 🙏');await sendToAdmins('🚨 ספאם\n@'+senderName+':\n"'+text+'"');return;}

    // קללות
    if(hasBadWord(text)){
      warningCount[senderPhone]=(warningCount[senderPhone]||0)+1; var w=warningCount[senderPhone];
      if(w>=3){
        var removed=await removeFromGroup(senderPhone);
        await sendMsg(GROUP_CHAT_ID,'🚫 @'+senderName+' הודח! קיללת 3 פעמים! ⛔');
        await sendMsg(senderPhone+'@c.us','⛔ הודחת מקבוצת '+GROUP_NAME+'!\n3 קללות.\nפנה/י למנהל 🙏');
        await sendToAdmins('🚫 '+senderName+' הודח!'+(removed?'✅':'⚠️'));
        frozenUsers.push(senderPhone);
      } else {
        await sendMsg(chatId,'⚠️ @'+senderName+' אזהרה *'+w+'/3*! עוד '+(3-w)+' קללות ← תודח! 🚫');
        await sendMsg(senderPhone+'@c.us','⚠️ אזהרה '+w+'/3!\nקיללת בקבוצת '+GROUP_NAME+'.\nעוד '+(3-w)+' קללות ← תודח!');
        await sendToAdmins('⚠️ @'+senderName+' אזהרה '+w+'/3:\n"'+text+'"');
      }
      return;
    }

    // חיפוש מוצר
    var triggerFound=false, searchQuery=text;
    for(var t=0;t<TRIGGER_WORDS.length;t++){
      if(text.indexOf(TRIGGER_WORDS[t])!==-1){
        triggerFound=true;
        searchQuery=searchQuery.split(TRIGGER_WORDS[t]).join('').trim();
      }
    }
    if(!triggerFound) return;
    if(!searchQuery||searchQuery.length<2){await sendMsg(chatId,'🎧 כתוב/י: *אני מחפש + שם המוצר*');return;}

    searchCount[senderPhone]=(searchCount[senderPhone]||0)+1;
    popularSearches[searchQuery]=(popularSearches[searchQuery]||0)+1;
    var total=searchCount[senderPhone];

    if(total===5) await sendMsg(chatId,'🎉 @'+senderName+' החיפוש ה-5 שלך! 😄');
    else if(total===10){await sendMsg(chatId,'🏆 @'+senderName+' 10 חיפושים! מלך הדילים! 👑');await sendToAdmins('🎉 @'+senderName+' הגיע/ה ל-10 חיפושים!');}
    else if(total===20){if(vipUsers.indexOf(senderPhone)===-1)vipUsers.push(senderPhone);await sendMsg(chatId,'💎 @'+senderName+' 20 חיפושים! VIP! 👑');}

    await processSearch(senderRaw, senderName, chatId, searchQuery);

  } catch(e){console.error('שגיאה:'+e.message);}
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
