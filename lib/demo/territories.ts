import records from "./data/territories.json";

export const territoryRecords = records;
export function visibleTowns() {
  return records.filter(t => t.type === "concejo" && t.visible && records.find(parent => parent.id === t.parent)?.visible);
}
export const navigationTerritories: Record<string, string[]> = Object.fromEntries(
  records.filter(t => t.type === "comarca" && t.visible).map(comarca => [comarca.name,
    visibleTowns().filter(t => t.parent === comarca.id).map(t => t.name)])
);
