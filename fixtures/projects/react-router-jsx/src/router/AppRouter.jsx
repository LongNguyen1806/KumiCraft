import { Route, Routes } from 'react-router';

import MainLayout from '../layouts/MainLayout';
import Dashboard from '../pages/Dashboard';
import Tasks from '../pages/Tasks';

export default function AppRouter() {
  return (
    <Routes>
      <Route path='/' element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path='tasks' element={<Tasks />} />
      </Route>
    </Routes>
  );
}
