
// ===== ScraperAPI =====
async function scrapeAliExpress(queryEn) {
  try {
    const aliUrl = 'https://www.aliexpress.com/wholesale?SearchText='+encodeURIComponent(queryEn)+'&SortType=total_tranpro_desc';
    const res = await axios.get('http://api.scraperapi.com',{
      params:{api_key:SCRAPER_KEY,url:aliUrl,country_code:'us',device_type:'desktop'},
      timeout:30000
    });
    const html = res.data;
    if(!html||html.length<1000){console.log('⚠️ ScraperAPI empty');return[];}
    if(html.includes('captcha')||html.includes('robot')){console.log('⚠️ ScraperAPI blocked');return[];}

    const idMatches = [...html.matchAll(/"productId"\s*[=:]\s*"?(\d{8,})"?/g)];
    if(!idMatches.length){console.log('⚠️ No products in HTML');return[];}
    console.log('🎯 ScraperAPI: '+idMatches.length+' product IDs');

    const products = [];
    const seen = new Set();

    for(const m of idMatches) {
      const id = m[1];
      if(seen.has(id)) continue;
      seen.add(id);

      const idx = html.indexOf(id);
      const chunk = html.substring(Math.max(0,idx-200),idx+1000);

      const titleM = chunk.match(/"title"\s*:\s*"([^"]{10,})"/);
      const title = titleM ? titleM[1] : null;
      if(!title || !isRelevant(title, queryEn)) continue;

      const priceM = chunk.match(/"(?:salePrice|sale_price|price)"\s*:\s*"?([0-9.]+)"?/);
      const priceUsd = priceM ? parseFloat(priceM[1]) : null;
      if(!priceUsd || priceUsd <= 0) continue;

      const origM = chunk.match(/"(?:originalPrice|original_price)"\s*:\s*"?([0-9.]+)"?/);
      const origUsd = origM ? parseFloat(origM[1]) : priceUsd;

      const ratingM = chunk.match(/"(?:starRating|evaluate_rate|rating)"\s*:\s*"?([0-9.]+)"?/);
      const salesM = chunk.match(/"(?:sold|lastest_volume|tradeCount)"\s*:\s*"?([0-9]+)"?/);

      let imgM = chunk.match(/"(?:imageUrl|img|mainImage|productImage)"\s*:\s*"([^"]{20,})"/);
      let img = imgM ? imgM[1].replace(/\\u002F/g,'/').replace(/\\/g,'') : null;
      if(img && img.startsWith('//')) img='https:'+img;

      const link = await shortenLink('https://www.aliexpress.com/item/'+id+'.html?aff_platform=portals-tool&sk=_dV4Bh9T&aff_trace_key='+ALI_TRACKING_ID+'&terminal_id='+ALI_APP_KEY);

      products.push({
        title: title.substring(0,80),
        price: Math.round(priceUsd*USD_TO_ILS),
        origPrice: Math.round(origUsd*USD_TO_ILS),
        rating: ratingM ? ratingM[1] : '4.5',
        sales: salesM ? salesM[1] : '0',
        link, image: img
      });

      if(products.length >= 2) break;
    }

    console.log('✅ ScraperAPI: '+products.length+' relevant products');
    return products;
  } catch(e) {
    console.error('❌ ScraperAPI:'+e.message);
    return [];
  }
}

// ===== AliExpress API (גיבוי) =====
async function fetchAPI(queryEn) {
  try {
    const ts = Date.now().toString();
    const p = {
      app_key:ALI_APP_KEY, method:'aliexpress.affiliate.product.query',
      sign_method:'md5', timestamp:ts, v:'2.0',
      keywords:queryEn, tracking_id:ALI_TRACKING_ID,
      page_size:'20', sort:'LAST_VOLUME_DESC',
      fields:'product_id,product_title,sale_price,evaluate_rate,lastest_volume,promotion_link,original_price,product_main_image_url'
    };
    const keys = Object.keys(p).sort();
    let sig = ALI_APP_SECRET;
    for(const k of keys) sig += k+p[k];
    sig += ALI_APP_SECRET;
    p.sign = crypto.createHash('md5').update(sig,'utf8').digest('hex').toUpperCase();
    const qs = Object.keys(p).map(k=>`${encodeURIComponent(k)}=${encodeURIComponent(p[k])}`).join('&');
    const res = await axios.get('https://api-sg.aliexpress.com/sync?'+qs,{timeout:15000});
    const all = res.data && res.data.aliexpress_affiliate_product_query_response &&
                res.data.aliexpress_affiliate_product_query_response.resp_result &&
                res.data.aliexpress_affiliate_product_query_response.resp_result.result &&
                res.data.aliexpress_affiliate_product_query_response.resp_result.result.products
                ? res.data.aliexpress_affiliate_product_query_response.resp_result.result.products.product : [];
    console.log('📦 API: '+all.length+' products');
    const filtered = all.filter(p=>p.promotion_link&&p.sale_price&&isRelevant(p.product_title,queryEn));
    const final = filtered.length>0 ? filtered : all.filter(p=>p.promotion_link&&p.sale_price&&parseFloat(p.evaluate_rate||0)>=90);
    const products = [];
    for(const item of final.slice(0,2)) {
      const link = await shortenLink(item.promotion_link);
      let img = item.product_main_image_url;
      if(img&&img.startsWith('//')) img='https:'+img;
      products.push({
        title: item.product_title.substring(0,80),
        price: Math.round(parseFloat(item.sale_price)*USD_TO_ILS),
        origPrice: Math.round(parseFloat(item.original_price||item.sale_price)*USD_TO_ILS),
        rating: item.evaluate_rate||'4.5',
        sales: item.lastest_volume||'0',
        link, image:img
      });
    }
    return products;
  } catch(e) { console.error('❌ API:'+e.message); return []; }
}

async function getProducts(queryEn) {
  const cached = getCached(queryEn);
  if(cached) return cached;

  let products = await scrapeAliExpress(queryEn);
  if(!products.length) {
    console.log('⬇️ Fallback AliExpress API...');
    products = await fetchAPI(queryEn);
  }

  if(products.length) setCache(queryEn, products);
  return products;
}

async function sendProduct(chatId, p, num) {
  let cap = '━━━━━━━━━━━━━━━\n'+num+'️⃣ *'+p.title+'*\n━━━━━━━━━━━━━━━\n';
  if(p.origPrice && p.origPrice > p.price) {
    const d = Math.round((1-p.price/p.origPrice)*100);
    cap += '💰 *₪'+p.price+'* ~~₪'+p.origPrice+'~~ 🏷️ -'+d+'%\n';
  } else {
    cap += '💰 מחיר: *₪'+p.price+'*\n';
  }
  cap += '🚚 משלוח חינם!\n';
  cap += stars(p.rating)+'\n';
  cap += '📦 '+Number(p.sales||0).toLocaleString()+' מכירות\n';
  cap += '🔗 '+p.link+'\n━━━━━━━━━━━━━━━';

  if(p.image) await sendImg(chatId, p.image, cap);
  else await sendMsg(chatId, cap);
}

async function searchAndSend(chatId, senderName, queryHe) {
  try {
    const queryEn = await getEnglishQuery(queryHe);
    console.log('🔍 "'+queryHe+'" → "'+queryEn+'"');
    const products = await getProducts(queryEn);

    if(!products.length) {
      await sendMsg(chatId, '😕 @'+senderName+' לא מצאתי תוצאות עבור "'+queryHe+'".\n\n💡 נסה לפרט יותר:\n• "אוזניות בלוטות אלחוטיות"\n• "שעון חכם שחור"');
      return;
    }

    await sendMsg(chatId, '✅ @'+senderName+' מצאתי את הדילים הכי שווים! 👇');
    for(let i=0;i<products.length;i++) {
      await sendProduct(chatId, products[i], i+1);
      await sleep(1200);
    }
  } catch(e) {
    console.error('❌ search:'+e.message);
    await sendMsg(chatId, '❌ שגיאה בחיפוש. נסה שוב!');
  }
}

async function startFlow(phone, name) {
  newUserFlow[phone] = {step:1};
  await sendMsg(phone+'@c.us', WELCOME);
  await sleep(1000);
  await sendMsg(phone+'@c.us', SQ1);
}

async function handleFlow(phone, name, text) {
  const f = newUserFlow[phone]; if(!f) return false;
  if(f.step===1) { f.step=2; await sendMsg(phone+'@c.us', SQ2); return true; }
  if(f.step===2) {
    await sendMsg(phone+'@c.us', SDONE);
    await sendAdmins('📋 *חבר חדש!*\n👤 '+name+'\n📱 '+phone);
    await sendMsg(GROUP_CHAT_ID, '🎉 *ברוכים הבאים @'+name+'!*\nכתוב/י *אני מחפש + מוצר* ונמצא לך! 🔥');
    delete newUserFlow[phone]; return true;
  }
  return false;
}

async function startPoll() {
  pollActive=true; for(const k in pollVotes) delete pollVotes[k];
  for(let i=0;i<POLL_OPTIONS.length;i++) pollVotes[i+1]=0;
  const top=getTop(); const tm=top.length ? '\n\n💡 _הכי נחפש: '+top.join(', ')+'_' : '';
  let msg='━━━━━━━━━━━━━━━\n📊 *סקר שבועי!*\n━━━━━━━━━━━━━━━\n\n';
  for(let j=0;j<POLL_OPTIONS.length;j++) msg+=(j+1)+'. '+POLL_OPTIONS[j]+'\n';
  msg+='\n✍️ *ענו עם מספר 1-10!*'+tm+'\n⏰ _פתוח 24 שעות_\n━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID, msg);
  if(pollTimeout) clearTimeout(pollTimeout);
  pollTimeout = setTimeout(async()=>await sendPollResults(), 24*60*60*1000);
}

async function sendPollResults() {
  pollActive=false; let total=0; for(const k in pollVotes) total+=pollVotes[k];
  if(!total) { await sendAdmins('📊 אף אחד לא הצביע 😕'); return; }
  const res = Object.keys(pollVotes).map(k=>({name:POLL_OPTIONS[parseInt(k)-1],votes:pollVotes[k]})).sort((a,b)=>b.votes-a.votes);
  let msg='━━━━━━━━━━━━━━━\n📊 *תוצאות הסקר!*\n━━━━━━━━━━━━━━━\n\nהצביעו: *'+total+'*\n\n';
  const m=['🥇','🥈','🥉'];
  for(let i=0;i<res.length;i++) { if(res[i].votes>0) msg+=(i<3?m[i]:'▫️')+' '+res[i].name+': '+res[i].votes+' ('+Math.round(res[i].votes/total*100)+'%)\n'; }
  msg+='\n🏆 *מנצח: '+res[0].name+'!*\n━━━━━━━━━━━━━━━';
  await sendMsg(GROUP_CHAT_ID, msg);
}

async function sendDeal() {
  const q = nextDeal();
  console.log('🔥 Deal: '+q);
  await sendMsg(GROUP_CHAT_ID, '━━━━━━━━━━━━━━━\n🔥 *דיל חם!* 🔥\n━━━━━━━━━━━━━━━');
  await searchAndSend(GROUP_CHAT_ID, 'Deal', q);
}

async function announceKing() {
  let king=null,max=0;
  for(const p in searchCount) if(searchCount[p]>max) { max=searchCount[p]; king=p; }
  if(king&&max>0) {
    await sendMsg(GROUP_CHAT_ID, '━━━━━━━━━━━━━━━\n👑 *מלך הקבוצה!*\n━━━━━━━━━━━━━━━\n\n@'+king+' חיפש/ה *'+max+'* פעמים!\n🏆 כל הכבוד! 🔥\n━━━━━━━━━━━━━━━');
    for(const k in searchCount) delete searchCount[k];
  }
}

async function handleAdmin(text, chatId) {
  const cmd = text.trim();
  if(cmd==='!דיל') { await sendDeal(); await sendMsg(chatId,'✅ דיל נשלח!'); return; }
  if(cmd==='!סקר') { await startPoll(); await sendMsg(chatId,'✅ סקר נשלח!'); return; }
  if(cmd==='!תוצאות') { await sendPollResults(); return; }
  if(cmd==='!מלך') { await announceKing(); return; }
  if(cmd==='!מצב') {
    let t=0; for(const p in searchCount) t+=searchCount[p];
    const top=getTop();
    await sendMsg(chatId,'📊 *סטטוס:*\n🔍 חיפושים: '+t+'\n💾 Cache: '+Object.keys(searchCache).length+'\n❄️ מוקפאים: '+frozenUsers.length+'\n👑 VIP: '+vipUsers.length+'\n💱 $=₪'+USD_TO_ILS.toFixed(2)+'\n🔥 הכי נחפש: '+(top[0]||'אין')+'\n🔥 דיל הבא: '+DEAL_LIST[dealIdx%DEAL_LIST.length]);
    return;
  }
  if(cmd==='!ניקוי') { for(const k in searchCount) delete searchCount[k]; await sendMsg(chatId,'✅'); return; }
  if(cmd==='!ניקוי cache') { for(const k in searchCache) delete searchCache[k]; await sendMsg(chatId,'✅ Cache נוקה!'); return; }
  if(cmd==='!בוקר') { await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n☀️ *בוקר טוב!*\n━━━━━━━━━━━━━━━\n\nיום חדש = דילים חדשים! 🔥\nכתבו *אני מחפש + מוצר*!\n━━━━━━━━━━━━━━━'); await sendMsg(chatId,'✅'); return; }
  if(cmd==='!ערב') { await sendMsg(GROUP_CHAT_ID,'━━━━━━━━━━━━━━━\n🌙 *ערב טוב!*\n━━━━━━━━━━━━━━━\n\nעדיין מחפשים? כתבו ונמצא! 🔍\n━━━
