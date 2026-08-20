const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://bootbackend.onrender.com';

interface RequestOptions extends RequestInit {
  data?: any;
}

export async function apiFetch<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { data, headers, ...customOptions } = options;
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    method: data ? (customOptions.method || 'POST') : (customOptions.method || 'GET'),
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    ...customOptions,
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, config);
    if (response.status === 204) return null as unknown as T;
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message || response.statusText || 'An error occurred');
    }
    return json as T;
  } catch (error: any) {
    console.error(`API Fetch Error [${url}]:`, error.message);
    throw error;
  }
}

export interface PromoCodeItem {
  id: string;
  code: string;
  bookmaker: string;
  exampleImageUrl?: string | null;
  isActive: boolean;
  _count?: { orders: number; claims: number };
}

export interface CampaignOrder {
  id: string;
  promoCodeId: string;
  promoCode: PromoCodeItem;
  targetAccounts: number;
  claimedCount: number;
  freeDepositConditions: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  createdAt: string;
}

export interface PlayerClaimItem {
  id: string;
  telegramChatId: string;
  telegramUsername?: string;
  telegramName?: string;
  promoCode: PromoCodeItem;
  order: CampaignOrder;
  playerBookmakerId?: string;
  screenshotUrl?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export const api = {
  // Promo codes
  getPromoCodes: () => apiFetch<PromoCodeItem[]>('/promocodes'),
  createPromoCode: (data: { code: string; bookmaker: string; exampleImageUrl?: string }) => 
    apiFetch<PromoCodeItem>('/promocodes', { method: 'POST', data }),
  updatePromoCodeImage: (id: string, exampleImageUrl: string) =>
    apiFetch<PromoCodeItem>(`/promocodes/${id}/image`, { method: 'PATCH', data: { exampleImageUrl } }),
  uploadPromoImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${API_BASE_URL}/promocodes/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Échec du téléversement de l\'image');
    return res.json() as Promise<{ url: string }>;
  },
  togglePromoCode: (id: string) => 
    apiFetch<PromoCodeItem>(`/promocodes/${id}/toggle`, { method: 'PATCH' }),
  deletePromoCode: (id: string) => 
    apiFetch(`/promocodes/${id}`, { method: 'DELETE' }),

  // Orders
  getOrders: () => apiFetch<CampaignOrder[]>('/orders'),
  createOrder: (data: { promoCodeId: string; targetAccounts: number; freeDepositConditions: string }) => 
    apiFetch<CampaignOrder>('/orders', { method: 'POST', data }),
  updateOrderStatus: (id: string, status: 'ACTIVE' | 'PAUSED' | 'COMPLETED') => 
    apiFetch<CampaignOrder>(`/orders/${id}/status`, { method: 'PATCH', data: { status } }),
  deleteOrder: (id: string) => 
    apiFetch(`/orders/${id}`, { method: 'DELETE' }),

  // Claims
  getClaims: () => apiFetch<PlayerClaimItem[]>('/claims'),
  createClaim: (data: {
    telegramChatId: string;
    telegramUsername?: string;
    telegramName?: string;
    promoCodeId: string;
    orderId: string;
    playerBookmakerId: string;
    screenshotUrl?: string;
  }) => apiFetch<PlayerClaimItem>('/claims', { method: 'POST', data }),
  updateClaimStatus: (id: string, status: 'APPROVED' | 'REJECTED') => 
    apiFetch<PlayerClaimItem>(`/claims/${id}/status`, { method: 'PATCH', data: { status } }),
};
