import { Routes, Route, Navigate } from "react-router-dom";
import { RefreshProvider } from "./contexts/refresh-context";
import { AppLayout } from "./components/app-layout";
import { VehiclesPage } from "./pages/vehicles-page";
import { PlayersPage } from "./pages/players-page";
import { SettingsPage } from "./pages/settings-page";

export default function App() {
  return (
    <RefreshProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/vehicles" replace />} />
          <Route path="vehicles" element={<VehiclesPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </RefreshProvider>
  );
}
