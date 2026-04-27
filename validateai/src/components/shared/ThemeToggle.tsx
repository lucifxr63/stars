import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-xl border border-gray-200 dark:border-white/10 
                 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-900 dark:text-[#F0EFF8] 
                 bg-white hover:bg-gray-50 dark:bg-transparent dark:hover:bg-gray-100 dark:bg-white/5 
                 transition-all"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
