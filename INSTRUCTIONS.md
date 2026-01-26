var FOLDER_NAME = "Marathon_Images"; 
var DAY2_SHEET_NAME = "Day_2_Submissions";
var BOT_TOKEN = "8512515016:AAGA5SJdmvjYZEOH71krXVkkAoRE73727Oc"; 
var IS_DAY_2_ACTIVE = true; 

function A_SETUP_CLICK_ME() {
  Logger.log("🔧 НАСТРОЙКА...");
  DriveApp.getRootFolder();
  UrlFetchApp.fetch("https://www.google.com"); 
  Logger.log("✅ ПРАВА ЕСТЬ. Делайте Deploy -> New Version.");
}

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000); 
  try {
    var out = {};
    if (e.postData) {
      var d = JSON.parse(e.postData.contents);
      if (d.action === 'getRandomAsset') out = getRandomAsset(d.telegramNick);
      else if (d.action === 'sendAssetsToChat') out = handleSendAssets(d);
      else if (d.action === 'submitDay2') out = handleSubmitDay2(d);
      else out = handleSubmitDay1(d);
    } else if (e.parameter && e.parameter.nick) {
      out = checkUser(e.parameter.nick);
    } else {
      out = { "status": "error", "message": "No data" };
    }
    out.version = "v4.2";
    return sendJSON(out);
  } catch (err) { 
    return sendJSON({ "status": "error", "message": "Err: " + err.toString() });
  } finally { lock.releaseLock(); }
}

function handleSendAssets(d) {
   sendMessageToTelegram(d.chatId, "👋 Привет! Отправляю файлы...");
   sendPhotoToTelegram(d.chatId, d.assets.base, "📂 Базовый");
   sendPhotoToTelegram(d.chatId, d.assets.angle1, "📸 Ракурс 1");
   sendPhotoToTelegram(d.chatId, d.assets.angle2, "📸 Ракурс 2");
   sendPhotoToTelegram(d.chatId, d.assets.angle3, "📸 Ракурс 3");
   sendMessageToTelegram(d.chatId, "✅ Готово!");
   return { "status": "success" };
}

function handleSubmitDay2(d) {
   var s = getOrCreateSheet(DAY2_SHEET_NAME), f = getOrCreateFolder(FOLDER_NAME);
   var n = d.telegramNick || "Anon";
   s.appendRow([new Date(), n, procImg(d.receivedRef, f, n+"_d2_ref"), procImg(d.result1, f, n+"_d2_r1"), procImg(d.result2, f, n+"_d2_r2")]);
   return { "status": "success" };
}

function handleSubmitDay1(d) {
    var s = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(), f = getOrCreateFolder(FOLDER_NAME);
    var n = d.telegramNick || "Anon";
    var rows = s.getDataRange().getValues();
    for (var i=1; i<rows.length; i++) {
        if (String(rows[i][1]).toLowerCase() === String(n).toLowerCase()) s.getRange(i+1, 1, 1, s.getLastColumn()).setBackground("#FFCDD2");
    }
    s.appendRow([new Date(), n, procImg(d.baseReference, f, n+"_b"), procImg(d.angle1, f, n+"_a1"), procImg(d.angle2, f, n+"_a2"), procImg(d.angle3, f, n+"_a3")]);
    return { "status": "success", "isDay2Active": IS_DAY_2_ACTIVE };
}

function checkUser(nick) {
    var data = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getDataRange().getValues();
    for (var i=1; i<data.length; i++) if (String(data[i][1]).toLowerCase() === String(nick).toLowerCase()) return { "exists": true, "isDay2Active": IS_DAY_2_ACTIVE };
    return { "exists": false, "isDay2Active": IS_DAY_2_ACTIVE };
}

function sendMessageToTelegram(chatId, text) {
  try { UrlFetchApp.fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', { method: 'post', contentType: 'application/json', payload: JSON.stringify({ chat_id: String(chatId), text: text }), muteHttpExceptions: true }); } catch (e) {}
}

function sendPhotoToTelegram(chatId, url, cap) {
  try {
    var id = (String(url).match(/id=([a-zA-Z0-9_-]+)/) || [])[1];
    if (!id) return;
    var f = DriveApp.getFileById(id);
    if (f.getSize() > 20*1024*1024) return;
    UrlFetchApp.fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendPhoto', { method: 'post', payload: { chat_id: String(chatId), photo: f.getBlob(), caption: cap }, muteHttpExceptions: true });
  } catch (e) {}
}

function getRandomAsset(reqNick) {
  if (!IS_DAY_2_ACTIVE) return { "status": "error", "message": "Locked" };
  var s = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = s.getDataRange().getValues(), forms = s.getDataRange().getFormulas();
  if (rows.length < 2) return { "status": "error", "message": "Empty" };
  var cands = [];
  for(var i=1; i<rows.length; i++) {
     if(String(rows[i][1]).toLowerCase() === String(reqNick).toLowerCase()) continue;
     var fb = forms[i][2] || rows[i][2];
     if (fb && String(fb).length > 10) cands.push({ n: rows[i][1], b: exUrl(fb), a1: exUrl(forms[i][3]||rows[i][3]), a2: exUrl(forms[i][4]||rows[i][4]), a3: exUrl(forms[i][5]||rows[i][5]) });
  }
  if(cands.length === 0) return { "status": "error", "message": "No assets" };
  var w = cands[Math.floor(Math.random() * cands.length)];
  return { "status": "success", "assets": { base: w.b, angle1: w.a1, angle2: w.a2, angle3: w.a3 }, "authorNick": w.n };
}

function exUrl(v) { var m = String(v).match(/"(https:\/\/[^"]+)"/); return (m && m[1]) ? m[1] : (String(v).indexOf("http")===0?v:""); }
function procImg(b64, f, n) {
  if (!b64 || b64.length < 50) return "";
  try {
    var p = b64.split(','), b = Utilities.newBlob(Utilities.base64Decode(p[1]), p[0].split(':')[1].split(';')[0], n);
    var file = f.createFile(b); file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var u = "https://drive.google.com/uc?export=view&id=" + file.getId();
    return '=HYPERLINK("' + u + '"; IMAGE("' + u + '"))';
  } catch (e) { return "Err"; }
}
function getOrCreateFolder(n) { var f = DriveApp.getFoldersByName(n); return f.hasNext() ? f.next() : DriveApp.createFolder(n); }
function getOrCreateSheet(n) { var ss = SpreadsheetApp.getActiveSpreadsheet(); var s = ss.getSheetByName(n); if(!s) { s = ss.insertSheet(n); s.appendRow(["Date", "Nick", "Ref", "R1", "R2"]); } return s; }
function sendJSON(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }