import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Nav } from './components/Nav';
import { Board } from './pages/Board';
import { Create } from './pages/Create';
import { Created } from './pages/Created';
import { Detail } from './pages/Detail';
import { Edit } from './pages/Edit';

function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Board />} />
        <Route path="/create" element={<Create />} />
        <Route path="/created/:id" element={<Created />} />
        <Route path="/g/:id" element={<Detail />} />
        <Route path="/g/:id/edit" element={<Edit />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
