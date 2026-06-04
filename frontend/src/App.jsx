import { useState } from 'react';
import Home from './components/Home';
import Detective from './components/Detective';
import Ranking from './components/Ranking';
import Tutorial from './components/Tutorial';
import CompetitionMode from './components/CompetitionMode';
import CompetitionBigScreen from './components/CompetitionBigScreen';
import { useToast } from './hooks/useToast';

export default function App() {
  const [page, setPage] = useState('home');
  const { showToast, ToastContainer } = useToast();

  return (
    <>
      <ToastContainer />
      {page === 'home' && <Home onNavigate={setPage} />}
      {page === 'detective' && <Detective onBack={() => setPage('home')} showToast={showToast} />}
      {page === 'ranking' && <Ranking onBack={() => setPage('home')} />}
      {page === 'tutorial' && <Tutorial onBack={() => setPage('home')} />}
      {page === 'competition' && <CompetitionMode onBack={() => setPage('home')} showToast={showToast} />}
      {page === 'competition-big-screen' && <CompetitionBigScreen onBack={() => setPage('home')} />}
    </>
  );
}
