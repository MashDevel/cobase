import { useState, useEffect } from 'react';
import { SunIcon, MoonIcon } from 'lucide-react';

export default function ThemeToggle() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <button
      type="button"
      onClick={() => setDarkMode((dm) => !dm)}
      className="p-2 rounded-full bg-transparent border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-transform transform hover:scale-110 ease-in-out focus:outline-none"
    >
      {darkMode ? (
        <SunIcon className="h-6 w-6 text-neutral-400" />
      ) : (
        <MoonIcon className="h-6 w-6 text-neutral-600" />
      )}
    </button>
  );
}
