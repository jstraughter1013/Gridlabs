import React from 'react';

interface CardProps {
  title: string;
  content: string;
  footer?: string;
  variant?: 'default' | 'outlined' | 'elevated';
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  title,
  content,
  footer,
  variant = 'default',
  onClick,
}) => {
  const baseClasses = 'rounded-lg overflow-hidden transition-shadow';
  
  const variantClasses = {
    default: 'bg-white border border-gray-200',
    outlined: 'bg-white border-2 border-blue-500',
    elevated: 'bg-white shadow-lg hover:shadow-xl',
  };
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${
    onClick ? 'cursor-pointer' : ''
  }`;

  return (
    <div 
      className={classes} 
      onClick={onClick}
      data-testid="gridlabs-card"
    >
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      </div>
      <div className="px-4 py-5 sm:p-6 text-gray-700">
        {content}
      </div>
      {footer && (
        <div className="px-4 py-4 sm:px-6 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
