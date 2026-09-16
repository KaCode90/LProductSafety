import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import MaterialMaster from './pages/Materials/MaterialMaster';
import MaterialDetail from './pages/Materials/MaterialDetail';
import CAPA from './pages/Management/CAPA';
import ComplianceOverview from './pages/Compliance';
import navigation from '../../backend/navigation.json';
import ModuleNavigation from './pages/ModuleNavigation';

const implementedPaths = new Set(['/dashboard', '/compliance', '/materials', '/management/capa']);
const missingRoutes = navigation.flatMap(group => [group, ...group.children]).filter(item => !implementedPaths.has(item.href));

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="compliance" element={<ComplianceOverview />} />
          <Route path="materials" element={<MaterialMaster />} />
          <Route path="materials/:id" element={<MaterialDetail />} />
          <Route path="management/capa" element={<CAPA />} />
          {missingRoutes.map(item => <Route key={item.href} path={item.href.slice(1)} element={<ModuleNavigation name={item.name} children={navigation.find(group => group.href === item.href)?.children ?? []} />} />)}
          <Route path="*" element={<div className="p-8">Không tìm thấy trang.</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
