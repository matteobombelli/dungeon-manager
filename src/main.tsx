import "@fontsource-variable/figtree";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Navigate, createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { APP_BASE } from "../shared/api";
import App from "./App";
import { RequireAuth } from "./auth/RequireAuth";
import CampaignPage from "./routes/CampaignPage";
import CampaignsPage from "./routes/CampaignsPage";
import LoginPage from "./routes/LoginPage";
import PrefabsPage from "./routes/PrefabsPage";
import RegisterPage from "./routes/RegisterPage";
import ScenePage from "./routes/ScenePage";
import "./styles.css";

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <App />,
      children: [
        { index: true, element: <Navigate to="/campaigns" replace /> },
        { path: "login", element: <LoginPage /> },
        { path: "register", element: <RegisterPage /> },
        {
          element: <RequireAuth />,
          children: [
            { path: "campaigns", element: <CampaignsPage /> },
            { path: "campaigns/:id/scenes?/:sceneId?", element: <CampaignPage /> },
            { path: "scenes/:id", element: <ScenePage /> },
            { path: "prefabs", element: <PrefabsPage /> },
          ],
        },
      ],
    },
  ],
  { basename: APP_BASE }
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
