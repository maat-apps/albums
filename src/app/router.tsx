import { lazy, useEffect } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";

import { AppLockGate } from "../components/app-lock-gate";
import { completeConnect } from "../lib/spotify-session";

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

const CoversView = lazy(() =>
  import("../views/covers/covers-view").then((m) => ({
    default: m.CoversView,
  })),
);
const PickCoverView = lazy(() =>
  import("../views/covers/pick-cover-view").then((m) => ({
    default: m.PickCoverView,
  })),
);

/**
 * Spotify sends the user back to the app's root with `?code=` (or
 * `?error=`): finish connecting, then show the covers screen.
 */
function SpotifyCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    void completeConnect(new URLSearchParams(location.search)).then(
      (result) => {
        if (result === "none") return;
        void navigate("/covers", { replace: true, state: { spotify: result } });
      },
    );
  }, [location.search, navigate]);
  return null;
}

export function AppRouter() {
  return (
    <AppLockGate>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <SpotifyCallback />
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/new" element={<NewAlbumView />} />
          <Route path="/covers" element={<CoversView />} />
          <Route path="/covers/:id" element={<PickCoverView />} />
          <Route path="/:id" element={<AlbumView />} />
          <Route path="/:id/edit" element={<EditAlbumView />} />
        </Routes>
      </BrowserRouter>
    </AppLockGate>
  );
}
