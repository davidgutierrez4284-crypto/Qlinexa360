import React from 'react';

const Tooltip = ({ text, children, placement = 'top', align = 'center', widthClass = 'w-72' }) => {
  let tooltipClass = '';
  switch (placement) {
    case 'bottom':
      tooltipClass =
        align === 'start'
          ? 'top-full left-0 mt-2'
          : 'top-full mt-2 left-1/2 -translate-x-1/2';
      break;
    case 'right':
      tooltipClass = 'left-full ml-2 top-1/2 -translate-y-1/2';
      break;
    case 'left':
      tooltipClass = 'right-full mr-2 top-1/2 -translate-y-1/2';
      break;
    case 'top':
    default:
      tooltipClass = 'bottom-full mb-2 left-1/2 -translate-x-1/2';
      break;
  }
  return (
    <div className="relative inline-flex items-center group">
      {children}
      <div
        className={`absolute ${tooltipClass} ${widthClass} p-3 bg-gray-800 text-white text-xs text-left leading-relaxed rounded-lg shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 z-[9999] pointer-events-none whitespace-normal`}
      >
        {text}
      </div>
    </div>
  );
};

export default Tooltip;
