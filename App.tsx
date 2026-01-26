import React, { useState, useCallback, useEffect } from 'react';
import { Send, Check, Loader2, AlertCircle, Info, Settings, Lock, Telescope, Download, ArrowRight, Home, LogOut, PartyPopper, MessageCircle } from 'lucide-react';
import FormInput from './components/FormInput';
import ImageUploader from './components/ImageUploader';
import { HomeworkData, Day2HomeworkData, UploadStatus, ApiResponse } from './types';
import { LABELS, GOOGLE_SCRIPT_URL } from './constants';
import { submitHomework, checkUserExists, fetchRandomAsset, submitDay2Homework, sendAssetsToChat } from './services/googleSheetService';

const LOCAL_STORAGE_KEY = 'marathon_user_nick';

const App: React.FC = () => {
  // Day 1 Form Data
  const [formData, setFormData] = useState<HomeworkData>({
    telegramNick: '',
    baseReference: null,
    angle1: null,
    angle2: null,
    angle3: null,
  });

  // Day 2 Form Data
  const [day2Data, setDay2Data] = useState<Day2HomeworkData>({
    telegramNick: '',
    receivedRef: null,
    result1: null,
    result2: null
  });

  const [status, setStatus] = useState<UploadStatus>(UploadStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [userExistsWarning, setUserExistsWarning] = useState<boolean>(false);
  const [isCheckingUser, setIsCheckingUser] = useState<boolean>(false);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(true); // Loading state for auto-login
  
  // Day 2 States
  const [isDay2Active, setIsDay2Active] = useState<boolean>(false);
  const [receivedAssets, setReceivedAssets] = useState<ApiResponse['assets'] | null>(null);
  const [receivedAuthor, setReceivedAuthor] = useState<string>('');
  const [isFetchingAsset, setIsFetchingAsset] = useState<boolean>(false);
  const [isDay2SubmissionMode, setIsDay2SubmissionMode] = useState<boolean>(false);
  const [day2Success, setDay2Success] = useState<boolean>(false);
  const [isSendingToChat, setIsSendingToChat] = useState<boolean>(false);
  const [sentToChatSuccess, setSentToChatSuccess] = useState<boolean>(false);
  
  // New State: Welcome Back (Skipped Upload)
  const [isWelcomeBack, setIsWelcomeBack] = useState<boolean>(false);
  // Manual override to show Day 1 form even if user exists
  const [showDay1Anyway, setShowDay1Anyway] = useState<boolean>(false);

  // Telegram User ID
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null);

  // --- TELEGRAM INIT & AUTO-LOGIN ---
  useEffect(() => {
    // 1. Telegram Init
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      
      // Get User ID for "Send to Chat" feature
      const userId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
      if (userId) setTelegramUserId(userId);
    }

    // 2. Auto-Login Logic with Safety Timeout
    const savedNick = localStorage.getItem(LOCAL_STORAGE_KEY);
    
    // Safety timeout: if server is slow/down, don't show white screen forever
    const safetyTimer = setTimeout(() => {
       setIsRestoringSession(false);
    }, 5000);

    if (savedNick) {
      // Pre-fill forms immediately for better UX
      setFormData(prev => ({ ...prev, telegramNick: savedNick }));
      setDay2Data(prev => ({ ...prev, telegramNick: savedNick }));

      const verifyUser = async () => {
        try {
          const result = await checkUserExists(savedNick);
          
          if (result.error) {
             // Server error: Don't just show Day 1, warn user
             setErrorMessage("⚠️ Сервер недоступен. Проверьте интернет.");
          } else if (result.exists) {
            // User confirmed -> Go straight to Success/Menu screen
            setUserExistsWarning(true);
            setIsWelcomeBack(true);
            setStatus(UploadStatus.SUCCESS);
            if (result.isDay2Active) setIsDay2Active(true);
          }
        } catch (e) {
          console.error("Auto-login failed", e);
        } finally {
          clearTimeout(safetyTimer);
          setIsRestoringSession(false);
        }
      };
      verifyUser();
    } else {
      clearTimeout(safetyTimer);
      setIsRestoringSession(false);
    }
    
    return () => clearTimeout(safetyTimer);
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
    setErrorMessage(""); // Clear previous errors
    
    try {
      const result = await checkUserExists(formData.telegramNick);
      
      if (result.error) {
         // Silently ignore
      } else {
         setUserExistsWarning(result.exists);
         if (result.isDay2Active) {
           setIsDay2Active(true);
         }
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
    setIsWelcomeBack(false); 

    try {
      const response = await submitHomework(formData);
      
      // SAVE SESSION
      localStorage.setItem(LOCAL_STORAGE_KEY, formData.telegramNick);
      
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

  const handleDay2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!day2Data.receivedRef || !day2Data.result1 || !day2Data.result2) {
       setErrorMessage("Заполните все 3 поля (референс и 2 результата)");
       return;
    }

    setStatus(UploadStatus.UPLOADING);
    setErrorMessage('');

    try {
      // Страховка: берем ник откуда угодно, лишь бы не пустой
      const nick = formData.telegramNick || day2Data.telegramNick || localStorage.getItem(LOCAL_STORAGE_KEY) || "Anonymous";
      
      const finalData = {
         ...day2Data,
         telegramNick: nick
      };
      
      await submitDay2Homework(finalData);
      
      // SAVE SESSION (Just in case)
      localStorage.setItem(LOCAL_STORAGE_KEY, nick);

      setStatus(UploadStatus.SUCCESS);
      setDay2Success(true);
    } catch (error) {
      setStatus(UploadStatus.ERROR);
      setErrorMessage("Ошибка отправки День 2. Попробуйте еще раз.");
    }
  };

  const handleGetDay2Asset = async () => {
    setIsFetchingAsset(true);
    setErrorMessage(''); 
    try {
      const nick = formData.telegramNick || localStorage.getItem(LOCAL_STORAGE_KEY) || "";
      const result = await fetchRandomAsset(nick);
      if (result.status === 'success' && result.assets) {
        setReceivedAssets(result.assets);
        setReceivedAuthor(result.authorNick || "Аноним");
        // Pre-fill nick for Day 2 form
        setDay2Data(prev => ({...prev, telegramNick: nick}));
      } else {
        setErrorMessage(result.message || "Не удалось получить ассеты. Попробуйте позже.");
      }
    } catch (error) {
      setErrorMessage("Ошибка соединения. Проверьте интернет.");
    } finally {
      setIsFetchingAsset(false);
    }
  };
  
  const handleSendToChat = async () => {
    if (!receivedAssets || !telegramUserId) return;
    
    setIsSendingToChat(true);
    try {
       const response = await sendAssetsToChat(telegramUserId, receivedAssets);
       
       if (response.status === 'success') {
         setSentToChatSuccess(true);
       } else {
         const msg = response.message || "";
         
         // SPECIAL HANDLER FOR PERMISSION ERRORS
         if (msg.includes("UrlFetchApp") || msg.includes("script.external_request")) {
           alert(
             "⚠️ ОШИБКА НАСТРОЕК (Для Администратора):\n\n" +
             "Скрипт не имеет прав на выход в интернет.\n" +
             "1. Зайдите в Google Apps Script.\n" +
             "2. Запустите функцию 'A_SETUP_CLICK_ME'.\n" +
             "3. При Deploy убедитесь, что выбрано 'Execute as: Me' (от Вашего имени), а не от пользователя."
           );
         } else if (msg.includes("blocked")) {
           alert("Бот заблокирован пользователем. Напишите боту /start и попробуйте снова.");
         } else {
           alert("Ошибка отправки: " + msg);
         }
       }
    } catch (e) {
       alert("Не удалось отправить. Попробуйте еще раз или скачайте вручную.");
    } finally {
       setIsSendingToChat(false);
    }
  };

  const handleSkipToDay2 = () => {
    // Save session manually if they clicked "I've already submitted"
    localStorage.setItem(LOCAL_STORAGE_KEY, formData.telegramNick);
    
    setIsWelcomeBack(true);
    setStatus(UploadStatus.SUCCESS);
  };

  const handleLogout = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    // Reset states
    setStatus(UploadStatus.IDLE);
    setErrorMessage('');
    setFormData({
      telegramNick: '',
      baseReference: null,
      angle1: null,
      angle2: null,
      angle3: null,
    });
    setDay2Data(prev => ({ ...prev, telegramNick: '' }));
    setUserExistsWarning(false);
    setIsWelcomeBack(false);
    setIsDay2Active(false);
    setReceivedAssets(null);
    setDay2Success(false);
    setIsDay2SubmissionMode(false);
    setShowDay1Anyway(false);
    setSentToChatSuccess(false);
  };

  // CORRECT DOWNLOAD HANDLER FOR ANDROID/TELEGRAM
  const handleDownloadAsset = (url: string) => {
    const downloadUrl = url.replace('export=view', 'export=download');
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openLink(downloadUrl, { tryInstantView: false });
    } else {
      window.open(downloadUrl, '_blank');
    }
  };

  // ---------------------------------------------------------------------------
  // LOADING SCREEN (Checking LocalStorage/API)
  // ---------------------------------------------------------------------------
  if (isRestoringSession) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-warm-600">
          <Loader2 className="animate-spin" size={48} />
          <p className="font-medium text-lg">Вход...</p>
          <button 
             onClick={() => setIsRestoringSession(false)}
             className="mt-4 text-xs text-warm-400 underline"
          >
            Долго грузится? Нажмите сюда
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW: DAY 2 SUCCESS (SUBMISSION DONE)
  // ---------------------------------------------------------------------------
  if (day2Success) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border-2 border-green-100">
           <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 shadow-sm">
             <Telescope size={40} />
           </div>
           <h2 className="text-2xl font-bold text-warm-900 mb-2">{LABELS.DAY2_SUCCESS_TITLE}</h2>
           <p className="text-warm-600 mb-6">{LABELS.DAY2_SUCCESS_MSG}</p>
           
           <div className="bg-green-50 text-green-800 p-4 rounded-xl border border-green-200 text-sm font-medium">
             Задание принято. Ждем вас завтра на 3-м дне!
           </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW: DAY 2 FORM
  // ---------------------------------------------------------------------------
  if (isDay2SubmissionMode) {
    return (
      <div className="min-h-screen bg-warm-50 font-sans text-warm-900 pb-12">
        <header className="bg-white shadow-sm border-b border-warm-200 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-lg font-bold text-warm-800">{LABELS.DAY2_TITLE}</h1>
            <button onClick={() => setIsDay2SubmissionMode(false)} className="text-warm-500 hover:text-warm-800">
               <Home size={24} />
            </button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 mt-8">
           <div className="bg-white rounded-3xl shadow-xl p-6 md:p-10 border border-warm-100 relative overflow-hidden">
              {status === UploadStatus.UPLOADING && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-amber-600">
                  <Loader2 className="animate-spin mb-4" size={48} />
                  <p className="text-xl font-semibold">Отправка отчета...</p>
                </div>
              )}

              <div className="mb-6 text-center">
                 <h2 className="text-2xl font-bold text-warm-800 mb-2">Форма сдачи (День 2)</h2>
                 <p className="text-warm-500">Ник: <span className="font-bold text-amber-600">@{formData.telegramNick || day2Data.telegramNick || localStorage.getItem(LOCAL_STORAGE_KEY)}</span></p>
              </div>

              <form onSubmit={handleDay2Submit}>
                <ImageUploader
                  id="receivedRef"
                  label={LABELS.DAY2_RECEIVED_REF_LABEL}
                  value={day2Data.receivedRef}
                  onChange={(val) => setDay2Data(prev => ({ ...prev, receivedRef: val }))}
                  required
                />
                
                <div className="h-px bg-warm-100 my-6"></div>

                <ImageUploader
                  id="res1"
                  label={LABELS.DAY2_RESULT_1_LABEL}
                  value={day2Data.result1}
                  onChange={(val) => setDay2Data(prev => ({ ...prev, result1: val }))}
                  required
                />
                 <ImageUploader
                  id="res2"
                  label={LABELS.DAY2_RESULT_2_LABEL}
                  value={day2Data.result2}
                  onChange={(val) => setDay2Data(prev => ({ ...prev, result2: val }))}
                  required
                />

                {errorMessage && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600">
                    <AlertCircle className="shrink-0 mt-0.5" />
                    <p className="font-medium">{errorMessage}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === UploadStatus.UPLOADING}
                  className="w-full mt-8 py-5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all"
                >
                  <Send size={20} />
                  {LABELS.SUBMIT_BTN}
                </button>
              </form>
           </div>
        </main>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW: DAY 1 SUCCESS / DAY 2 ASSETS (EXCHANGE COMPLETE)
  // ---------------------------------------------------------------------------
  if (status === UploadStatus.SUCCESS) {
    if (receivedAssets) {
      // State C: Exchange Complete (SHOW ASSETS + BUTTON TO SUBMIT)
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
                 Автор: <span className="font-bold text-amber-600">{receivedAuthor}</span>
               </p>

               {/* === NEW FEATURE: SEND TO CHAT BUTTON === */}
               {telegramUserId ? (
                 <div className="mb-8">
                    {!sentToChatSuccess ? (
                      <button 
                        onClick={handleSendToChat}
                        disabled={isSendingToChat}
                        className="w-full py-5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-3 active:scale-95"
                      >
                         {isSendingToChat ? <Loader2 className="animate-spin" /> : <MessageCircle size={24} />}
                         {isSendingToChat ? "Отправляю..." : "Прислать мне всё в личку"}
                      </button>
                    ) : (
                      <div className="w-full py-4 bg-green-100 text-green-700 rounded-2xl font-bold flex items-center justify-center gap-2 border border-green-200">
                         <Check size={24} /> Отправлено! Проверьте чат
                      </div>
                    )}
                    <p className="text-xs text-warm-400 mt-2">Бот пришлет вам 4 фотографии</p>
                 </div>
               ) : (
                 <p className="text-xs text-red-400 mb-4">Откройте через Telegram для отправки в личку</p>
               )}
               {/* ======================================== */}
               
               {/* === MOVED UP: SUBMIT BUTTON === */}
               <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 mb-8">
                  <h3 className="text-xl font-bold text-amber-900 mb-2">Готовы сдать работу?</h3>
                  <p className="text-amber-700 mb-6 text-sm">
                    Когда выполните задание с этими референсами, нажмите кнопку ниже.
                  </p>
                  <button 
                    onClick={() => setIsDay2SubmissionMode(true)}
                    className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-amber-200 transition-all flex items-center justify-center gap-2"
                  >
                    {LABELS.DAY2_GO_TO_SUBMIT} <ArrowRight size={20} />
                  </button>
               </div>

               <div className="h-px bg-warm-200 w-full mb-8"></div>

               {/* === MANUAL DOWNLOAD SECTION (MOVED DOWN) === */}
               <p className="text-sm text-warm-600 font-bold mb-4 text-center px-4">
                 у кого не приходят референсы по синей кнопке попробуйте вручную скачать:
               </p>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-left">
                  {[
                    { title: LABELS.BASE_REF, url: receivedAssets.base },
                    { title: LABELS.ANGLE_1, url: receivedAssets.angle1 },
                    { title: LABELS.ANGLE_2, url: receivedAssets.angle2 },
                    { title: LABELS.ANGLE_3, url: receivedAssets.angle3 }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-warm-50 rounded-xl p-3 border border-warm-200 shadow-sm">
                       <h3 className="font-bold text-warm-700 mb-2 px-1 text-sm">{item.title}</h3>
                       <div className="aspect-video bg-warm-200 rounded-lg overflow-hidden mb-3 relative">
                          <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                       </div>
                       
                       <button 
                         onClick={() => handleDownloadAsset(item.url)}
                         className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-warm-300 text-warm-700 rounded-lg text-sm font-bold hover:bg-amber-50 hover:border-amber-400 transition-all shadow-sm"
                       >
                         <Download size={16} /> Скачать вручную
                       </button>
                    </div>
                  ))}
               </div>
               
             </div>
           </div>
        </div>
      );
    }

    // State B: Welcome Screen / Day 1 Success -> Button to get Asset
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-warm-100">
          
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isWelcomeBack ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
            {isWelcomeBack ? <Telescope size={40} /> : <Check size={40} strokeWidth={3} />}
          </div>
          
          <h2 className="text-2xl font-bold text-warm-800 mb-2">
            {isWelcomeBack ? `Привет, ${formData.telegramNick}!` : LABELS.SUCCESS_TITLE}
          </h2>
          <p className="text-warm-600 mb-4">
            {isWelcomeBack 
              ? "Рады видеть вас снова." 
              : LABELS.SUCCESS_MSG
            }
          </p>
          
          <div className="h-px bg-warm-100 w-full mb-6"></div>

          {errorMessage && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-center justify-center gap-2 animate-fade-in">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isDay2Active ? (
            <button 
              onClick={handleGetDay2Asset}
              disabled={isFetchingAsset}
              className="group w-full py-6 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white rounded-3xl text-2xl font-extrabold transition-all transform hover:scale-[1.02] shadow-xl shadow-amber-300 relative overflow-hidden animate-pulse"
            >
              {isFetchingAsset ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" />
                  Загрузка...
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                  <div className="flex items-center justify-center gap-3 relative z-10">
                    <PartyPopper size={32} />
                    {LABELS.DAY2_ACTIVE_BTN}
                  </div>
                </>
              )}
            </button>
          ) : (
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

          {isWelcomeBack && (
            <button 
              onClick={handleLogout}
              className="mt-6 text-warm-400 text-sm font-semibold hover:text-warm-600 flex items-center justify-center gap-1 mx-auto"
            >
              <LogOut size={14} />
              Не вы? Выйти
            </button>
          )}

        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW: MAIN FORM (DAY 1)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-warm-50 font-sans text-warm-900 pb-12">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-warm-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl overflow-hidden shrink-0 border border-amber-200 shadow-sm">
             <img 
               src="https://i.imgur.com/Ru7aBW1.jpeg" 
               alt="Marathon Logo" 
               className="w-full h-full object-cover"
             />
          </div>
          <div>
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
          
          {status === UploadStatus.UPLOADING && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-amber-600">
              <Loader2 className="animate-spin mb-4" size={48} />
              <p className="text-xl font-semibold">Загрузка работы...</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-8">
              {/* === ERROR BANNER FROM SERVER === */}
              {errorMessage && !day2Success && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 shadow-sm animate-fade-in">
                  <AlertCircle className="shrink-0 mt-0.5" />
                  <div>
                     <p className="font-bold">Ошибка</p>
                     <p className="text-sm">{errorMessage}</p>
                  </div>
                </div>
              )}
              {/* ================================= */}

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
              
              {isCheckingUser && (
                <div className="text-warm-400 text-sm flex items-center mt-2 px-1">
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Проверяем базу участников...
                </div>
              )}

              {/* FAST TRACK TO DAY 2 */}
              {userExistsWarning && isDay2Active && !showDay1Anyway ? (
                <div className="mt-6 animate-fade-in text-center">
                   <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-4">
                      <div className="flex items-center justify-center gap-2 text-amber-800 font-bold text-lg mb-2">
                        <Check size={24} className="text-green-600" />
                        Вы уже сдали День 1!
                      </div>
                      <p className="text-amber-700 mb-6">
                         Второй день уже открыт. Приступайте к заданию!
                      </p>
                      
                      <button 
                         type="button"
                         onClick={handleSkipToDay2}
                         className="w-full py-6 bg-gradient-to-tr from-amber-500 to-amber-600 text-white rounded-2xl text-2xl font-black shadow-xl shadow-amber-300 hover:shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3 animate-pulse"
                       >
                          <PartyPopper size={32} />
                          НАЧАТЬ ДЕНЬ 2
                       </button>
                   </div>
                   
                   <button 
                     type="button" 
                     onClick={() => setShowDay1Anyway(true)}
                     className="text-sm text-warm-400 hover:text-warm-600 underline"
                   >
                     Я хочу перезалить День 1
                   </button>
                </div>
              ) : (
                /* NORMAL DAY 1 FORM (Hidden if Fast Track is Active) */
                <>
                  {userExistsWarning && (
                     <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 mb-6">
                        <Info className="shrink-0 mt-0.5 text-amber-600" />
                        <div>
                          <p className="font-bold mb-1">Режим перезаливки</p>
                          <p className="text-sm text-amber-700">
                            Вы уже сдавали работу, но можете отправить новую версию.
                          </p>
                        </div>
                     </div>
                  )}

                  <div className="h-px bg-warm-100 my-8"></div>

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
                </>
              )}
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