import React, { useState, useCallback, useEffect } from 'react';
import { Send, Check, Loader2, AlertCircle, Info, Settings, Lock, Telescope, Download, ArrowRight } from 'lucide-react';
import FormInput from './components/FormInput';
import ImageUploader from './components/ImageUploader';
import { HomeworkData, UploadStatus, ApiResponse } from './types';
import { LABELS, GOOGLE_SCRIPT_URL } from './constants';
import { submitHomework, checkUserExists, fetchRandomAsset } from './services/googleSheetService';

const App: React.FC = () => {
  const [formData, setFormData] = useState<HomeworkData>({
    telegramNick: '',
    baseReference: null,
    angle1: null,
    angle2: null,
    angle3: null,
  });

  const [status, setStatus] = useState<UploadStatus>(UploadStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [userExistsWarning, setUserExistsWarning] = useState<boolean>(false);
  const [isCheckingUser, setIsCheckingUser] = useState<boolean>(false);
  
  // Day 2 States
  const [isDay2Active, setIsDay2Active] = useState<boolean>(false);
  const [receivedAssets, setReceivedAssets] = useState<ApiResponse['assets'] | null>(null);
  const [receivedAuthor, setReceivedAuthor] = useState<string>('');
  const [isFetchingAsset, setIsFetchingAsset] = useState<boolean>(false);
  
  // New State: Welcome Back (Skipped Upload)
  const [isWelcomeBack, setIsWelcomeBack] = useState<boolean>(false);

  // --- TELEGRAM INIT ---
  useEffect(() => {
    // Безопасная проверка наличия Telegram API перед вызовом
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand(); // Принудительно разворачиваем на весь экран
    }
  }, []);

  // CRITICAL CHECK: Ensure URL is set
  if (!GOOGLE_SCRIPT_URL || (GOOGLE_SCRIPT_URL as string) === "YOUR_WEB_APP_URL_HERE") {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-lg w-full border-2 border-red-200">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6">
             <Settings size={32} />
          </div>
          <h1 className="text-2xl font-bold text-red-800 mb-4">Настройка не завершена!</h1>
          <p className="text-gray-700 mb-4">
            Приложение не знает, куда отправлять данные. Вы не вставили ссылку на скрипт.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-800 font-medium bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
            <li>Откройте файл <code className="bg-gray-200 px-1 rounded">constants.ts</code></li>
            <li>Найдите строку <code className="text-sm">YOUR_WEB_APP_URL_HERE</code></li>
            <li>Замените её на вашу ссылку из Google Apps Script (заканчивается на <code className="text-blue-600">/exec</code>)</li>
          </ol>
          <p className="text-sm text-gray-500">
            После этого страница обновится автоматически.
          </p>
        </div>
      </div>
    );
  }

  // Check user existence when they leave the nickname field
  const handleNickBlur = useCallback(async () => {
    if (!formData.telegramNick || formData.telegramNick.length < 3) return;
    
    setIsCheckingUser(true);
    try {
      const result = await checkUserExists(formData.telegramNick);
      setUserExistsWarning(result.exists);
      
      // Update global Day 2 status from the check result
      if (result.isDay2Active) {
        setIsDay2Active(true);
      }
    } catch (e) {
      console.error("Check failed", e);
    } finally {
      setIsCheckingUser(false);
    }
  }, [formData.telegramNick]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.telegramNick || !formData.baseReference || !formData.angle1 || !formData.angle2 || !formData.angle3) {
      setErrorMessage("Пожалуйста, заполните все обязательные поля");
      return;
    }

    setStatus(UploadStatus.UPLOADING);
    setErrorMessage('');
    setIsWelcomeBack(false); // Reset welcome back flag on fresh submit

    try {
      const response = await submitHomework(formData);
      setStatus(UploadStatus.SUCCESS);
      if (response.isDay2Active) {
        setIsDay2Active(true);
      }
    } catch (error) {
      console.error(error);
      setStatus(UploadStatus.ERROR);
      setErrorMessage(LABELS.ERROR_MSG);
    }
  };

  const handleGetDay2Asset = async () => {
    setIsFetchingAsset(true);
    setErrorMessage(''); // Clear previous errors
    try {
      const result = await fetchRandomAsset(formData.telegramNick);
      if (result.status === 'success' && result.assets) {
        setReceivedAssets(result.assets);
        setReceivedAuthor(result.authorNick || "Аноним");
      } else {
        setErrorMessage(result.message || "Не удалось получить ассеты. Попробуйте позже.");
      }
    } catch (error) {
      setErrorMessage("Ошибка соединения. Проверьте интернет.");
    } finally {
      setIsFetchingAsset(false);
    }
  };

  const handleSkipToDay2 = () => {
    setIsWelcomeBack(true);
    setStatus(UploadStatus.SUCCESS);
  };

  // --- RENDER SUCCESS / DAY 2 STATE ---
  if (status === UploadStatus.SUCCESS) {
    if (receivedAssets) {
      // State C: Exchange Complete (SHOW ALL 4 IMAGES)
      return (
        <div className="min-h-screen bg-warm-50 py-10 px-4">
           <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-amber-100">
             <div className="bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300 h-2"></div>
             
             <div className="p-8 text-center">
               <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-600 shadow-sm">
                 <Telescope size={32} />
               </div>
               
               <h2 className="text-3xl font-bold text-warm-900 mb-2">{LABELS.DAY2_EXCHANGE_TITLE}</h2>
               <p className="text-warm-600 mb-6 max-w-xl mx-auto">
                 {LABELS.DAY2_EXCHANGE_DESC} <br/>
                 Автор материалов: <span className="font-bold text-amber-600">{receivedAuthor}</span>
               </p>

               {/* GRID OF IMAGES */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-left">
                  {/* Card Helper */}
                  {[
                    { title: LABELS.BASE_REF, url: receivedAssets.base },
                    { title: LABELS.ANGLE_1, url: receivedAssets.angle1 },
                    { title: LABELS.ANGLE_2, url: receivedAssets.angle2 },
                    { title: LABELS.ANGLE_3, url: receivedAssets.angle3 }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-warm-50 rounded-xl p-3 border border-warm-200 hover:border-amber-300 transition-colors shadow-sm">
                       <h3 className="font-bold text-warm-700 mb-2 px-1 text-sm">{item.title}</h3>
                       <div className="aspect-video bg-warm-200 rounded-lg overflow-hidden mb-3 relative group">
                          <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                       </div>
                       <a 
                         href={item.url.replace('export=view', 'export=download')} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-warm-300 text-warm-700 rounded-lg text-sm font-bold hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 transition-all"
                       >
                         <Download size={16} /> Скачать
                       </a>
                    </div>
                  ))}
               </div>
               
               <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-amber-800 text-sm">
                  <p>📸 <strong>Задание:</strong> Сохраните эти 4 изображения. Используйте их для выполнения задания второго дня.</p>
               </div>
             </div>
           </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-warm-100">
          
          {/* Success Check or Welcome Back Icon */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isWelcomeBack ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
            {isWelcomeBack ? <Telescope size={40} /> : <Check size={40} strokeWidth={3} />}
          </div>
          
          <h2 className="text-2xl font-bold text-warm-800 mb-2">
            {isWelcomeBack ? `Привет, ${formData.telegramNick}!` : LABELS.SUCCESS_TITLE}
          </h2>
          <p className="text-warm-600 mb-8">
            {isWelcomeBack 
              ? "Рады видеть вас снова. Вы можете приступить ко второму этапу." 
              : LABELS.SUCCESS_MSG
            }
          </p>
          
          <div className="h-px bg-warm-100 w-full mb-8"></div>

          {/* Display Errors here if Day 2 fetch fails */}
          {errorMessage && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-center justify-center gap-2 animate-fade-in">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Day 2 Button Logic */}
          {isDay2Active ? (
            // State B: Active
            <button 
              onClick={handleGetDay2Asset}
              disabled={isFetchingAsset}
              className="group w-full py-5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white rounded-2xl text-xl font-bold transition-all transform active:scale-[0.98] shadow-lg shadow-amber-200 relative overflow-hidden"
            >
              {isFetchingAsset ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" />
                  Получение...
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                  <div className="flex items-center justify-center gap-3 relative z-10">
                    <Telescope className="animate-pulse" />
                    {LABELS.DAY2_ACTIVE_BTN}
                  </div>
                </>
              )}
            </button>
          ) : (
            // State A: Locked
            <div className="opacity-70 grayscale transition-all hover:grayscale-0 hover:opacity-100">
              <button 
                disabled
                className="w-full py-5 bg-warm-200 text-warm-500 rounded-2xl text-xl font-bold flex items-center justify-center gap-3 cursor-not-allowed border-2 border-warm-300"
              >
                <Lock size={20} />
                {LABELS.DAY2_LOCKED_BTN}
              </button>
              <p className="text-sm text-warm-500 mt-3 font-medium px-4">
                {LABELS.DAY2_LOCKED_DESC}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- RENDER FORM ---
  return (
    <div className="min-h-screen bg-warm-50 font-sans text-warm-900 pb-12">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-warm-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl overflow-hidden shrink-0 border border-amber-200 shadow-sm">
             {/* 
                [НАСТРОЙКА] АВАТАРКА ПРИЛОЖЕНИЯ
                Чтобы поменять картинку, замените ссылку в src="..." ниже
             */}
             <img 
               src="https://i.imgur.com/Ru7aBW1.jpeg" 
               alt="Marathon Logo" 
               className="w-full h-full object-cover"
             />
          </div>
          <div>
            {/* 
                [НАСТРОЙКА] ЗАГОЛОВКИ
                Текст заголовков (LABELS.TITLE, LABELS.SUBTITLE) 
                находится и меняется в файле constants.ts 
            */}
            <h1 className="text-xl font-bold text-warm-800 tracking-tight leading-none">
              {LABELS.TITLE}
            </h1>
            <p className="text-warm-500 text-sm font-medium mt-1">
              {LABELS.SUBTITLE}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 mt-8">
        <div className="bg-white rounded-3xl shadow-xl shadow-warm-200/50 p-6 md:p-10 border border-warm-100 relative overflow-hidden">
          
          {/* Form Loader Overlay */}
          {status === UploadStatus.UPLOADING && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-amber-600">
              <Loader2 className="animate-spin mb-4" size={48} />
              <p className="text-xl font-semibold">Загрузка работы...</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            
            {/* Nickname Section */}
            <div className="mb-8">
              <FormInput
                id="telegram"
                label={LABELS.TELEGRAM_NICK}
                value={formData.telegramNick}
                onChange={(val) => {
                  setFormData(prev => ({ ...prev, telegramNick: val }));
                  if (userExistsWarning) setUserExistsWarning(false);
                }}
                onBlur={handleNickBlur}
                placeholder="@username"
                required
              />
              
              {/* Checking Status */}
              {isCheckingUser && (
                <div className="text-warm-400 text-sm flex items-center mt-2 px-1">
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Проверяем базу участников...
                </div>
              )}

              {/* Duplicate Warning & Day 2 Skip */}
              {userExistsWarning && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-4 text-amber-800 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <Info className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-bold mb-1">Вы уже сдавали работу</p>
                      <p className="text-sm text-amber-700 leading-relaxed">
                        Мы нашли задание от <strong>{formData.telegramNick}</strong>. 
                        Если вы хотите обновить файлы, отправьте форму снова. Старые файлы будут помечены как устаревшие.
                      </p>
                    </div>
                  </div>

                  {/* Show Skip Button if Day 2 is Active */}
                  {isDay2Active && (
                    <button 
                       type="button"
                       onClick={handleSkipToDay2}
                       className="w-full py-3 bg-white border-2 border-amber-300 text-amber-700 font-bold rounded-lg hover:bg-amber-100 hover:border-amber-400 transition-all flex items-center justify-center gap-2 shadow-sm"
                     >
                        <Telescope size={18} />
                        Перейти ко Дню 2 (без загрузки)
                     </button>
                  )}
                </div>
              )}
            </div>

            <div className="h-px bg-warm-100 my-8"></div>

            {/* Images Section */}
            <div className="space-y-6">
              <ImageUploader
                id="baseRef"
                label={LABELS.BASE_REF}
                value={formData.baseReference}
                onChange={(val) => setFormData(prev => ({ ...prev, baseReference: val }))}
                required
              />
              
              <ImageUploader
                id="angle1"
                label={LABELS.ANGLE_1}
                value={formData.angle1}
                onChange={(val) => setFormData(prev => ({ ...prev, angle1: val }))}
                required
              />

              <ImageUploader
                id="angle2"
                label={LABELS.ANGLE_2}
                value={formData.angle2}
                onChange={(val) => setFormData(prev => ({ ...prev, angle2: val }))}
                required
              />

              <ImageUploader
                id="angle3"
                label={LABELS.ANGLE_3}
                value={formData.angle3}
                onChange={(val) => setFormData(prev => ({ ...prev, angle3: val }))}
                required
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600">
                <AlertCircle className="shrink-0 mt-0.5" />
                <p className="font-medium">{errorMessage}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-10 sticky bottom-6 z-20">
               <button
                type="submit"
                disabled={status === UploadStatus.UPLOADING}
                className={`w-full py-5 text-white rounded-2xl text-xl font-bold transition-all shadow-lg flex items-center justify-center gap-3 transform active:scale-[0.98]
                  ${userExistsWarning 
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200/50' 
                    : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200/50'
                  }
                  ${(status === UploadStatus.UPLOADING) ? 'opacity-80 cursor-not-allowed' : ''}
                `}
              >
                {status === UploadStatus.UPLOADING ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    {LABELS.SENDING}
                  </>
                ) : (
                  <>
                    <Send size={24} />
                    {userExistsWarning ? 'Обновить задание' : (LABELS.SUBTITLE ? LABELS.SUBMIT_BTN : "Отправить")}
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
        
        <p className="text-center text-warm-400 mt-8 mb-12 text-sm">
          ИИ-РЕЖИССУРА © 2026
        </p>
      </main>
    </div>
  );
};

export default App;