import React from 'react';

interface BadgeProps {
  text: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'small' | 'medium' | 'large';
  rounded?: boolean;
}

const Badge: React.FC<BadgeProps> = ({
  text,
  variant = 'primary',
  size = 'medium',
  rounded = false,
}) => {
  const baseClasses = 'inline-flex items-center font-medium';
  
  const variantClasses = {
    primary: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-gray-100 text-gray-800',
  };
  
  const sizeClasses = {
    small: 'px-2 py-0.5 text-xs',
    medium: 'px-2.5 py-0.5 text-sm',
    large: 'px-3 py-1 text-base',
  };
  
  const roundedClasses = rounded ? 'rounded-full' : 'rounded';
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${roundedClasses}`;

  return (
    <span className={classes} data-testid="gridlabs-badge">
      {text}
    </span>
  );
};

export default Badge;
