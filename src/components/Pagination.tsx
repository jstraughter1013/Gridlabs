import React from 'react';

interface PaginationProps {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  showPageNumbers?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'simple' | 'detailed';
}

/**
 * Pagination component for navigating through multiple pages of content
 */
const Pagination: React.FC<PaginationProps> = ({
  totalPages,
  currentPage,
  onPageChange,
  showPageNumbers = true,
  size = 'medium',
  variant = 'detailed',
}) => {
  // Size classes
  const sizeClasses = {
    small: 'h-8 w-8 text-sm',
    medium: 'h-10 w-10 text-base',
    large: 'h-12 w-12 text-lg',
  };

  // Button styles
  const buttonBase = 
    `inline-flex items-center justify-center border border-gray-300 
     bg-white ${sizeClasses[size]} rounded-md 
     hover:bg-gray-50 focus:z-20 focus:outline-offset-0`;
  
  const activeButton = 
    `inline-flex items-center justify-center border border-blue-500 
     bg-blue-50 ${sizeClasses[size]} text-blue-600 rounded-md
     hover:bg-blue-100 focus:z-20 focus:outline-offset-0`;
  
  const disabledButton = 
    `inline-flex items-center justify-center border border-gray-200 
     bg-gray-50 ${sizeClasses[size]} text-gray-400 rounded-md 
     cursor-not-allowed`;

  // Generate page numbers to display
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    if (currentPage <= 3) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    
    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  // Render the pagination component
  return (
    <nav className="flex items-center justify-between border-t border-gray-200 px-4 sm:px-0" data-testid="gridlabs-pagination">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={currentPage === 1 ? disabledButton : buttonBase}
          aria-label="Previous page"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={currentPage === totalPages ? disabledButton : buttonBase}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
      
      {variant === 'detailed' && (
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing page <span className="font-medium">{currentPage}</span> of{' '}
              <span className="font-medium">{totalPages}</span>
            </p>
          </div>
          
          <div>
            <ul className="isolate inline-flex -space-x-px rounded-md shadow-sm">
              <li>
                <button
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`${currentPage === 1 ? disabledButton : buttonBase} rounded-l-md px-2`}
                  aria-label="Previous page"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </li>
              
              {showPageNumbers && 
                getPageNumbers().map((page, index) => (
                  <li key={index}>
                    {page === '...' ? (
                      <span className={`${buttonBase} cursor-default`}>...</span>
                    ) : (
                      <button
                        onClick={() => onPageChange(page as number)}
                        className={page === currentPage ? activeButton : buttonBase}
                        aria-current={page === currentPage ? 'page' : undefined}
                      >
                        {page}
                      </button>
                    )}
                  </li>
                ))
              }
              
              <li>
                <button
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={`${currentPage === totalPages ? disabledButton : buttonBase} rounded-r-md px-2`}
                  aria-label="Next page"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}
      
      {variant === 'simple' && (
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-center">
          <div>
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`${currentPage === 1 ? disabledButton : buttonBase} rounded-l-md px-3`}
              aria-label="Previous page"
            >
              <span className="sr-only">Previous</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>
            
            <span className={`${buttonBase} cursor-default px-4`}>
              {currentPage} / {totalPages}
            </span>
            
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`${currentPage === totalPages ? disabledButton : buttonBase} rounded-r-md px-3`}
              aria-label="Next page"
            >
              <span className="sr-only">Next</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Pagination;
