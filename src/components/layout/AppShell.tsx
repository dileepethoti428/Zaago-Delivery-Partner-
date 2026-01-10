import { ReactNode } from 'react';
import { ZaagoHeader } from './ZaagoHeader';
import { TabBar } from './TabBar';
import { motion } from 'framer-motion';

interface AppShellProps {
  children: ReactNode;
  showTabBar?: boolean;
}

export function AppShell({ children, showTabBar = true }: AppShellProps) {
  // Location sync is now handled centrally in AppProviders via useLocationSyncController

  return (
    <div className="min-h-screen bg-background">
      <ZaagoHeader />
      
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="container pt-14 pb-20 px-4"
      >
        {children}
      </motion.main>
      
      {showTabBar && <TabBar />}
    </div>
  );
}
