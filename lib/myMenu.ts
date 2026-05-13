// マイメニュー：よく食べる料理をローカル保存して1タップで記録できるようにする
// 永続化先：localStorage（端末ごと）

export type MyMenuItem = {
  id: string;
  name: string;
  unit: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  createdAt: string; // ISO 8601
  lastUsedAt?: string;
  useCount?: number;
};

const STORAGE_KEY = 'mewodas_my_menu_v1';

export function loadMyMenu(): MyMenuItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((it): it is MyMenuItem =>
      it && typeof it.id === 'string' && typeof it.name === 'string'
    );
  } catch {
    return [];
  }
}

export function saveMyMenu(items: MyMenuItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // 失敗時は黙殺（容量超過など）
  }
}

export function addMyMenuItem(item: Omit<MyMenuItem, 'id' | 'createdAt'>): MyMenuItem {
  const items = loadMyMenu();
  const newItem: MyMenuItem = {
    ...item,
    id: `mm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  items.unshift(newItem);
  saveMyMenu(items);
  return newItem;
}

export function removeMyMenuItem(id: string): void {
  const items = loadMyMenu().filter((it) => it.id !== id);
  saveMyMenu(items);
}

export function touchMyMenuItem(id: string): void {
  const items = loadMyMenu();
  const target = items.find((it) => it.id === id);
  if (!target) return;
  target.lastUsedAt = new Date().toISOString();
  target.useCount = (target.useCount ?? 0) + 1;
  saveMyMenu(items);
}
