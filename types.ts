export interface HomeworkData {
  telegramNick: string;
  baseReference: string | null;
  angle1: string | null;
  angle2: string | null;
  angle3: string | null;
}

export interface Day2HomeworkData {
  telegramNick: string;
  receivedRef: string | null; // Референс, который достался (для контроля)
  result1: string | null;     // Результат 1
  result2: string | null;     // Результат 2
}

export enum UploadStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface ApiResponse {
  status: 'success' | 'error';
  message?: string;
  isDay2Active?: boolean; // Флаг от сервера: активен ли День 2
  // Новый формат ответа: объект со всеми 4 ссылками
  assets?: {
    base: string;
    angle1: string;
    angle2: string;
    angle3: string;
  };
  authorNick?: string;    // Ник автора ассета (опционально)
}

// Расширяем глобальный объект window для поддержки Telegram Web App
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        openLink: (url: string, options?: { tryInstantView?: boolean }) => void;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
        };
      };
    };
  }
}