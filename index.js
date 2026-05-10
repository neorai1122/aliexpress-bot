const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const INSTANCE_ID = '7107614702';
const API_TOKEN = 'aaf1035940284f4e80553c38cee6ffadd2704e160e1e4895ae';
const GREEN_API_URL = 'https://7107.api.greenapi.com/waInstance' + INSTANCE_ID;

async function sendMsg(chatId, message) {
  try { await axios.post(GREEN_API_URL+'/sendMessage/'+API_TOKEN,{chatId,message}); } catch(e) { console.error(e.message); }
}

app.post('/webhook', async function(req, res) {
  res.sendStatus(200);
  try {
    var body = req.body;
    if (!body || body.typeWebhook !== 'incomingMessageReceived') return;
    var md = body.messageData || {};
    if (!md || md.typeMessage !== 'textMessage') return;
    var text = md.textMessageData && md.textMessageData.textMessage ? md.textMessageData.textMessage : '';
    var sd = body.senderData || {};
    var chatId = sd.chatId || '';
    var senderPhone = sd.sender || '';
    var senderName = sd.senderName || '';
    if (!text || !chatId) return;

    console.log('===PHONE===:' + senderPhone);
    console.log('===NAME===:' + senderName);
    console.log('===TEXT===:' + text);

    if (text === '!מי') {
      await sendMsg(chatId, 'המספר שלך הוא: ' + senderPhone);
    }
  } catch(e) { console.error(e.message); }
});

app.get('/', function(req,res) { res.send('בדיקה!'); });
var PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('פועל על פורט ' + PORT); });
