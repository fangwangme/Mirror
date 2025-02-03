import React, { useState, useEffect, useRef } from 'react';
import { Select, DatePicker, Card, Table, Space } from 'antd';
import moment from 'moment-timezone';  // Use moment-timezone
import { createChart } from 'lightweight-charts';
import { ENDPOINTS } from '../config/api';

const { Option } = Select;

const TradeSummary = () => {
  const [symbol, setSymbol] = useState('SPY');
  const [date, setDate] = useState(moment());
  const [trades, setTrades] = useState([]);
  const [marketData, setMarketData] = useState([]);
  const [profitSummary, setProfitSummary] = useState([]);
  const chartContainerRef = useRef();
  const chartRef = useRef();

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

  // Aggregate 1m market data to 2m
  const aggregate2MinData = (data) => {
    const groupedData = {};
    data.forEach(item => {
      const timestamp = new Date(item.tradetime);
      timestamp.setMinutes(Math.floor(timestamp.getMinutes() / 2) * 2);
      timestamp.setSeconds(0);
      const timeKey = timestamp.getTime();

      if (!groupedData[timeKey]) {
        groupedData[timeKey] = {
          time: timeKey / 1000,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume
        };
      } else {
        groupedData[timeKey].high = Math.max(groupedData[timeKey].high, item.high);
        groupedData[timeKey].low = Math.min(groupedData[timeKey].low, item.low);
        groupedData[timeKey].close = item.close;
        groupedData[timeKey].volume += item.volume;
      }
    });
    return Object.values(groupedData);
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
    if (chartContainerRef.current) {
      const chart = createChart(chartContainerRef.current, {
        height: 500,
        layout: {
          backgroundColor: '#ffffff',
          textColor: '#333',
        },
        grid: {
          vertLines: { color: '#f0f0f0' },
          horzLines: { color: '#f0f0f0' },
        },
        crosshair: {
          mode: 'normal',
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });

      // Create marker series for trades
      const markerSeries = chart.addLineSeries({
        lastValueVisible: false,
      });

      chartRef.current = {
        chart,
        candlestickSeries,
        markerSeries
      };

      return () => {
        chart.remove();
      };
    }
  }, []);

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
          const aggregatedData = aggregate2MinData(normalizedMarketData);

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
  }, [symbol, date]);

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
          />
        </Space>

        <div 
          ref={chartContainerRef}
          style={{ 
            width: '100%',
            height: '500px',
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
