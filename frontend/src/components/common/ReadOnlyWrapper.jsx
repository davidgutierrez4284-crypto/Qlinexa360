import React from 'react';
import { useReadOnlyMode } from '../../hooks/useReadOnlyMode';
import { toast } from 'react-toastify';

/**
 * Componente wrapper que deshabilita elementos interactivos cuando está en modo solo lectura
 * 
 * Uso:
 * <ReadOnlyWrapper>
 *   <button onClick={handleClick}>Guardar</button>
 * </ReadOnlyWrapper>
 * 
 * O con mensaje personalizado:
 * <ReadOnlyWrapper message="No puedes guardar porque tu suscripción está cancelada">
 *   <button onClick={handleClick}>Guardar</button>
 * </ReadOnlyWrapper>
 */
export const ReadOnlyWrapper = ({ children, message, showToast = true, className = '' }) => {
  const { isReadOnly, message: defaultMessage } = useReadOnlyMode();

  const handleClick = (e) => {
    if (isReadOnly) {
      e.preventDefault();
      e.stopPropagation();
      if (showToast) {
        toast.error(message || defaultMessage || 'Tu suscripción está cancelada. Solo puedes consultar información.');
      }
    }
  };

  if (!isReadOnly) {
    return <>{children}</>;
  }

  // Si está en modo solo lectura, envolver los hijos y deshabilitar interacciones
  return (
    <div 
      className={`read-only-wrapper ${className}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (isReadOnly && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          e.stopPropagation();
          if (showToast) {
            toast.error(message || defaultMessage || 'Tu suscripción está cancelada. Solo puedes consultar información.');
          }
        }
      }}
      style={{ 
        pointerEvents: 'auto',
        position: 'relative'
      }}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          // Deshabilitar botones
          if (child.type === 'button' || (child.props && child.props.onClick)) {
            return React.cloneElement(child, {
              disabled: true,
              onClick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (showToast) {
                  toast.error(message || defaultMessage || 'Tu suscripción está cancelada. Solo puedes consultar información.');
                }
                if (child.props.onClick) {
                  child.props.onClick(e);
                }
              },
              style: {
                ...child.props.style,
                opacity: 0.6,
                cursor: 'not-allowed'
              }
            });
          }
          // Deshabilitar inputs y textareas
          if (child.type === 'input' || child.type === 'textarea' || child.type === 'select') {
            return React.cloneElement(child, {
              disabled: true,
              readOnly: true,
              style: {
                ...child.props.style,
                opacity: 0.6,
                cursor: 'not-allowed'
              }
            });
          }
        }
        return child;
      })}
    </div>
  );
};

export default ReadOnlyWrapper;

