import { useEffect, useState } from 'react';

interface NotifyProps {
  message: string | null;
}

export default function Notify({ message }: NotifyProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);

      const timeout = setTimeout(() => setVisible(false), 1200);
      return () => clearTimeout(timeout);
    } else {
      setVisible(false);
    }
  }, [message]);

  return (
    <div
      className={`
        fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2
        bg-neutral-800 text-white px-12 py-8 text-lg rounded-lg shadow-2xl z-50
        transition-opacity duration-300 ease-in-out border border-neutral-500
        ${message && visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
    >
      {message}
    </div>
  );
}
