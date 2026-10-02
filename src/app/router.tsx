import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router";

import { AppLockGate } from "../components/app-lock-gate";

const HomeView = lazy(() =>
  import("../views/home/home-view").then((m) => ({ default: m.HomeView })),
);
const AlbumView = lazy(() =>
  import("../views/album/album-view").then((m) => ({ default: m.AlbumView })),
);
const NewAlbumView = lazy(() =>
  import("../views/album/album-form-view").then((m) => ({
    default: m.NewAlbumView,
  })),
);
const EditAlbumView = lazy(() =>
  import("../views/album/album-form-view").then((m) => ({
    default: m.EditAlbumView,
  })),
);

export function AppRouter() {
  return (
    <AppLockGate>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/new" element={<NewAlbumView />} />
          <Route path="/:id" element={<AlbumView />} />
          <Route path="/:id/edit" element={<EditAlbumView />} />
        </Routes>
      </BrowserRouter>
    </AppLockGate>
  );
}
