import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router";

import { AppLockGate } from "../components/app-lock-gate";

const HomeView = lazy(() =>
  import("../views/home/home-view").then((m) => ({ default: m.HomeView })),
);

export function AppRouter() {
  return (
    <AppLockGate>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<HomeView />} />
        </Routes>
      </BrowserRouter>
    </AppLockGate>
  );
}
