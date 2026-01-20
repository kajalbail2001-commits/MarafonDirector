import React from 'react';

interface FormInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({ 
  id, 
  label, 
  value, 
  onChange,
  onBlur,
  placeholder, 
  required = false 
}) => {
  return (
    <div className="mb-6">
      <label 
        htmlFor={id} 
        className="block text-xl font-semibold text-warm-800 mb-2"
      >
        {label} {required && <span className="text-amber-600">*</span>}
      </label>
      <input
        type="text"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        className="w-full px-5 py-4 text-lg rounded-xl border-2 border-warm-200 bg-white text-warm-900 placeholder-warm-400 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100 transition-all shadow-sm"
      />
    </div>
  );
};

export default FormInput;