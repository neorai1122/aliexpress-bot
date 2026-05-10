const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const GREEN_API_URL = `https://7107.api.greenapi.com/waInstance${INSTANCE_ID}`;
const ALI_TRACKING_ID = 'bot01';
const ALI_APP_KEY = '533908';
const GROUP_CHAT_ID = 'KOL2v0rh8LH3RgfQIVr8gq@g.us';
const ADMINS = ['972538800370@c.us', '972557119650@c.us'];

const userMemory = {};
const searchCount = {};
const frozenUsers = new Set();
const vipUsers = new Set();
const warningCount = {};

const TRIGGER_WORDS = ['אני מחפש','אני מחפשת','חפש לי','חפשי לי','אני צריך','אני צריכה','מחפש','מחפשת','איפה אפשר לקנות','רוצה לקנות','מישהו מכיר','מישהי מכירה','יש מוצר'];
const BAD_WORDS = ['זין','כוס','שרמוטה','בן זונה','מניאק','זונה','לך תזדיין','ממזר','אידיוט','טמבל','מפגר','fuck','shit','bitch','asshole','bastard','idiot'];
const SPAM_WORDS = ['הצטרפו','קבוצה חדשה','דרושים','מבצע מיוחד','ווטסאפ','טלגרם','השקעה','הרוויחו','עשירים','קליק','ביטקוין','הימור','קזינו'];

const TRANSLATIONS = {'אוזניות':'earphones','בלוטות':'bluetooth','נעליים':'shoes','נעל':'shoes','שעון':'watch','טלפון':'phone','מטען':'charger','כיסא':'chair','מאוורר':'fan','מצלמה':'camera','תיק':'bag','בגדים':'clothes','צמיד':'bracelet','טבעת':'ring','משקפיים':'glasses','ספורט':'sport','ילדים':'kids','צעצוע':'toy','מטבח':'kitchen','עט':'pen','מחשב':'computer','לפטופ':'laptop','זול':'cheap','כפפות':'gloves','טאבלט':'tablet','רמקול':'speaker','מקלדת':'keyboard','עכבר':'mouse','מנורה':'lamp','שמיכה':'blanket','כרית':'pillow','ארנק':'wallet','כובע':'hat','גרביים':'socks','חגורה':'belt','מראה':'mirror','בושם':'perfume','קרם':'cream','שמפו':'shampoo'};
const FUNNY_RESPONSES = {'כיסא':'😂 כיסא? בטח אחרי שעמדת כל היום!','שמיכה':'🥶 שמיכה? קר לך?','בושם':'😏 מישהו רוצה להריח טוב!','טבעת':'💍😄 מישהו מתחתן?!','צעצוע':'😄 בשביל הילדים... או בשבילך?'};
const JOKES = ['למה הסלמון שחה נגד הזרם? כי הוא לא רצה לקנות דגים קפואים מאלי אקספרס! 😂','מה ההבדל בין אמא לאלי אקספרס? אמא תמיד מגיעה בזמן! 😄','למה הבוט שלי לא ישן? כי הדילים לא ישנים! 🔥'];
const FACTS = ['💡 ידעתם? אלי אקספרס מוכר מעל 100 מיליון מוצרים!','💡 ידעתם? ניתן לחסוך עד 80% לעומת מחירים בישראל!','💡 ידעתם? אלי אקספרס מציע החזר כספי מלא אם המוצר לא הגיע!'];

function translateToEnglish(text) {
  let result = text;
  for (const [h, e] of Object.entries(TRANSLATIONS)) result = result.replace(new RegExp(h, 'g'), e);
  return result;
}

function buildSearchLink(query) {
  const encoded = encodeURIComponent(translateToEnglish(query));
  return `https://www.aliexpress.com/wholesale?SearchText=${encoded}&SortType=total_tranpro_desc&aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key=${ALI_TRACKING_ID}&terminal_id=${ALI_APP_KEY}`;
}

async function sendMessage(chatId, message) {
  try { await axios.post(`${GREEN_API_URL}/sendMessage/${API_TOKEN}`, { chatId, message }); } catch (e) { console.error(e.message); }
}

async function sendToAdmins(message) {
  for (const admin of ADMINS) await sendMessage(admin, message);
}

async function sendTyping(chatId) {
  try { await axios.post(`${GREEN_API_URL}/sendTyping/${API_TOKEN}`, { chatId }); } catch (e) {}
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function containsBadWord(text) { return BAD_WORDS.some(w => text.toLowerCase().includes(w.toLowerCase())); }
function containsSpam(text) { return SPAM_WORDS.some(w => text.includes(w)); }
function isAdmin(phone) { return ADMINS.includes(phone); }
function getHeat() { return '🔥'.repeat(Math.floor(Math.random() * 3) + 3); }

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return '☀️ בוקר טוב!';
  if (h >= 12 && h < 17) return '🌤️ צהריים טובים!';
  if (h >= 17 && h < 21) return '🌆 ערב טוב!';
  return '🌙 שש... כולם ישנים אבל אני עובד בשבילך!';
}

function getKing() {
  let king = null, max = 0;
  for (const [p, c] of Object.entries(searchCount)) { if (c > max) { max = c; king = p; } }
  return { king, max };
}

async function sendDailyDeal() {
  const deals = [{name:'אוזניות בלוטות פרו',query:'bluetooth earphones pro',saving:120},{name:'שעון חכם 2024',query:'smart watch 2024',saving:250},{name:'מטען מהיר 65W',query:'fast charger 65w',saving:80},{name:'רמקול בלוטות עמיד למים',query:'waterproof bluetooth speaker',saving:150},{name:'מצלמת אבטחה WiFi',query:'security camera wifi 4k',saving:200}];
  const deal = deals[Math.floor(Math.random() * deals.length)];
  await sendMessage(GROUP_CHAT_ID, `🚨 *דיל היום!* 🚨\n\nהדיל הכי חם: *${deal.name}*\n\n🌡️ חום הדיל: ${getHeat()}\n💰 חיסכון לעומת ישראל: *₪${deal.saving}*\n\n👉 ${buildSearchLink(deal.query)}\n\n⚡ אל תפספסו!`);
}

async function sendWeeklyPoll() {
  await sendMessage(GROUP_CHAT_ID, `📊 *סקר שבועי!*\n\nמה הכי מעניין אתכם?\n\n1️⃣ אוזניות ואביזרי אודיו\n2️⃣ שעונים חכמים\n3️⃣ מוצרי בית וגאדג'טים\n4️⃣ ביגוד ואופנה\n5️⃣ מוצרי ספורט\n6️⃣ אלקטרוניקה\n\nענו עם המספר! 👇`);
}

async function sendSurpriseBox() {
  const surprises = [{name:"גאדג'ט מטורף",query:'cool gadget 2024'},{name:'מוצר ויראלי',query:'viral product tiktok'},{name:'המצאה מדהימה',query:'amazing invention cheap'}];
  const s = surprises[Math.floor(Math.random() * surprises.length)];
  await sendMessage(GROUP_CHAT_ID, `🎁 *קופסת הפתעה!*\n\n*${s.name}* — המחיר יפיל אתכם!\n\n👉 ${buildSearchLink(s.query)}\n\n😱`);
}

async function announceKing() {
  const { king, max } = getKing();
  if (king && max > 0) {
    await sendMessage(GROUP_CHAT_ID, `👑 *מלך הקבוצה!*\n\n@${king.replace('@c.us', '')} חיפש/ה *${max}* פעמים!\n\n🏆 כל הכבוד! 🔥`);
    Object.keys(searchCount).forEach(k => delete searchCount[k]);
  }
}

async function handleAdminCommand(text, senderPhone) {
  const cmd = text.trim();
  if (cmd === '!דיל') { await sendDailyDeal(); await sendMessage(senderPhone, '✅ דיל נשלח!'); return true; }
  if (cmd === '!סקר') { await sendWeeklyPoll(); await sendMessage(senderPhone, '✅ סקר נשלח!'); return true; }
  if (cmd === '!הפתעה') { await sendSurpriseBox(); await sendMessage(senderPhone, '✅ הפתעה נשלחה!'); return true; }
  if (cmd === '!מלך') { await announceKing(); await sendMessage(senderPhone, '✅ מלך הוכרז!'); return true; }
  if (cmd === '!מצב') {
    const total = Object.values(searchCount).reduce((a, b) => a + b, 0);
    await sendMessage(senderPhone, `📊 *סטטוס:*\n\n🔍 חיפושים: ${total}\n❄️ מוקפאים: ${frozenUsers.size}\n👑 VIP: ${vipUsers.size}`);
    return true;
  }
  if (cmd === '!ניקוי') { Object.keys(searchCount).forEach(k => delete searchCount[k]); await sendMessage(senderPhone, '✅ אופס!'); return true; }
  if (cmd === '!בדיחה') { await sendMessage(GROUP_CHAT_ID, `😂 *בדיחה:*\n\n${JOKES[Math.floor(Math.random() * JOKES.length)]}`); await sendMessage(senderPhone, '✅'); return true; }
  if (cmd === '!עובדה') { await sendMessage(GROUP_CHAT_ID, FACTS[Math.floor(Math.random() * FACTS.length)]); await sendMessage(senderPhone, '✅'); return true; }
  if (cmd === '!תחרות') { await sendMessage(GROUP_CHAT_ID, `🏆 *תחרות דילים!*\n\nמי ימצא את הדיל הכי זול השבוע?\nהזוכה מקבל תג 👑 VIP!\n\nיאללה! 🔥`); await sendMessage(senderPhone, '✅'); return true; }
  if (cmd === '!מצב לילה') { await sendMessage(GROUP_CHAT_ID, `🌙 *מצב לילה פעיל*\n\nשקט... הבוט עובד בלחישות 😴`); await sendMessage(senderPhone, '✅'); return true; }
  if (cmd === '!מצב טירוף') { await sendMessage(GROUP_CHAT_ID, `🔥🤯💥 *מצב טירוף!* 💥🤯🔥\n\nיאללה תחפשו דילים! 🚀💰`); await sendMessage(senderPhone, '✅'); return true; }
  if (cmd.startsWith('!הקפא ')) { const p = '972' + cmd.replace('!הקפא ', '').replace(/^0/, '') + '@c.us'; frozenUsers.add(p); await sendMessage(senderPhone, `✅ ${p} הוקפא!`); return true; }
  if (cmd.startsWith('!שחרר ')) { const p = '972' + cmd.replace('!שחרר ', '').replace(/^0/, '') + '@c.us'; frozenUsers.delete(p); await sendMessage(senderPhone, `✅ שוחרר!`); return true; }
  if (cmd.startsWith('!VIP ')) { const p = '972' + cmd.replace('!VIP ', '').replace(/^0/, '') + '@c.us'; vipUsers.add(p); await sendMessage(GROUP_CHAT_ID, `👑 @${p.replace('@c.us','')} קיבל/ה VIP! 🌟`); await sendMessage(senderPhone, '✅'); return true; }
  if (cmd.startsWith('!אזהרה ')) { const p = '972' + cmd.replace('!אזהרה ', '').replace(/^0/, '') + '@c.us'; await sendMessage(p, `⚠️ *אזהרה מהמנהל!*\n\nאנא שמור על כללי הקבוצה 🙏`); await sendMessage(senderPhone, '✅'); return true; }
  if (cmd.startsWith('!כבוד ')) { const p = '972' + cmd.replace('!כבוד ', '').replace(/^0/, '') + '@c.us'; await sendMessage(GROUP_CHAT_ID, `🏆 *גיבור הקבוצה!*\n\n@${p.replace('@c.us','')} הוא/היא הגיבור/ת שלנו! ❤️`); await sendMessage(senderPhone, '✅'); return true; }
  if (cmd.startsWith('!הודעה ')) { await sendMessage(GROUP_CHAT_ID, `📢 *הודעה מהמנהל:*\n\n${cmd.replace('!הודעה ', '')}`); await sendMessage(senderPhone, '✅'); return true; }
  if (cmd === '!עזרה') {
    await sendMessage(senderPhone, `📋 *פקודות מנהל:*\n\n!דיל !סקר !הפתעה !מלך !מצב !ניקוי !בדיחה !עובדה !תחרות\n!מצב לילה !מצב טירוף\n!הקפא [מספר]\n!שחרר [מספר]\n!VIP [מספר]\n!אזהרה [מספר]\n!כבוד [מספר]\n!הודעה [טקסט]`);
    return true;
  }
  return false;
}

function scheduleDaily() {
  const now = new Date(), next = new Date();
  next.setHours(10, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);
  setTimeout(async () => { await sendDailyDeal(); scheduleDaily(); }, next - now);
}

function scheduleWeekly() {
  const now = new Date(), next = new Date();
  next.setDate(now.getDate() + (7 - now.getDay()));
  next.setHours(11, 0, 0, 0);
  setTimeout(async () => { await sendWeeklyPoll(); scheduleWeekly(); }, next - now);
}

function scheduleKing() {
  const now = new Date(), next = new Date();
  next.setDate(now.getDate() + (7 - now.getDay()));
  next.setHours(12, 0, 0, 0);
  setTimeout(async () => { await announceKing(); scheduleKing(); }, next - now);
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (!body || body.typeWebhook !== 'incomingMessageReceived') return;
    const messageData = body.messageData;
    if (!messageData || messageData.typeMessage !== 'textMessage') return;
    const text = messageData.textMessageData?.textMessage || '';
    const chatId = body.senderData?.chatId || '';
    const senderName = body.senderData?.senderName || 'חבר';
    const senderPhone = body.senderData?.sender || '';
    if (!text || !chatId) return;

    if (isAdmin(senderPhone) && text.startsWith('!')) { await handleAdminCommand(text, senderPhone); return; }
    if (frozenUsers.has(senderPhone)) return;

    if (containsSpam(text)) {
      await sendMessage(chatId, `🚫 @${senderPhone.replace('@c.us','')} פרסומות אסורות בקבוצה! 🙏`);
      await sendToAdmins(`🚨 *ספאם!*\n${senderName}: "${text}"`);
      return;
    }

    if (containsBadWord(text)) {
      warningCount[senderPhone] = (warningCount[senderPhone] || 0) + 1;
      const w = warningCount[senderPhone];
      await sendMessage(chatId, `⚠️ @${senderPhone.replace('@c.us','')} אזהרה ${w}/3! שלחתי לך הודעה פרטית.`);
      await sendMessage(senderPhone, `שלום ${senderName} 👋\n\nזוהי אזהרה *${w}* מתוך 3.\nהשפה שהשתמשת בה לא מתאימה לקבוצה 🙏\n\n${w >= 3 ? '⛔ אזהרה אחרונה!' : '😊 בוא נמשיך בצורה נעימה!'}`);
      if (w >= 3) { frozenUsers.add(senderPhone); await sendMessage(chatId, `❄️ @${senderPhone.replace('@c.us','')} הוקפא!`); }
      await sendToAdmins(`🚨 *קללה!*\n${senderName} (אזהרה ${w}/3):\n"${text}"`);
      return;
    }

    const triggerWord = TRIGGER_WORDS.find(word => text.includes(word));
    if (!triggerWord) return;

    let searchQuery = text;
    for (const word of TRIGGER_WORDS) searchQuery = searchQuery.replace(word, '').trim();
    if (!searchQuery || searchQuery.length < 2) { await sendMessage(chatId, '🎧 כתוב למשל: אני מחפש אוזניות בלוטות'); return; }

    if (!userMemory[senderPhone]) userMemory[senderPhone] = [];
    userMemory[senderPhone].push(searchQuery);
    searchCount[senderPhone] = (searchCount[senderPhone] || 0) + 1;
    const total = searchCount[senderPhone];
    const mention = `@${senderPhone.replace('@c.us','')}`;
    const isVIP = vipUsers.has(senderPhone);
    const link = buildSearchLink(searchQuery);
    const saving = Math.floor(Math.random() * 200) + 50;
    const funny = Object.entries(FUNNY_RESPONSES).find(([k]) => searchQuery.includes(k));

    await sendTyping(chatId);
    await sendMessage(chatId, `${getTimeGreeting()} ${mention}${isVIP?' 👑':''}!\n🔍 מחפש *${searchQuery}*... רגע!`);
    await sleep(2000);
    await sendTyping(chatId);
    await sleep(1500);

    let msg = `${mention}${isVIP?' 👑 VIP':''} ✅ *מצאתי עבורך ${searchQuery}!*\n\n`;
    if (funny) msg += `${funny[1]}\n\n`;
    msg += `🌡️ חום הדיל: ${getHeat()}\n`;
    msg += `💰 חיסכון לעומת ישראל: *₪${saving}*\n\n`;
    msg += `👇 לחץ לראות:\n${link}\n\n🔥 מחירים מטורפים!`;

    if (total === 5) msg += `\n\n🎉 החיפוש ה-5 שלך! אתה מכור לדילים! 😄`;
    else if (total === 10) { msg += `\n\n🏆 *10 חיפושים!* אתה מלך הדילים! 👑`; await sendToAdmins(`🎉 ${senderName} הגיע ל-10 חיפושים!`); }
    else if (total === 20) { vipUsers.add(senderPhone); msg += `\n\n🌟 *20 חיפושים!* קיבלת תג VIP! 👑`; }

    const prev = userMemory[senderPhone];
    if (prev.length > 1) { const last = prev[prev.length - 2]; if (last !== searchQuery) msg += `\n\n💡 *בפעם הקודמת חיפשת:* ${last}`; }

    const same = Object.entries(userMemory).filter(([p, s]) => p !== senderPhone && s.includes(searchQuery)).map(([p]) => p.replace('@c.us',''));
    if (same.length > 0) msg += `\n\n🤝 גם @${same[0]} חיפש/ה את זה! תעשו הזמנה ביחד! 😄`;

    await sendMessage(chatId, msg);
  } catch (e) { console.error(e.message); }
});

app.get('/', (req, res) => { res.send('🤖 הבוט הפרימיום פועל!'); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 הבוט הפרימיום פועל על פורט ' + PORT);
  scheduleDaily();
  scheduleWeekly();
  scheduleKing();
  setInterval(async () => { await sendSurpriseBox(); }, 7 * 24 * 60 * 60 * 1000);
});
