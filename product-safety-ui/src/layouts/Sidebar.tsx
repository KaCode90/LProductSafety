import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShieldCheck, PackageSearch, Settings, FolderOpen, Briefcase, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import navigation from '../../../backend/navigation.json';
import { cn } from '../lib/utils';

const icons: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboard, 'shield-check': ShieldCheck,
  'package-search': PackageSearch, settings: Settings, 'folder-open': FolderOpen, briefcase: Briefcase,
};

export default function Sidebar() {
  const { pathname } = useLocation();
  const activeGroup = navigation.find(item => pathname === item.href || pathname.startsWith(item.href + '/'));
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <aside aria-label="Menu chính" className={cn('flex shrink-0 flex-col border-r bg-white shadow-sm transition-all', collapsed ? 'w-20' : 'w-72 max-w-[80vw]')}>
      <div className="flex min-h-16 items-center justify-between gap-2 border-b px-4">
        {!collapsed && <Link to="/dashboard" className="flex items-center gap-2 font-bold text-blue-900"><ShieldCheck className="h-7 w-7 shrink-0" />Product Safety</Link>}
        <button type="button" className="rounded p-2 hover:bg-gray-100" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'} aria-expanded={!collapsed}>
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navigation.map(item => {
          const Icon = icons[item.icon];
          const active = activeGroup?.id === item.id;
          const open = !collapsed && (expanded[item.id] ?? active);
          return <div key={item.id}>
            <div className={cn('flex items-center rounded-md', active ? 'bg-blue-50 text-blue-800' : 'text-gray-700 hover:bg-gray-50')}>
              <Link to={item.href} title={item.name} onClick={() => { if (collapsed && item.children.length) setCollapsed(false); setExpanded(prev => ({ ...prev, [item.id]: true })); }} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-sm font-semibold" aria-current={pathname === item.href ? 'page' : undefined}>
                <Icon size={20} className="shrink-0" />{!collapsed && <span>{item.name}</span>}
              </Link>
              {!!item.children.length && !collapsed && <button type="button" aria-label={(open ? 'Thu gọn ' : 'Mở ') + item.name} aria-expanded={open} aria-controls={'submenu-' + item.id} className="rounded p-2" onClick={() => setExpanded(prev => ({ ...prev, [item.id]: !open }))}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>}
            </div>
            {!!item.children.length && open && <div id={'submenu-' + item.id} className="ml-5 my-1 space-y-1 border-l pl-3">
              {item.children.map(sub => <Link key={sub.href} to={sub.href} aria-current={pathname === sub.href ? 'page' : undefined} className={cn('block rounded-md px-3 py-2 text-sm', pathname === sub.href ? 'bg-blue-50 font-semibold text-blue-800' : 'text-gray-600 hover:bg-gray-50')}>{sub.name}</Link>)}
            </div>}
          </div>;
        })}
      </nav>
      <div className="border-t p-4"><div className="flex items-center gap-3"><span className="rounded-full bg-blue-900 p-2 text-xs font-bold text-white">QA</span>{!collapsed && <div><p className="text-sm font-semibold">QA Manager</p><p className="text-xs text-gray-500">Product Safety</p></div>}</div></div>
    </aside>
  );
}
