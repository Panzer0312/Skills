import { Link, Navigate, useParams } from "react-router-dom";
import { getSkill } from "./registry.js";

export function SkillOverview() {
  const { skillId } = useParams();
  const skill = skillId ? getSkill(skillId) : undefined;

  if (!skill) {
    return <p className="text-slate-600 dark:text-slate-400">Dieser Lernbereich existiert nicht.</p>;
  }

  if (skill.manifest.entry) return <Navigate to={skill.manifest.entry} replace />;

  return (
    <div>
      <h1 className="text-2xl font-semibold">{skill.manifest.name}</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">{skill.manifest.description}</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {skill.manifest.modules.map((module) => (
          <li key={module.id}>
            <Link
              to={`/skill/${skill.manifest.id}/${module.id}`}
              className="block rounded-lg border border-slate-200 p-4 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
            >
              <div className="font-medium">{module.title}</div>
              {module.subtitle ? (
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{module.subtitle}</div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
