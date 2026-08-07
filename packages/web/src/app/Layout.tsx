import { Moon, Sun } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { getSkills } from "../skills/registry.js";
import { useTheme } from "./theme.js";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-3 py-2 text-sm ${isActive ? "bg-slate-200 font-medium dark:bg-slate-800" : "hover:bg-slate-100 dark:hover:bg-slate-900"}`;

export function Layout() {
  const { theme, setTheme } = useTheme();
  const skills = getSkills();
  const pinned = skills.flatMap((skill) =>
    skill.manifest.modules
      .filter((mod) => mod.pinned)
      .map((mod) => ({ skillId: skill.manifest.id, moduleId: mod.id, title: mod.title })),
  );

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-slate-200 p-3 dark:border-slate-800">
        <div className="mb-4 px-3 text-lg font-semibold">Skills</div>
        <nav className="space-y-1">
          <NavLink to="/" className={linkClass} end>
            Übersicht
          </NavLink>
          <NavLink to="/review" className={linkClass}>
            Wiederholen
          </NavLink>
          <NavLink to="/stats" className={linkClass}>
            Statistik
          </NavLink>
          <div className="pt-3 text-xs uppercase tracking-wide text-slate-500">Lernbereiche</div>
          {skills.map((skill) => (
            <NavLink key={skill.manifest.id} to={`/skill/${skill.manifest.id}`} className={linkClass}>
              {skill.manifest.name}
            </NavLink>
          ))}
          <NavLink to="/import" className={linkClass}>
            Anki-Import
          </NavLink>
          <NavLink to="/einstellungen" className={linkClass}>
            Einstellungen
          </NavLink>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
          {pinned.map((entry) => (
            <NavLink
              key={`${entry.skillId}/${entry.moduleId}`}
              to={`/skill/${entry.skillId}/${entry.moduleId}`}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900"
            >
              {entry.title}
            </NavLink>
          ))}
          <button
            type="button"
            aria-label="Design umschalten"
            className="ml-auto rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-900"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>
        <main className="min-w-0 flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
