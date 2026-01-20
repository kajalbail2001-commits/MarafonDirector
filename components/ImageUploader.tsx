import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, CheckCircle } from 'lucide-react';

interface ImageUploaderProps {
  id: string; // Left in interface for type compatibility, but removed from usage
  label: string;
  value: string | null;
  onChange: (base64: string | null) => void;
  required?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  label, 
  value, 
  onChange, 
  required = false 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);

    if (!file) return;

    // Ограничение размера убрано по просьбе пользователя.
    // Если нужно вернуть, раскомментируйте блок ниже и добавьте импорт MAX_FILE_SIZE_MB из '../constants'
    /*
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Файл слишком большой. Максимум ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }
    */

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      onChange(base64String);
    };
    reader.onerror = () => {
      setError("Ошибка чтения файла");
    };
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mb-8">
      <label className="block text-xl font-semibold text-warm-800 mb-3">
        {label} {required && <span className="text-amber-600">*</span>}
      </label>
      
      {!value ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer group relative w-full h-48 rounded-2xl border-2 border-dashed border-warm-300 bg-warm-50 hover:bg-white hover:border-amber-400 transition-all duration-300 flex flex-col items-center justify-center text-center p-4"
        >
          <div className="w-16 h-16 rounded-full bg-warm-100 text-warm-500 group-hover:bg-amber-100 group-hover:text-amber-600 flex items-center justify-center mb-3 transition-colors">
            <Upload size={32} />
          </div>
          <p className="text-warm-600 text-lg group-hover:text-amber-800 font-medium">
            Нажмите, чтобы загрузить фото
          </p>
          {/* Текст про размер убран, чтобы не смущать пользователя */}
        </div>
      ) : (
        <div className="relative w-full rounded-2xl overflow-hidden border-2 border-amber-200 shadow-md bg-white">
          <div className="aspect-video w-full bg-warm-100 flex items-center justify-center relative">
            <img 
              src={value} 
              alt="Preview" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/10"></div>
          </div>
          
          <div className="absolute top-3 right-3 flex gap-2">
             <div className="bg-green-500 text-white p-2 rounded-full shadow-lg">
                <CheckCircle size={20} />
             </div>
          </div>

          <div className="p-4 flex items-center justify-between bg-white">
             <div className="flex items-center text-warm-700 font-medium">
                <ImageIcon size={20} className="mr-2 text-amber-500"/>
                Изображение загружено
             </div>
             <button
                type="button"
                onClick={handleClear}
                className="text-red-500 hover:text-red-700 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
             >
                Удалить
             </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-red-500 text-sm font-semibold flex items-center">
          <X size={16} className="mr-1" /> {error}
        </p>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/jpg"
        className="hidden"
      />
    </div>
  );
};

export default ImageUploader;