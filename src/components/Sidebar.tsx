import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Package, 
  Store, 
  Image as ImageIcon, 
  ChevronRight
} from 'lucide-react';

import './Sidebar.css';

const Sidebar: React.FC = () => {
  const menuItems = [
    { name: 'Products', path: '/products', icon: Package },
    { name: 'Stores', path: '/stores', icon: Store },
    { name: 'Images', path: '/images', icon: ImageIcon },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-branding">
        <h2 className="sidebar-brand-title">
          DELIVERY<span className="sidebar-brand-text">ADMIN</span>
        </h2>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.name}</span>
            <ChevronRight size={14} className="sidebar-chevron" />
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
