import { furnitureKindLabel } from './catalog';
import type { SearchHit, Workspace } from './types';

export function searchWorkspace(workspace: Workspace, rawQuery: string): SearchHit[] {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return [];
  const hits: SearchHit[] = [];

  for (const house of workspace.houses) {
    for (const floor of house.floors) {
      const context = {
        houseId: house.id,
        houseName: house.name,
        floorId: floor.id,
        floorName: floor.name,
        floorLevel: floor.level,
      };

      for (const furniture of floor.furniture) {
        const containerMatches = furniture.name.toLocaleLowerCase().includes(query);
        if (containerMatches) {
          hits.push({
            ...context,
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
            ...context,
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
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.houseName.localeCompare(b.houseName, 'zh-CN') ||
        a.floorLevel - b.floorLevel ||
        a.itemName.localeCompare(b.itemName, 'zh-CN'),
    )
    .slice(0, 80);
}
