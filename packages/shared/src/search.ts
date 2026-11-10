import { FURNITURE_CATALOG, furnitureKindLabel } from './catalog';
import type { Project, SearchHit } from './types';

export function searchProject(project: Project, rawQuery: string): SearchHit[] {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return [];
  const hits: SearchHit[] = [];

  for (const furniture of project.furniture) {
    const containerMatches = furniture.name.toLocaleLowerCase().includes(query);
    if (containerMatches) {
      hits.push({
        furnitureId: furniture.id,
        furnitureName: furniture.name,
        furnitureKind: furniture.kind,
        itemId: null,
        itemName: furniture.name,
        quantity: furniture.items.length,
        note: `${furnitureKindLabel(furniture.kind)} · 共 ${furniture.items.length} 类物品`,
        match: 'furniture',
      });
    }

    for (const item of furniture.items) {
      const nameMatch = item.name.toLocaleLowerCase().includes(query);
      const noteMatch = item.note.toLocaleLowerCase().includes(query);
      if (!nameMatch && !noteMatch) continue;
      hits.push({
        furnitureId: furniture.id,
        furnitureName: furniture.name,
        furnitureKind: furniture.kind,
        itemId: item.id,
        itemName: item.name,
        quantity: item.quantity,
        note: item.note,
        match: noteMatch ? 'note' : 'item',
      });
    }
  }

  const rank = (hit: SearchHit): number => {
    if (hit.match === 'furniture') return 0;
    const name = hit.itemName.toLocaleLowerCase();
    if (name === query) return 1;
    if (name.startsWith(query)) return 2;
    return 3;
  };

  return hits
    .sort((a, b) => rank(a) - rank(b) || a.itemName.localeCompare(b.itemName, 'zh-CN'))
    .slice(0, 60);
}

export function furnitureSearchText(project: Project): string {
  return project.furniture
    .flatMap((f) => [
      f.name,
      FURNITURE_CATALOG[f.kind].label,
      ...f.items.flatMap((item) => [item.name, item.note]),
    ])
    .join(' ');
}
