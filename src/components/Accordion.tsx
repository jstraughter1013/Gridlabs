import React, { useState } from 'react';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

/**
 * AccordionItem component for use within the Accordion
 */
const AccordionItem: React.FC<AccordionItemProps> = ({ 
  title, 
  children, 
  defaultOpen = false 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-md mb-2">
      <button
        className="w-full flex justify-between items-center p-4 text-left"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        data-testid="gridlabs-accordion-header"
      >
        <span className="font-medium">{title}</span>
        <svg
          className={`w-5 h-5 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div 
        className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 p-4 pt-0' : 'max-h-0'}`}
        aria-hidden={!isOpen}
        data-testid="gridlabs-accordion-content"
      >
        {isOpen && children}
      </div>
    </div>
  );
};

interface AccordionProps {
  children: React.ReactNode;
  allowMultiple?: boolean;
  className?: string;
}

// Define the component type with the static Item property
type AccordionComponent = React.FC<AccordionProps> & {
  Item: React.FC<AccordionItemProps>;
};

/**
 * Accordion component for collapsible content panels
 */
const Accordion: AccordionComponent = ({ 
  children,
  allowMultiple = false, 
  className = ''
}) => {
  return (
    <div className={`gridlabs-accordion ${className}`} data-testid="gridlabs-accordion">
      {children}
    </div>
  );
};

// Assign the AccordionItem as a static property
Accordion.Item = AccordionItem;

export default Accordion;
