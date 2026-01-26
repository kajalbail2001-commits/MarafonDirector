// ============================================================================
// ИНСТРУКЦИЯ:
// 1. Выделите ВЕСЬ текст в этом окне (Ctrl + A).
// 2. Скопируйте (Ctrl + C).
// 3. Перейдите в редактор скриптов Google (Extensions > Apps Script).
// 4. Очистите файл Code.gs и вставьте этот код (Ctrl + V).
// 5. Нажмите "Начать развертывание" -> "Новое развертывание" -> "Развернуть".
// ============================================================================

// --- НАСТРОЙКИ ---
var FOLDER_NAME = "Marathon_Images"; 
var DAY2_SHEET_NAME = "Day_2_Submissions";
// Ваш токен бота:
var BOT_TOKEN = "8512515016:AAGA5SJdmvjYZEOH71krXVkkAoRE73727Oc"; 
// Открыт ли второй день:
var IS_DAY_2_ACTIVE = true; 

// --- ОСНОВНОЙ КОД ---

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    if (e.postData) {
      var data = JSON.parse(e.postData.contents);
      
      // Действие: Получить случайный референс (для Дня 2)
      if (data.action === 'getRandomAsset') {
         return sendJSON(getRandomAsset(data.telegramNick));
      }

      // Действие: Отправить файлы в чат
      if (data.action === 'sendAssetsToChat') {
         return handleSendAssets(data);
      }

      // Действие: Сдать ДЗ День 2
      if (data.action === 'submitDay2') {
         return handleSubmitDay2(data);
      }

      // Действие по умолчанию: Сдать ДЗ День 1
      return handleSubmitDay1(data);
    }
    
    // Проверка существования пользователя (GET запрос)
    if (e.parameter && e.parameter.nick) {
      return checkUser(e.parameter.nick);
    }
    
    return sendJSON({ "status": "error", "message": "No data received" });

  } catch (error) {
    return sendJSON({ "status": "error", "message": error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// --- ЛОГИКА ОТПРАВКИ В ЧАТ ---
function handleSendAssets(data) {
   if (!BOT_TOKEN || BOT_TOKEN.indexOf(":") === -1) {
     return sendJSON({ "status": "error", "message": "Invalid Bot Token in Script" });
   }
   
   var chatId = data.chatId;
   if (!chatId) return sendJSON({ "status": "error", "message": "No Chat ID provided" });
   
   // 1. Тестовое сообщение
   var tRes = sendMessageToTelegram(chatId, "👋 Привет! Начинаю отправку 4-х файлов...");
   if (tRes !== "OK") {
     return sendJSON({ "status": "error", "message": "Bot seems blocked. Error: " + tRes });
   }

   // 2. Отправка фото
   var errs = [];
   errs.push(sendPhotoToTelegram(chatId, data.assets.base, "📂 Базовый референс"));
   errs.push(sendPhotoToTelegram(chatId, data.assets.angle1, "📸 Ракурс 1"));
   errs.push(sendPhotoToTelegram(chatId, data.assets.angle2, "📸 Ракурс 2"));
   errs.push(sendPhotoToTelegram(chatId, data.assets.angle3, "📸 Ракурс 3"));
   
   // Проверка результатов
   var fails = errs.filter(function(r){ return r !== "OK"; });
   if (fails.length > 0) {
      sendMessageToTelegram(chatId, "⚠️ Не все файлы дошли. Ошибки: " + fails.join(", "));
      return sendJSON({ "status": "error", "message": "Partial failure: " + fails.join("; ") });
   }
   
   sendMessageToTelegram(chatId, "✅ Все файлы отправлены успешно!");
   return sendJSON({ "status": "success" });
}

// --- ОБРАБОТЧИКИ ФОРМ ---

function handleSubmitDay2(data) {
   var sheet = getOrCreateSheet(DAY2_SHEET_NAME);
   var folder = getOrCreateFolder(FOLDER_NAME);
   var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM.yyyy HH:mm");
   var nick = data.telegramNick || "Anonymous";

   var rRef = processImage(data.receivedRef, folder, nick + "_day2_ref");
   var r1 = processImage(data.result1, folder, nick + "_day2_res1");
   var r2 = processImage(data.result2, folder, nick + "_day2_res2");

   sheet.appendRow([ts, nick, rRef, r1, r2]);
   return sendJSON({ "status": "success" });
}

function handleSubmitDay1(data) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var folder = getOrCreateFolder(FOLDER_NAME);
    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM.yyyy HH:mm");
    var nick = data.telegramNick || "Anonymous";

    var base = processImage(data.baseReference, folder, nick + "_base");
    var a1 = processImage(data.angle1, folder, nick + "_angle1");
    var a2 = processImage(data.angle2, folder, nick + "_angle2");
    var a3 = processImage(data.angle3, folder, nick + "_angle3");
    
    // Подсветка дубликатов
    var rows = sheet.getDataRange().getValues();
    var cleanNick = String(nick).trim().toLowerCase();
    for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][1]).trim().toLowerCase() === cleanNick) {
            // Красим строку в красный, если ник уже есть
            sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()).setBackground("#FFCDD2");
        }
    }

    sheet.appendRow([ts, nick, base, a1, a2, a3]);
    return sendJSON({ 
      "status": "success", 
      "isDay2Active": IS_DAY_2_ACTIVE 
    });
}

function checkUser(nick) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    var exists = false;
    var clean = String(nick).trim().toLowerCase();
    
    // Простой поиск по колонке B (индекс 1)
    for (var i = 1; i < data.length; i++) {
        if (String(data[i][1]).trim().toLowerCase() === clean) { 
          exists = true; 
          break; 
        }
    }
    return sendJSON({ "exists": exists, "isDay2Active": IS_DAY_2_ACTIVE });
}

// --- TELEGRAM API HELPERS ---

function sendMessageToTelegram(chatId, text) {
  try {
    var url = 'https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage';
    var payload = {
      'chat_id': String(chatId),
      'text': text
    };
    var options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true
    };
    var response = UrlFetchApp.fetch(url, options);
    return response.getResponseCode() === 200 ? "OK" : "Error " + response.getResponseCode();
  } catch (e) {
    return "Exception: " + e.toString();
  }
}

function sendPhotoToTelegram(chatId, driveUrl, caption) {
  try {
    // Извлекаем ID файла из ссылки Google Drive
    var idMatch = String(driveUrl).match(/id=([a-zA-Z0-9_-]+)/);
    var fileId = idMatch ? idMatch[1] : null;
    
    if (!fileId) return "Invalid URL format";

    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    // Важно задать имя, иначе Telegram может отклонить файл
    blob.setName("image.jpg"); 

    var url = 'https://api.telegram.org/bot' + BOT_TOKEN + '/sendPhoto';
    var payload = {
      'chat_id': String(chatId),
      'photo': blob,
      'caption': caption
    };
    var options = {
      'method': 'post',
      'payload': payload,
      'muteHttpExceptions': true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() !== 200) {
       return "API Error " + response.getResponseCode() + ": " + response.getContentText();
    }
    return "OK";
  } catch (e) {
    return "Script Exception: " + e.toString();
  }
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function getRandomAsset(reqNick) {
  if (!IS_DAY_2_ACTIVE) return { "status": "error", "message": "День 2 закрыт" };
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  var forms = sheet.getDataRange().getFormulas();
  
  if (rows.length < 2) return { "status": "error", "message": "База пуста" };

  var candidates = [];
  var cleanReq = String(reqNick).trim().toLowerCase();
  
  // Проверяем, есть ли сам просящий в базе
  var selfFound = false;
  for(var i=1; i<rows.length; i++) {
     if(String(rows[i][1]).trim().toLowerCase() === cleanReq) { selfFound=true; break; }
  }
  if(!selfFound) return { "status": "error", "message": "Сначала сдайте День 1" };

  // Собираем кандидатов (исключая себя)
  for (var i=1; i<rows.length; i++) {
     var rNick = String(rows[i][1]).trim().toLowerCase();
     // Берем ссылку из формулы (так как там HYPERLINK) или значения
     var fBase = forms[i][2] || rows[i][2];
     
     if (rNick !== cleanReq && fBase && String(fBase).length > 20) {
        candidates.push({
           nick: rows[i][1],
           base: extractUrl(fBase),
           ang1: extractUrl(forms[i][3]||rows[i][3]),
           ang2: extractUrl(forms[i][4]||rows[i][4]),
           ang3: extractUrl(forms[i][5]||rows[i][5])
        });
     }
  }
  
  if(candidates.length === 0) return { "status": "error", "message": "Нет доступных работ для обмена" };
  
  var winner = candidates[Math.floor(Math.random() * candidates.length)];
  return { 
    "status": "success", 
    "assets": { 
      base: winner.base, 
      angle1: winner.ang1, 
      angle2: winner.ang2, 
      angle3: winner.ang3 
    }, 
    "authorNick": winner.nick 
  };
}

function extractUrl(val) {
   // Пытаемся достать ссылку из формулы =HYPERLINK("url"; ...)
   var m = String(val).match(/"(https:\/\/[^"]+)"/);
   if (m && m[1]) return m[1];
   // Если это просто текст ссылки
   if (String(val).indexOf("http") === 0) return val;
   return "";
}

function processImage(base64Str, folder, fileName) {
  if (!base64Str || base64Str.length < 50) return "";
  try {
    var parts = base64Str.split(',');
    var type = parts[0].split(':')[1].split(';')[0];
    var data = Utilities.base64Decode(parts[1]);
    var blob = Utilities.newBlob(data, type, fileName + "_" + Date.now());
    
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var url = "https://drive.google.com/uc?export=view&id=" + file.getId();
    // Возвращаем формулу для красивого отображения в таблице
    return '=HYPERLINK("' + url + '"; IMAGE("' + url + '"))';
  } catch (e) {
    return "Error saving image: " + e.toString();
  }
}

function getOrCreateFolder(name) { 
  var folders = DriveApp.getFoldersByName(name); 
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name); 
}

function getOrCreateSheet(name) { 
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  var sheet = ss.getSheetByName(name); 
  if(!sheet) { 
    sheet = ss.insertSheet(name); 
    sheet.appendRow(["Timestamp", "Nick", "Reference", "Result 1", "Result 2"]); 
  } 
  return sheet; 
}

function sendJSON(content) { 
  return ContentService.createTextOutput(JSON.stringify(content)).setMimeType(ContentService.MimeType.JSON); 
}