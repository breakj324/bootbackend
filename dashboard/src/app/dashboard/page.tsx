'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { api, PromoCodeItem, CampaignOrder, PlayerClaimItem } from '@/lib/api';

export default function DashboardOverview() {
  const [promos, setPromos] = useState<PromoCodeItem[]>([]);
  const [orders, setOrders] = useState<CampaignOrder[]>([]);
  const [claims, setClaims] = useState<PlayerClaimItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [p, o, c] = await Promise.all([api.getPromoCodes(), api.getOrders(), api.getClaims()]);
      setPromos(p);
      setOrders(o);
      setClaims(c);
    } catch (err) {
      // Silently fail, show zeros
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const activePromos = promos.filter(p => p.isActive);
  const totalTarget = orders.reduce((s, o) => s + o.targetAccounts, 0);
  const totalClaimed = orders.reduce((s, o) => s + o.claimedCount, 0);
  const pct = totalTarget > 0 ? Math.round((totalClaimed / totalTarget) * 100) : 0;
  const pendingClaims = claims.filter(c => c.status === 'PENDING');
  const recentClaims = claims.slice(0, 3);

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div />
        <button onClick={loadAll} className="btn-icon" title="Rafraîchir les statistiques" style={{ padding: '0.6rem' }}>
          <RefreshCw size={18} color="var(--accent-secondary)" />
        </button>
      </div>

      {/* Cartes de stats depuis BD */}
      <section className="dashboard-grid">
        <div className="card card-gradient">
          <div className="card-header-simple">
            <span className="card-title">Codes Promo Actifs</span>
          </div>
          <div className="card-value">{isLoading ? '…' : `${activePromos.length} Code${activePromos.length !== 1 ? 's' : ''}`}</div>
          <div className="card-footer-text">
            {activePromos.length > 0
              ? activePromos.slice(0, 2).map(p => <><code key={p.id}>{p.code}</code> ({p.bookmaker}){' '}</>)
              : 'Aucun code actif en BD'}
          </div>
        </div>

        <div className="card card-gradient">
          <div className="card-header-simple">
            <span className="card-title">Ordres de Comptes</span>
          </div>
          <div className="card-value">{isLoading ? '…' : `${totalClaimed} / ${totalTarget}`}</div>
          <div className={`card-footer-text ${pct >= 75 ? 'trend-up' : ''}`}>
            {isLoading ? 'Chargement...' : `${pct}% des objectifs atteints sur Telegram`}
          </div>
        </div>

        <div className="card card-gradient">
          <div className="card-header-simple">
            <span className="card-title">Vérifications Joueurs</span>
          </div>
          <div className="card-value">{isLoading ? '…' : `${pendingClaims.length} En Attente`}</div>
          <div className="card-footer-text">
            {isLoading ? 'Chargement...' : `${claims.length} demandes totales en BD`}
          </div>
        </div>
      </section>

      {/* Bannière CTA */}
      <section className="card" style={{
        marginBottom: '3rem',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.15))',
        borderColor: 'rgba(99, 102, 241, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2rem'
      }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Lancer un Nouvel Ordre de Comptes</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px' }}>
            Selectionnez un code promo depuis la BD, entrez le nombre de comptes desires, et enregistrez l'ordre.
          </p>
        </div>
        <Link href="/dashboard/orders" className="btn-primary" style={{ width: 'auto', padding: '0.85rem 1.75rem' }}>
          <span>Creer un Ordre</span>
        </Link>
      </section>

      <section className="section-split">
        {/* Tableau des dernières réclamations depuis BD */}
        <div className="card table-card">
          <div className="table-title-bar">
            <h2 className="table-title">Dernieres Soumissions (BD)</h2>
            <Link href="/dashboard/claims" style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)', fontWeight: 600 }}>
              Voir tout
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>
            ) : recentClaims.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Aucune réclamation en BD. Le bot Telegram remplira cette liste.
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Joueur</th>
                    <th>ID Telegram</th>
                    <th>Code Promo</th>
                    <th>ID Bookmaker</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClaims.map((c) => (
                    <tr key={c.id}>
                      <td>{c.telegramName || c.telegramUsername || '—'}</td>
                      <td><code>{c.telegramChatId}</code></td>
                      <td><code style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{c.promoCode?.code}</code></td>
                      <td>{c.playerBookmakerId || '—'}</td>
                      <td>
                        <span className={`badge-status ${c.status === 'APPROVED' ? 'badge-success' : c.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>
                          {c.status === 'APPROVED' ? 'Approuve' : c.status === 'PENDING' ? 'En Attente' : 'Rejete'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Statut Bot Telegram */}
        <div className="card">
          <h2 className="table-title" style={{ marginBottom: '0.5rem' }}>Statut du Bot Telegram</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Integration Webhook et Queue BullMQ — toutes les données passent par la BD SQLite.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'Anti-Abus et Doublons', detail: 'Contrainte Unicite SQLite', active: true },
              { label: 'Stockage Persistant', detail: 'SQLite via Prisma ORM', active: true },
              { label: 'Extraction ID Telegram', detail: 'Automatique via Webhook', active: true },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem', background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'
              }}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>{item.label}</span>
                  <strong style={{ fontSize: '0.95rem' }}>{item.detail}</strong>
                </div>
                <span className={`badge-status ${item.active ? 'badge-success' : 'badge-danger'}`}>
                  {item.active ? 'Actif' : 'Inactif'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
