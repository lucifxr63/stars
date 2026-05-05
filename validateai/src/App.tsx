import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ProtectedLayout } from '@/app/layout';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { ThemeProvider } from 'next-themes';

const Landing = lazy(() => import('@/app/routes/Landing').then((m) => ({ default: m.Landing })));
const Login = lazy(() => import('@/app/routes/Login').then((m) => ({ default: m.Login })));
const Validate = lazy(() => import('@/app/routes/Validate').then((m) => ({ default: m.Validate })));
const Results = lazy(() => import('@/app/routes/Results').then((m) => ({ default: m.Results })));
const ValidationDetail = lazy(() => import('@/app/routes/ValidationDetail').then((m) => ({ default: m.ValidationDetail })));
const AuthCallback = lazy(() => import('@/app/routes/AuthCallback').then((m) => ({ default: m.AuthCallback })));
const Admin = lazy(() => import('@/app/routes/Admin').then((m) => ({ default: m.Admin })));
const SharedValidation = lazy(() => import('@/app/routes/SharedValidation').then((m) => ({ default: m.SharedValidation })));
const IdeaHistory = lazy(() => import('@/app/routes/IdeaHistory').then((m) => ({ default: m.IdeaHistory })))
const MarketStudy = lazy(() => import('@/app/routes/MarketStudy').then((m) => ({ default: m.MarketStudy })));
const Pricing = lazy(() => import('@/app/routes/Pricing').then((m) => ({ default: m.Pricing })));
const Demo = lazy(() => import('@/app/routes/Demo').then((m) => ({ default: m.Demo })));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
      <div className="w-8 h-8 border-2 border-[#7C6FF7] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ErrorBoundary>
      <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/validate" element={<Validate />} />
            <Route path="/results" element={<Results />} />
            <Route path="/results/:id" element={<ValidationDetail />} />
            <Route path="/results/:id/history" element={<IdeaHistory />} />
            <Route path="/market/:validationId" element={<MarketStudy />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route path="/shared/:token" element={<SharedValidation />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/demo" element={<Demo />} />
        </Routes>
      </Suspense>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
    </ErrorBoundary>
    </ThemeProvider>
  );
}
