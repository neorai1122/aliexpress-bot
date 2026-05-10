const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const GREEN_API_URL = 'https://7107.api.greenapi.com/waInstance' + INSTANCE_ID;
const ALI_TRACKING_ID = 'bot01';
const ALI_APP_KEY = '533908';
const GROUP_CHAT_ID = 'KOL2v0rh8LH3RgfQIVr8gq@g.us';
const ADMIN1 = '972538800370@c.us';
const ADMIN2 = '972557119650@c.us';
const ADMINS = [ADMIN1, ADMIN2];

const userMemory = {};
const searchCount = {};
const frozenUsers = [];
const vipUsers = [];
const warningCount = {};

const TRIGGER_WORDS = ['אני מחפש','אני מחפשת','חפש לי','חפשי לי','אני צריך','אני צריכה','מחפש','מחפשת','רוצה לקנות','מישהו מכיר','מישהי מכירה','יש מוצר'];
const BAD_WORDS = ['זין','כוס','שרמוטה','זונה','מניאק','ממזר','אידיוט','טמבל','מפגר','fuck','shit','bitch','asshole','bastard'];
const SPAM_WORDS = ['הצטרפו','קבוצה חדשה','דרושים','ווטסאפ','טלגרם','השקעה','הרוויחו','ביטקוין','הימור','קזינו'];
const TRANSLATIONS = {'אוזניות':'earphones','בלוטות':'bluetooth','נעליים':'shoes','שעון':'watch','טלפון':'phone','מטען':'charger','כיסא':'chair','מאוורר':'fan','מצלמה':'camera','תיק':'bag','בגדים':'clothes','צמיד':'bracelet','טבעת':'ring','משקפיים':'glasses','ספורט':'sport','ילדים':'kids','צעצוע':'toy','מטבח':'kitchen','מחשב':'computer','לפטופ':'laptop','טאבלט':'tablet','רמקול':'speaker','מקלדת':'keyboard','עכבר':'mouse','מנורה':'lamp','שמיכה':'blanket','כרית':'pillow','ארנק':'wallet','כובע':'hat','גרביים':'socks','חגורה':'belt','בושם':'perfume'};
const FUNNY = {'כיסא':'😂 כיסא? בטח אחרי שעמדת כל היום!','שמיכה':'🥶 שמיכה? קר לך?','בושם':'😏 מישהו רוצה להריח טוב!','טבעת':'💍 מישהו מתחתן?!','צעצוע':'😄 בשביל הילדים... או בשבילך?'};
const JOKES = ['למה הסלמון שחה נגד הזרם? כי הוא לא רצה לקנות דגים קפואים מאלי אקספרס! 😂','מה ההבדל בין אמא לאלי אקספרס? אמא תמיד מגיעה בזמן! 😄','למה הבוט לא ישן? כי הדילים לא ישנים! 🔥'];
const FACTS = ['💡 ידעתם? אלי אקספרס מוכר מעל 100 מיליון מוצרים!','💡 ידעתם? ניתן לחסוך עד 80% לעומת מחירים בישראל!','💡 ידעתם? אלי אקספרס מציע החזר כספי מלא אם המוצר לא הגיע!'];

function translateToEnglish(text) { var r = text; for (var k in TRANSLATIONS) r = r.split(k).join(TRANSLATIONS[k]); return r; }
function buildLink(query) { return 'https://www.aliexpress.com/wholesale?SearchText=' + encodeURIComponent(translateToEnglish(query)) + '&SortType=total_tranpro_desc&aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key=' + ALI_TRACKING_ID + '&terminal_id=' + ALI_APP_KEY; }
function getHeat() { var h=''; for(var i=0;i<Math.floor(Math.random()*3)+3;i++) h+='🔥'; return h; }
function getGreeting() { var h=new Date().getHours(); if(h>=6&&h<12) return '☀️ בוקר טוב!'; if(h>=12&&h<17) return '🌤️ צהריים טובים!'; if(h>=17&&h<21) return '🌆 ערב טוב!'; return '🌙 לילה טוב!'; }
function isAdmin(p) { return ADMINS.indexOf(p)!==-1; }
function isFrozen(p) { return frozenUsers.indexOf(p)!==-1; }
function isVIP(p) { return vipUsers.indexOf(p)!==-1; }
function hasBadWord(t) { var l=t.toLowerCase(); for(var i=0;i<BAD_WORDS.length;i++) if(l.indexOf(BAD_WORDS[i].toLowerCase())!==-1) return true; return false; }
function hasSpam(t) { for(var i=0;i<SPAM_WORDS.length;i++) if(t.indexOf(SPAM_WORDS[i])!==-1) return true; return false; }
function sleep(ms) { return new Promise(function(r){setTimeout(r,ms);}); }

async function sendMsg(chatId, message) {
  try { await axios.post(GREEN_API_URL+'/sendMessage/'+API_TOKEN,{chatId,message}); } catch(e) { console.error(e.message); }
}
async function sendTyping(chatId) { try { await axios.post(GREEN_API_URL+'/sendTyping/'+API_TOKEN,{chatId}); } catch(e) {} }
async function sendToAdmins(msg) { await sendMsg(ADMIN1,msg); await sendMsg(ADMIN2,msg); }

async function sendDailyDeal() {
  var deals=[{name:'אוזניות בלוטות פרו',query:'bluetooth earphones pro',saving:120},{name:'שעון חכם 2024',query:'smart watch 2024',saving:250},{name:'מטען מהיר 65W',query:'fast charger 65w',saving:80},{name:'רמקול בלוטות',query:'waterproof bluetooth speaker',saving:150},{name:'מצלמת אבטחה WiFi',query:'security camera wifi',saving:200}];
  var d=deals[Math.floor(Math.random()*deals.length)];
  await sendMsg(GROUP_CHAT_ID,'🚨 *דיל היום!* 🚨\n\nהדיל הכי חם: *'+d.name+'*\n\n🌡️ חום הדיל: '+getHeat()+'\n💰 חיסכון לעומת ישראל: *₪'+d.saving+'*\n\n👉 '+buildLink(d.query)+'\n\n⚡ אל תפספסו!');
}
async function sendPoll() { await sendMsg(GROUP_CHAT_ID,'📊 *סקר שבועי!*\n\nמה הכי מעניין אתכם?\n\n1️⃣ אוזניות\n2️⃣ שעונים חכמים\n3️⃣ מוצרי בית\n4️⃣ ביגוד\n5️⃣ ספורט\n6️⃣ אלקטרוניקה\n\nענו עם המספר! 👇'); }
async function sendSurprise() { var l=[{name:'גאדגט מטורף',query:'cool gadget 2024'},{name:'מוצר ויראלי',query:'viral product tiktok'},{name:'המצאה מדהימה',query:'amazing invention cheap'}]; var s=l[Math.floor(Math.random()*l.length)]; await sendMsg(GROUP_CHAT_ID,'🎁 *קופסת הפתעה!*\n\n*'+s.name+'* — המחיר יפיל אתכם!\n\n👉 '+buildLink(s.query)+'\n\n😱'); }
async function announceKing() { var king=null,max=0; for(var p in searchCount) if(searchCount[p]>max){max=searchCount[p];king=p;} if(king&&max>0){await sendMsg(GROUP_CHAT_ID,'👑 *מלך הקבוצה!*\n\n@'+king.replace('@c.us','')+'חיפש/ה *'+max+'* פעמים!\n\n🏆 כל הכבוד! 🔥'); for(var k in searchCount) delete searchCount[k];} }

async function handleAdmin(text, phone) {
  var cmd=text.trim();
  if(cmd==='!דיל'){await sendDailyDeal();await sendMsg(phone,'✅ דיל נשלח!');return;}
  if(cmd==='!סקר'){await sendPoll();await sendMsg(phone,'✅ סקר נשלח!');return;}
  if(cmd==='!הפתעה'){await sendSurprise();await sendMsg(phone,'✅ הפתעה נשלחה!');return;}
  if(cmd==='!מלך'){await announceKing();await sendMsg(phone,'✅ מלך הוכרז!');return;}
  if(cmd==='!מצב'){var t=0;for(var p in searchCount)t+=searchCount[p];await sendMsg(phone,'📊 *סטטוס:*\n🔍 חיפושים: '+t+'\n❄️ מוקפאים: '+frozenUsers.length+'\n👑 VIP: '+vipUsers.length);return;}
  if(cmd==='!ניקוי'){for(var k in searchCount)delete searchCount[k];await sendMsg(phone,'✅ אופס!');return;}
  if(cmd==='!בדיחה'){await sendMsg(GROUP_CHAT_ID,'😂 *בדיחה:*\n\n'+JOKES[Math.floor(Math.random()*JOKES.length)]);await sendMsg(phone,'✅');return;}
  if(cmd==='!עובדה'){await sendMsg(GROUP_CHAT_ID,FACTS[Math.floor(Math.random()*FACTS.length)]);await sendMsg(phone,'✅');return;}
  if(cmd==='!תחרות'){await sendMsg(GROUP_CHAT_ID,'🏆 *תחרות דילים!*\n\nמי ימצא את הדיל הכי זול?\nהזוכה מקבל 👑 VIP!\n\nיאללה! 🔥');await sendMsg(phone,'✅');return;}
  if(cmd==='!מצב לילה'){await sendMsg(GROUP_CHAT_ID,'🌙 *מצב לילה*\n\nהבוט עובד בלחישות 😴');await sendMsg(phone,'✅');return;}
  if(cmd==='!מצב טירוף'){await sendMsg(GROUP_CHAT_ID,'🔥🤯💥 *מצב טירוף!*\n\nיאללה תחפשו דילים! 🚀💰');await sendMsg(phone,'✅');return;}
  if(cmd.indexOf('!הקפא ')===0){var n=cmd.replace('!הקפא ','').replace(/^0/,'');var fp='972'+n+'@c.us';if(frozenUsers.indexOf(fp)===-1)frozenUsers.push(fp);await sendMsg(phone,'✅ הוקפא!');return;}
  if(cmd.indexOf('!שחרר ')===0){var n2=cmd.replace('!שחרר ','').replace(/^0/,'');var fp2='972'+n2+'@c.us';var i=frozenUsers.indexOf(fp2);if(i!==-1)frozenUsers.splice(i,1);await sendMsg(phone,'✅ שוחרר!');return;}
  if(cmd.indexOf('!VIP ')===0){var n3=cmd.replace('!VIP ','').replace(/^0/,'');var vp='972'+n3+'@c.us';if(vipUsers.indexOf(vp)===-1)vipUsers.push(vp);await sendMsg(GROUP_CHAT_ID,'👑 @'+vp.replace('@c.us','')+' קיבל/ה VIP! 🌟');await sendMsg(phone,'✅');return;}
  if(cmd.indexOf('!אזהרה ')===0){var n4=cmd.replace('!אזהרה ','').replace(/^0/,'');var wp='972'+n4+'@c.us';await sendMsg(wp,'⚠️ *אזהרה מהמנהל!*\n\nאנא שמור על כללי הקבוצה 🙏');await sendMsg(phone,'✅');return;}
  if(cmd.indexOf('!כבוד ')===0){var n5=cmd.replace('!כבוד ','').replace(/^0/,'');var hp='972'+n5+'@c.us';await sendMsg(GROUP_CHAT_ID,'🏆 *גיבור הקבוצה!*\n\n@'+hp.replace('@c.us','')+' הגיבור/ת שלנו! ❤️');await sendMsg(phone,'✅');return;}
  if(cmd.indexOf('!הודעה ')===0){await sendMsg(GROUP_CHAT_ID,'📢 *הודעה מהמנהל:*\n\n'+cmd.replace('!הודעה ',''));await sendMsg(phone,'✅');return;}
  if(cmd==='!עזרה'){await sendMsg(phone,'📋 *פקודות מנהל:*\n\n!דיל !סקר !הפתעה !מלך !מצב !ניקוי !בדיחה !עובדה !תחרות\n!מצב לילה !מצב טירוף\n!הקפא [מספר]\n!שחרר [מספר]\n!VIP [מספר]\n!אזהרה [מספר]\n!כבוד [מספר]\n!הודעה [טקסט]');return;}
}

function scheduleDaily(){var now=new Date(),next=new Date();next.setHours(10,0,0,0);if(now>=next)next.setDate(next.getDate()+1);setTimeout(async function(){await sendDailyDeal();scheduleDaily();},next-now);}
function scheduleWeekly(){var now=new Date(),next=new Date();next.setDate(now.getDate()+(7-now.getDay()));next.setHours(11,0,0,0);setTimeout(async function(){await sendPoll();scheduleWeekly();},next-now);}
function scheduleKing(){var now=new Date(),next=new Date();next.setDate(now.getDate()+(7-now.getDay()));next.setHours(12,0,0,0);setTimeout(async function(){await announceKing();scheduleKing();},next-now);}

app.post('/webhook', async function(req, res) {
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
    var senderPhone=sd.sender||'';
    var senderName=sd.senderName||'חבר';
    if(!text||!chatId||!senderPhone) return;

    console.log('הודעה מ:',senderName,'|',text.substring(0,50));

    if(isAdmin(senderPhone)&&text.charAt(0)==='!'){await handleAdmin(text,senderPhone);return;}
    if(isFrozen(senderPhone)) return;

    if(hasSpam(text)){await sendMsg(chatId,'🚫 @'+senderPhone.replace('@c.us','')+' פרסומות אסורות! 🙏');await sendToAdmins('🚨 *ספאם!*\n'+senderName+':\n"'+text+'"');return;}

    if(hasBadWord(text)){
      warningCount[senderPhone]=(warningCount[senderPhone]||0)+1;
      var w=warningCount[senderPhone];
      await sendMsg(chatId,'⚠️ @'+senderPhone.replace('@c.us','')+' אזהרה '+w+'/3! שלחתי לך הודעה פרטית 🙏');
      await sendMsg(senderPhone,'שלום '+senderName+' 👋\n\nזוהי אזהרה *'+w+'* מתוך 3.\nהשפה שהשתמשת בה לא מתאימה 🙏\n\n'+(w>=3?'⛔ אזהרה אחרונה!':'😊 בוא נמשיך בצורה נעימה!'));
      if(w>=3){if(frozenUsers.indexOf(senderPhone)===-1)frozenUsers.push(senderPhone);await sendMsg(chatId,'❄️ @'+senderPhone.replace('@c.us','')+' הוקפא!');}
      await sendToAdmins('🚨 *קללה!*\n'+senderName+' (אזהרה '+w+'/3):\n"'+text+'"');
      return;
    }

    var triggerFound=false;
    var searchQuery=text;
    for(var t=0;t<TRIGGER_WORDS.length;t++){if(text.indexOf(TRIGGER_WORDS[t])!==-1){triggerFound=true;searchQuery=searchQuery.split(TRIGGER_WORDS[t]).join('').trim();}}
    if(!triggerFound) return;
    if(!searchQuery||searchQuery.length<2){await sendMsg(chatId,'🎧 כתוב למשל: אני מחפש אוזניות בלוטות');return;}

    if(!userMemory[senderPhone]) userMemory[senderPhone]=[];
    userMemory[senderPhone].push(searchQuery);
    searchCount[senderPhone]=(searchCount[senderPhone]||0)+1;
    var total=searchCount[senderPhone];
    var mention='@'+senderPhone.replace('@c.us','');
    var vipTag=isVIP(senderPhone)?' 👑':'';
    var link=buildLink(searchQuery);
    var saving=Math.floor(Math.random()*200)+50;
    var funnyMsg='';
    for(var fk in FUNNY){if(searchQuery.indexOf(fk)!==-1){funnyMsg=FUNNY[fk];break;}}

    await sendTyping(chatId);
    await sendMsg(chatId,getGreeting()+' '+mention+vipTag+'!\n🔍 מחפש *'+searchQuery+'*... רגע אחד!');
    await sleep(2000);
    await sendTyping(chatId);
    await sleep(1500);

    var reply=mention+vipTag+' ✅ *מצאתי עבורך '+searchQuery+'!*\n\n';
    if(funnyMsg) reply+=funnyMsg+'\n\n';
    reply+='🌡️ חום הדיל: '+getHeat()+'\n';
    reply+='💰 חיסכון לעומת ישראל: *₪'+saving+'*\n\n';
    reply+='👇 לחץ לראות:\n'+link+'\n\n';
    reply+='🔥 מחירים מטורפים!';

    if(total===5) reply+='\n\n🎉 החיפוש ה-5 שלך! מכור לדילים! 😄';
    else if(total===10){reply+='\n\n🏆 *10 חיפושים!* מלך הדילים! 👑';await sendToAdmins('🎉 '+senderName+' הגיע ל-10 חיפושים!');}
    else if(total===20){if(vipUsers.indexOf(senderPhone)===-1)vipUsers.push(senderPhone);reply+='\n\n🌟 *20 חיפושים!* קיבלת VIP! 👑';}

    var prevList=userMemory[senderPhone];
    if(prevList.length>1){var lastS=prevList[prevList.length-2];if(lastS!==searchQuery) reply+='\n\n💡 *בפעם הקודמת חיפשת:* '+lastS;}

    for(var sp in userMemory){if(sp!==senderPhone&&userMemory[sp].indexOf(searchQuery)!==-1){reply+='\n\n🤝 גם @'+sp.replace('@c.us','')+' חיפש/ה את זה! תעשו הזמנה ביחד! 😄';break;}}

    await sendMsg(chatId,reply);
  } catch(e){console.error('שגיאה:',e.message);}
});

app.get('/',function(req,res){res.send('הבוט הפרימיום פועל!');});

var PORT=process.env.PORT||3000;
app.listen(PORT,function(){
  console.log('הבוט הפרימיום פועל על פורט '+PORT);
  scheduleDaily();
  scheduleWeekly();
  scheduleKing();
  setInterval(async function(){await sendSurprise();},7*24*60*60*1000);
});
