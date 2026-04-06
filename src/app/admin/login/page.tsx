import LoginScreen from '@/components/admin/LoginScreen';

export const metadata = { title: '後台登入 — 大師修' };

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <LoginScreen />
    </div>
  );
}
