import React from 'react';

interface TagProps {
  text: string;
  color?: 'gray' | 'red' | 'yellow' | 'green' | 'blue' | 'indigo' | 'purple' | 'pink';
  size?: 'small' | 'medium' | 'large';
  rounded?: boolean;
  removable?: boolean;
  onRemove?: () => void;
}

const Tag: React.FC<TagProps> = ({
  text,
  color = 'blue',
  size = 'medium',
  rounded = true,
  removable = false,
  onRemove,
}) => {
  // Color variants
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    purple: 'bg-purple-100 text-purple-800',
    pink: 'bg-pink-100 text-pink-800',
  };
  
  // Size variants
  const sizeClasses = {
    small: 'text-xs px-2 py-0.5',
    medium: 'text-sm px-2.5 py-0.5',
    large: 'text-base px-3 py-1',
  };
  
  // Rounding
  const roundedClass = rounded ? 'rounded-full' : 'rounded';
  
  return (
    <span 
      className={`inline-flex items-center font-medium ${colorClasses[color]} ${sizeClasses[size]} ${roundedClass}`}
      data-testid="gridlabs-tag"
    >
      {text}
      
      {removable && (
        <button
          type="button"
          className={`ml-1.5 inline-flex items-center justify-center rounded-full hover:bg-${color}-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${color}-500`}
          onClick={onRemove}
          aria-label={`Remove ${text}`}
          data-testid="gridlabs-tag-remove"
        >
          <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
            <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
          </svg>
        </button>
      )}
    </span>
  );
};

export default Tag;
