import { create } from 'zustand';

export interface Order {
  id: string;
  pickup: string;
  drop: string;
  pickupCoord: { lat: number; lng: number };
  distanceKm?: number; // computed
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

// Dummy orders with coordinates near Phagwara/Jalandhar (Punjab)
const dummyOrders: Order[] = [
  { 
    id: 'ZA-10342', 
    pickup: 'Phagwara Bus Stand', 
    drop: 'LPU Main Gate', 
    pickupCoord: { lat: 31.2245, lng: 75.7717 },
    etaMin: 15, 
    payout: 85, 
    status: 'new' 
  },
  { 
    id: 'ZA-10343', 
    pickup: 'LPU Main Gate', 
    drop: 'Lovely Sweets, Jalandhar', 
    pickupCoord: { lat: 31.2530, lng: 75.7033 },
    etaMin: 25, 
    payout: 105, 
    status: 'new' 
  },
  { 
    id: 'ZA-10344', 
    pickup: 'Jalandhar City Railway Station', 
    drop: 'Model Town', 
    pickupCoord: { lat: 31.3256, lng: 75.5762 },
    etaMin: 18, 
    payout: 95, 
    status: 'new' 
  },
  { 
    id: 'ZA-10345', 
    pickup: 'Model Town, Jalandhar', 
    drop: 'Lovely Sweets', 
    pickupCoord: { lat: 31.3269, lng: 75.5799 },
    etaMin: 12, 
    payout: 75, 
    status: 'new' 
  },
  { 
    id: 'ZA-10346', 
    pickup: 'Lovely Sweets, Jalandhar', 
    drop: 'Phagwara Market', 
    pickupCoord: { lat: 31.3196, lng: 75.5908 },
    etaMin: 22, 
    payout: 110, 
    status: 'accepted' 
  },
  { 
    id: 'ZA-10347', 
    pickup: 'Nakodar Chowk', 
    drop: 'LPU Campus', 
    pickupCoord: { lat: 31.2180, lng: 75.7550 },
    etaMin: 20, 
    payout: 90, 
    status: 'new' 
  },
  { 
    id: 'ZA-10348', 
    pickup: 'Hoshiarpur Road', 
    drop: 'GT Road Junction', 
    pickupCoord: { lat: 31.2380, lng: 75.7890 },
    etaMin: 15, 
    payout: 80, 
    status: 'new' 
  },
  { 
    id: 'ZA-10349', 
    pickup: 'Amritsar Golden Temple', 
    drop: 'Hall Bazaar', 
    pickupCoord: { lat: 31.6340, lng: 74.8723 }, // Far away - should be filtered out
    etaMin: 90, 
    payout: 350, 
    status: 'new' 
  },
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
