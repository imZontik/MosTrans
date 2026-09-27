import { lazy } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Layout } from '@/components/Layout'
import { AdminLayout } from '@/components/AdminLayout'
import { EmergencyOverlay } from '@/components/EmergencyOverlay'
import { LogoMark } from '@/components/Logo'
import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'
import ScenariosPage from '@/pages/ScenariosPage'
import PlayPage from '@/pages/PlayPage'
import TournamentPage from '@/pages/TournamentPage'
import LeaderboardPage from '@/pages/LeaderboardPage'
import ProfilePage from '@/pages/ProfilePage'
import AchievementsPage from '@/pages/AchievementsPage'
import RunHistoryPage from '@/pages/RunHistoryPage'
import NotificationsPage from '@/pages/NotificationsPage'
import { NotificationsProvider } from '@/notifications/NotificationsContext'
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'))
const EmployeesPage = lazy(() => import('@/pages/admin/EmployeesPage'))
const EmployeeDetailPage = lazy(() => import('@/pages/admin/EmployeeDetailPage'))
const AdminScenariosPage = lazy(() => import('@/pages/admin/ScenariosPage'))
const ScenarioEditorPage = lazy(() => import('@/pages/admin/ScenarioEditorPage'))
const GeneratePage = lazy(() => import('@/pages/admin/GeneratePage'))
const AdminTournamentsPage = lazy(() => import('@/pages/admin/TournamentsPage'))
const EmergenciesPage = lazy(() => import('@/pages/admin/EmergenciesPage'))
const AssistantPage = lazy(() => import('@/pages/admin/AssistantPage'))
const BroadcastsPage = lazy(() => import('@/pages/admin/BroadcastsPage'))

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg" role="status" aria-label="Загрузка">
      <LogoMark className="h-12 w-12" />
    </div>
  )
}

function RequireAuth() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <Splash />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return (
    <NotificationsProvider>
      <Outlet />
      <EmergencyOverlay />
    </NotificationsProvider>
  )
}

function RequireStaff() {
  const { isStaff } = useAuth()
  return isStaff ? <Outlet /> : <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="scenarios" element={<ScenariosPage />} />
          <Route path="tournament" element={<TournamentPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/achievements" element={<AchievementsPage />} />
          <Route path="profile/history" element={<RunHistoryPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="users/:userId" element={<ProfilePage />} />
          <Route path="users/:userId/achievements" element={<AchievementsPage />} />
        </Route>
        <Route path="play/:runId" element={<PlayPage />} />
        <Route path="admin" element={<RequireStaff />}>
          <Route element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="employees/:userId" element={<EmployeeDetailPage />} />
            <Route path="scenarios" element={<AdminScenariosPage />} />
            <Route path="scenarios/generate" element={<GeneratePage />} />
            <Route path="scenarios/:scenarioId" element={<ScenarioEditorPage />} />
            <Route path="tournaments" element={<AdminTournamentsPage />} />
            <Route path="emergencies" element={<EmergenciesPage />} />
            <Route path="assistant" element={<AssistantPage />} />
            <Route path="broadcasts" element={<BroadcastsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
