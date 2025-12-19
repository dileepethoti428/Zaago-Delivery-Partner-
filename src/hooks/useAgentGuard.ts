import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { agentSession } from '@/utils/agentSession';
import { cleanupOnLogout } from '@/utils/logoutCleanup';
import { toast } from '@/hooks/use-toast';

export function useAgentGuard() {
  const navigate = useNavigate();
  const { user, session } = useAuthStore();

  useEffect(() => {
    // Only run if we have a session
    if (!session || !user) return;

    const storedAgentId = agentSession.getCurrentAgentId();
    const currentUserId = user.id;

    // Check for mismatch
    if (storedAgentId && storedAgentId !== currentUserId) {
      console.error('⚠️ Agent ID mismatch detected!');
      console.log(`Stored: ${storedAgentId}, Current: ${currentUserId}`);

      toast({
        title: 'Session Conflict',
        description: 'Please log in again',
        variant: 'destructive',
      });

      cleanupOnLogout().then(() => {
        navigate('/login', { replace: true });
      });
    }
  }, [user, session, navigate]);
}
