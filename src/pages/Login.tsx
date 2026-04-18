import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Activity, Hammer, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Custom Logo Component: Bone & Screw (High Fidelity)
const BoneScrewLogo = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Screw (Behind) - Bottom Left Part (Threaded Tip) */}
    {/* Main Shaft Segment */}
    <path d="M28 72 L42 58" />
    {/* Pointed Tip */}
    <path d="M28 72 L22 78" />
    {/* Threads - Crisp angled lines */}
    <path d="M29 77 L33 73" />
    <path d="M33 73 L37 69" />
    <path d="M37 69 L41 65" />
    <path d="M41 65 L45 61" />

    {/* Screw (Behind) - Top Right Part (Head) */}
    {/* Main Shaft Segment */}
    <path d="M58 42 L72 28" />
    {/* Screw Head (Nail-like flat head) */}
    <line x1="68" y1="24" x2="76" y2="32" strokeWidth="3" />

    {/* Bone (Foreground) - Clean Symmetric Shape */}
    <path d="M 40 26 C 34 26 32 16 40 16 C 44 16 48 20 50 24 C 52 20 56 16 60 16 C 68 16 66 26 60 26 Q 56 26 56 50 Q 56 74 60 74 C 66 74 68 84 60 84 C 56 84 52 80 50 76 C 48 80 44 84 40 84 C 32 84 34 74 40 74 Q 44 74 44 50 Q 44 26 40 26 Z" />
  </svg>
);

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const success = await login(email, password);

    if (!success) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Left Side - Branding & Visuals (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#0c4a6e] via-[#0284c7] to-[#38bdf8] relative overflow-hidden flex-col justify-center items-center text-white p-12">
        {/* Abstract Medical Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <Activity className="absolute top-10 left-10 w-64 h-64 transform -rotate-12 text-white" />
          <Hammer className="absolute bottom-20 right-10 w-48 h-48 transform rotate-12 text-white opacity-20" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full border-8 border-white/20 opacity-30" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border-[20px] border-white/10 opacity-10" />
          <AlertCircle className="absolute bottom-40 left-20 w-32 h-32 opacity-30 text-white" />
        </div>

        {/* Glassmorphism Branding Card */}
        <div className="bg-card rounded-2xl shadow-xl border border-border/20 p-8 text-center max-w-lg animate-fade-in relative z-10 bg-white/10 backdrop-blur-md border-white/20">
          <div className="bg-white p-4 rounded-2xl inline-flex mb-8 shadow-lg">
            <BoneScrewLogo className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-6 font-[Tajawal] text-white">
            شركة الدلتا للمستلزمات الطبية
          </h1>
          <p className="text-xl text-white/95 font-medium leading-relaxed font-[Tajawal]">
            نظام متكامل لإدارة المستلزمات الطبية، العمليات الجراحية، والمخزون بكفاءة عالية واحترافية.
          </p>
        </div>

        {/* Footer on the branding side */}
        <div className="absolute bottom-8 text-white/80 text-sm font-[Tajawal]">
          © {new Date().getFullYear()} جميع الحقوق محفوظة
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 animate-slide-in-up">
          {/* Mobile Logo (Visible only on small screens) */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg">
              <BoneScrewLogo className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-foreground font-[Tajawal]">
              شركة الدلتا للمستلزمات الطبية
            </h1>
          </div>

          <div className="bg-card rounded-2xl shadow-xl border border-border p-8">
            <div className="text-center mb-8">
              {/* Added Logo for Desktop within the White Card */}
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 text-primary mb-6 animate-fade-in mx-auto transition-transform hover:scale-105 duration-300">
                <BoneScrewLogo className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-foreground font-[Tajawal]">تسجيل الدخول</h2>
              <p className="text-muted-foreground mt-2 font-[Tajawal]">مرحباً بعودتك، يرجى إدخال بياناتك للمتابعة</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm animate-fade-in border border-destructive/20">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground font-[Tajawal]">
                  البريد الإلكتروني
                </label>
                <div className="relative group">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 text-primary/80 group-focus-within:text-primary transition-colors duration-300" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@hospital.com"
                    required
                    className="w-full h-[72px] pr-12 pl-4 rounded-2xl border border-input bg-background/50 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-300 shadow-sm text-lg"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground font-[Tajawal]">
                  كلمة المرور
                </label>
                <div className="relative group">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 text-primary/80 group-focus-within:text-primary transition-colors duration-300" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-[72px] pr-12 pl-12 rounded-2xl border border-input bg-background/50 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-300 shadow-sm text-lg"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-secondary text-primary/80 hover:text-primary transition-all duration-200"
                  >
                    {showPassword ? (
                      <EyeOff className="w-6 h-6" />
                    ) : (
                      <Eye className="w-6 h-6" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="remember"
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <label htmlFor="remember" className="text-base text-muted-foreground font-[Tajawal] cursor-pointer select-none hover:text-foreground transition-colors">
                  تذكرني
                </label>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-[72px] text-xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300 bg-primary hover:bg-[#0284c7] active:scale-[0.98] rounded-2xl font-[Tajawal]"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري تسجيل الدخول...</span>
                  </div>
                ) : (
                  'تسجيل الدخول'
                )}
              </Button>
            </form>
          </div>

          {/* Footer */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground font-[Tajawal]">
              تطوير وبرمجة:{' '}
              <a
                href="https://wathqq.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-primary hover:text-primary/80 transition-colors"
              >
                وثق Wathqq
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
