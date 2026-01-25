# Google Apps Script Code

Код для вставки в редактор скриптов (Расширения > Apps Script).

**ВАЖНО:** Замените ВЕСЬ код на этот новый.
После обновления не забудьте: **Начать развертывание -> Управление -> Новая версия -> Развернуть.**

```javascript
// -------------------------------------------------------------
// НАСТРОЙКИ
// -------------------------------------------------------------
var FOLDER_NAME = "Marathon_Images"; 
var DAY2_SHEET_NAME = "Day_2_Submissions";

// --- ПЕРЕКЛЮЧАТЕЛЬ ДНЯ 2 ---
// Измените на true, когда нужно запустить второй день!
var IS_DAY_2_ACTIVE = true; 
// -------------------------------------------------------------


function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    // 1. Обработка POST запросов
    if (e.postData) {
      var data = JSON.parse(e.postData.contents);
      
      // Сценарий A: Запрос на получение случайного ассета
      if (data.action === 'getRandomAsset') {
         var result = getRandomAsset(data.telegramNick);
         return sendJSON(result);
      }

      // Сценарий B: Сдача задания ДЕНЬ 2
      if (data.action === 'submitDay2') {
         var sheet = getOrCreateSheet(DAY2_SHEET_NAME);
         var folder = getOrCreateFolder(FOLDER_NAME);
         var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM.yyyy HH:mm");
         var userNick = data.telegramNick || "Аноним";

         // Сохраняем картинки Дня 2
         var receivedRef = processImage(data.receivedRef, folder, userNick + "_day2_received");
         var res1 = processImage(data.result1, folder, userNick + "_day2_res1");
         var res2 = processImage(data.result2, folder, userNick + "_day2_res2");

         sheet.appendRow([timestamp, userNick, receivedRef, res1, res2]);
         
         return sendJSON({ "status": "success", "message": "Day 2 Submitted" });
      }

      // Сценарий C: Обычная загрузка домашки (День 1)
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      var folder = getOrCreateFolder(FOLDER_NAME);
      
      var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM.yyyy HH:mm");
      var userNick = data.telegramNick || "Аноним";

      // Сохраняем картинки День 1
      var refImg = processImage(data.baseReference, folder, userNick + "_base");
      var ang1Img = processImage(data.angle1, folder, userNick + "_angle1");
      var ang2Img = processImage(data.angle2, folder, userNick + "_angle2");
      var ang3Img = processImage(data.angle3, folder, userNick + "_angle3");

      // Красим дубликаты
      var rows = sheet.getDataRange().getValues();
      var checkNick = String(userNick).trim().toLowerCase();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][1]).trim().toLowerCase() === checkNick) {
          sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()).setBackground("#FFCDD2");
        }
      }

      sheet.appendRow([timestamp, userNick, refImg, ang1Img, ang2Img, ang3Img]);
      
      return sendJSON({ 
        "status": "success", 
        "isDay2Active": IS_DAY_2_ACTIVE 
      });
    }
    
    // 2. Обработка GET запросов
    if (e.parameter && e.parameter.nick) {
      var nick = String(e.parameter.nick).trim().toLowerCase();
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(); // Проверяем по День 1
      var data = sheet.getDataRange().getValues();
      var exists = false;
      
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][1]).trim().toLowerCase() === nick) {
           exists = true; 
           break; 
        }
      }
      return sendJSON({ 
        "exists": exists,
        "isDay2Active": IS_DAY_2_ACTIVE
      });
    }
    
    return sendJSON({ "status": "error", "message": "No data" });

  } catch (error) {
    return sendJSON({ "status": "error", "message": error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function getRandomAsset(requestingUserNick) {
  if (!IS_DAY_2_ACTIVE) {
    return { "status": "error", "message": "День 2 еще закрыт" };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(); // Берем из первого листа
  var range = sheet.getDataRange();
  var values = range.getValues();
  var formulas = range.getFormulas(); 

  if (values.length < 2) return { "status": "error", "message": "Нет данных" };

  var candidates = [];
  var reqNick = requestingUserNick ? String(requestingUserNick).trim().toLowerCase() : "";
  var userExists = false;

  // Проверяем наличие юзера
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]).trim().toLowerCase() === reqNick) {
      userExists = true;
      break; 
    }
  }

  if (!userExists) return { "status": "error", "message": "Ваш ник не найден." };

  // Собираем кандидатов
  for (var i = 1; i < values.length; i++) {
    var rowNick = String(values[i][1]).trim().toLowerCase();
    var baseRaw = formulas[i][2] || values[i][2];
    var ang1Raw = formulas[i][3] || values[i][3];
    var ang2Raw = formulas[i][4] || values[i][4];
    var ang3Raw = formulas[i][5] || values[i][5];

    if (rowNick !== reqNick && baseRaw && String(baseRaw).length > 10) {
       candidates.push({
         nick: values[i][1],
         base: baseRaw,
         ang1: ang1Raw,
         ang2: ang2Raw,
         ang3: ang3Raw
       });
    }
  }

  if (candidates.length === 0) return { "status": "error", "message": "Нет доступных работ для обмена." };

  var winner = candidates[Math.floor(Math.random() * candidates.length)];
  
  return {
    "status": "success",
    "assets": {
        "base": extractUrlFromFormula(winner.base),
        "angle1": extractUrlFromFormula(winner.ang1),
        "angle2": extractUrlFromFormula(winner.ang2),
        "angle3": extractUrlFromFormula(winner.ang3)
    },
    "authorNick": winner.nick
  };
}

function extractUrlFromFormula(formula) {
  try {
    var str = String(formula);
    var match = str.match(/"(https:\/\/[^"]+)"/);
    if (match && match[1]) return match[1];
    if (str.indexOf("http") === 0) return str;
    return "";
  } catch (e) { return ""; }
}

function processImage(base64String, folder, filenamePrefix) {
  if (!base64String || base64String.length < 100) return "";
  try {
    var parts = base64String.split(',');
    var contentType = parts[0].substring(5, parts[0].indexOf(';'));
    var base64Data = parts[1];
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, filenamePrefix + "_" + Date.now() + ".png");
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var viewUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
    return '=HYPERLINK("' + viewUrl + '"; IMAGE("' + viewUrl + '"))';
  } catch (e) { return "Error: " + e.toString(); }
}

function getOrCreateFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function getOrCreateSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(["Timestamp", "Nick", "ReceivedRef", "Result1", "Result2"]);
  }
  return sheet;
}

function sendJSON(content) {
  return ContentService.createTextOutput(JSON.stringify(content)).setMimeType(ContentService.MimeType.JSON);
}
```