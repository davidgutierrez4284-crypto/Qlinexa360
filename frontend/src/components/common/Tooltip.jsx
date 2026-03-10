import React from 'react';

const Tooltip = ({ text, children, placement = 'top' }) => {
  let tooltipClass = '';
  switch (placement) {
    case 'bottom':
      tooltipClass = 'top-full mt-2 left-1/2 -translate-x-1/2';
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
    <div className="relative flex items-center group">
      {children}
      <div className={`absolute ${tooltipClass} w-64 p-3 bg-gray-800 text-white text-xs text-center rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none`}>
        {text}
      </div>
    </div>
  );
};

export default Tooltip; 