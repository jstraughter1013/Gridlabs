import React, { useState, useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
  position = 'top-right',
}) => {
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration, onClose]);
  
  // If not visible, don't render anything
  if (!visible) return null;
  
  // Styles based on type
  const typeStyles = {
    success: 'bg-green-100 border-green-500 text-green-700',
    error: 'bg-red-100 border-red-500 text-red-700',
    warning: 'bg-yellow-100 border-yellow-500 text-yellow-700',
    info: 'bg-blue-100 border-blue-500 text-blue-700',
  };
  
  // Styles based on position
  const positionStyles = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };
  
  // Icon based on type
  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
  };
  
  return (
    <div 
      className={`fixed ${positionStyles[position]} z-50 max-w-sm transition-opacity`}
      role="alert"
      aria-live="assertive"
      data-testid="gridlabs-toast"
    >
      <div className={`p-3 rounded shadow-md border-l-4 ${typeStyles[type]} flex items-start`}>
        <div className="mr-2 font-bold">{icons[type]}</div>
        <div>{message}</div>
        <button 
          className="ml-auto -mr-1 text-gray-500 hover:text-gray-700"
          onClick={() => {
            setVisible(false);
            if (onClose) onClose();
          }}
          aria-label="Close"
        >
          &times;
        </button>
      </div>
    </div>
  );
};

export default Toast;
