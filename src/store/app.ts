import { create } from 'zustand';

export interface Order {
  id: string;
  pickup: string;
  drop: string;
  distanceKm: number;
  etaMin: number;
  payout: number;
  status: 'new' | 'accepted' | 'picked' | 'delivered' | 'canceled';
}

export interface Agent {
  id: string;
  name: string;
  email: string;
}

interface AppState {
  isAuthed: boolean;
  agent: Agent | null;
  orders: Order[];
  setIsAuthed: (value: boolean) => void;
  setAgent: (agent: Agent | null) => void;
  setOrders: (orders: Order[]) => void;
  getOrderById: (id: string) => Order | undefined;
}

// Dummy orders
const dummyOrders: Order[] = [
  { id: 'ZA-10342', pickup: 'Koramangala 5th Block', drop: 'HSR Layout Sector 2', distanceKm: 4.2, etaMin: 15, payout: 85, status: 'new' },
  { id: 'ZA-10343', pickup: 'Indiranagar', drop: 'Whitefield', distanceKm: 12.5, etaMin: 35, payout: 145, status: 'new' },
  { id: 'ZA-10344', pickup: 'MG Road', drop: 'Electronic City', distanceKm: 14.8, etaMin: 42, payout: 165, status: 'new' },
  { id: 'ZA-10345', pickup: 'Jayanagar 4th Block', drop: 'BTM Layout', distanceKm: 3.1, etaMin: 12, payout: 65, status: 'new' },
  { id: 'ZA-10346', pickup: 'Marathahalli', drop: 'Sarjapur Road', distanceKm: 8.7, etaMin: 25, payout: 105, status: 'accepted' },
  { id: 'ZA-10347', pickup: 'Banashankari', drop: 'JP Nagar', distanceKm: 5.6, etaMin: 18, payout: 90, status: 'new' },
  { id: 'ZA-10348', pickup: 'Yelahanka', drop: 'Hebbal', distanceKm: 6.3, etaMin: 20, payout: 95, status: 'picked' },
  { id: 'ZA-10349', pickup: 'Rajajinagar', drop: 'Malleshwaram', distanceKm: 2.8, etaMin: 10, payout: 60, status: 'new' },
];

export const useAppStore = create<AppState>((set, get) => ({
  isAuthed: false,
  agent: null,
  orders: dummyOrders,
  setIsAuthed: (value) => set({ isAuthed: value }),
  setAgent: (agent) => set({ agent }),
  setOrders: (orders) => set({ orders }),
  getOrderById: (id) => get().orders.find(order => order.id === id),
}));
