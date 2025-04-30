# GridLabs UI Components

A collection of reusable UI components for GridLabs applications.

## Components

- Button: A versatile button component with various styles and sizes

## Installation

```bash
npm install gridlabs-ui-components
```

## Usage

```jsx
import { Button } from 'gridlabs-ui-components';

function App() {
  return (
    <Button 
      text="Click Me" 
      variant="primary" 
      size="medium" 
      onClick={() => console.log('Button clicked!')}
    />
  );
}
```

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the components: `npm run build`
