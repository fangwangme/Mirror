import React, { useState, useEffect, useRef } from 'react';
import { Select, DatePicker, Card, Table, Space, Button, message } from 'antd';
import moment from 'moment-timezone';
import { createChart } from 'lightweight-charts';
import { ENDPOINTS } from '../config/api';

const { Option } = Select;

const TradeSummary = () => {
  const [symbol, setSymbol] = useState('SPY');
  const [date, setDate] = useState(null);
  const [trades, setTrades] = useState([]);
  const [marketData, setMarketData] = useState([]);
  const [profitSummary, setProfitSummary] = useState([]);
  const [interval, setInterval] = useState("2m");
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const [tradeData, setTradeData] = useState([]);
  const [totalProfit, setTotalProfit] = useState(0);

  const handleIntervalChange = (value) => {
    setInterval(value);
  };

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

  const tradeColors = {
    BUY: { CALL: '#26a69a', PUT: '#4CAF50' },
    SELL: { CALL: '#ef5350', PUT: '#f44336' }
  };

  const aggregateData = (data, minutesInterval) => {
    const grouped = {};
    data.forEach(item => {
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

  const calculateProfits = (trades) => {
    const profitsByName = {};
    let totalPnL = 0;

    // Sort trades by datetime for proper order
    const sortedTrades = [...trades].sort((a, b) => 
      moment(a.action_datetime).valueOf() - moment(b.action_datetime).valueOf()
    );

    sortedTrades.forEach(trade => {
      const name = trade.name;
      if (!profitsByName[name]) {
        profitsByName[name] = {
          name,
          buyValue: 0,
          sellValue: 0,
          totalFees: 0,
          trades: []
        };
      }

      const entry = profitsByName[name];
      const tradeValue = trade.action_price * trade.size; // Removed * 100
      const fee = trade.fee || 0;

      if (trade.action === 'BUY') {
        entry.buyValue += tradeValue;
        entry.totalFees += fee;
      } else if (trade.action === 'SELL') {
        entry.sellValue += tradeValue;
        entry.totalFees += fee;
      }

      entry.trades.push(trade);
    });

    // Calculate final stats for each name
    const summaries = Object.values(profitsByName).map(summary => ({
      name: summary.name,
      totalTrades: summary.trades.length,
      buyAmount: summary.buyValue,
      sellAmount: summary.sellValue,
      totalFees: summary.totalFees,
      totalPnL: summary.sellValue - summary.buyValue - summary.totalFees,
      trades: summary.trades
    }));

    setProfitSummary(summaries);
    setTotalProfit(summaries.reduce((acc, curr) => acc + curr.totalPnL, 0));
  };

  const calculateTradeProfit = (buyTrade, sellTrade) => {
    const buyFee = buyTrade.fee || 0;
    const sellFee = sellTrade.fee || 0;
    return (
      (sellTrade.action_price - buyTrade.action_price) * buyTrade.size * 100 - buyFee - sellFee
    );
  };

  const fetchData = async () => {
    try {
      if (!date || !symbol) {
        return; // Exit early without error if no date selected
      }
      const formattedDate = date.format('YYYY-MM-DD');
      
      const [marketResponse, tradesResponse] = await Promise.all([
        fetch(`${ENDPOINTS.STOCK_DATA}?symbol=${symbol}&date=${formattedDate}`),
        fetch(`${ENDPOINTS.TRADES}?symbol=${symbol}&date=${formattedDate}`)
      ]);

      const marketData = await marketResponse.json();
      const trades = await tradesResponse.json();

      if (marketData && Array.isArray(marketData)) {
        setMarketData(marketData);
      }

      if (trades && Array.isArray(trades)) {
        setTradeData(trades);
        calculateProfits(trades);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  // Fix formatTime to use NY timezone
  const formatTime = (timestamp) => {
    return moment.tz(timestamp * 1000, "America/New_York").format("HH:mm");
  };

  const renderLegend = (bar) => {
    if (!bar) return '';
    const minutesInterval = parseInt(interval.replace('m',''));
    // Use NY timezone for bar time
    const nyTime = moment.tz(bar.time * 1000, "America/New_York");
    const minutes = nyTime.minutes();
    const roundedMinutes = Math.floor(minutes / minutesInterval) * minutesInterval;
    nyTime.minutes(roundedMinutes).seconds(0);
    
    const timeStr = nyTime.format("HH:mm");
    const nextTime = moment(nyTime).add(minutesInterval, "minutes").format("HH:mm");
    
    return `
      <div style="padding: 12px; background: white; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; line-height: 1.5;">
        <div>Time: ${timeStr} - ${nextTime}</div>
        <div style="color: ${bar.close >= bar.open ? '#26a69a' : '#ef5350'}">
          Open: ${bar.open.toFixed(2)}
          High: ${bar.high.toFixed(2)}
          Low: ${bar.low.toFixed(2)}
          Close: ${bar.close.toFixed(2)}
        </div>
        <div>Volume: ${bar.volume.toLocaleString()}</div>
      </div>
    `;
  };

  useEffect(() => {
    if (chartContainerRef.current && marketData.length > 0) {
      const minutesInterval = parseInt(interval.replace('m',''));
      const aggregated = aggregateData(marketData, minutesInterval);
      const chart = createChart(chartContainerRef.current, {
        height: 500,
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
        },
        localization: {
          timeFormatter: (timestamp) =>
            moment.tz(timestamp * 1000, "America/New_York").format("HH:mm")
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

      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      candlestickSeries.setData(aggregated);
      chart.timeScale().fitContent();

      chartRef.current = chart;

      return () => chart.remove();
    }
  }, [marketData, interval]);

  const tradeColumns = [
    { 
      title: 'Symbol', 
      dataIndex: 'symbol',
      sorter: (a, b) => a.symbol.localeCompare(b.symbol),
    },
    { 
      title: 'Name', 
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    { 
      title: 'Action', 
      dataIndex: 'action',
      sorter: (a, b) => a.action.localeCompare(b.action),
    },
    { 
      title: 'Action Time', 
      dataIndex: 'action_datetime',
      sorter: (a, b) => moment(a.action_datetime).unix() - moment(b.action_datetime).unix(),
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss')
    },
    { 
      title: 'Price', 
      dataIndex: 'action_price',
      sorter: (a, b) => a.action_price - b.action_price,
      render: (value) => value.toFixed(2),
    },
    { 
      title: 'Stop Loss', 
      dataIndex: 'stop_loss',
      sorter: (a, b) => (a.stop_loss || 0) - (b.stop_loss || 0),
      render: (value) => value ? value.toFixed(2) : '-'
    },
    { 
      title: 'Exit Target', 
      dataIndex: 'exit_target',
      sorter: (a, b) => (a.exit_target || 0) - (b.exit_target || 0),
      render: (value) => value ? value.toFixed(2) : '-'
    },
    { 
      title: 'Size', 
      dataIndex: 'size',
      sorter: (a, b) => a.size - b.size,
    },
    { 
      title: 'Fee', 
      dataIndex: 'fee',
      sorter: (a, b) => a.fee - b.fee,
    },
  ];

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Total Trades',
      dataIndex: 'totalTrades',
      sorter: (a, b) => a.totalTrades - b.totalTrades,
    },
    {
      title: 'Buy/Sell',
      render: (_, record) => `${record.buyCount}/${record.sellCount}`,
    },
    {
      title: 'Remaining Size',
      dataIndex: 'remainingSize',
      sorter: (a, b) => a.remainingSize - b.remainingSize,
    },
    {
      title: 'Realized P/L',
      dataIndex: 'realizedPnL',
      render: (value) => (
        <span style={{ color: value >= 0 ? '#26a69a' : '#ef5350' }}>
          ${value.toFixed(2)}
        </span>
      ),
      sorter: (a, b) => a.realizedPnL - b.realizedPnL,
    },
    {
      title: 'Total Fees',
      dataIndex: 'totalFees',
      render: (value) => `$${value.toFixed(2)}`,
      sorter: (a, b) => a.totalFees - b.totalFees,
    }
  ];

  const statColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Total P/L',
      dataIndex: 'totalPnL',
      key: 'totalPnL',
      render: (value) => (
        <span style={{ color: (value || 0) >= 0 ? '#26a69a' : '#ef5350', fontWeight: 'bold' }}>
          ${(value || 0).toFixed(2)}
        </span>
      ),
      sorter: (a, b) => (a.totalPnL || 0) - (b.totalPnL || 0),
    },
    {
      title: 'Trades',
      dataIndex: 'trades',
      key: 'trades',
      render: (trades) => `${(trades || []).length}`,
      sorter: (a, b) => (a.trades || []).length - (b.trades || []).length,
    },
    {
      title: 'Buy Amount',
      dataIndex: 'buyAmount',
      key: 'buyAmount',
      render: (value) => `$${(value || 0).toFixed(2)}`,
    },
    {
      title: 'Sell Amount',
      dataIndex: 'sellAmount',
      key: 'sellAmount',
      render: (value) => `$${(value || 0).toFixed(2)}`,
    },
    {
      title: 'Total Fees',
      dataIndex: 'totalFees',
      key: 'totalFees',
      render: (value) => `$${(value || 0).toFixed(2)}`,
    }
  ];

  const handleSearch = async () => {
    try {
      if (!symbol || !date) {
        message.error('Please select both symbol and date');
        return;
      }

      const formattedDate = date.format('YYYY-MM-DD');
      
      // Fetch both market data and trades
      const [marketResponse, tradesResponse] = await Promise.all([
        fetch(`${ENDPOINTS.STOCK_DATA}?symbol=${symbol}&date=${formattedDate}`),
        fetch(`${ENDPOINTS.TRADES}?symbol=${symbol}&date=${formattedDate}`)
      ]);

      const marketData = await marketResponse.json();
      const trades = await tradesResponse.json();

      if (marketData && Array.isArray(marketData)) {
        setMarketData(marketData);
      }

      if (trades && Array.isArray(trades)) {
        setTradeData(trades);
        calculateProfits(trades);
      }

      message.success('Data loaded successfully');
    } catch (error) {
      console.error('Error fetching data:', error);
      message.error('Failed to fetch data');
    }
  };

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
          <Button type="primary" onClick={handleSearch}>Search</Button>
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

        <Card title="Trade Statistics">
          {/* Total P/L display */}
          <div style={{ marginBottom: '20px' }}>
            <strong>Total P/L: </strong>
            <span style={{ 
              color: totalProfit >= 0 ? '#26a69a' : '#ef5350',
              fontSize: '1.2em',
              fontWeight: 'bold'
            }}>
              ${totalProfit.toFixed(2)}
            </span>
          </div>

          {/* Statistics by Name */}
          <Table
            dataSource={profitSummary}
            columns={statColumns}
            pagination={false}
            rowKey="name"
            size="small"
            style={{ marginBottom: '24px' }}
          />

          {/* Trade List */}
          <h3>Trade Details</h3>
          <Table
            dataSource={tradeData}
            columns={tradeColumns}
            pagination={{
              pageSize: 10,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} trades`,
              showQuickJumper: true,
              showSizeChanger: false
            }}
            scroll={{ x: 1300 }}
            size="small"
            rowKey="id"
          />
        </Card>
      </Space>
    </div>
  );
};

export default TradeSummary;
