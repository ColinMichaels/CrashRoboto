import { createRoot } from 'react-dom/client';
import { GameBootstrap } from './app/GameBootstrap';
import './styles.css';

createRoot(document.getElementById('root')!).render(<GameBootstrap />);
