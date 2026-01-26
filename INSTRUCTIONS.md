// --- ИНСТРУКЦИЯ ---
// 1. Вставьте этот код в Code.gs (очистив старый).
// 2. Выберите функцию "_INSTALL_FIX" вверху и нажмите Run (▶).
// 3. Дайте разрешения: "Review Permissions" -> Ваш Аккаунт -> "Advanced" -> "Go to ... (unsafe)" -> "Allow".
// 4. Сделайте Deploy -> New Deployment.

var FOLDER_NAME = "Marathon_Images"; 
var DAY2_SHEET_NAME = "Day_2_Submissions";
var BOT_TOKEN = "8512515016:AAGA5SJdmvjYZEOH71krXVkkAoRE73727Oc"; 
var IS_DAY_2_ACTIVE = true; 

function _INSTALL_FIX() {
  console.log("Запрос разрешений...");
  DriveApp.getFiles(); // Триггер прав на Диск
  try { UrlFetchApp.fetch("https://api.telegram.org"); } catch(e) {} // Триггер прав на Интернет
  console.log("✅ УСПЕШНО. Теперь делайте Deploy.");
}

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);
  try {
    if (e.postData) {
      var d = JSON.parse(e.postData.contents);
      if (d.action === 'getRandomAsset') return sendJSON(getRandomAsset(d.telegramNick));
      if (d.action === 'sendAssetsToChat') return handleSendAssets(d);
      if (d.action === 'submitDay2') return handleSubmitDay2(d);
      return handleSubmitDay1(d);
    }
    if (e.parameter && e.parameter.nick) return checkUser(e.parameter.nick);
    return sendJSON({ "status": "error", "message": "No data" });
  } catch (err) { return sendJSON({ "status": "error", "message": err.toString() });
  } finally { lock.releaseLock(); }
}

function handleSendAssets(d) {
   if (!BOT_TOKEN || BOT_TOKEN.indexOf(":") === -1) return sendJSON({ "status": "error", "message": "Bad Token" });
   var chatId = d.chatId;
   sendMessageToTelegram(chatId, "👋 Привет! Отправляю файлы...");
   var errs = [];
   errs.push(sendPhotoToTelegram(chatId, d.assets.base, "📂 Базовый"));
   errs.push(sendPhotoToTelegram(chatId, d.assets.angle1, "📸 Ракурс 1"));
   errs.push(sendPhotoToTelegram(chatId, d.assets.angle2, "📸 Ракурс 2"));
   errs.push(sendPhotoToTelegram(chatId, d.assets.angle3, "📸 Ракурс 3"));
   var fails = errs.filter(function(r){ return r !== "OK"; });
   if (fails.length > 0) return sendJSON({ "status": "error", "message": "Errors: " + fails.join(", ") });
   sendMessageToTelegram(chatId, "✅ Готово!");
   return sendJSON({ "status": "success" });
}

function handleSubmitDay2(d) {
   var sheet = getOrCreateSheet(DAY2_SHEET_NAME);
   var folder = getOrCreateFolder(FOLDER_NAME);
   var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM.yyyy HH:mm");
   var nick = d.telegramNick || "Anon";
   sheet.appendRow([ts, nick, processImage(d.receivedRef, folder, nick+"_d2_ref"), processImage(d.result1, folder, nick+"_d2_r1"), processImage(d.result2, folder, nick+"_d2_r2")]);
   return sendJSON({ "status": "success" });
}

function handleSubmitDay1(d) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var folder = getOrCreateFolder(FOLDER_NAME);
    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM.yyyy HH:mm");
    var nick = d.telegramNick || "Anon";
    var rows = sheet.getDataRange().getValues();
    var cleanNick = String(nick).trim().toLowerCase();
    for (var i=1; i<rows.length; i++) {
        if (String(rows[i][1]).trim().toLowerCase() === cleanNick) sheet.getRange(i+1, 1, 1, sheet.getLastColumn()).setBackground("#FFCDD2");
    }
    sheet.appendRow([ts, nick, processImage(d.baseReference, folder, nick+"_base"), processImage(d.angle1, folder, nick+"_a1"), processImage(d.angle2, folder, nick+"_a2"), processImage(d.angle3, folder, nick+"_a3")]);
    return sendJSON({ "status": "success", "isDay2Active": IS_DAY_2_ACTIVE });
}

function checkUser(nick) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    var clean = String(nick).trim().toLowerCase();
    for (var i=1; i<data.length; i++) {
        if (String(data[i][1]).trim().toLowerCase() === clean) return sendJSON({ "exists": true, "isDay2Active": IS_DAY_2_ACTIVE });
    }
    return sendJSON({ "exists": false, "isDay2Active": IS_DAY_2_ACTIVE });
}

function sendMessageToTelegram(chatId, text) {
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'post', contentType: 'application/json', payload: JSON.stringify({ chat_id: String(chatId), text: text }), muteHttpExceptions: true
    });
    return "OK";
  } catch (e) { return e.toString(); }
}

function sendPhotoToTelegram(chatId, driveUrl, cap) {
  try {
    var id = (String(driveUrl).match(/id=([a-zA-Z0-9_-]+)/) || [])[1];
    if (!id) return "NoID";
    var blob = DriveApp.getFileById(id).getBlob().setName("img.jpg"); 
    var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendPhoto', {
        method: 'post', payload: { chat_id: String(chatId), photo: blob, caption: cap }, muteHttpExceptions: true
    });
    return res.getResponseCode() === 200 ? "OK" : "Err" + res.getResponseCode();
  } catch (e) { return "Ex:" + e.toString(); }
}

function getRandomAsset(reqNick) {
  if (!IS_DAY_2_ACTIVE) return { "status": "error", "message": "Day2 Locked" };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  var forms = sheet.getDataRange().getFormulas();
  if (rows.length < 2) return { "status": "error", "message": "Empty DB" };

  var cands = [];
  var cleanReq = String(reqNick).trim().toLowerCase();
  var selfFound = false;
  for(var i=1; i<rows.length; i++) {
     if(String(rows[i][1]).trim().toLowerCase() === cleanReq) selfFound=true;
     var fBase = forms[i][2] || rows[i][2];
     if (String(rows[i][1]).trim().toLowerCase() !== cleanReq && fBase && String(fBase).length > 20) {
        cands.push({ n: rows[i][1], b: extractUrl(fBase), a1: extractUrl(forms[i][3]||rows[i][3]), a2: extractUrl(forms[i][4]||rows[i][4]), a3: extractUrl(forms[i][5]||rows[i][5]) });
     }
  }
  if(!selfFound) return { "status": "error", "message": "User not found" };
  if(cands.length === 0) return { "status": "error", "message": "No candidates" };
  var w = cands[Math.floor(Math.random() * cands.length)];
  return { "status": "success", "assets": { base: w.b, angle1: w.a1, angle2: w.a2, angle3: w.a3 }, "authorNick": w.n };
}

function extractUrl(val) {
   var m = String(val).match(/"(https:\/\/[^"]+)"/);
   return (m && m[1]) ? m[1] : (String(val).indexOf("http") === 0 ? val : "");
}

function processImage(b64, folder, name) {
  if (!b64 || b64.length < 50) return "";
  try {
    var parts = b64.split(',');
    var blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), parts[0].split(':')[1].split(';')[0], name + "_" + Date.now());
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var u = "https://drive.google.com/uc?export=view&id=" + file.getId();
    return '=HYPERLINK("' + u + '"; IMAGE("' + u + '"))';
  } catch (e) { return "Err"; }
}

function getOrCreateFolder(n) { var f = DriveApp.getFoldersByName(n); return f.hasNext() ? f.next() : DriveApp.createFolder(n); }
function getOrCreateSheet(n) { var ss = SpreadsheetApp.getActiveSpreadsheet(); var s = ss.getSheetByName(n); if(!s) { s = ss.insertSheet(n); s.appendRow(["Time", "Nick", "Ref", "R1", "R2"]); } return s; }
function sendJSON(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }