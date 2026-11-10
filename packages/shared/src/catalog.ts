import type { FurnitureKind } from './types';

export interface FurnitureSpec {
  label: string;
  short: string;
  width: number;
  depth: number;
  height: number;
  color: string;
  storage: boolean;
  description: string;
}

export const FURNITURE_CATALOG: Record<FurnitureKind, FurnitureSpec> = {
  sofa: {
    label: '沙发',
    short: 'SOFA',
    width: 2.1,
    depth: 0.9,
    height: 0.78,
    color: '#b4825f',
    storage: true,
    description: '布艺三人沙发，座下可以收纳零碎物件',
  },
  table: {
    label: '桌子',
    short: 'TABLE',
    width: 1.5,
    depth: 0.85,
    height: 0.74,
    color: '#a9744f',
    storage: true,
    description: '日常桌面，适合记录随手放置的物件',
  },
  bed: {
    label: '双人床',
    short: 'BED',
    width: 1.8,
    depth: 2.05,
    height: 0.55,
    color: '#c9b8a4',
    storage: true,
    description: '双人床，床下与床头都可以存放物品',
  },
  cabinet: {
    label: '储物柜',
    short: 'CABINET',
    width: 1.2,
    depth: 0.48,
    height: 1.9,
    color: '#7f927f',
    storage: true,
    description: '封闭式收纳柜，适合分类存放',
  },
  nightstand: {
    label: '床头柜',
    short: 'NIGHTSTAND',
    width: 0.5,
    depth: 0.45,
    height: 0.55,
    color: '#b08f6e',
    storage: true,
    description: '床边小柜，收纳睡前常用物件',
  },
};

export const FURNITURE_KINDS = Object.keys(FURNITURE_CATALOG) as FurnitureKind[];

export const FURNITURE_COLORS = [
  '#b4825f',
  '#9d6b53',
  '#c7a77b',
  '#7f927f',
  '#7c8fa6',
  '#a58b9e',
  '#c9b8a4',
  '#6f7b70',
];

export function furnitureKindLabel(kind: FurnitureKind): string {
  return FURNITURE_CATALOG[kind]?.label ?? '家具';
}
