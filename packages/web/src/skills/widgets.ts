import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { ProgressApi } from "./ProgressApi.js";

export interface WidgetProps {
  data: unknown[];
  progress: ProgressApi;
  settings: Record<string, string>;
}

const widgetModules = import.meta.glob("../../../../skills/*/widgets/*.tsx");

export function loadWidget(
  skillId: string,
  widgetName: string,
): LazyExoticComponent<ComponentType<WidgetProps>> | null {
  const suffix = `/skills/${skillId}/widgets/${widgetName}.tsx`;
  const entry = Object.entries(widgetModules).find(([path]) => path.endsWith(suffix));
  if (!entry) return null;
  const importer = entry[1] as () => Promise<{ default: ComponentType<WidgetProps> }>;
  return lazy(importer);
}
