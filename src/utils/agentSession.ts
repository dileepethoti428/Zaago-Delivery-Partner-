const AGENT_SESSION_KEY = 'zaago_current_agent_id';

export const agentSession = {
  getCurrentAgentId: (): string | null => {
    return localStorage.getItem(AGENT_SESSION_KEY);
  },
  
  setCurrentAgentId: (agentId: string): void => {
    localStorage.setItem(AGENT_SESSION_KEY, agentId);
  },
  
  clearCurrentAgentId: (): void => {
    localStorage.removeItem(AGENT_SESSION_KEY);
  },
  
  isCurrentAgent: (agentId: string): boolean => {
    const stored = localStorage.getItem(AGENT_SESSION_KEY);
    return stored === agentId;
  },
};
