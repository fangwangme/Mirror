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
    { key: '/', label: <Link to="/">Chart</Link> },
    { key: '/trades', label: <Link to="/trades">Trade Entry</Link> },
    { key: '/trade-summary', label: <Link to="/trade-summary">Trade Summary</Link> },
    { key: '/data-fetch', label: <Link to="/data-fetch">Fetch Data</Link> }
  ];

  return (
    <Menu
      theme="dark"
      mode="horizontal"
      selectedKeys={[location.pathname]}
      items={menuItems}  // Changed from children to items
    />
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
