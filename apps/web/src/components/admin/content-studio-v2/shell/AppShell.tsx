import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Toaster } from '../primitives/Toaster';

interface AppShellProps {
  children: ReactNode;
  userEmail?: string;
  userInitials?: string;
}

/**
 * Standard shell layout for any v2 mode page (home/create/library/plan).
 * Sidebar fixe à gauche, topbar fixe en haut, contenu scrollable au
 * milieu. Toaster monté une seule fois pour tout le module.
 */
export function AppShell({ children, userEmail, userInitials }: AppShellProps) {
  return (
    <div className="cs-app" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar userEmail={userEmail} userInitials={userInitials} />
        <main
          style={{
            flex: 1,
            background: 'var(--cs-bg-sunken)',
            padding: '32px 36px',
            overflowY: 'auto',
          }}
        >
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
