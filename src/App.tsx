import { Routes, Route } from 'react-router-dom';
import Landing from './components/Landing';
import GridView from './__grid/GridView';
import Preview from './__grid/Preview';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      {/* grid */}
      <Route path="__grid" element={<GridView />} />
      <Route path="__grid/preview" element={<Preview />} />

      {/* catch-all */}
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}

export default App;