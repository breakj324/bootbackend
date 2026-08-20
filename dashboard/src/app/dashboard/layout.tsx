'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Tag, 
  Rocket, 
  Users, 
  Bot,
  LogOut,
  Bell,
  Sparkles
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Vue Générale', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Codes Promo', href: '/dashboard/promocodes', icon: Tag },
    { name: 'Ordres & Campagnes', href: '/dashboard/orders', icon: Rocket },
    { name: 'Joueurs & Vérifications', href: '/dashboard/claims', icon: Users },
    { name: 'Simulateur Bot', href: '/dashboard/simulator', icon: Bot },
  ];

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Sparkles size={18} color="#fff" />
          </div>
          <span>AFFILIATE HUB</span>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                className={`sidebar-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar">AM</div>
          <div className="user-info">
            <span className="user-name">Affiliate Manager</span>
            <span className="user-role">Gambling Operations</span>
          </div>
          <Link href="/" style={{ marginLeft: 'auto', display: 'flex', color: 'var(--text-muted)' }} className="btn-icon">
            <LogOut size={16} />
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        <header className="header">
          <div className="header-title-container">
            <h1 className="header-title">Gambling Affiliate Control Center</h1>
            <p className="header-subtitle">Gestion automatique des codes promo, ordres de comptes &amp; bot Telegram</p>
          </div>

          <div className="header-actions">
            <div className="badge-wrapper">
              <button className="btn-icon" aria-label="Notifications">
                <Bell size={18} />
              </button>
              <div className="badge-dot" />
            </div>
          </div>
        </header>

        <main className="content-body">
          {children}
        </main>
      </div>
    </div>
  );
}
