import { HomeworkData, Day2HomeworkData, ApiResponse } from '../types';
import { GOOGLE_SCRIPT_URL } from '../constants';

// Функция для очистки URL от возможных пробелов при копировании
const getCleanUrl = () => {
  if (!GOOGLE_SCRIPT_URL) return "";
  // Удаляем пробелы и кавычки, если они случайно попали
  return GOOGLE_SCRIPT_URL.trim().replace(/['"]/g, '');
};

const validateUrl = (url: string) => {
  if (!url || url === "YOUR_WEB_APP_URL_HERE") {
    console.error("GOOGLE_SCRIPT_URL не настроен в constants.ts");
    return false;
  }
  if (!url.endsWith('/exec')) {
    console.warn("URL скрипта должен заканчиваться на /exec. Текущий URL:", url);
  }
  return true;
};

export const checkUserExists = async (nick: string): Promise<{ exists: boolean; isDay2Active: boolean; error?: boolean }> => {
  const url = getCleanUrl();
  
  if (!validateUrl(url)) {
    return { exists: false, isDay2Active: false, error: true }; 
  }

  try {
    // Добавляем timestamp чтобы избежать кэширования
    const queryUrl = `${url}?nick=${encodeURIComponent(nick)}&t=${Date.now()}`;
    
    const response = await fetch(queryUrl, {
      method: 'GET',
    });
    
    if (!response.ok) {
        console.warn("User check network error:", response.status);
        return { exists: false, isDay2Active: false, error: true };
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (data.status === 'error') {
          // Если скрипт вернул явную ошибку (например, 500 внутри try/catch)
          return { exists: false, isDay2Active: false, error: true };
      }
      return { 
        exists: data.exists === true, 
        isDay2Active: data.isDay2Active === true,
        error: false
      };
    } catch (e) {
      // Если вернулся HTML (например, ошибка скрипта), не ломаем приложение
      console.warn("Server returned non-JSON response for checkUserExists:", text.substring(0, 150));
      return { exists: false, isDay2Active: false, error: true };
    }
  } catch (error) {
    console.error("Error checking user existence:", error);
    return { exists: false, isDay2Active: false, error: true };
  }
};

export const submitHomework = async (data: HomeworkData): Promise<ApiResponse> => {
  const url = getCleanUrl();

  if (!validateUrl(url)) {
    throw new Error("API URL is not configured. Please check constants.ts");
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      // Используем text/plain чтобы избежать Preflight (OPTIONS) запроса
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
      },
      redirect: "follow"
    });

    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }

    const text = await response.text();
    try {
      const result = JSON.parse(text);
      return result;
    } catch (e) {
      console.error("Server response was not JSON:", text);
      throw new Error("Ошибка сервера (Invalid JSON). Проверьте логи Google Script.");
    }
  } catch (error) {
    console.error("Submission error:", error);
    throw error;
  }
};

export const submitDay2Homework = async (data: Day2HomeworkData): Promise<ApiResponse> => {
  const url = getCleanUrl();

  if (!validateUrl(url)) {
    throw new Error("API URL is not configured.");
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        action: 'submitDay2',
        ...data
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: "follow"
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Day 2 Submission error:", error);
    throw error;
  }
};

export const fetchRandomAsset = async (myNick: string): Promise<ApiResponse> => {
  const url = getCleanUrl();

  if (!validateUrl(url)) {
    throw new Error("API URL is not configured.");
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'getRandomAsset', 
        telegramNick: myNick 
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: "follow"
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Asset fetch error:", error);
    throw error;
  }
};

export const sendAssetsToChat = async (chatId: number, assets: { base: string; angle1: string; angle2: string; angle3: string; }): Promise<ApiResponse> => {
  const url = getCleanUrl();
  if (!validateUrl(url)) throw new Error("API URL not configured");

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        action: 'sendAssetsToChat',
        chatId: chatId,
        assets: assets
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: "follow"
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    return JSON.parse(await response.text());
  } catch (error) {
    console.error("Send to Chat error:", error);
    throw error;
  }
};