import React from 'react';

const STYLES = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
  gray: 'bg-gray-300',
};

const LabTrafficLight = ({ status = 'gray', label, size = 'md' }) => {
  const dot = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  return (
    <span className="inline-flex items-center gap-2" title={label || status}>
      <span className={'inline-block rounded-full ' + dot + ' ' + (STYLES[status] || STYLES.gray)} />
      {label ? <span className="text-sm text-gray-700">{label}</span> : null}
    </span>
  );
};

export default LabTrafficLight;
