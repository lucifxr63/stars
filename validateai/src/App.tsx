import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ProtectedLayout, AppLayout } from '@/app/layout';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { ThemeProvider } from 'next-themes';

// Public routes
const Landing          = lazy(() => import('@/app/routes/Landing').then((m) => ({ default: m.Landing })));
const Login            = lazy(() => import('@/app/routes/Login').then((m) => ({ default: m.Login })));
const ForgotPassword   = lazy(() => import('@/app/routes/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword    = lazy(() => import('@/app/routes/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const AuthCallback     = lazy(() => import('@/app/routes/AuthCallback').then((m) => ({ default: m.AuthCallback })));
const SharedValidation = lazy(() => import('@/app/routes/SharedValidation').then((m) => ({ default: m.SharedValidation })));
const SurveyRespond    = lazy(() => import('@/app/routes/SurveyRespond').then((m) => ({ default: m.SurveyRespond })));
const Pricing          = lazy(() => import('@/app/routes/Pricing').then((m) => ({ default: m.Pricing })));
const Demo             = lazy(() => import('@/app/routes/Demo').then((m) => ({ default: m.Demo })));
const FigmaCallback      = lazy(() => import('@/app/routes/FigmaCallback').then((m) => ({ default: m.FigmaCallback })));
const LinkedInCallback   = lazy(() => import('@/app/routes/LinkedInCallback').then((m) => ({ default: m.LinkedInCallback })));
const PrivacyPolicy      = lazy(() => import('@/app/routes/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })));
const Terms              = lazy(() => import('@/app/routes/Terms').then((m) => ({ default: m.Terms })));
const AIPolicy           = lazy(() => import('@/app/routes/AIPolicy').then((m) => ({ default: m.AIPolicy })));
const VCDiligence        = lazy(() => import('@/app/routes/VCDiligence').then((m) => ({ default: m.VCDiligence })));

// Protected — standalone (no sidebar)
const Onboarding = lazy(() => import('@/app/routes/Onboarding').then((m) => ({ default: m.Onboarding })));
const Validate   = lazy(() => import('@/app/routes/Validate').then((m) => ({ default: m.Validate })));

// Protected — app layout (con sidebar)
const Dashboard         = lazy(() => import('@/app/routes/Dashboard').then((m) => ({ default: m.Dashboard })));
const Results           = lazy(() => import('@/app/routes/Results').then((m) => ({ default: m.Results })));
const ValidationDetail  = lazy(() => import('@/app/routes/ValidationDetail').then((m) => ({ default: m.ValidationDetail })));
const IdeaHistory       = lazy(() => import('@/app/routes/IdeaHistory').then((m) => ({ default: m.IdeaHistory })));
const MarketStudy       = lazy(() => import('@/app/routes/MarketStudy').then((m) => ({ default: m.MarketStudy })));
const MarketIntelligence = lazy(() => import('@/app/routes/MarketIntelligence').then((m) => ({ default: m.MarketIntelligence })));
const MyStartup         = lazy(() => import('@/app/routes/MyStartup').then((m) => ({ default: m.MyStartup })));
const Profile           = lazy(() => import('@/app/routes/Profile').then((m) => ({ default: m.Profile })));
const Developers        = lazy(() => import('@/app/routes/Developers').then((m) => ({ default: m.Developers })));
const Admin             = lazy(() => import('@/app/routes/Admin').then((m) => ({ default: m.Admin })));
const SurveyList        = lazy(() => import('@/app/routes/SurveyList').then((m) => ({ default: m.SurveyList })));
const SurveyBuilder     = lazy(() => import('@/app/routes/SurveyBuilder').then((m) => ({ default: m.SurveyBuilder })));
const SurveyResults     = lazy(() => import('@/app/routes/SurveyResults').then((m) => ({ default: m.SurveyResults })));
const CheckoutSuccess   = lazy(() => import('@/app/routes/CheckoutSuccess').then((m) => ({ default: m.CheckoutSuccess })));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
      <div className="w-8 h-8 border-2 border-[#0EB5C6] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0A0F] px-4">
      <div className="text-center max-w-sm">
        <p className="text-7xl font-black text-[#0EB5C6] mb-4">404</p>
        <h1 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-2">
          Página no encontrada
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-8">
          La URL que buscás no existe o fue movida.
        </p>
        <a
          href="/dashboard"
          className="inline-block px-6 py-3 bg-[#0EB5C6] text-white text-sm font-bold rounded-xl hover:bg-[#6B5EE6] transition-colors"
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}

import { isAnimusDomain } from '@/lib/domain';

export default function App() {
  const isAnimus = isAnimusDomain();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Rutas públicas */}
              <Route path="/"               element={isAnimus ? <Developers /> : <Landing />} />
              <Route path="/login"          element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password"  element={<ResetPassword />} />
              <Route path="/auth/callback"  element={<AuthCallback />} />
              <Route path="/shared/:token"  element={<SharedValidation />} />
              <Route path="/s/:slug"        element={<SurveyRespond />} />
              <Route path="/pricing"        element={<Pricing />} />
              <Route path="/demo"           element={<Demo />} />
              <Route path="/figma/callback"              element={<FigmaCallback />} />
              <Route path="/auth/linkedin/callback"      element={<LinkedInCallback />} />
              <Route path="/privacy-policy"              element={<PrivacyPolicy />} />
              <Route path="/terms"                      element={<Terms />} />
              <Route path="/ai-policy"                  element={<AIPolicy />} />
              <Route path="/vc-diligence"               element={<VCDiligence />} />

              {/* Rutas protegidas */}
              <Route element={<ProtectedLayout />}>
                {/* Standalone: sin sidebar */}
                <Route path="/onboarding"       element={<Onboarding />} />
                <Route path="/checkout/success" element={<CheckoutSuccess />} />

                {/* App: todas las rutas con sidebar via AppLayout */}
                <Route element={<AppLayout />}>
                  <Route path="/validate" element={<Validate />} />
                  <Route path="/dashboard"              element={isAnimus ? <Developers /> : <Dashboard />} />
                  <Route path="/market-intelligence"    element={<MarketIntelligence />} />
                  <Route path="/results"                element={<Results />} />
                  <Route path="/results/:id"            element={<ValidationDetail />} />
                  <Route path="/results/:id/history"    element={<IdeaHistory />} />
                  <Route path="/market/:validationId"   element={<MarketStudy />} />
                  <Route path="/startup"                element={<MyStartup />} />
                  <Route path="/profile"                element={<Profile />} />
                  <Route path="/developers"             element={<Developers />} />
                  <Route path="/animus"               element={<Developers />} />
                  <Route path="/animus/*"             element={<Developers />} />
                  <Route path="/admin"                  element={<Admin />} />
                  <Route path="/surveys"                element={<SurveyList />} />
                  <Route path="/surveys/new"            element={<SurveyBuilder />} />
                  <Route path="/surveys/:id/edit"       element={<SurveyBuilder />} />
                  <Route path="/surveys/:id/results"    element={<SurveyResults />} />
                </Route>
              </Route>

              {/* 404 — catch-all para URLs inválidas */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
