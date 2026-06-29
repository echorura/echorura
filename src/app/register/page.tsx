'use client';

import { useRouter } from 'next/navigation';
import AuthModal from '@/components/auth/AuthModal';

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <AuthModal 
        isOpen={true} 
        onClose={() => router.push('/')} 
        initialIsLogin={false} 
      />
    </div>
  );
}
