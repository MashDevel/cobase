import ReactDOM from 'react-dom/client';
import ShellApp from './shell/ShellApp';
import './index.css';

const saved = localStorage.getItem('theme');
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
const isDark = saved === 'dark' || (saved !== 'light' && prefersDark);
document.documentElement.classList.toggle('dark', isDark);
document.documentElement.classList.toggle('darwin', navigator.platform.includes('Mac'));

ReactDOM.createRoot(document.getElementById('root')!).render(<ShellApp />);
