import { createBrowserRouter } from 'react-router';

import { MainLayout } from './layouts/MainLayout.tsx';
import { About } from './pages/About.tsx';
import { Home } from './pages/Home.tsx';
import { NotFound } from './pages/NotFound.tsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'about', element: <About /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
