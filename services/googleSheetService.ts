import { HomeworkData, ApiResponse } from '../types';
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

export const checkUserExists = async (nick: string): Promise<{ exists: boolean; isDay2Active: boolean }> => {
  const url = getCleanUrl();
  
  if (!validateUrl(url)) {
    return { exists: false, isDay2Active: false }; 
  }

  try {
    // Добавляем timestamp чтобы избежать кэширования
    const queryUrl = `${url}?nick=${encodeURIComponent(nick)}&t=${Date.now()}`;
    
    const response = await fetch(queryUrl, {
      method: 'GET',
    });
    
    if (!response.ok) {
        console.warn("User check network error:", response.status);
        return { exists: false, isDay2Active: false };
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return { 
        exists: data.exists === true, 
        isDay2Active: data.isDay2Active === true 
      };
    } catch (e) {
      // Если вернулся HTML (например, ошибка скрипта), не ломаем приложение
      console.warn("Server returned non-JSON response for checkUserExists:", text.substring(0, 150));
      return { exists: false, isDay2Active: false };
    }
  } catch (error) {
    console.error("Error checking user existence:", error);
    return { exists: false, isDay2Active: false };
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