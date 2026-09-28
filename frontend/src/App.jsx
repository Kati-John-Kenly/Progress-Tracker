import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Pages & Components
import DashboardLayout from './components/DashboardLayout';
import HomeView from './pages/HomeView';
import RoutineView from './pages/RoutineView';
import FinanceView from './pages/FinanceView';
import SettingsView from './pages/SettingsView';

function App() {
    return (
        <AuthProvider>
            <Routes>
                {/* No more /auth route, everything goes straight to the layout */}
                <Route path="/" element={<DashboardLayout />}>
                    <Route index element={<HomeView />} />
                    <Route path="routine" element={<RoutineView />} />
                    <Route path="finance" element={<FinanceView />} />
                    <Route path="settings" element={<SettingsView />} />
                </Route>
            </Routes>
        </AuthProvider>
    );
}

export default App;