import { Routes, Route } from 'react-router-dom';

// Pages & Components
import DashboardLayout from './components/DashboardLayout';
import HomeView from './pages/HomeView';
import RoutineView from './pages/RoutineView';
import FinanceView from './pages/FinanceView';
import AnalyticsView from './pages/AnalyticsView';
import SettingsView from './pages/SettingsView';

function App() {
    return (
        <Routes>
            <Route path="/" element={<DashboardLayout />}>
                <Route index element={<HomeView />} />
                <Route path="routine" element={<RoutineView />} />
                <Route path="schedule" element={<RoutineView />} />
                <Route path="finance" element={<FinanceView key="finance" />} />
                <Route path="analytics" element={<AnalyticsView />} />
                <Route path="settings" element={<SettingsView />} />
            </Route>
        </Routes>
    );
}

export default App;