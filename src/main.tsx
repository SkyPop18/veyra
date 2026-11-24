import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Automatically forward from temporary or preview domains to the canonical production domain
if (typeof window !== 'undefined') {
  const host = window.location.hostname;
  if (host.includes('akshatkhushi2020-gmailcoms-projects.vercel.app')) {
    window.location.replace(
      `https://veyra-global.vercel.app${window.location.pathname}${window.location.search}${window.location.hash}`
    );
  }
}

createRoot(document.getElementById('root')!).render(<App />);
