import { Suspense, useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { CourseRenderer } from "../renderers/CourseRenderer.js";
import { DeckRenderer } from "../renderers/DeckRenderer.js";
import { LibraryRenderer } from "../renderers/LibraryRenderer.js";
import { ReferenceRenderer } from "../renderers/ReferenceRenderer.js";
import { createProgressApi } from "./ProgressApi.js";
import { getSkill } from "./registry.js";
import { loadWidget } from "./widgets.js";

function collect(data: Record<string, unknown>, patterns: string[]): unknown[] {
  const result: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    const matches = patterns.some((pattern) =>
      pattern.includes("*")
        ? new RegExp(`^${pattern.replace(/\*/g, "[^/]*")}$`).test(key)
        : pattern === key,
    );
    if (!matches) continue;
    if (Array.isArray(value)) result.push(...value);
    else result.push(value);
  }
  return result;
}

function useRouteModule(requireFullscreen: boolean) {
  const { skillId, moduleId } = useParams();
  const skill = skillId ? getSkill(skillId) : undefined;
  const found = skill?.manifest.modules.find((m) => m.id === moduleId);
  const module = found && (!requireFullscreen || found.fullscreen) ? found : undefined;

  const progress = useMemo(() => createProgressApi(skillId ?? ""), [skillId]);
  const Widget = useMemo(
    () => (skill && module?.widget ? loadWidget(skill.manifest.id, module.widget) : null),
    [skill, module],
  );
  return { skill, module, progress, Widget };
}

export function ModuleRoute() {
  const { skill, module, progress, Widget } = useRouteModule(false);
  return renderModule(skill, module, progress, Widget, true);
}

export function FullscreenModuleRoute() {
  const { skill, module, progress, Widget } = useRouteModule(true);
  return renderModule(skill, module, progress, Widget, false);
}

function renderModule(
  skill: ReturnType<typeof getSkill>,
  module: NonNullable<ReturnType<typeof getSkill>>["manifest"]["modules"][number] | undefined,
  progress: ReturnType<typeof createProgressApi>,
  Widget: ReturnType<typeof loadWidget> | null,
  followRedirect: boolean,
) {
  if (!skill || !module) {
    return <p className="text-slate-600 dark:text-slate-400">Dieses Modul existiert nicht.</p>;
  }

  if (followRedirect && module.redirect) return <Navigate to={module.redirect} replace />;

  const data = collect(skill.data, module.data);

  if (Widget) {
    return (
      <Suspense fallback={<p>Wird geladen…</p>}>
        <Widget data={data} progress={progress} settings={{}} />
      </Suspense>
    );
  }

  switch (module.type) {
    case "srs-deck":
      return <DeckRenderer skillId={skill.manifest.id} moduleId={module.id} title={module.title} />;
    case "course": {
      const folder = module.data[0]?.split("/")[0];
      return <CourseRenderer skillId={skill.manifest.id} title={module.title} folder={folder} />;
    }
    case "reference":
      return <ReferenceRenderer title={module.title} data={data} />;
    case "library":
      return <LibraryRenderer title={module.title} data={data} />;
    case "practice":
      return (
        <div>
          <h1 className="text-2xl font-semibold">{module.title}</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Für dieses Übungsmodul ist noch kein Widget hinterlegt.
          </p>
        </div>
      );
  }
}
