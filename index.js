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
const GROUP_CHAT_ID = 'KOL2v0rh8LH3RgfQIVr8gq@g.us';
const GROUP_NAME = 'דילים שווים';
const ADMIN_NUMBERS = ['972538800370', '972557119650'];

const userMemory = {};
const searchCount = {};
const frozenUsers = [];
const vipUsers = [];
const warningCount = {};
const pollVotes = {};
let pollActive = false;
let pollTimeout = null;

const TRIGGER_WORDS = [
  'אני מחפש', 'אני מחפשת', 'חפש לי', 'חפשי לי',
  'אני צריך', 'אני צריכה', 'מחפש', 'מחפשת',
  'רוצה לקנות', 'מישהו מכיר', 'מישהי מכירה',
  'יש מוצר', 'איפה אפשר לקנות', 'מישהו יודע איפה',
  'מישהי יודעת איפה', 'תמצאו לי', 'תביאו לי',
  'מחפשים', 'צריכים', 'יש דיל על', 'כמה עולה',
  'איפה קונים', 'מאיפה קונים', 'אפשר לקנות',
  'יש פה מישהו שמכיר'
];

const BAD_WORDS = [
  'זין', 'כוס', 'שרמוטה', 'זונה', 'מניאק', 'ממזר',
  'אידיוט', 'טמבל', 'מפגר', 'חרא', 'בן זונה', 'בת זונה',
  'כלבה', 'בהמה', 'ראש זין', 'פגום', 'מסריח',
  'לך לעזאזל', 'יבאן אמק', 'קס אמק', 'יבן שרמוטה',
  'كس', 'زبي', 'شرموطة', 'fuck', 'shit', 'bitch',
  'asshole', 'bastard', 'idiot', 'stupid', 'damn'
];

const SPAM_WORDS = [
  'הצטרפו', 'קבוצה חדשה', 'דרושים', 'ווטסאפ', 'טלגרם',
  'השקעה', 'הרוויחו', 'ביטקוין', 'הימור', 'קזינו',
  'לחצו על הלינק', 'הרשמה בחינם'
];

const POLL_OPTIONS = [
  'אוזניות ואביזרי אודיו',
  'שעונים חכמים',
  'מוצרי בית וגאדגטים',
  'ביגוד ואופנה',
  'מוצרי ספורט',
  'אלקטרוניקה ומחשבים',
  'צעצועים וילדים',
  'מטבח ובישול',
  'יופי וטיפוח',
  'כלי עבודה ותחביבים'
];

const FUNNY = {
  'כיסא': '😂 כיסא? בטח אחרי שעמדת כל היום!',
  'שמיכה': '🥶 שמיכה? קר לך?',
  'בושם': '😏 מישהו רוצה להריח טוב!',
  'טבעת': '💍 מישהו מתחתן?!',
  'צעצוע': '😄 בשביל הילדים... או בשבילך?'
};

const JOKES = [
  'למה הסלמון שחה נגד הזרם? כי הוא לא רצה לקנות דגים קפואים מאלי אקספרס! 😂',
  'מה ההבדל בין אמא לאלי אקספרס? אמא תמיד מגיעה בזמן! 😄',
  'למה הבוט לא ישן? כי הדילים לא ישנים! 🔥'
];

const FACTS = [
  '💡 ידעתם? אלי אקספרס מוכר מעל 100 מיליון מוצרים!',
  '💡 ידעתם? ניתן לחסוך עד 80% לעומת מחירים בישראל!',
  '💡 ידעתם? אלי אקספרס מציע החזר כספי מלא אם המוצר לא הגיע!'
];

function getPhone(raw) {
  return raw.replace('c.us','').replace('@','').replace('.','').trim();
}
function isAdmin(raw) { return ADMIN_NUMBERS.indexOf(getPhone(raw)) !== -1; }
function isFrozen(raw) { return frozenUsers.indexOf(getPhone(raw)) !== -1; }
function hasBadWord(t) { var l=t.toLowerCase(); for(var i=0;i<BAD_WORDS.length;i++) if(l.indexOf(BAD_WORDS[i].toLowerCase())!==-1) return true; return false; }
function hasSpam(t) { for(var i=0;i<SPAM_WORDS.length;i++) if(t.indexOf(SPAM_WORDS[i])!==-1) return true; return false; }
function getHeat() { var h=''; for(var i=0;i<Math.floor(Math.random()*3)+3;i++) h+='🔥'; return h; }
function getGreeting() { var h=new Date().getHours(); if(h>=6&&h<12) return '☀️ בוקר טוב!'; if(h>=12&&h<17) return '🌤️ צהריים טובים!'; if(h>=17&&h<21) return '🌆 ערב טוב!'; return '🌙 לילה טוב!'; }
function sleep(ms) { return new Promise(function(r){setTimeout(r,ms);}); }

async function sendMsg(chatId, message) {
  try {
    await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendMessage/'+API_TOKEN, {chatId:chatId, message:message});
    console.log('✅ נשלח ל:'+chatId);
  } catch(e) {
    console.error('❌ שגיאה:'+e.message);
  }
}

async function sendTyping(chatId) {
  try { await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendTyping/'+API_TOKEN,{chatId:chatId}); } catch(e) {}
}

async function sendToAdmins(msg) {
  for(var i=0;i<ADMIN_NUMBERS.length;i++) await sendMsg(ADMIN_NUMBERS[i]+'@c.us', msg);
}

async function searchAliExpress(query) {
  try {
    var timestamp = new Date().toISOString().replace(/[^0-9]/g,'').slice(0,15)+'000';
    var params = {
      app_key: ALI_APP_KEY,
      method: 'aliexpress.affiliate.product.query',
      sign_method: 'md5',
      timestamp: timestamp,
      v: '2.0',
      keywords: query,
      tracking_id: ALI_TRACKING_ID,
      page_size: '6',
      sort: 'LAST_VOLUME_DESC',
      fields: 'product_id,product_title,sale_price,evaluate_rate,lastest_volume,promotion_link'
    };
    var sortedKeys = Object.keys(params).sort();
    var signStr = ALI_APP_SECRET;
    for(var i=0;i<sortedKeys.length;i++) signStr += sortedKeys[i] + params[sortedKeys[i]];
    signStr += ALI_APP_SECRET;
    params.sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
    var queryString = Object.keys(params).map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&');
    var response = await axios.get('https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.listPromotionProduct/'+ALI_APP_KEY+'?'+queryString, {timeout:10000});
    if(response.data && response.data.result && response.data.result.products) {
      var products = response.data.result.products.product;
      if(!products || products.length === 0) return [];
      return products
        .filter(function(p){ return p.evaluate_rate && parseFloat(p.evaluate_rate) > 80; })
        .sort(function(a,b){ return parseFloat(b.evaluate_rate)-parseFloat(a.evaluate_rate); })
        .slice(0,2);
    }
    return [];
  } catch(e) {
    console.error('שגיאה בחיפוש:'+e.message);
    return [];
  }
}

function buildSearchLink(query) {
  return 'https://www.aliexpress.com/wholesale?SearchText='+encodeURIComponent(query)+'&SortType=total_tranpro_desc&aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key='+ALI_TRACKING_ID+'&terminal_id='+ALI_APP_KEY;
}

function buildProductMessage(products, query, mention) {
  if(!products || products.length === 0) {
    return mention+' ✅ מצאתי עבורך *'+query+'*!\n\n👉 '+buildSearchLink(query)+'\n\n🔥 לחץ לראות את הדילים!';
  }
  var msg = mention+' ✅ *מצאתי עבורך '+query+'!*\n\n';
  for(var i=0;i<products.length;i++) {
    var p = products[i];
    var title = p.product_title ? p.product_title.substring(0,50) : 'מוצר';
    var price = p.sale_price || '?';
    var rating = p.evaluate_rate ? p.evaluate_rate+'%' : '';
    var sales = p.lastest_volume ? p.lastest_volume+' מכירות' : '';
    var link = p.promotion_link || buildSearchLink(query);
    msg += (i+1)+'️⃣ *'+title+'*\n';
    msg += '💰 מחיר: $'+price+'\n';
    if(rating) msg += '⭐ דירוג: '+rating+'\n';
    if(sales) msg += '📦 '+sales+'\n';
    msg += '🔗 '+link+'\n\n';
  }
  msg += '🔥 מחירים מטורפים!';
  return msg;
}

async function startPoll() {
  pollActive = true;
  for(var k in pollVotes) delete pollVotes[k];
  var msg = '📊 *סקר שבועי — מה אתם הכי מחפשים?*\n\n';
  for(var i=0;i<POLL_OPTIONS.length;i++) {
    pollVotes[i+1] = 0;
    msg += (i+1)+'️⃣ '+POLL_OPTIONS[i]+'\n';
  }
  msg += '\nענו עם המספר! 👇\n_הסקר פתוח 24 שעות_';
  await sendMsg(GROUP_CHAT_ID, msg);

  if(pollTimeout) clearTimeout(pollTimeout);
  pollTimeout = setTimeout(async function() {
    await sendPollResults();
  }, 24 * 60 * 60 * 1000);
}

async function sendPollResults() {
  pollActive = false;
  var total = 0;
  for(var k in pollVotes) total += pollVotes[k];

  if(total === 0) {
    await sendToAdmins('📊 *תוצאות הסקר:*\n\nאף אחד לא הצביע 😕');
    return;
  }

  var results = Object.keys(pollVotes).map(function(k) {
    return {num: parseInt(k), name: POLL_OPTIONS[parseInt(k)-1], votes: pollVotes[k]};
  }).sort(function(a,b){ return b.votes-a.votes; });

  var msg = '📊 *תוצאות הסקר!*\n\nסה"כ הצביעו: '+total+'\n\n';
  for(var i=0;i<results.length;i++) {
    if(results[i].votes > 0) {
      var pct = Math.round(results[i].votes/total*100);
      msg += (i===0?'🥇':(i===1?'🥈':(i===2?'🥉':'▫️')))+' '+results[i].name+': '+results[i].votes+' הצבעות ('+pct+'%)\n';
    }
  }

  var winner = results[0];
  msg += '\n🏆 *הכי מבוקש: '+winner.name+'!*\n\nהדיל הבא יהיה על זה! 🔥';

  await sendMsg(GROUP_CHAT_ID, msg);
  await sendToAdmins('📊 *סיכום סקר:*\n\n'+msg);
}

async function sendDailyDeal() {
  var queries = ['bluetooth earphones','smart watch','fast charger','bluetooth speaker','security camera'];
  var query = queries[Math.floor(Math.random()*queries.length)];
  var products = await searchAliExpress(query);
  if(products && products.length > 0) {
    var p = products[0];
    var title = p.product_title ? p.product_title.substring(0,50) : query;
    var price = p.sale_price || '?';
    var link = p.promotion_link || buildSearchLink(query);
    await sendMsg(GROUP_CHAT_ID,'🚨 *דיל היום!* 🚨\n\n🌡️ חום הדיל: '+getHeat()+'\n\n*'+title+'*\n💰 $'+price+'\n\n👉 '+link+'\n\n⚡ אל תפספסו!');
  } else {
    await sendMsg(GROUP_CHAT_ID,'🚨 *דיל היום!* 🚨\n\n🌡️ חום הדיל: '+getHeat()+'\n\n👉 '+buildSearchLink(query)+'\n\n⚡ אל תפספסו!');
  }
}

async function sendSurprise() {
  var queries = ['cool gadget','viral product','amazing invention'];
  var query = queries[Math.floor(Math.random()*queries.length)];
  var products = await searchAliExpress(query);
  if(products && products.length > 0) {
    var p = products[0];
    var title = p.product_title ? p.product_title.substring(0,50) : 'גאדגט מטורף';
    var link = p.promotion_link || buildSearchLink(query);
    await sendMsg(GROUP_CHAT_ID,'🎁 *קופסת הפתעה!*\n\n*'+title+'*\n\n👉 '+link+'\n\n😱');
  }
}

async function announceKing() {
  var king=null,max=0;
  for(var p in searchCount) if(searchCount[p]>max){max=searchCount[p];king=p;}
  if(king&&max>0){
    await sendMsg(GROUP_CHAT_ID,'👑 *מלך הקבוצה!*\n\n@'+king+' חיפש/ה *'+max+'* פעמים!\n\n🏆 כל הכבוד! 🔥');
    for(var k in searchCount) delete searchCount[k];
  }
}

async function handleAdmin(text, chatId) {
  var cmd = text.trim();
  console.log('👑 פקודת מנהל: '+cmd);

  if(cmd==='!דיל'){await sendDailyDeal();await sendMsg(chatId,'✅ דיל נשלח!');return;}
  if(cmd==='!סקר'){await startPoll();await sendMsg(chatId,'✅ סקר נשלח! תוצאות יגיעו עוד 24 שעות');return;}
  if(cmd==='!תוצאות'){await sendPollResults();await sendMsg(chatId,'✅ תוצאות נשלחו!');return;}
  if(cmd==='!הפתעה'){await sendSurprise();await sendMsg(chatId,'✅ הפתעה נשלחה!');return;}
  if(cmd==='!מלך'){await announceKing();await sendMsg(chatId,'✅ מלך הוכרז!');return;}
  if(cmd==='!מצב'){
    var t=0;for(var p in searchCount)t+=searchCount[p];
    await sendMsg(chatId,'📊 *סטטוס הבוט:*\n\n🔍 חיפושים: '+t+'\n❄️ מוקפאים: '+frozenUsers.length+'\n👑 VIP: '+vipUsers.length+'\n📊 סקר פעיל: '+(pollActive?'כן':'לא'));
    return;
  }
  if(cmd==='!ניקוי'){for(var k in searchCount)delete searchCount[k];await sendMsg(chatId,'✅ ספירות אופסו!');return;}
  if(cmd==='!בדיחה'){await sendMsg(GROUP_CHAT_ID,'😂 *בדיחה:*\n\n'+JOKES[Math.floor(Math.random()*JOKES.length)]);await sendMsg(chatId,'✅');return;}
  if(cmd==='!עובדה'){await sendMsg(GROUP_CHAT_ID,FACTS[Math.floor(Math.random()*FACTS.length)]);await sendMsg(chatId,'✅');return;}
  if(cmd==='!תחרות'){await sendMsg(GROUP_CHAT_ID,'🏆 *תחרות דילים!*\n\nמי ימצא את הדיל הכי זול?\nהזוכה מקבל 👑 VIP!\n\nיאללה! 🔥');await sendMsg(chatId,'✅');return;}
  if(cmd==='!מצב לילה'){await sendMsg(GROUP_CHAT_ID,'🌙 *מצב לילה*\n\nהבוט עובד בלחישות 😴');await sendMsg(chatId,'✅');return;}
  if(cmd==='!מצב טירוף'){await sendMsg(GROUP_CHAT_ID,'🔥🤯💥 *מצב טירוף!*\n\nיאללה! 🚀💰');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!הקפא ')===0){var n=cmd.replace('!הקפא ','').replace(/^0/,'');if(frozenUsers.indexOf(n)===-1)frozenUsers.push(n);await sendMsg(chatId,'✅ הוקפא!');return;}
  if(cmd.indexOf('!שחרר ')===0){var n2=cmd.replace('!שחרר ','').replace(/^0/,'');var idx=frozenUsers.indexOf(n2);if(idx!==-1)frozenUsers.splice(idx,1);await sendMsg(chatId,'✅ שוחרר!');return;}
  if(cmd.indexOf('!VIP ')===0){var n3=cmd.replace('!VIP ','').replace(/^0/,'');if(vipUsers.indexOf(n3)===-1)vipUsers.push(n3);await sendMsg(GROUP_CHAT_ID,'👑 @'+n3+' קיבל/ה VIP! 🌟');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!אזהרה ')===0){var n4=cmd.replace('!אזהרה ','').replace(/^0/,'');await sendMsg(n4+'@c.us','⚠️ *אזהרה מהמנהל!*\n\nאנא שמור על כללי הקבוצה 🙏');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!כבוד ')===0){var n5=cmd.replace('!כבוד ','').replace(/^0/,'');await sendMsg(GROUP_CHAT_ID,'🏆 *גיבור הקבוצה!*\n\n@'+n5+' הגיבור/ת שלנו! ❤️');await sendMsg(chatId,'✅');return;}
  if(cmd.indexOf('!הודעה ')===0){await sendMsg(GROUP_CHAT_ID,'📢 *הודעה מהמנהל:*\n\n'+cmd.replace('!הודעה ',''));await sendMsg(chatId,'✅');return;}
  if(cmd==='!עזרה'){
    await sendMsg(chatId,
      '📋 *פקודות מנהל:*\n\n'+
      '!דיל - שלח דיל\n'+
      '!סקר - שלח סקר 24 שעות\n'+
      '!תוצאות - תוצאות סקר עכשיו\n'+
      '!הפתעה - קופסת הפתעה\n'+
      '!מלך - הכרז מלך\n'+
      '!מצב - סטטוס בוט\n'+
      '!ניקוי - אפס ספירות\n'+
      '!בדיחה - שלח בדיחה\n'+
      '!עובדה - שלח עובדה\n'+
      '!תחרות - פתח תחרות\n'+
      '!מצב לילה / !מצב טירוף\n'+
      '!הקפא [מספר]\n'+
      '!שחרר [מספר]\n'+
      '!VIP [מספר]\n'+
      '!אזהרה [מספר]\n'+
      '!כבוד [מספר]\n'+
      '!הודעה [טקסט]'
    );
    return;
  }
}

function scheduleDaily(){var now=new Date(),next=new Date();next.setHours(10,0,0,0);if(now>=next)next.setDate(next.getDate()+1);setTimeout(async function(){await sendDailyDeal();scheduleDaily();},next-now);}
function scheduleWeekly(){var now=new Date(),next=new Date();next.setDate(now.getDate()+(7-now.getDay()));next.setHours(11,0,0,0);setTimeout(async function(){await startPoll();scheduleWeekly();},next-now);}
function scheduleKing(){var now=new Date(),next=new Date();next.setDate(now.getDate()+(7-now.getDay()));next.setHours(12,0,0,0);setTimeout(async function(){await announceKing();scheduleKing();},next-now);}

app.post('/webhook',async function(req,res){
  res.sendStatus(200);
  try {
    var body=req.body;
    if(!body||body.typeWebhook!=='incomingMessageReceived') return;
    var md=body.messageData||{};
    if(!md||md.typeMessage!=='textMessage') return;
    var text='';
    if(md.textMessageData&&md.textMessageData.textMessage) text=md.textMessageData.textMessage;
    var sd=body.senderData||{};
    var chatId=sd.chatId||'';
    var senderRaw=sd.sender||'';
    var senderName=sd.senderName||'חבר';
    var senderPhone=getPhone(senderRaw);
    if(!text||!chatId||!senderPhone) return;

    console.log('📩 '+senderPhone+' | admin:'+isAdmin(senderRaw)+' | '+text.substring(0,30));

    // פקודות מנהל
    if(isAdmin(senderRaw)&&text.charAt(0)==='!'){await handleAdmin(text,chatId);return;}

    // הצבעה בסקר
    if(pollActive) {
      var voteNum = parseInt(text.trim());
      if(!isNaN(voteNum) && voteNum >= 1 && voteNum <= POLL_OPTIONS.length) {
        if(pollVotes[voteNum] !== undefined) {
          pollVotes[voteNum]++;
          await sendMsg(chatId, '✅ '+senderName+' הצבעת על: *'+POLL_OPTIONS[voteNum-1]+'*\n\nתודה! 🙏');
          return;
        }
      }
    }

    if(isFrozen(senderRaw)) return;

    // ספאם
    if(hasSpam(text)){
      await sendMsg(chatId,'🚫 @'+senderPhone+' פרסומות אסורות! 🙏');
      await sendToAdmins('🚨 *ספאם!*\n'+senderName+':\n"'+text+'"');
      return;
    }

    // קללות
    if(hasBadWord(text)){
      warningCount[senderPhone]=(warningCount[senderPhone]||0)+1;
      var w=warningCount[senderPhone];
      await sendMsg(chatId,'⚠️ @'+senderPhone+' אזהרה '+w+'/3! שלחתי לך הודעה פרטית 🙏');
      await sendMsg(senderPhone+'@c.us','שלום '+senderName+' 👋\n\nזוהי אזהרה *'+w+'* מתוך 3.\nהשפה שהשתמשת בה לא מתאימה 🙏\n\n'+(w>=3?'⛔ אזהרה אחרונה! הפעם הבאה תוקפא!':'😊 בוא נמשיך בצורה נעימה!'));
      if(w>=3){if(frozenUsers.indexOf(senderPhone)===-1)frozenUsers.push(senderPhone);await sendMsg(chatId,'❄️ @'+senderPhone+' הוקפא!');}
      await sendToAdmins('🚨 *קללה!*\n'+senderName+' ('+w+'/3):\n"'+text+'"');
      return;
    }

    // חיפוש מוצר
    var triggerFound=false,searchQuery=text;
    for(var t=0;t<TRIGGER_WORDS.length;t++){
      if(text.indexOf(TRIGGER_WORDS[t])!==-1){
        triggerFound=true;
        searchQuery=searchQuery.split(TRIGGER_WORDS[t]).join('').trim();
      }
    }
    if(!triggerFound) return;
    if(!searchQuery||searchQuery.length<2){await sendMsg(chatId,'🎧 כתוב למשל: אני מחפש אוזניות בלוטות');return;}

    if(!userMemory[senderPhone]) userMemory[senderPhone]=[];
    userMemory[senderPhone].push(searchQuery);
    searchCount[senderPhone]=(searchCount[senderPhone]||0)+1;
    var total=searchCount[senderPhone];
    var mention='@'+senderPhone;
    var funnyMsg='';
    for(var fk in FUNNY){if(searchQuery.indexOf(fk)!==-1){funnyMsg=FUNNY[fk];break;}}

    // שלח התראה פרטית למחפש
    await sendMsg(senderPhone+'@c.us',
      '🔔 *המוצר שלך נמצא!*\n\n'+
      'חיפשת: *'+searchQuery+'*\n\n'+
      '👉 כנס לקבוצה *'+GROUP_NAME+'* לראות את התוצאות! 🔥'
    );

    await sendTyping(chatId);
    await sendMsg(chatId,getGreeting()+' '+mention+'!\n🔍 מחפש *'+searchQuery+'*... רגע אחד!');
    if(funnyMsg) await sendMsg(chatId,funnyMsg);
    await sleep(1000);

    var products = await searchAliExpress(searchQuery);
    var reply = buildProductMessage(products, searchQuery, mention);

    if(total===5) reply+='\n\n🎉 החיפוש ה-5 שלך! 😄';
    else if(total===10){reply+='\n\n🏆 *10 חיפושים!* מלך הדילים! 👑';await sendToAdmins('🎉 '+senderName+' הגיע ל-10 חיפושים!');}

    await sendMsg(chatId,reply);

  } catch(e){console.error('שגיאה:',e.message);}
});

app.get('/',function(req,res){res.send('הבוט הפרימיום פועל!');});
var PORT=process.env.PORT||3000;
app.listen(PORT,function(){
  console.log('🚀 הבוט הפרימיום פועל על פורט '+PORT);
  scheduleDaily(); scheduleWeekly(); scheduleKing();
  setInterval(async function(){await sendSurprise();},7*24*60*60*1000);
});
