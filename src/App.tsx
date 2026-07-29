import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from './context/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { showToast } from './components/Toast';

import LandingPage from './pages/LandingPage';
import FacilitiesPage from './pages/FacilitiesPage';
import InventoryPage from './pages/InventoryPage';
import BorrowPage from './pages/BorrowPage';
import AgendaPage from './pages/AgendaPage';
import AspirasiPage from './pages/AspirasiPage';
import InputKavlingPage from './pages/InputKavlingPage';
import DataKavlingPage from './pages/DataKavlingPage';
import TimelinePage from './pages/TimelinePage';
import HistoryPage from './pages/HistoryPage';
import ReportPage from './pages/ReportPage';
import AboutPage from './pages/AboutPage';
import AuthPage from './pages/AuthPage';
import ConfirmEmailPage from './pages/ConfirmEmailPage';

import DashboardPage from './pages/admin/DashboardPage';
import BorrowingsAdminPage from './pages/admin/BorrowingsAdminPage';
import AgendaAdminPage from './pages/admin/AgendaAdminPage';
import TimelineAdminPage from './pages/admin/TimelineAdminPage';
import InventoryAdminPage from './pages/admin/InventoryAdminPage';
import FacilitiesAdminPage from './pages/admin/FacilitiesAdminPage';
import ReportsAdminPage from './pages/admin/ReportsAdminPage';
import TeamAdminPage from './pages/admin/TeamAdminPage';
import AnnouncementsAdminPage from './pages/admin/AnnouncementsAdminPage';
import AspirasiAdminPage from './pages/admin/AspirasiAdminPage';
import StatisticsPage from './pages/admin/StatisticsPage';
import MasterKelasPage from './pages/admin/MasterKelasPage';
import MasterEkstrakurikulerPage from './pages/admin/MasterEkstrakurikulerPage';

import UserManagementPage from './pages/admin/superadmin/UserManagementPage';
import RolesPermissionsPage from './pages/admin/superadmin/RolesPermissionsPage';
import FacilityManagersPage from './pages/admin/superadmin/FacilityManagersPage';
import ApprovalWorkflowPage from './pages/admin/superadmin/ApprovalWorkflowPage';
import SystemConfigPage from './pages/admin/superadmin/SystemConfigPage';
import ApproverEmailsPage from './pages/admin/superadmin/ApproverEmailsPage';
import SystemSettingsPage from './pages/admin/superadmin/SystemSettingsPage';
import ActivityLogsPage from './pages/admin/ActivityLogsPage';

function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function PermissionRoute({ module, children }: { module: string; children: ReactNode }) {
  const { hasPermission, loading } = useAuth();
  const location = useLocation();
  useEffect(() => { if (!loading && !hasPermission(module, 'read')) showToast('Anda tidak memiliki akses ke halaman ini', 'error'); }, [loading, hasPermission, module]);
  if (loading) return <div className="p-8 text-center text-slate-500">Memuat...</div>;
  if (!hasPermission(module, 'read')) return <Navigate to="/admin/dashboard" state={{ from: location }} replace />;
  return <>{children}</>;
}

function ActionPermissionRoute({ module, action, children }: { module: string; action: string; children: ReactNode }) {
  const { hasPermission, loading } = useAuth();
  const location = useLocation();
  useEffect(() => { if (!loading && !hasPermission(module, action)) showToast('Anda tidak memiliki akses ke halaman ini', 'error'); }, [loading, hasPermission, module, action]);
  if (loading) return <div className="p-8 text-center text-slate-500">Memuat...</div>;
  if (!hasPermission(module, action)) return <Navigate to="/admin/dashboard" state={{ from: location }} replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-8 text-center text-slate-500">Memuat...</div>;
  if (!session) return <Navigate to="/auth" state={{ from: location }} replace />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { isSuperAdmin, loading } = useAuth();
  const location = useLocation();
  useEffect(() => { if (!loading && !isSuperAdmin) showToast('Halaman ini hanya untuk Super Admin', 'error'); }, [loading, isSuperAdmin]);
  if (loading) return <div className="p-8 text-center text-slate-500">Memuat...</div>;
  if (!isSuperAdmin) return <Navigate to="/admin/dashboard" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout><LandingPage /></PublicLayout>} />
      <Route path="/fasilitas" element={<PublicLayout><FacilitiesPage /></PublicLayout>} />
      <Route path="/inventaris" element={<PublicLayout><InventoryPage /></PublicLayout>} />
      <Route path="/pinjam" element={<PublicLayout><BorrowPage /></PublicLayout>} />
      <Route path="/agenda" element={<PublicLayout><AgendaPage /></PublicLayout>} />
      <Route path="/aspirasi" element={<PublicLayout><AspirasiPage /></PublicLayout>} />
      <Route path="/kavling/input" element={<PublicLayout><InputKavlingPage /></PublicLayout>} />
      <Route path="/kavling/data" element={<PublicLayout><DataKavlingPage /></PublicLayout>} />
      <Route path="/timeline" element={<PublicLayout><TimelinePage /></PublicLayout>} />
      <Route path="/history" element={<PublicLayout><HistoryPage /></PublicLayout>} />
      <Route path="/laporan" element={<PublicLayout><ReportPage /></PublicLayout>} />
      <Route path="/tentang" element={<PublicLayout><AboutPage /></PublicLayout>} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/confirm" element={<ConfirmEmailPage />} />
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route path="dashboard" element={<PermissionRoute module="dashboard"><DashboardPage /></PermissionRoute>} />
        <Route path="borrowings" element={<PermissionRoute module="borrowings"><BorrowingsAdminPage /></PermissionRoute>} />
        <Route path="agenda" element={<PermissionRoute module="agenda"><AgendaAdminPage /></PermissionRoute>} />
        <Route path="timeline" element={<PermissionRoute module="timeline"><TimelineAdminPage /></PermissionRoute>} />
        <Route path="inventory" element={<PermissionRoute module="inventory"><InventoryAdminPage /></PermissionRoute>} />
        <Route path="facilities" element={<PermissionRoute module="facilities"><FacilitiesAdminPage /></PermissionRoute>} />
        <Route path="reports" element={<PermissionRoute module="reports"><ReportsAdminPage /></PermissionRoute>} />
        <Route path="team" element={<PermissionRoute module="team"><TeamAdminPage /></PermissionRoute>} />
        <Route path="announcements" element={<PermissionRoute module="announcements"><AnnouncementsAdminPage /></PermissionRoute>} />
        <Route path="aspirasi" element={<PermissionRoute module="aspirasi"><AspirasiAdminPage /></PermissionRoute>} />
        <Route path="statistics" element={<PermissionRoute module="statistics"><StatisticsPage /></PermissionRoute>} />
        <Route path="users" element={<PermissionRoute module="users"><UserManagementPage /></PermissionRoute>} />
        <Route path="roles" element={<PermissionRoute module="roles"><RolesPermissionsPage /></PermissionRoute>} />
        <Route path="facility-managers" element={<PermissionRoute module="facility_managers"><FacilityManagersPage /></PermissionRoute>} />
        <Route path="workflows" element={<PermissionRoute module="workflows"><ApprovalWorkflowPage /></PermissionRoute>} />
        <Route path="system-config" element={<PermissionRoute module="system_config"><SystemConfigPage /></PermissionRoute>} />
        <Route path="approver-emails" element={<PermissionRoute module="approver_emails"><ApproverEmailsPage /></PermissionRoute>} />
        <Route path="activity-logs" element={<SuperAdminRoute><ActivityLogsPage /></SuperAdminRoute>} />
        <Route path="system-settings" element={<SuperAdminRoute><SystemSettingsPage /></SuperAdminRoute>} />
        <Route path="lainnya/input-kavling" element={<ActionPermissionRoute module="kavling" action="create"><InputKavlingPage /></ActionPermissionRoute>} />
        <Route path="lainnya/data-kavling" element={<PermissionRoute module="kavling"><DataKavlingPage /></PermissionRoute>} />
        <Route path="lainnya/master-kelas" element={<PermissionRoute module="master_data"><MasterKelasPage /></PermissionRoute>} />
        <Route path="lainnya/master-ekstrakurikuler" element={<PermissionRoute module="master_data"><MasterEkstrakurikulerPage /></PermissionRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
