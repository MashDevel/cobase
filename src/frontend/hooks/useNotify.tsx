import { useState, useEffect } from 'react';

export function useNotify(duration = 1500) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (message) {
      const timeout = setTimeout(() => setMessage(null), duration);
      return () => clearTimeout(timeout);
    }
  }, [message, duration]);

  return {
    message,
    notify: (msg: string) => setMessage(msg),
  };
}
