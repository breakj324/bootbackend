'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Tag, Plus, CheckCircle, XCircle, Trash2, RefreshCw, AlertCircle, Upload, Image as ImageIcon } from 'lucide-react';
import { api, PromoCodeItem } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://bootbackend.onrender.com';

export default function PromoCodesPage() {
  const [promos, setPromos] = useState<PromoCodeItem[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newBookmaker, setNewBookmaker] = useState('XParibet');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const loadPromos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getPromoCodes();
      setPromos(data);
    } catch (err: any) {
      setError(`Impossible de charger les codes promo. Vérifiez la connexion au backend API (${API_BASE_URL}).`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPromos();
  }, [loadPromos]);

  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    setIsAdding(true);
    setError(null);
    try {
      let exampleImageUrl: string | undefined;
      if (selectedFile) {
        const uploadRes = await api.uploadPromoImage(selectedFile);
        exampleImageUrl = uploadRes.url;
      }

      const created = await api.createPromoCode({
        code: newCode.trim().toLowerCase(),
        bookmaker: newBookmaker,
        exampleImageUrl,
      });

      setPromos([created, ...promos]);
      setNewCode('');
      setSelectedFile(null);
      showSuccess(`Code "${created.code}" ajouté avec succès !`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du code promo.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRowImageUpload = async (promoId: string, file: File) => {
    setUploadingRowId(promoId);
    setError(null);
    try {
      const uploadRes = await api.uploadPromoImage(file);
      const updated = await api.updatePromoCodeImage(promoId, uploadRes.url);
      setPromos(promos.map(p => p.id === promoId ? updated : p));
      showSuccess('Image de l\'exemple mise à jour pour ce code !');
    } catch (err: any) {
      setError(err.message || 'Erreur lors du téléversement de l\'image.');
    } finally {
      setUploadingRowId(null);
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      const updated = await api.togglePromoCode(id);
      setPromos(promos.map(p => p.id === id ? { ...p, isActive: updated.isActive } : p));
    } catch (err: any) {
      setError(err.message || 'Erreur lors du changement de statut.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce code promo ?')) return;
    try {
      await api.deletePromoCode(id);
      setPromos(promos.filter(p => p.id !== id));
      showSuccess('Code promo supprimé.');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Gestion des Codes Promo</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Ajoutez et gérez vos codes promo avec leurs images d'exemple spécifiques pour le bot Telegram
          </p>
        </div>
        <button
          onClick={loadPromos}
          className="btn-icon"
          title="Rafraîchir"
          style={{ padding: '0.6rem' }}
        >
          <RefreshCw size={18} color="var(--accent-secondary)" />
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem',
          color: '#fca5a5', fontSize: '0.9rem'
        }}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
          borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem',
          color: '#86efac', fontSize: '0.9rem'
        }}>
          <CheckCircle size={18} />
          {successMsg}
        </div>
      )}

      <div className="section-split">
        {/* Liste des codes */}
        <div className="card table-card">
          <div className="table-title-bar">
            <h3 className="table-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tag size={18} color="var(--accent-primary)" />
              Codes en base ({promos.length})
            </h3>
          </div>

          {isLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
              <p>Chargement depuis la base de données...</p>
            </div>
          ) : promos.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <Tag size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>Aucun code promo en base. Ajoutez-en un !</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Code Promo</th>
                    <th>Bookmaker</th>
                    <th>Image Exemple (Telegram)</th>
                    <th>Statut</th>
                    <th>Ordres</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((promo) => {
                    const imageUrl = promo.exampleImageUrl
                      ? (promo.exampleImageUrl.startsWith('http') ? promo.exampleImageUrl : `${API_BASE_URL}${promo.exampleImageUrl}`)
                      : null;

                    return (
                      <tr key={promo.id}>
                        <td>
                          <code style={{ fontSize: '1rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                            {promo.code}
                          </code>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{promo.bookmaker}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {imageUrl ? (
                              <a href={imageUrl} target="_blank" rel="noopener noreferrer" title="Cliquer pour agrandir">
                                <img
                                  src={imageUrl}
                                  alt={`Exemple ${promo.code}`}
                                  style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                                />
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'var(--bg-tertiary)', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                Image par défaut
                              </span>
                            )}
                            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--accent-secondary)' }}>
                              <Upload size={14} />
                              {uploadingRowId === promo.id ? '...' : (imageUrl ? 'Changer' : 'Uploader')}
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleRowImageUpload(promo.id, e.target.files[0]);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </td>
                        <td>
                          <span className={`badge-status ${promo.isActive ? 'badge-success' : 'badge-danger'}`}>
                            {promo.isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td>{promo._count?.orders ?? 0} ordre(s)</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn-icon"
                              onClick={() => toggleStatus(promo.id)}
                              title={promo.isActive ? 'Désactiver' : 'Activer'}
                            >
                              {promo.isActive
                                ? <XCircle size={16} color="var(--color-warning)" />
                                : <CheckCircle size={16} color="var(--color-success)" />}
                            </button>
                            <button
                              className="btn-icon"
                              onClick={() => handleDelete(promo.id)}
                              title="Supprimer"
                            >
                              <Trash2 size={16} color="var(--color-danger)" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Formulaire d'ajout */}
        <div className="card">
          <h3 className="table-title" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} color="var(--accent-secondary)" />
            Ajouter un Code Promo
          </h3>

          <form onSubmit={handleAddPromo}>
            <div className="form-group">
              <label className="form-label" htmlFor="bookmaker-select">Bookmaker / Plateforme</label>
              <select
                id="bookmaker-select"
                className="form-input"
                value={newBookmaker}
                onChange={(e) => setNewBookmaker(e.target.value)}
              >
                <option value="XParibet">XParibet</option>
                <option value="Melbet">Melbet</option>
                <option value="1xBet">1xBet</option>
                <option value="Linebet">Linebet</option>
                <option value="888starz">888starz</option>
                <option value="Betwinner">Betwinner</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="promo-code-input">Nom du Code Promo</label>
              <input
                id="promo-code-input"
                type="text"
                className="form-input"
                placeholder="Exemple: atlass12"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Image Exemple (Screenshot spécifique)</label>
              <input
                type="file"
                accept="image/*"
                className="form-input"
                style={{ padding: '0.4rem' }}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Optionnel : cette image montrant le code <b>{newCode || 'promo'}</b> sera envoyée par le bot Telegram aux joueurs.
              </span>
            </div>

            <button type="submit" className="btn-primary" disabled={isAdding}>
              <Plus size={16} />
              <span>{isAdding ? 'Enregistrement en cours...' : 'Enregistrer le Code Promo'}</span>
            </button>
          </form>

          <div style={{
            marginTop: '1.5rem', padding: '1rem',
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
            fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6
          }}>
            <strong style={{ color: 'var(--text-secondary)' }}>🖼️ Images spécifiques par Promo</strong><br />
            Chaque code promo peut avoir sa propre image d'exemple qui sera envoyée automatiquement au joueur via Telegram lors de l'étape de vérification.
          </div>
        </div>
      </div>
    </div>
  );
}
