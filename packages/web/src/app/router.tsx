import { createBrowserRouter } from "react-router-dom";
import { Dashboard } from "../features/dashboard/Dashboard.js";
import { ReviewSession } from "../features/review/ReviewSession.js";
import { Settings } from "../features/settings/Settings.js";
import { Stats } from "../features/stats/Stats.js";
import { ModuleRoute } from "../skills/ModuleRoute.js";
import { SkillOverview } from "../skills/SkillOverview.js";
import { Layout } from "./Layout.js";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "review", element: <ReviewSession /> },
      { path: "stats", element: <Stats /> },
      { path: "einstellungen", element: <Settings /> },
      { path: "skill/:skillId", element: <SkillOverview /> },
      { path: "skill/:skillId/:moduleId", element: <ModuleRoute /> },
    ],
  },
]);
