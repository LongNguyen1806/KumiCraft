import { Link, Outlet } from 'react-router';

export default function MainLayout() {
  return (
    <div>
      <nav>
        <Link to='/'>Tổng quan</Link> <Link to='/tasks'>Công việc</Link>
      </nav>
      <Outlet />
    </div>
  );
}
