import AdminPanel from '@/components/admin/AdminPanel';

export const metadata = { title: '後台管理 — 大師修' };

export default function AdminPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <AdminPanel />
    </div>
  );
}
