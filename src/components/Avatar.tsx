// smoke-test preview – 2025-04-30T23:50Z

import React from 'react';

interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'circle' | 'rounded' | 'square';
  status?: 'online' | 'offline' | 'busy' | 'away';
  initials?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  size = 'medium',
  variant = 'circle',
  status,
  initials,
}) => {
  const sizeClasses = {
    small: 'h-8 w-8 text-xs',
    medium: 'h-10 w-10 text-sm',
    large: 'h-14 w-14 text-base',
  };
  
  const variantClasses = {
    circle: 'rounded-full',
    rounded: 'rounded-lg',
    square: 'rounded-none',
  };
  
  const initialsClasses = 'flex items-center justify-center bg-gray-200 text-gray-600 font-medium';
  
  // Determine component to render (image or initials)
  const content = src ? (
    <img 
      src={src} 
      alt={alt} 
      className={`${sizeClasses[size]} ${variantClasses[variant]} object-cover`}
      data-testid="gridlabs-avatar-img"
    />
  ) : (
    <div 
      className={`${sizeClasses[size]} ${variantClasses[variant]} ${initialsClasses}`}
      aria-label={alt}
      data-testid="gridlabs-avatar-initials"
    >
      {initials}
    </div>
  );
  
  // Container for avatar with optional status indicator
  return (
    <div className="relative inline-block">
      {content}
      
      {status && (
        <span 
          className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white
            ${status === 'online' ? 'bg-green-400' : 
              status === 'offline' ? 'bg-gray-400' : 
              status === 'busy' ? 'bg-red-400' : 
              'bg-yellow-400'}`}
          data-testid="gridlabs-avatar-status"
        />
      )}
    </div>
  );
};

export default Avatar;
