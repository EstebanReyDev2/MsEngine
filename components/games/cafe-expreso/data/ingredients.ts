// 📂 data/ingredients.ts
export type IngredientId = 'coffee' | 'milk' | 'sugar' | 'caramel' | 'cocoa' | 'ice';

export interface IngredientDef {
  id: IngredientId;
  label: string;
  symbol: string;
  color: string;
  bgClass: string;
}

export const INGREDIENT_DEFS: IngredientDef[] = [
  { id: 'coffee', label: 'Café Grano', symbol: '☕', color: '#B45309', bgClass: 'bg-[#78350F]' },
  { id: 'milk', label: 'Sexto Leche', symbol: '🥛', color: '#38BDF8', bgClass: 'bg-[#0369A1]' },
  { id: 'sugar', label: 'Sirope Azúcar', symbol: '🍬', color: '#F8FAFC', bgClass: 'bg-[#475569]' },
  { id: 'caramel', label: 'Toffee Caramelo', symbol: '🍯', color: '#FBBF24', bgClass: 'bg-[#78350F]' },
  { id: 'cocoa', label: 'Polvo Cacao', symbol: '🍫', color: '#D97706', bgClass: 'bg-[#451A03]' },
  { id: 'ice', label: 'Hielo Iceberg', symbol: '❄️', color: '#22D3EE', bgClass: 'bg-[#0891B2]' },
];
