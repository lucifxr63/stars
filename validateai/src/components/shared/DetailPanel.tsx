import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function DetailPanel({ isOpen, onClose, title, children }: DetailPanelProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkMedia = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkMedia();
    window.addEventListener('resize', checkMedia);
    return () => window.removeEventListener('resize', checkMedia);
  }, []);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            {/* Backdrop */}
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            {/* Content */}
            <Dialog.Content asChild>
              <motion.div
                initial={isDesktop ? { x: '100%', y: 0 } : { y: '100%', x: 0 }}
                animate={{ x: 0, y: 0 }}
                exit={isDesktop ? { x: '100%', y: 0 } : { y: '100%', x: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`fixed z-50 bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10 flex flex-col focus:outline-none
                  ${isDesktop 
                    ? 'inset-y-0 right-0 h-full w-full max-w-lg border-l shadow-2xl' 
                    : 'inset-x-0 bottom-0 h-[85vh] rounded-t-3xl border-t shadow-[0_-8px_30px_rgb(0,0,0,0.12)]'
                  }`}
              >
                {/* Mobile Drag Handle Placeholder */}
                {!isDesktop && (
                  <div className="flex justify-center pt-3 pb-2 cursor-grab">
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full" />
                  </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5 shrink-0">
                  <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-slate-100">
                    {title}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 transition"
                      aria-label="Close"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </Dialog.Close>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
