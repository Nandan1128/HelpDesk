import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800/80 bg-slate-950/40 py-4 px-6 text-center text-xs text-slate-500">
        AI-Powered Ticket Management System &copy; {new Date().getFullYear()} &bull; Express, React, Better Auth &amp; Gemini
      </footer>
    </div>
  );
}

export default Layout;
