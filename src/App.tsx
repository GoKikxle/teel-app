import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Nav } from './components/Nav';
import { Home } from './pages/Home';
import { SignIn } from './pages/SignIn';
import { Create } from './pages/Create';
import { Created } from './pages/Created';
import { Detail } from './pages/Detail';
import { Edit } from './pages/Edit';
import { SplitBillCreate } from './pages/SplitBillCreate';
import { ClosedItems } from './pages/ClosedItems';
import { PollCreate } from './pages/PollCreate';
import { PollVote } from './pages/PollVote';
import { PollOrganize } from './pages/PollOrganize';

function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/create" element={<Create />} />
        <Route path="/split/create" element={<SplitBillCreate />} />
        <Route path="/created/:id" element={<Created />} />
        <Route path="/closed" element={<ClosedItems />} />
        <Route path="/g/:id" element={<Detail />} />
        <Route path="/g/:id/edit" element={<Edit />} />
        <Route path="/poll/new" element={<PollCreate />} />
        <Route path="/p/:id" element={<PollVote />} />
        <Route path="/poll/:id/organize" element={<PollOrganize />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
