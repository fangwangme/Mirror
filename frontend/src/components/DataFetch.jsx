import React, { useState } from 'react';
import { Button, Space, message } from 'antd';
import { ENDPOINTS } from '../config/api';

const DataFetch = () => {
  const [loadingSPY, setLoadingSPY] = useState(false);
  const [loadingQQQ, setLoadingQQQ] = useState(false);

  const handleFetch = async (symbol) => {
    const setLoading = symbol === 'SPY' ? setLoadingSPY : setLoadingQQQ;
    setLoading(true);
    
    try {
      const response = await fetch(ENDPOINTS.FETCH_MARKET_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${symbol} data`);
      }

      const data = await response.json();
      message.success(`${data.message} (${data.rows} data points)`);
    } catch (error) {
      message.error(`Failed to fetch ${symbol} data`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="data-fetch">
      <h2>Fetch Market Data</h2>
      <Space size="large">
        <Button 
          type="primary" 
          onClick={() => handleFetch('SPY')} 
          loading={loadingSPY}
        >
          Fetch SPY 1-Minute Data
        </Button>
        <Button 
          type="primary" 
          onClick={() => handleFetch('QQQ')} 
          loading={loadingQQQ}
        >
          Fetch QQQ 1-Minute Data
        </Button>
      </Space>
    </div>
  );
};

export default DataFetch;
