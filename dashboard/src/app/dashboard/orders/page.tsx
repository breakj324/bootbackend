'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Rocket, Plus, Play, Pause, Trash2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { api, CampaignOrder, PromoCodeItem } from '@/lib/api';

export default function OrdersPage() {
  const [orders, setOrders] = useState<CampaignOrder[]>([]);
  const [promos, setPromos] = useState<PromoCodeItem[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState('');
  const [targetAccounts, setTargetAccounts] = useState<number>(20);
  const [conditions, setConditions] = useState('Inscrivez-vous avec le code promo et répondez avec votre ID joueur.');
  const [isLaunching, setIsLaunching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ordersData, promosData] = await Promise.all([
        api.getOrders(),
        api.getPromoCodes(),
      ]);
      setOrders(ordersData);
      setPromos(promosData.filter(p => p.isActive));
      if (promosData.length > 0 && !selectedPromoId) {
        setSelectedPromoId(promosData[0].id);
      }
    } catch (err: any) {
      setError('Impossible de charger les données. Vérifiez la connexion au serveur backend API.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPromoId || !targetAccounts || targetAccounts <= 0) return;
    setIsLaunching(true);
    setError(null);
    try {
      const newOrder = await api.createOrder({
        promoCodeId: selectedPromoId,
        targetAccounts: Number(targetAccounts),
        freeDepositConditions: conditions,
      });
      setOrders([newOrder, ...orders]);
      const promo = promos.find(p => p.id === selectedPromoId);
      showSuccess(`🚀 Ordre lancé ! Le bot attend ${targetAccounts} joueurs pour le code "${promo?.code}".`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de l\'ordre.');
    } finally {
      setIsLaunching(false);
    }
  };

  const toggleOrderStatus = async (order: CampaignOrder) => {
    const nextStatus = order.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const updated = await api.updateOrderStatus(order.id, nextStatus);
      setOrders(orders.map(o => o.id === order.id ? updated : o));
    } catch (err: any) {
      setError(err.message || 'Erreur lors du changement de statut.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet ordre ?')) return;
    try {
      await api.deleteOrder(id);
      setOrders(orders.filter(o => o.id !== id));
      showSuccess('Ordre supprimé.');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Ordres de Comptes &amp; Campagnes</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Créez vos demandes de comptes par code promo et lancez la distribution automatique via le Bot Telegram
          </p>
        </div>
        <button onClick={loadData} className="btn-icon" title="Rafraîchir" style={{ padding: '0.6rem' }}>
          <RefreshCw size={18} color="var(--accent-secondary)" />
        </button>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem',
          color: '#fca5a5', fontSize: '0.9rem'
        }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {successMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
          borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem',
          color: '#86efac', fontSize: '0.9rem'
        }}>
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      <div className="section-split">
        {/* Liste des Ordres */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Rocket size={18} color="var(--accent-primary)" />
            Campagnes en base ({orders.length})
          </h3>

          {isLoading ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={20} style={{ marginBottom: '0.5rem' }} />
              <p>Chargement depuis la base de données...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Rocket size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>Aucun ordre en base. Créez-en un !</p>
            </div>
          ) : (
            orders.map((order) => {
              const percentage = order.targetAccounts > 0
                ? Math.min(100, Math.round((order.claimedCount / order.targetAccounts) * 100))
                : 0;
              return (
                <div key={order.id} className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-secondary)', fontWeight: 700 }}>
                        {order.promoCode?.bookmaker} • #{order.id.slice(0, 8)}
                      </span>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.2rem' }}>
                        Code: <code style={{ color: 'var(--accent-primary)' }}>{order.promoCode?.code}</code>
                      </h4>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className={`badge-status ${order.status === 'ACTIVE' ? 'badge-success' : order.status === 'PAUSED' ? 'badge-warning' : 'badge-danger'}`}>
                        {order.status === 'ACTIVE' ? 'Actif' : order.status === 'PAUSED' ? 'En Pause' : 'Terminé'}
                      </span>
                      {order.status !== 'COMPLETED' && (
                        <button className="btn-icon" onClick={() => toggleOrderStatus(order)} title={order.status === 'ACTIVE' ? 'Pause' : 'Réactiver'}>
                          {order.status === 'ACTIVE'
                            ? <Pause size={16} color="var(--color-warning)" />
                            : <Play size={16} color="var(--color-success)" />}
                        </button>
                      )}
                      <button className="btn-icon" onClick={() => handleDelete(order.id)} title="Supprimer">
                        <Trash2 size={16} color="var(--color-danger)" />
                      </button>
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--bg-tertiary)', padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
                    color: 'var(--text-secondary)', marginBottom: '1.25rem',
                    borderLeft: '3px solid var(--accent-primary)'
                  }}>
                    <strong>Conditions :</strong> {order.freeDepositConditions}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {order.claimedCount} / {order.targetAccounts} joueurs enregistrés
                      </span>
                      <span style={{ color: 'var(--accent-secondary)', fontWeight: 700 }}>{percentage}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${percentage}%`, height: '100%',
                        background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                        borderRadius: '999px', transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Formulaire de création */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h3 className="table-title" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} color="var(--accent-secondary)" />
            Créer et Lancer un Ordre
          </h3>

          <form onSubmit={handleCreateOrder}>
            <div className="form-group">
              <label className="form-label" htmlFor="promo-selection">Code Promo (depuis la BD)</label>
              <select
                id="promo-selection"
                className="form-input"
                value={selectedPromoId}
                onChange={(e) => setSelectedPromoId(e.target.value)}
                required
              >
                {promos.length === 0 ? (
                  <option value="">— Aucun code actif en BD —</option>
                ) : (
                  promos.map(p => (
                    <option key={p.id} value={p.id}>{p.code} ({p.bookmaker})</option>
                  ))
                )}
              </select>
              {promos.length === 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-warning)', marginTop: '0.25rem', display: 'block' }}>
                  Ajoutez d'abord un code promo dans la page Codes Promo.
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="target-accounts-input">Nombre de Joueurs Souhaités</label>
              <input
                id="target-accounts-input"
                type="number"
                min="1"
                max="1000"
                className="form-input"
                placeholder="Exemple: 20"
                value={targetAccounts}
                onChange={(e) => setTargetAccounts(Number(e.target.value))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="conditions-input">Conditions du Dépôt Gratuit</label>
              <textarea
                id="conditions-input"
                className="form-textarea"
                placeholder="Conditions pour le joueur..."
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={isLaunching || promos.length === 0}>
              <Rocket size={16} />
              <span>{isLaunching ? 'Enregistrement en BD...' : 'Lancer l\'Ordre → Base de Données'}</span>
            </button>
          </form>

          <div style={{
            marginTop: '1.5rem', padding: '1rem',
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
            fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6
          }}>
            <strong style={{ color: 'var(--text-secondary)' }}>💾 Stockage SQLite</strong><br />
            Les ordres sont sauvegardés en BD et liés aux codes promo. Le Bot Telegram consulte la même BD pour distribuer les offres.
          </div>
        </div>
      </div>
    </div>
  );
}
