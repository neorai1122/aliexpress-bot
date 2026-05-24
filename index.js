const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(express.json({limit:'50mb'}));

// ===== CONFIG =====
const INSTANCE_ID='7107614702';
const API_TOKEN='aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const BASE_URL='https://7107.api.greenapi.com';
const ALI_APP_KEY='533908';
const ALI_APP_SECRET='iTd8ZOn3s1xmlJ7fXLoe2XYHBkkaF2dF';
const ALI_TRACKING_ID='bot01';
const GROUP_CHAT_ID='120363424186489979@g.us';
const GROUP_NAME='דילים שווים';
const ADMIN_NUMBERS=['972538800370','972557119650'];
const GEMINI_KEY='AIzaSyBtTaHkuyj_Q15AQcmOZIS2iY_Bg3cDP58';
const SCRAPER_KEY='84d4a6b717aad7db03154d7b00c2df3a';
const RENDER_URL='https://aliexpress-bot-brr6.onrender.com';
const RANK_WEIGHTS={semantic:0.40,rating:0.25,sales:0.20,price:0.10,image:0.05};

// ===== EXCHANGE RATE =====
let USD_TO_ILS=3.75;
async function updateRate(){
  try{const r=await axios.get('https://api.exchangerate-api.com/v4/latest/USD',{timeout:8000});if(r.data?.rates?.ILS){USD_TO_ILS=r.data.rates.ILS;console.log('💱 Rate:'+USD_TO_ILS.toFixed(2));}}catch(e){}
}
updateRate();setInterval(updateRate,12*60*60*1000);

// ===== CACHE =====
const cacheStore={};
const CACHE_TTL=6*60*60*1000;
const INTENT_TTL=24*60*60*1000;
function cacheSet(k,v,ttl=CACHE_TTL){cacheStore[k.toLowerCase()]={v,e:Date.now()+ttl};}
function cacheGet(k){const c=cacheStore[k.toLowerCase()];if(!c||Date.now()>c.e){if(c)delete cacheStore[k.toLowerCase()];return null;}return c.v;}
function cacheClear(){Object.keys(cacheStore).forEach(k=>delete cacheStore[k]);}
function cacheSize(){return Object.keys(cacheStore).length;}
setInterval(()=>{const now=Date.now();Object.keys(cacheStore).forEach(k=>{if(now>cacheStore[k].e)delete cacheStore[k];});},60*60*1000);

// ===== AI MEMORY =====
const mem={querySuccess:{},queryFail:{},categoryHits:{},topProducts:{},userHistory:{}};
function memRecordSearch(q,cat){if(!mem.querySuccess[q])mem.querySuccess[q]=0;mem.categoryHits[cat]=(mem.categoryHits[cat]||0)+1;}
function memRecordSuccess(q){mem.querySuccess[q]=(mem.querySuccess[q]||0)+1;}
function memRecordFail(q){mem.queryFail[q]=(mem.queryFail[q]||0)+1;}
function memRecordProduct(id){mem.topProducts[id]=(mem.topProducts[id]||0)+1;}
function memRecordUser(phone,q){if(!mem.userHistory[phone])mem.userHistory[phone]=[];mem.userHistory[phone].push({q,t:Date.now()});if(mem.userHistory[phone].length>20)mem.userHistory[phone]=mem.userHistory[phone].slice(-20);}
function memTopCategories(){return Object.entries(mem.categoryHits).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([cat,count])=>({cat,count}));}
function memSuccessfulQueries(){return Object.entries(mem.querySuccess).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([q])=>q);}
function memStats(){return{totalSearches:Object.values(mem.querySuccess).reduce((a,b)=>a+b,0),uniqueQueries:Object.keys(mem.querySuccess).length,topCategories:memTopCategories(),topQueries:memSuccessfulQueries().slice(0,5),uniqueUsers:Object.keys(mem.userHistory).length};}

// ===== STATE =====
const searchCount={},warningCount={},frozenUsers=[],vipUsers=[],newUserFlow={};
let pollActive=false,pollVotes={},pollTimer=null;
let dealIdx=0;

// ===== CONSTANTS =====
const TRIGGER_WORDS=['אני מחפש','אני מחפשת','חפש לי','חפשי לי','אני צריך','אני צריכה','מחפש','מחפשת','תמצא לי','תביא לי','רוצה לקנות','מישהו מכיר','תמצאו לי','תביאו לי'];
const BAD_WORDS=['זין','כוס','שרמוטה','זונה','מניאק','ממזר','אידיוט','טמבל','מפגר','חרא','בן זונה','fuck','shit','bitch','asshole'];
const SPAM_WORDS=['הצטרפו','קבוצה חדשה','דרושים','טלגרם','השקעה','הרוויחו','ביטקוין','הימור','קזינו'];
const POLL_OPTIONS=['🎧 Earphones & Audio','⌚ Smartwatches','🏠 Home & Gadgets','👗 Fashion','⚽ Sports','💻 Electronics','🧸 Kids & Toys','🍳 Kitchen','💄 Beauty','🔧 Tools'];
const DEAL_LIST=['bluetooth earphones wireless','smartwatch fitness tracker','fast charger 65w usb-c','bluetooth speaker waterproof','wireless gaming mouse','led strip lights rgb','laptop stand aluminum','power bank 20000mah','polarized sunglasses men','running shoes lightweight','robot vacuum cleaner','portable mini projector','electric toothbrush sonic','waterproof backpack','wireless keyboard mouse combo'];
const ACCESSORY_SIGNALS=['case','cover','protector','tempered glass','screen glass','strap','watch band','watch strap','silicone band','holder','stand','mount','bracket','dock','charging cable','data cable','usb cable','sponge','cleaning','brush','cloth','replacement part','spare part','repair kit','film','skin','sticker','decal','pouch','sleeve','bag for','carrying case','tip','eartip','foam tip','ear tip','wheel cap','valve cap'];

const WELCOME='👋 *ברוכים הבאים לקבוצת '+GROUP_NAME+'!* 🎉\n\n━━━━━━━━━━━━━━━\n🤖 *הבוט מבין עברית טבעית!*\n━━━━━━━━━━━━━━━\n\nכתוב: _"אני מחפש + מוצר"_\n\n📌 דוגמאות:\n• אני מחפש אוזניות בלוטות\n• מחפשת שעון זהב\n• חפש לי מטען מהיר\n• אני מחפש ג\'אנטים לרכב\n\n🎁 תקבל:\n• 2 מוצרים עם תמונות\n• מחיר בשקלים ₪\n• ביקורות ודירוג\n• לינק שותפים!\n\n⚠️ כללים:\n• אסור לקלל — 3 = הוצאה!\n• אסור ספאם 🙏\n━━━━━━━━━━━━━━━';
const SQ1='❓ *שאלה 1/2*\n\nמה הכי מעניין אותך?\n\n1️⃣ אלקטרוניקה\n2️⃣ ביגוד ואופנה\n3️⃣ מוצרי בית\n4️⃣ ספורט ובריאות\n5️⃣ הכל!\n\n_ענה/י עם מספר_';
const SQ2='❓ *שאלה 2/2*\n\nמה הגיל שלך?\n\n1️⃣ 18-25\n2️⃣ 26-35\n3️⃣ 36-45\n4️⃣ 45+\n\n_ענה/י עם מספר_';
const SDONE='✅ *תודה! הכל מוכן!*\n\n🎉 ברוכים הבאים!\nכתוב/י *אני מחפש + מוצר* ונמצא לך! 🔥';

// ===== HELPERS =====
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function getPhone(r){return r.replace('@c.us','').replace('@g.us','').replace('@','').trim();}
function isAdmin(r){return ADMIN_NUMBERS.includes(getPhone(r));}
function hasBad(t){const l=t.toLowerCase();return BAD_WORDS.some(b=>l.includes(b));}
function hasSpam(t){return SPAM_WORDS.some(s=>t.includes(s));}
function getTop(){return Object.keys(mem.querySuccess).sort((a,b)=>mem.querySuccess[b]-mem.querySuccess[a]).slice(0,3);}

function formatStars(r){const n=parseFloat(r);if(isNaN(n))return '⭐⭐⭐⭐⭐ (5.0/5)';const s=Math.round((n/20)*2)/2;let st='';for(let i=0;i<Math.floor(s);i++)st+='⭐';if(s%1)st+='✨';return st+' ('+s.toFixed(1)+'/5)';}
function formatSales(n){const v=parseInt(n||0);if(v>=1000000)return(v/1000000).toFixed(1)+'M';if(v>=1000)return(v/1000).toFixed(1)+'K';return v.toString();}
function toILS(usd){return Math.round(parseFloat(usd||0)*USD_TO_ILS);}

function buildAffiliateLink(productId){return'https://www.aliexpress.com/item/'+productId+'.html?aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key='+ALI_TRACKING_ID+'&terminal_id='+ALI_APP_KEY;}

async function shortenLink(url){
  try{const r=await axios.get('https://tinyurl.com/api-create.php?url='+encodeURIComponent(url),{timeout:8000});if(r.data&&typeof r.data==='string'&&r.data.startsWith('http'))return r.data.trim();return url;}catch(e){return url;}
}

function formatProduct(p,num){
  const priceILS=toILS(p.sale_price||0);const origILS=toILS(p.original_price||p.sale_price||0);
  const disc=origILS>priceILS?Math.round((1-priceILS/origILS)*100):0;
  const title=(p.product_title||p.title||'מוצר').substring(0,85);
  let msg='━━━━━━━━━━━━━━━\n'+num+'️⃣ *'+title+'*\n━━━━━━━━━━━━━━━\n';
  if(disc>5&&origILS>priceILS)msg+='💰 *₪'+priceILS+'* ~~₪'+origILS+'~~ 🏷️ -'+disc+'%\n';
  else msg+='💰 מחיר: *₪'+priceILS+'*\n';
  msg+='🚚 משלוח חינם!\n'+formatStars(p.evaluate_rate||p.rating)+'\n📦 '+formatSales(p.lastest_volume||p.sales)+' מכירות\n🔗 '+(p.shortLink||p.promotion_link)+'\n━━━━━━━━━━━━━━━';
  return msg;
}

// ===== WHATSAPP =====
async function sendMsg(chatId,msg){try{await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendMessage/'+API_TOKEN,{chatId,message:msg});}catch(e){console.error('❌ msg:'+e.message);}}
async function sendImg(chatId,url,cap){
  try{if(!url){await sendMsg(chatId,cap);return;}if(url.startsWith('//'))url='https:'+url;await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendFileByUrl/'+API_TOKEN,{chatId,urlFile:url,fileName:'product.jpg',caption:cap||''});}
  catch(e){if(cap)await sendMsg(chatId,cap);}
}
async function sendTyping(chatId){try{await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/sendTyping/'+API_TOKEN,{chatId});}catch(e){}}
async function sendToAdmins(msg){for(const n of ADMIN_NUMBERS)await sendMsg(n+'@c.us',msg);}
async function removeFromGroup(phone){try{await axios.post(BASE_URL+'/waInstance'+INSTANCE_ID+'/removeGroupParticipant/'+API_TOKEN,{groupId:GROUP_CHAT_ID,participantChatId:phone+'@c.us'});return true;}catch(e){return false;}}

// ===== GEMINI AI =====
const GEMINI_URL='https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key='+GEMINI_KEY;
async function callGemini(prompt){
  const res=await axios.post(GEMINI_URL,{contents:[{parts:[{text:prompt}]}]},{timeout:12000});
  let t=res.data?.candidates?.[0]?.content?.parts?.[0]?.text||'';
  return t.replace(/```json|```/g,'').trim();
}

async function analyzeIntent(heText){
  const ck='intent:'+heText.toLowerCase().trim();const cached=cacheGet(ck);if(cached)return cached;
  try{
    const t=await callGemini(`You are an AI shopping intent analyzer for an AliExpress WhatsApp bot serving Israeli customers.
User wrote in Hebrew: "${heText}"
Return ONLY valid JSON:
{"category":"electronics|clothing|home|sports|automotive|beauty|toys|tools|other","productType":"exact product in English 2-4 words","primaryKeyword":"single most important English keyword","blockedWords":["words NOT in title"],"requiredWords":["at least one MUST be in title"],"minPriceUSD":null,"maxPriceUSD":null,"confidence":0.0-1.0}
Examples:
- "ג'אנטים לרכב" → automotive, "alloy wheel rims", block:[sticker,cover,cleaner], require:[wheel,rim,alloy]
- "אוזניות בלוטות" → electronics, "bluetooth earphones", block:[case,strap,tip], require:[earphone,earbuds,headphone]
- "שעון זהב סטייל" → electronics, "gold stylish smartwatch", block:[band,strap,case], require:[watch,smartwatch]`);
    const intent=JSON.parse(t);
    console.log('🧠 Intent:',intent.productType,'| conf:',intent.confidence);
    cacheSet(ck,intent,INTENT_TTL);return intent;
  }catch(e){console.error('❌ Gemini intent:'+e.message);return{category:'other',productType:'product',primaryKeyword:heText,blockedWords:['case','cover','strap'],requiredWords:[],minPriceUSD:null,maxPriceUSD:null,confidence:0.4};}
}

async function expandQueries(intent){
  const ck='expand:'+intent.productType.toLowerCase();const cached=cacheGet(ck);if(cached)return cached;
  try{
    const t=await callGemini(`Generate 6 optimized AliExpress search queries for: "${intent.productType}" (${intent.category})
Rules: 2-5 words each, vary broad/specific/brand/feature, use actual AliExpress title terms, NO accessories.
Return ONLY JSON array: ["query1","query2","query3","query4","query5","query6"]`);
    const queries=JSON.parse(t);
    console.log('🔄 Queries:',queries.slice(0,3).join(' | '));
    cacheSet(ck,queries,INTENT_TTL);return queries;
  }catch(e){const base=intent.primaryKeyword||intent.productType;return[base,base+' wireless',base+' 2024',intent.productType,intent.category+' '+base];}
}

async function validateProducts(products,intent){
  if(!products.length)return[];
  const highConf=products.filter(p=>(p._overlap||0)>0.7);
  if(highConf.length>=2){console.log('⚡ Skipping Gemini — high local confidence');return products.map((_,i)=>({i,ok:true,score:0.85}));}
  try{
    const list=products.slice(0,6).map((p,i)=>({i,title:(p.product_title||p.title||'').substring(0,80),price:parseFloat(p.sale_price||0)}));
    const t=await callGemini(`Validate AliExpress products for relevance.
User wants: "${intent.productType}" (${intent.category})
Products: ${JSON.stringify(list)}
Return ONLY JSON array: [{"i":0,"ok":true,"score":0.95},...]
Score 0-1. ok=false if clearly accessory/case/strap/unrelated.`);
    const result=JSON.parse(t);
    console.log('🤖 Validated:',result.filter(r=>r.ok).length+'/'+result.length+' ok');
    return result;
  }catch(e){return products.map((_,i)=>({i,ok:true,score:0.5}));}
}

// ===== LOCAL FILTER =====
function isAccessory(title){const t=title.toLowerCase();return ACCESSORY_SIGNALS.some(s=>t.includes(s));}
function isFakePrice(p){return parseFloat(p)<0.50;}
function semanticOverlap(title,keywords){
  const t=title.toLowerCase();const words=keywords.toLowerCase().split(/\s+/).filter(w=>w.length>2);
  const matches=words.filter(w=>t.includes(w)).length;return matches/Math.max(words.length,1);
}
function imageScore(url){
  if(!url)return 0;
  if(url.includes('_220x220')||url.includes('_100x100'))return 0.3;
  if(url.includes('_320x320')||url.includes('_200x200'))return 0.6;
  if(url.includes('_640x640')||url.includes('_480x480'))return 1.0;
  if(url.includes('.jpg')||url.includes('.webp'))return 0.8;
  return 0.5;
}
function priceScore(priceUSD,category){
  const price=parseFloat(priceUSD);if(isNaN(price)||price<=0)return 0;
  const ranges={phone:[50,800],earphones:[3,200],watch:[5,300],charger:[2,60],speaker:[5,150],clothing:[3,100],automotive:[10,500],laptop:[100,1500]};
  const[min,max]=ranges[category]||[1,999];
  if(price<min*0.3)return 0.1;if(price>max*3)return 0.2;if(price>=min&&price<=max)return 1.0;return 0.6;
}

function filterProducts(products,{keywords,category,blockedWords=[],requiredWords=[]}){
  const results=[];
  for(const p of products){
    const title=p.product_title||p.title||'';const price=parseFloat(p.sale_price||p.price||0);const imgUrl=p.product_main_image_url||p.image||'';
    if(isFakePrice(price)){console.log('❌ fake price:'+price);continue;}
    if(!p.promotion_link&&!p.productId){continue;}
    if(isAccessory(title)){const wantsAcc=requiredWords.some(w=>ACCESSORY_SIGNALS.includes(w));if(!wantsAcc){console.log('❌ accessory:'+title.substring(0,40));continue;}}
    if(blockedWords.some(w=>w.length>2&&title.toLowerCase().includes(w.toLowerCase()))){console.log('❌ blocked:'+title.substring(0,40));continue;}
    if(requiredWords.length>0&&!requiredWords.some(w=>title.toLowerCase().includes(w.toLowerCase()))){console.log('❌ required miss:'+title.substring(0,40));continue;}
    const overlapScore=semanticOverlap(title,keywords);
    const imgScoreVal=imageScore(imgUrl);
    const ratingScore=Math.min(parseFloat(p.evaluate_rate||80)/100,1);
    const salesRaw=parseFloat(p.lastest_volume||p.sales||1);
    const salesScore=Math.min(Math.log10(salesRaw+1)/6,1);
    const pScore=priceScore(price,category);
    results.push({...p,_scores:{overlapScore,priceScore:pScore,imgScore:imgScoreVal,ratingScore,salesScore},_overlap:overlapScore});
  }
  console.log('🔧 Filter:'+products.length+' → '+results.length);
  return results;
}

// ===== RANKING =====
function rankProducts(products,aiValidation=[]){
  return products.map((p,i)=>{
    const s=p._scores||{};const ai=aiValidation.find(v=>v.i===i)||{ok:true,score:0.5};
    if(!ai.ok)return null;
    const semanticScore=(s.overlapScore||0.5)*0.6+(ai.score||0.5)*0.4;
    const W=RANK_WEIGHTS;
    const finalScore=semanticScore*W.semantic+(s.ratingScore||0.5)*W.rating+(s.salesScore||0.3)*W.sales+(s.priceScore||0.5)*W.price+(s.imgScore||0.5)*W.image;
    return{...p,_finalScore:finalScore};
  }).filter(Boolean).sort((a,b)=>b._finalScore-a._finalScore);
}

// ===== ALIEXPRESS API =====
async function searchAffiliateAPI(keywords){
  try{
    const ts=Date.now().toString();
    const params={app_key:ALI_APP_KEY,method:'aliexpress.affiliate.product.query',sign_method:'md5',timestamp:ts,v:'2.0',keywords,tracking_id:ALI_TRACKING_ID,page_size:'20',sort:'LAST_VOLUME_DESC',fields:'product_id,product_title,sale_price,evaluate_rate,lastest_volume,promotion_link,original_price,product_main_image_url'};
    const keys=Object.keys(params).sort();let sig=ALI_APP_SECRET;for(const k of keys)sig+=k+params[k];sig+=ALI_APP_SECRET;
    params.sign=crypto.createHash('md5').update(sig,'utf8').digest('hex').toUpperCase();
    const qs=Object.keys(params).map(k=>`${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
    const res=await axios.get('https://api-sg.aliexpress.com/sync?'+qs,{timeout:15000});
    const products=res.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product||[];
    console.log('📦 API ['+keywords.substring(0,25)+']: '+products.length);
    return products;
  }catch(e){console.error('❌ API:'+e.message);return[];}
}

async function scrapeSearch(keywords){
  try{
    const aliUrl='https://www.aliexpress.com/wholesale?SearchText='+encodeURIComponent(keywords)+'&SortType=total_tranpro_desc';
    const res=await axios.get('http://api.scraperapi.com',{params:{api_key:SCRAPER_KEY,url:aliUrl,country_code:'us',device_type:'desktop'},timeout:30000});
    const html=res.data;if(!html||html.length<1000||html.includes('captcha'))return[];
    const ids=[...html.matchAll(/"productId"\s*[=:]\s*"?(\d{8,})"?/g)];if(!ids.length)return[];
    console.log('🕷️ Scraper ['+keywords.substring(0,25)+']: '+ids.length+' IDs');
    const products=[];const seen=new Set();
    for(const m of ids){
      const id=m[1];if(seen.has(id))continue;seen.add(id);
      const idx=html.indexOf(id);const chunk=html.substring(Math.max(0,idx-200),idx+1000);
      const tM=chunk.match(/"title"\s*:\s*"([^"]{10,})"/);const pM=chunk.match(/"(?:salePrice|price)"\s*:\s*"?([0-9.]+)"?/);
      const oM=chunk.match(/"originalPrice"\s*:\s*"?([0-9.]+)"?/);const rM=chunk.match(/"(?:starRating|evaluate_rate)"\s*:\s*"?([0-9.]+)"?/);
      const sM=chunk.match(/"(?:sold|lastest_volume)"\s*:\s*"?([0-9]+)"?/);const iM=chunk.match(/"(?:imageUrl|img|mainImage)"\s*:\s*"([^"]{20,})"/);
      const price=pM?parseFloat(pM[1]):null;if(!tM||!price||price<=0)continue;
      let img=iM?iM[1].replace(/\\u002F/g,'/').replace(/\\/g,''):null;if(img&&img.startsWith('//'))img='https:'+img;
      products.push({product_title:tM[1].substring(0,100),sale_price:price.toString(),original_price:oM?oM[1]:price.toString(),evaluate_rate:rM?rM[1]:'4.5',lastest_volume:sM?sM[1]:'100',promotion_link:buildAffiliateLink(id),product_main_image_url:img});
      if(products.length>=10)break;
    }
    return products;
  }catch(e){console.error('❌ Scraper:'+e.message);return[];}
}

async function multiSearch(queries){
  const seen=new Set();const all=[];
  const top3=queries.slice(0,3);
  const results=await Promise.allSettled(top3.map(q=>searchAffiliateAPI(q)));
  for(const res of results){if(res.status!=='fulfilled')continue;for(const p of res.value){const id=p.product_id||p.product_title?.substring(0,30);if(!id||seen.has(id))continue;seen.add(id);all.push(p);}}
  if(all.length<5){console.log('⬇️ Scraper fallback...');const scraped=await scrapeSearch(queries[0]);for(const p of scraped){const id=p.product_title?.substring(0,30);if(!id||seen.has(id))continue;seen.add(id);all.push(p);}}
  console.log('🔍 Total unique: '+all.length);return all;
}

// ===== CORE AI COMMERCE ENGINE =====
async function processSearch(chatId,phone,senderName,heQuery){
  const ck='commerce:'+heQuery.toLowerCase().trim();const cached=cacheGet(ck);
  if(cached){console.log('⚡ Cache hit: '+heQuery);memRecordSuccess(heQuery);await deliverResults(chatId,senderName,cached);return;}

  console.log('\n══════════════════════════════');
  console.log('🛒 AI COMMERCE: "'+heQuery+'"');
  console.log('══════════════════════════════');
  await sendTyping(chatId);

  const intent=await analyzeIntent(heQuery);
  memRecordSearch(heQuery,intent.category);
  if(intent.confidence<0.25){await sendMsg(chatId,'@'+senderName+' 🤔 לא הבנתי מה לחפש. נסה לפרט יותר!');memRecordFail(heQuery);return;}

  const queries=await expandQueries(intent);
  console.log('🔄 Queries:',queries.slice(0,3).join(' | '));

  const rawProducts=await multiSearch(queries);
  if(!rawProducts.length){await sendMsg(chatId,'😕 @'+senderName+' לא מצאתי "'+intent.productType+'".\n\n💡 נסה מילות חיפוש אחרות!');memRecordFail(heQuery);return;}

  const filtered=filterProducts(rawProducts,{keywords:queries[0],category:intent.category,blockedWords:intent.blockedWords||[],requiredWords:intent.requir
