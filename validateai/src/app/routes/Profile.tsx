import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FounderProfileTab } from '@/components/shared/FounderProfileTab';

export function Profile() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#0A0A0F]">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#F0EFF8]">Perfil del Fundador</h1>
          <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mt-1">
            Tu experiencia enriquece el análisis de Founder-Market Fit en cada validación.
          </p>
        </div>
        <div className="bg-white dark:bg-[#12121A] rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
          <FounderProfileTab />
        </div>
      </main>
      <Footer />
    </div>
  );
}
