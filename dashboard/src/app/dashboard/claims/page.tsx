'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle, XCircle, ShieldCheck, Search, Filter, RefreshCw, AlertCircle, ImageIcon, X } from 'lucide-react';
import { api, PlayerClaimItem } from '@/lib/api';

function ClaimScreenshotCell({
  url,
  onPreview,
}: {
  url?: string | null;
  onPreview: (fullUrl: string) => void;
}) {
  const [hasError, setHasError] = useState(false);

  if (!url) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.25rem 0.6rem',
          borderRadius: '999px',
          fontSize: '0.78rem',
          fontWeight: 700,
          background: 'rgba(251,146,60,0.15)',
          color: '#fb923c',
          border: '1px solid rgba(251,146,60,0.3)',
        }}
      >
        ⚠ Manquant
      </span>
    );
  }

  if (url === 'telegram_file_uploaded' || url === 'simulated_screenshot') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.25rem 0.6rem',
          borderRadius: '999px',
          fontSize: '0.78rem',
          fontWeight: 700,
          background: 'rgba(99,102,241,0.15)',
          color: '#818cf8',
          border: '1px solid rgba(99,102,241,0.3)',
        }}
      >
        ✓ Reçu (Telegram)
      </span>
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://bootbackend.onrender.com';
  let fullUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    fullUrl = `${baseUrl}${cleanPath}`;
  }

  if (hasError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.25rem 0.6rem',
            borderRadius: '999px',
            fontSize: '0.78rem',
            fontWeight: 700,
            background: 'rgba(34,197,94,0.15)',
            color: '#4ade80',
            border: '1px solid rgba(34,197,94,0.3)',
          }}
        >
          ✓ Preuve reçue
        </span>
        <a
          href={fullUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: '0.72rem',
            padding: '0.2rem 0.5rem',
            background: 'rgba(99,102,241,0.15)',
            color: 'var(--accent-primary)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '4px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <ImageIcon size={11} /> Ouvrir
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
      <img
        src={fullUrl}
        alt="Preuve"
        onError={() => setHasError(true)}
        style={{
          width: '60px',
          height: '45px',
          objectFit: 'cover',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          cursor: 'pointer',
          transition: 'transform 0.15s',
        }}
        onClick={() => onPreview(fullUrl)}
        onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
      />
      <button
        onClick={() => onPreview(fullUrl)}
        style={{
          fontSize: '0.72rem',
          padding: '0.2rem 0.5rem',
          background: 'rgba(99,102,241,0.15)',
          color: 'var(--accent-primary)',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
      >
        <ImageIcon size={11} /> Voir
      </button>
    </div>
  );
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState<PlayerClaimItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const loadClaims = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getClaims();
      setClaims(data);
    } catch (err: any) {
      setError('Impossible de charger les vérifications. Vérifiez que le backend tourne sur le port 3001.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const handleUpdateStatus = async (id: string, newStatus: 'APPROVED' | 'REJECTED') => {
    try {
      const updated = await api.updateClaimStatus(id, newStatus);
      setClaims(claims.map(c => c.id === id ? { ...c, status: updated.status } : c));
      showSuccess(`Demande ${newStatus === 'APPROVED' ? 'approuvée' : 'rejetée'} avec succès.`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour du statut.');
    }
  };

  const filteredClaims = claims.filter(c => {
    const name = c.telegramName || '';
    const username = c.telegramUsername || '';
    const bookerId = c.playerBookmakerId || '';
    const code = c.promoCode?.code || '';

    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      username.toLowerCase().includes(search.toLowerCase()) ||
      c.telegramChatId.includes(search) ||
      bookerId.toLowerCase().includes(search.toLowerCase()) ||
      code.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = filterStatus === 'ALL' || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Joueurs &amp; Demandes de Dépôt Gratuit</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Vérifiez les comptes soumis par les joueurs sur Telegram et validez leurs bonus en 1 clic
          </p>
        </div>
        <button onClick={loadClaims} className="btn-icon" title="Rafraîchir" style={{ padding: '0.6rem' }}>
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

      {/* Barre de filtre */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flexGrow: 1, position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Rechercher par ID Telegram, Nom, Username ou ID Bookmaker..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-input"
              style={{ width: 'auto' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">Tous les statuts</option>
              <option value="PENDING">En Attente</option>
              <option value="APPROVED">Approuvés</option>
              <option value="REJECTED">Rejetés</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tableau des réclamations */}
      <div className="card table-card">
        <div className="table-title-bar">
          <h3 className="table-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} color="var(--accent-secondary)" />
            Vérifications depuis BD ({filteredClaims.length})
          </h3>
        </div>

        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={20} style={{ marginBottom: '0.5rem' }} />
            <p>Chargement depuis la base de données...</p>
          </div>
        ) : filteredClaims.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>Aucune réclamation en base pour les filtres sélectionnés.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Joueur Telegram</th>
                  <th>ID Telegram</th>
                  <th>Code Promo</th>
                  <th>Bookmaker &amp; ID Soumis</th>
                  <th>Screenshot</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.map((claim) => (
                  <tr key={claim.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{claim.telegramName || '—'}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)' }}>
                          {claim.telegramUsername ? `@${claim.telegramUsername}` : '—'}
                        </span>
                      </div>
                    </td>
                    <td><code style={{ fontSize: '0.85rem' }}>{claim.telegramChatId}</code></td>
                    <td><code style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{claim.promoCode?.code}</code></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{claim.promoCode?.bookmaker}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ID: {claim.playerBookmakerId || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <ClaimScreenshotCell
                        url={claim.screenshotUrl}
                        onPreview={(fullUrl) => setPreviewUrl(fullUrl)}
                      />
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDate(claim.createdAt)}</td>
                    <td>
                      <span className={`badge-status ${claim.status === 'APPROVED' ? 'badge-success' : claim.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>
                        {claim.status === 'APPROVED' ? 'Approuvé' : claim.status === 'PENDING' ? 'En Attente' : 'Rejeté'}
                      </span>
                    </td>
                    <td>
                      {claim.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn-primary"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto', background: 'var(--color-success)' }}
                            onClick={() => handleUpdateStatus(claim.id, 'APPROVED')}
                          >
                            <CheckCircle size={14} />
                            <span>Approuver</span>
                          </button>
                          <button
                            className="btn-icon"
                            style={{ borderColor: 'rgba(239,68,68,0.3)' }}
                            onClick={() => handleUpdateStatus(claim.id, 'REJECTED')}
                            title="Rejeter"
                          >
                            <XCircle size={16} color="var(--color-danger)" />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Traité</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

    {/* Modal d'aperçu de screenshot */}
    {previewUrl && (
      <div
        onClick={() => setPreviewUrl(null)}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
          cursor: 'zoom-out',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'relative', maxWidth: '90vw', maxHeight: '90vh',
            borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <button
            onClick={() => setPreviewUrl(null)}
            style={{
              position: 'absolute', top: '0.75rem', right: '0.75rem',
              background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
              width: '36px', height: '36px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <X size={18} color="white" />
          </button>
          <img
            src={previewUrl}
            alt="Preuve joueur"
            style={{ display: 'block', maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
          />
        </div>
      </div>
    )}
    </>
  );
}
