import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import 'antd/dist/reset.css'; // Add this line
import StockChart from './components/StockChart';
import TradeEntry from './components/TradeEntry';
import TradeSummary from './components/TradeSummary';
import DataFetch from './components/DataFetch';

const { Header, Content } = Layout;

function NavMenu() {
  const location = useLocation();
  const menuItems = [
    { key: '/', label: 'Chart', path: '/' },
    { key: '/trades', label: 'Trade Entry', path: '/trades' },
    { key: '/trade-summary', label: 'Trade Summary', path: '/trade-summary' },
    { key: '/data-fetch', label: 'Fetch Data', path: '/data-fetch' },
  ];

  return (
    <Menu
      theme="dark"
      mode="horizontal"
      selectedKeys={[location.pathname]}
    >
      {menuItems.map(item => (
        <Menu.Item key={item.key}>
          <Link to={item.path}>{item.label}</Link>
        </Menu.Item>
      ))}
    </Menu>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout className="layout">
        <Header>
          <NavMenu />
        </Header>
        <Content style={{ padding: '24px', minHeight: 'calc(100vh - 64px)' }}>
          <Routes>
            <Route path="/" element={<StockChart />} />
            <Route path="/trades" element={<TradeEntry />} />
            <Route path="/trade-summary" element={<TradeSummary />} />
            <Route path="/data-fetch" element={<DataFetch />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
