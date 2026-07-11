import React, { useState, useEffect, useRef } from 'react';
import { SPANISH_SPEAKING_COUNTRIES, getFlagUrl } from '../../constants/countries';

/**
 * Selector de país con banderas, reutilizando la misma lista de países de habla
 * hispana del componente de teléfono (PhoneInput). El valor emitido es el código
 * ISO-2 en MAYÚSCULAS (p. ej. "MX", "ES") para mantener consistencia en la BD.
 */
const findCountry = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  return (
    SPANISH_SPEAKING_COUNTRIES.find((c) => c.code === v) ||
    SPANISH_SPEAKING_COUNTRIES.find((c) => c.name.toLowerCase() === v) ||
    null
  );
};

const CountrySelect = ({
  value = '',
  onChange,
  label = 'País',
  required = false,
  error = '',
  disabled = false,
  id,
  className = '',
  placeholder = 'Selecciona un país',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selected = findCountry(value);
  const inputId = id || 'country-select';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (c) => {
    setIsOpen(false);
    onChange?.(c.code.toUpperCase(), c);
  };

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          id={inputId}
          onClick={() => !disabled && setIsOpen((o) => !o)}
          disabled={disabled}
          className="flex items-center gap-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-invalid={!!error}
        >
          {selected ? (
            <>
              <img src={getFlagUrl(selected.code)} alt="" className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
              <span className="text-sm text-gray-800 truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-sm text-gray-400 truncate">{placeholder}</span>
          )}
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && (
          <div
            className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] py-1"
            role="listbox"
          >
            {SPANISH_SPEAKING_COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={selected?.code === c.code}
                onClick={() => handleSelect(c)}
                className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
              >
                <img src={getFlagUrl(c.code)} alt="" className="w-6 h-4 object-cover rounded-sm" />
                <span className="text-sm text-gray-700">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default CountrySelect;
