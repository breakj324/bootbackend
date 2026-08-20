'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Send, User, RefreshCw, ShieldAlert, AlertCircle, Image } from 'lucide-react';
import { api, PromoCodeItem, CampaignOrder } from '@/lib/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  imageUrl?: string;
  timestamp: string;
}

export default function SimulatorPage() {
  const [chatId, setChatId] = useState('518392019');
  const [username, setUsername] = useState('joueur_test');
  const [activeOrder, setActiveOrder] = useState<(CampaignOrder & { promoCode: PromoCodeItem }) | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stepState, setStepState] = useState<'IDLE' | 'AWAITING_BOOKMAKER_ID' | 'AWAITING_SCREENSHOT'>('IDLE');
  const [tempBookmakerId, setTempBookmakerId] = useState('');
  const [claimedCodes, setClaimedCodes] = useState<string[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const initMsg = (order: (CampaignOrder & { promoCode: PromoCodeItem }) | null): ChatMessage => ({
    id: 'm1',
    sender: 'bot',
    text: order
      ? `🤖 <b>Simulateur de Bot Telegram (Moroccan Darija)</b>\nOrdre actif détecté depuis la BD !\nCode promo : <code>${order.promoCode.code}</code> (${order.promoCode.bookmaker})\n\nTapez <code>/start</code> pour simuler un joueur.`
      : `🤖 <b>Simulateur de Bot Telegram</b>\nAucun ordre actif en base de données.\nCréez d'abord un ordre dans la page <b>Ordres &amp; Campagnes</b>.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  const loadActiveOrder = useCallback(async () => {
    setIsLoadingOrder(true);
    setLoadError(null);
    try {
      const [orders, claimsData] = await Promise.all([
        api.getOrders(),
        api.getClaims(),
      ]);
      const active = orders.find(o => o.status === 'ACTIVE') as (CampaignOrder & { promoCode: PromoCodeItem }) | undefined;
      setActiveOrder(active || null);
      setClaims(claimsData);
      setMessages([initMsg(active || null)]);
      setStepState('IDLE');
      setTempBookmakerId('');
      setClaimedCodes([]);
    } catch (err: any) {
      setLoadError('Impossible de charger les ordres actifs. Vérifiez le backend.');
    } finally {
      setIsLoadingOrder(false);
    }
  }, []);

  useEffect(() => {
    loadActiveOrder();
  }, [loadActiveOrder]);

  const processMessage = async (userMsgText: string, isPhoto: boolean = false) => {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: isPhoto ? `🖼️ [صورة الشاشة المرسلة / Capture d'écran]` : userMsgText,
      timestamp: timeNow,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    // Fetch latest claims dynamically to check uniqueness in real-time
    let latestClaims = claims;
    try {
      latestClaims = await api.getClaims();
      setClaims(latestClaims);
    } catch (e) {}

    setTimeout(async () => {
      let botResponseText = '';
      let botImageUrl: string | undefined = undefined;

      if (!activeOrder) {
        botResponseText = `⚠️ <b>Aucun ordre actif / ماكاين حتى شي عرض</b>\n\nCréez d'abord un ordre dans la page <b>Ordres &amp; Campagnes</b>.`;
      } else {
        const code = activeOrder.promoCode.code;
        const bookmaker = activeOrder.promoCode.bookmaker;

        // Check if this Telegram Chat ID already claimed the code in database
        const alreadyClaimedInDb = latestClaims.some(
          c => c.telegramChatId === chatId && c.promoCode?.id === activeOrder.promoCodeId
        );

        if (alreadyClaimedInDb || claimedCodes.includes(code)) {
          botResponseText = `⚠️ <b>هاد العرض مستعمل ديجا!</b>\n\nأهلاً ${username}، راك ديجا شاركتي فهاد العرض ديال الكود برومو <code>${code}</code> (${bookmaker}).\n\n<i>حالة الطلب ديالك دابا هي:</i> <b>قيد المراجعة ⏳</b>.`;
        } else if (userMsgText === '/start') {
          setStepState('AWAITING_BOOKMAKER_ID');
          setTempBookmakerId('');
          botResponseText = `🎁 <b>عرض البونص والتسجيل - ${bookmaker.toUpperCase()}</b>\n\nمرحباً بك <b>${username}</b>!\nباش تستافد من البونص والديبو فابور ديالنا، تبع هاد الخطوات البسيطة:\n\n1️⃣ تسجل فـ <b>${bookmaker}</b>\n2️⃣ دير الكود برومو (Code Promo) الضروري: <code>${code}</code>\n3️⃣ <b>الشروط المطلوبة :</b> ${activeOrder.freeDepositConditions}\n\n👉 <b>صيفط ليا دابا الأيدي (ID)</b> ديال الحساب ديالك اللي تسجلتي بيه فـ ${bookmaker} باش نتحققوا منو.`;
        } else if (stepState === 'AWAITING_BOOKMAKER_ID') {
          if (isPhoto) {
            botResponseText = `⚠️ <b>عافاك صيفط الأيدي (ID) أولاً !</b>\n\nصيفط ليا الرقم ديال الأيدي (ID) ديالك عاد صيفط السكرين شوت.`;
          } else {
            // Validate exactly 10 digits
            const isTenDigits = /^\d{10}$/.test(userMsgText);
            if (!isTenDigits) {
              botResponseText = `⚠️ <b>الأيدي غير صحيح !</b>\n\nالأيدي (ID) خاصو يكون كيتكون من 10 ديال الأرقام بالضبط (مثال: 1770795503). عاود صيفط الرقم الصحيح من فضلك.`;
            } else {
              // Check global uniqueness of Bookmaker Account ID
              const isDuplicated = latestClaims.some(c => c.playerBookmakerId === userMsgText);
              if (isDuplicated) {
                botResponseText = `❌ <b>الأيدي مستعمل ديجا !</b>\n\nهاد الأيدي (ID) <code>${userMsgText}</code> ديجا تسجل فالعرض من طرف مستخدم آخر. مايمكنش ليك تعاود تستعمل نفس الأيدي.`;
              } else {
                setStepState('AWAITING_SCREENSHOT');
                setTempBookmakerId(userMsgText);
                botResponseText = `💬 <b>خطوة أخيرة ومهمة!</b>\n\nشكراً، الأيدي ديالك هو <code>${userMsgText}</code>.\n\nدابا، <b>صيفط ليا سكرين شوت (صورة الشاشة)</b> ديال الحساب ديالك اللي تسجلتي بيه (يكون كايظهر بحال هاد النموذج التوضيحي بالضبط، فين كايظهر الأيدي والكود برومو <code>${code}</code>) باش نأكدو التسجيل ديالك ونفعلوا ليك البونص. 📸`;
                botImageUrl = '/example-screenshot.png';
              }
            }
          }
        } else if (stepState === 'AWAITING_SCREENSHOT') {
          if (!isPhoto) {
            botResponseText = `⚠️ <b>عافاك صيفط صورة (Screenshot) !</b>\n\nهاد الخطوة ضرورية بزاف باش نقدرو نتحققوا من الحساب ديالك ونرسلو ليك البونص. صيفط ليا سكرين شوت ديال التسجيل دابا من فضلك (اضغط على زر 📷 لإرسال صورة).`;
            botImageUrl = '/example-screenshot.png';
          } else {
            // Save the claim to real database SQLite!
            try {
              await api.createClaim({
                telegramChatId: chatId,
                telegramUsername: username,
                telegramName: username,
                promoCodeId: activeOrder.promoCodeId,
                orderId: activeOrder.id,
                playerBookmakerId: tempBookmakerId,
                screenshotUrl: 'simulated_screenshot_proof_image'
              });

              setClaimedCodes(prev => [...prev, code]);
              setStepState('IDLE');
              botResponseText = `✅ <b>تم تسجيل الطلب بنجاح!</b>\n\nشكراً ليك! صيفطنا المعلومات ديالك للفريق المكلّف. غادي نراجعو الأيدي (<code>${tempBookmakerId}</code>) والسكرين شوت ديالك وغادي نجاوبوك هنا ف أقرب وقت فاش يتفعل البونص ديالك. 🚀`;
            } catch (err: any) {
              botResponseText = `❌ <b>خطأ أثناء الحفظ ف قاعدة البيانات :</b>\n\n${err.message || 'خطأ غير معروف'}`;
            }
          }
        } else {
          // Default start message
          setStepState('AWAITING_BOOKMAKER_ID');
          botResponseText = `🎁 <b>عرض البونص والتسجيل - ${bookmaker.toUpperCase()}</b>\n\nمرحباً بك <b>${username}</b>!\nباش تستافد من البونص والديبو فابور ديالنا، تبع هاد الخطوات البسيطة:\n\n1️⃣ تسجل فـ <b>${bookmaker}</b>\n2️⃣ دير الكود برومو (Code Promo) الضروري: <code>${code}</code>\n3️⃣ <b>الشروط المطلوبة :</b> ${activeOrder.freeDepositConditions}\n\n👉 <b>صيفط ليا دابا الأيدي (ID)</b> ديال الحساب ديالك اللي تسجلتي بيه فـ ${bookmaker} باش نتحققوا منو.`;
        }
      }

      const botMessage: ChatMessage = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text: botResponseText,
        imageUrl: botImageUrl,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, botMessage]);
      setIsProcessing(false);
    }, 600);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    processMessage(inputText.trim(), false);
    setInputText('');
  };

  const handleSendScreenshot = () => {
    processMessage('', true);
  };

  const handleReset = () => {
    setMessages([initMsg(activeOrder)]);
    setStepState('IDLE');
    setTempBookmakerId('');
    setClaimedCodes([]);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Simulateur de Bot Telegram (Darija)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Testez l'interaction en arabe marocain (Darija) avec vérification de l'ID et capture d'écran obligatoire.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-icon" onClick={loadActiveOrder} title="Recharger depuis BD" style={{ padding: '0.6rem' }}>
            <RefreshCw size={18} color="var(--accent-secondary)" />
          </button>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={handleReset}>
            <RefreshCw size={16} />
            <span>Réinitialiser</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem',
          color: '#fca5a5', fontSize: '0.9rem'
        }}>
          <AlertCircle size={18} /> {loadError}
        </div>
      )}

      <div className="section-split">
        {/* Fenêtre de Chat */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '600px' }}>
          <div style={{
            background: 'var(--bg-tertiary)', padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}>
            <div className="sidebar-logo-icon" style={{ background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))' }}>
              <Bot size={18} color="#fff" />
            </div>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Affiliate Gambling Bot</h4>
              <span style={{ fontSize: '0.75rem', color: activeOrder ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {isLoadingOrder ? '● Chargement BD...' : activeOrder ? `● Ordre actif: ${activeOrder.promoCode.code}` : '● Aucun ordre actif'}
              </span>
            </div>
          </div>

          <div style={{
            flexGrow: 1, padding: '1.5rem', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: '1rem',
            background: 'rgba(10, 11, 16, 0.4)'
          }}>
            {messages.map((m) => (
              <div key={m.id} style={{
                alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%', display: 'flex', flexDirection: 'column',
                alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  background: m.sender === 'user'
                    ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))'
                    : 'var(--bg-tertiary)',
                  border: m.sender === 'user' ? 'none' : '1px solid var(--border-color)',
                  color: '#fff', padding: '0.85rem 1.15rem',
                  borderRadius: m.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  fontSize: '0.9rem', lineHeight: '1.5', boxShadow: 'var(--shadow-sm)'
                }}>
                  {m.imageUrl && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <img
                        src={m.imageUrl}
                        alt="Exemple de capture d'écran"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '300px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          objectFit: 'contain'
                        }}
                      />
                    </div>
                  )}
                  <div dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{m.timestamp}</span>
              </div>
            ))}
            {isProcessing && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Le bot écrit...
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} style={{
            padding: '1rem', background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'center'
          }}>
            <input
              type="text"
              className="form-input"
              placeholder={
                stepState === 'AWAITING_SCREENSHOT'
                  ? "صيفط سكرين شوت / Cliquez sur l'icône photo à droite..."
                  : "Simuler un message joueur (ex: /start ou ID)..."
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing}
            />
            
            <button
              type="button"
              className="btn-icon"
              style={{
                padding: '0.75rem',
                borderColor: stepState === 'AWAITING_SCREENSHOT' ? 'var(--accent-primary)' : 'var(--border-color)',
                background: stepState === 'AWAITING_SCREENSHOT' ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
              }}
              onClick={handleSendScreenshot}
              disabled={isProcessing}
              title="Simuler l'envoi d'une capture d'écran"
            >
              <Image size={18} color={stepState === 'AWAITING_SCREENSHOT' ? 'var(--accent-primary)' : 'var(--text-muted)'} />
            </button>

            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0 1.25rem' }} disabled={isProcessing}>
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Sidebar Debug */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h3 className="table-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} color="var(--accent-secondary)" />
              Profil du Joueur de Test
            </h3>
            <div className="form-group">
              <label className="form-label">Telegram Chat ID</label>
              <input type="text" className="form-input" value={chatId} onChange={(e) => setChatId(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Username Telegram</label>
              <input type="text" className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
          </div>

          <div className="card">
            <h3 className="table-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={18} color="var(--color-warning)" />
              Ordre Actif (depuis BD)
            </h3>
            {activeOrder ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p><strong>Code Promo :</strong> <code style={{ color: 'var(--accent-primary)' }}>{activeOrder.promoCode.code}</code></p>
                <p><strong>Bookmaker :</strong> {activeOrder.promoCode.bookmaker}</p>
                <p><strong>Objectif :</strong> {activeOrder.claimedCount} / {activeOrder.targetAccounts} joueurs</p>
                <p><strong>Étape Actuelle :</strong> <code>{stepState}</code></p>
                {tempBookmakerId && <p><strong>ID Soumis :</strong> <code>{tempBookmakerId}</code></p>}
                <p><strong>Codes Réclamés :</strong>{' '}
                  {claimedCodes.length > 0
                    ? claimedCodes.map(c => <code key={c} style={{ color: 'var(--accent-primary)', marginLeft: '4px' }}>{c}</code>)
                    : <span style={{ color: 'var(--text-muted)' }}>Aucun</span>}
                </p>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Aucun ordre actif en BD. Créez-en un dans <strong>Ordres &amp; Campagnes</strong>.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
