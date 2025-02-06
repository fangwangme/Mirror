import React, { useState, useEffect, useRef } from 'react';
import { Select, DatePicker, Card, Table, Space, Button } from 'antd';
import moment from 'moment';  // Remove timezone
import { createChart } from 'lightweight-charts';
import { ENDPOINTS } from '../config/api';

const { Option } = Select;

const TradeSummary = () => {
  const [symbol, setSymbol] = useState('SPY');
  const [date, setDate] = useState(null); // Changed from moment() to null
  const [trades, setTrades] = useState([]);
  const [marketData, setMarketData] = useState([]);
  const [profitSummary, setProfitSummary] = useState([]);
  const [interval, setInterval] = useState("2m");
  const chartContainerRef = useRef();
  const chartRef = useRef();

  const handleIntervalChange = (value) => {
    setInterval(value);
  };

  // NEW: fetchMarketData only when Search is clicked
  const fetchMarketData = async () => {
    try {
      if (!symbol || !date) return;
      const formattedDate = date.format('YYYY-MM-DD');
      const response = await fetch(`/api/stock-data?symbol=${symbol}&date=${formattedDate}`);
      const data = await response.json();
      if (data && Array.isArray(data) && data.length > 0) {
        setMarketData(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Color scheme for different trade types
  const tradeColors = {
    BUY: { CALL: '#26a69a', PUT: '#4CAF50' },
    SELL: { CALL: '#ef5350', PUT: '#f44336' },
    BTO: { CALL: '#26a69a', PUT: '#4CAF50' },
    STC: { CALL: '#ef5350', PUT: '#f44336' },
    STO: { CALL: '#ef5350', PUT: '#f44336' },
    BTC: { CALL: '#26a69a', PUT: '#4CAF50' }
  };

  // Helper function to convert any timestamp to NY time
  const toNYTime = (timestamp) => {
    return moment.tz(timestamp, "America/New_York");
  };

  // Helper function to convert market data time to match trade time
  const normalizeMarketTime = (marketTime) => {
    // Convert market data time (which has timezone) to NY time without timezone info
    return toNYTime(marketTime).format('YYYY-MM-DD HH:mm:00');
  };

  // Modified aggregateData to correctly handle New York timezone conversion
  const aggregateData = (data, minutesInterval) => {
    const grouped = {};
    data.forEach(item => {
      // Assuming item.tradetime is a datetime string (e.g., "2023-10-03 09:31:00")
      const timestamp = moment.tz(item.tradetime, "America/New_York");
      const minutes = timestamp.minutes();
      timestamp.minutes(Math.floor(minutes / minutesInterval) * minutesInterval)
               .seconds(0);
      const key = timestamp.unix();
      if (!grouped[key]) {
        grouped[key] = {
          time: key,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: parseFloat(item.volume)
        };
      } else {
        grouped[key].high = Math.max(grouped[key].high, parseFloat(item.high));
        grouped[key].low = Math.min(grouped[key].low, parseFloat(item.low));
        grouped[key].close = parseFloat(item.close);
        grouped[key].volume += parseFloat(item.volume);
      }
    });
    return Object.values(grouped).sort((a, b) => a.time - b.time);
  };

  // Calculate profit summary for each trade name
  const calculateProfits = (trades) => {
    const profitMap = {};
    
    trades.forEach(trade => {
      if (!profitMap[trade.name]) {
        profitMap[trade.name] = {
          name: trade.name,
          totalProfit: 0,
          trades: []
        };
      }

      // Add trade to the list
      profitMap[trade.name].trades.push(trade);

      // Calculate running profit
      if (['SELL', 'STC'].includes(trade.action)) {
        let matchingBuy = profitMap[trade.name].trades.find(t => 
          ['BUY', 'BTO'].includes(t.action) && 
          t.size === trade.size &&
          !t.matched
        );

        if (matchingBuy) {
          matchingBuy.matched = true;
          const profit = (trade.action_price - matchingBuy.action_price) * trade.size * 100;
          profitMap[trade.name].totalProfit += profit;
        }
      }
    });

    return Object.values(profitMap);
  };

  const normalizeDateTime = (timestamp) => {
    // Convert any timestamp to NY timezone and strip timezone info
    return moment.tz(timestamp, "America/New_York").format('YYYY-MM-DD HH:mm:00');
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const formattedDate = date.format('YYYY-MM-DD');
        
        // Fetch market data and trades
        const [marketResponse, tradesResponse] = await Promise.all([
          fetch(`${ENDPOINTS.STOCK_DATA}?symbol=${symbol}&date=${formattedDate}`),
          fetch(ENDPOINTS.TRADES)
        ]);

        const marketData = await marketResponse.json();
        const tradesData = await tradesResponse.json();

        // Filter trades and convert market data times
        const normalizedMarketData = marketData.map(item => ({
          ...item,
          tradetime: normalizeMarketTime(item.tradetime)
        }));

        const filteredTrades = tradesData.filter(trade => 
          trade.symbol === symbol && 
          moment(trade.action_datetime).format('YYYY-MM-DD') === formattedDate
        );

        // Update chart
        if (chartRef.current) {
          const { candlestickSeries, markerSeries } = chartRef.current;
          
          // Aggregate data with normalized timestamps
          const minutesInterval = parseInt(interval.replace('m',''));
          const aggregatedData = aggregateData(normalizedMarketData, minutesInterval);

          // Create markers with normalized timestamps
          const markers = filteredTrades.map(trade => {
            // Use unix timestamp for chart markers
            const tradeTime = moment(trade.action_datetime).unix();
            const isCall = trade.name.toLowerCase().includes('call');
            const optionType = isCall ? 'CALL' : 'PUT';
            
            return {
              time: tradeTime,
              position: trade.action.includes('BUY') ? 'belowBar' : 'aboveBar',
              color: tradeColors[trade.action][optionType],
              shape: 'circle',
              text: `${trade.action} ${trade.size}x @ ${trade.action_price}`
            };
          });

          candlestickSeries.setData(aggregatedData);
          markerSeries.setMarkers(markers);
          chartRef.current.chart.timeScale().fitContent();
        }

      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [symbol, date, interval]);

  useEffect(() => {
    if (chartContainerRef.current && marketData.length > 0) {
      const minutesInterval = parseInt(interval.replace('m',''));
      const aggregated = aggregateData(marketData, minutesInterval);
      const chart = createChart(chartContainerRef.current, {
        height: 500,  // Changed from 300 to 500
        layout: {
          backgroundColor: '#ffffff',
          textColor: '#333'
        },
        grid: {
          vertLines: { color: '#f0f0f0' },
          horzLines: { color: '#f0f0f0' }
        },
        crosshair: { mode: 'normal' },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 12,
          barSpacing: 12,
          minBarSpacing: 2,
          tickMarkFormatter: (time) =>
            moment.tz(time * 1000, "America/New_York").format("HH:mm"),
          borderColor: '#D1D4DC',
          fixLeftEdge: true,
          fixRightEdge: true,
        }
      });

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350'
      });

      const volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      // Configure volume scale
      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      // Set data and fit content
      candlestickSeries.setData(aggregated);
      chart.timeScale().fitContent();

      chartRef.current = chart;

      return () => chart.remove();
    }
  }, [marketData, interval]);

  // Columns for profit summary table
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Total Profit/Loss',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      render: value => `$${value.toFixed(2)}`,
      sorter: (a, b) => a.totalProfit - b.totalProfit,
    }
  ];

  return (
    <div className="trade-summary">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space>
          <Select
            value={symbol}
            onChange={setSymbol}
            style={{ width: 120 }}
          >
            <Option value="SPY">SPY</Option>
            <Option value="QQQ">QQQ</Option>
          </Select>
          
          <DatePicker
            value={date}
            onChange={setDate}
            disabledDate={current => current && current > moment().endOf('day')}
            style={{ width: 120 }}
          />

          <Select value={interval} onChange={handleIntervalChange} style={{ width: 120 }}>
            <Option value="1m">1m</Option>
            <Option value="2m">2m</Option>
            <Option value="5m">5m</Option>
            <Option value="10m">10m</Option>
          </Select>
          <Button type="primary" onClick={fetchMarketData}>Search</Button>
        </Space>

        <div 
          ref={chartContainerRef}
          style={{ 
            width: '100%',
            height: '500px',  // Changed from 300px to 500px
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />

        <Card title="Profit Summary">
          <Table
            dataSource={profitSummary}
            columns={columns}
            pagination={false}
            rowKey="name"
          />
        </Card>
      </Space>
    </div>
  );
};

export default TradeSummary;
