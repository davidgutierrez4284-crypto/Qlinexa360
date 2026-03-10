import React, { useState, useEffect, useRef } from 'react';
import {
  SPANISH_SPEAKING_COUNTRIES,
  DEFAULT_COUNTRY,
  getFlagUrl,
  parseE164,
  toE164,
} from '../../constants/countries';

/**
 * Componente de teléfono internacional con selector de país y banderas.
 * Emite valor en formato E.164 (+5215512345678) para WhatsApp y SMS.
 */
const PhoneInput = ({
  value = '',
  onChange,
  name = 'phone',
  label = 'Teléfono',
  required = false,
  error = '',
  placeholder = 'Número local',
  disabled = false,
  id,
  className = '',
  showTooltip = false,
  tooltipTitle = 'Es importante para que se envíen mensajes a través de Qlinexa360',
  TooltipComponent,
}) => {
  const parsed = parseE164(value);
  const [country, setCountry] = useState(parsed.country);
  const [localNumber, setLocalNumber] = useState(parsed.localNumber);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const { country: c, localNumber: ln } = parseE164(value);
    setCountry(c);
    setLocalNumber(ln);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCountryChange = (c) => {
    setCountry(c);
    setIsOpen(false);
    const e164 = toE164(c, localNumber);
    onChange?.({ target: { name, value: e164 } });
  };

  const handleNumberChange = (e) => {
    const v = e.target.value.replace(/\D/g, '');
    setLocalNumber(v);
    const e164 = toE164(country, v);
    onChange?.({ target: { name, value: e164 } });
  };

  const inputId = id || `phone-${name}`;

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"
        >
          {label}
          {required && <span className="text-red-500">*</span>}
          {showTooltip && TooltipComponent && (
            <TooltipComponent title={tooltipTitle}>
              <span className="inline-flex cursor-help">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01" />
                </svg>
              </span>
            </TooltipComponent>
          )}
        </label>
      )}
      <div className="flex rounded-md shadow-sm border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        {/* Selector de país - sin overflow-hidden para que el dropdown sea visible en modales */}
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => !disabled && setIsOpen((o) => !o)}
            disabled={disabled}
            className="flex items-center gap-2 h-full min-w-[120px] px-3 py-2 bg-gray-50 border-r border-gray-300 hover:bg-gray-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Seleccionar país"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          >
            <img
              src={getFlagUrl(country.code)}
              alt=""
              className="w-6 h-4 object-cover rounded-sm flex-shrink-0"
            />
            <span className="text-sm font-medium text-gray-700 truncate">
              +{country.dialCode}
            </span>
            <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isOpen && (
            <div
              className="absolute top-full left-0 mt-1 w-64 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] py-1"
              role="listbox"
            >
              {SPANISH_SPEAKING_COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  role="option"
                  aria-selected={c.code === country.code}
                  onClick={() => handleCountryChange(c)}
                  className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                >
                  <img src={getFlagUrl(c.code)} alt="" className="w-6 h-4 object-cover rounded-sm" />
                  <span className="text-sm text-gray-700">{c.name}</span>
                  <span className="text-sm text-gray-500 ml-auto">+{c.dialCode}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Input número */}
        <input
          type="tel"
          id={inputId}
          name={name}
          value={localNumber}
          onChange={handleNumberChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="tel"
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="flex-1 min-w-0 px-3 py-2 border-0 focus:ring-0 focus:outline-none text-gray-900 placeholder-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

export default PhoneInput;
