import React, { useState, useEffect, useRef } from 'react';
import { Select, DatePicker, Button, Space, message } from 'antd';
import moment from 'moment-timezone';  // Use moment-timezone
import { createChart } from 'lightweight-charts';
import { ENDPOINTS } from '../config/api';

const StockChart = () => {
  const [symbol, setSymbol] = useState('SPY');
  const [date, setDate] = useState(moment()); // Use regular moment
  const [currentBar, setCurrentBar] = useState(null);
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const legendRef = useRef();

  // Update aggregate2MinData function to handle NY timezone
  const aggregate2MinData = (data) => {
    const groupedData = {};
    
    data.forEach(item => {
      // Convert to NY timezone for proper grouping
      const timestamp = moment.tz(item.tradetime, 'America/New_York');
      const minutes = timestamp.minutes();
      timestamp.minutes(Math.floor(minutes / 2) * 2);
      timestamp.seconds(0);
      const timeKey = timestamp.unix();

      if (!groupedData[timeKey]) {
        groupedData[timeKey] = {
          time: timeKey,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: parseInt(item.volume)
        };
      } else {
        groupedData[timeKey].high = Math.max(groupedData[timeKey].high, parseFloat(item.high));
        groupedData[timeKey].low = Math.min(groupedData[timeKey].low, parseFloat(item.low));
        groupedData[timeKey].close = parseFloat(item.close);
        groupedData[timeKey].volume += parseInt(item.volume);
      }
    });

    return Object.values(groupedData).sort((a, b) => a.time - b.time);
  };

  const fetchStockData = async () => {
    try {
      // Format date in local timezone, backend expects YYYY-MM-DD
      const formattedDate = date.format('YYYY-MM-DD');
      console.log('Fetching data for date:', formattedDate); // Debug log
      
      const response = await fetch(
        `/api/stock-data?symbol=${symbol}&date=${formattedDate}`
      );
      const data = await response.json();

      if (!data || data.error) {
        throw new Error(data.error || 'Failed to fetch data');
      }

      if (chartRef.current && data.length > 0) {
        const { candlestickSeries, volumeSeries } = chartRef.current;
        
        // Aggregate and format the data
        const aggregatedData = aggregate2MinData(data);
        console.log('Aggregated data:', aggregatedData.length, 'bars'); // Debug log
        
        candlestickSeries.setData(aggregatedData);
        volumeSeries.setData(aggregatedData.map(item => ({
          time: item.time,
          value: item.volume,
          color: item.close >= item.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
        })));
        
        chartRef.current.chart.timeScale().fitContent();
        message.success(`Loaded ${data.length} data points`);
      } else {
        message.info('No data available for selected date');
      }
    } catch (error) {
      console.error('Error fetching stock data:', error);
      message.error('Failed to fetch stock data');
    }
  };

  // Add timezone conversion helper
  const convertToNYTime = (timestamp) => {
    return moment.tz(timestamp, "America/New_York");
  };

  // Add legend component
  const renderLegend = (bar) => {
    if (!bar) return '';
    const nyTime = convertToNYTime(bar.time * 1000);
    return `
      <div style="padding: 12px; background: white; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; line-height: 1.5;">
        <div>Time (NY): ${nyTime.format('HH:mm')} - ${nyTime.add(2, 'minutes').format('HH:mm')}</div>
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
    if (chartContainerRef.current) {
      // Create legend container
      legendRef.current = document.createElement('div');
      legendRef.current.style.position = 'absolute';
      legendRef.current.style.left = '12px';
      legendRef.current.style.top = '12px';
      legendRef.current.style.zIndex = '2';
      chartContainerRef.current.appendChild(legendRef.current);

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
          rightOffset: 12,
          barSpacing: 6, // Increased spacing for better visibility
          tickMarkFormatter: (time) => {
            return moment.tz(time * 1000, 'America/New_York').format('HH:mm');
          },
        },
      });

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
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

      // Add crosshair move handler
      chart.subscribeCrosshairMove((param) => {
        if (param.time && param.point) {
          const currentData = param.seriesData.get(candlestickSeries);
          if (currentData) {
            const volumeData = param.seriesData.get(volumeSeries);
            setCurrentBar({
              ...currentData,
              time: param.time,
              volume: volumeData?.value || 0
            });
          }
        } else {
          setCurrentBar(null);
        }
      });

      // Adjust chart size when window resizes
      const handleResize = () => {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      };

      window.addEventListener('resize', handleResize);
      handleResize();

      chartRef.current = {
        chart,
        candlestickSeries,
        volumeSeries,
      };

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        if (legendRef.current && legendRef.current.parentNode) {
          legendRef.current.parentNode.removeChild(legendRef.current);
        }
      };
    }
  }, []);

  const handleSearch = async () => {
    if (!symbol || !date) {
      message.error('Please select both symbol and date');
      return;
    }
    await fetchStockData();
  };

  // Update legend when current bar changes
  useEffect(() => {
    if (legendRef.current) {
      legendRef.current.innerHTML = renderLegend(currentBar);
    }
  }, [currentBar]);

  return (
    <div className="stock-chart">
      <h2>Stock Price Chart</h2>
      <Space className="controls" style={{ marginBottom: '20px' }}>
        <Select
          value={symbol}
          onChange={setSymbol}
          style={{ width: 120 }}
        >
          <Select.Option value="SPY">SPY</Select.Option>
          <Select.Option value="QQQ">QQQ</Select.Option>
        </Select>
        
        <DatePicker
          value={date}
          onChange={newDate => setDate(newDate)}
          disabledDate={current => current && current > moment().endOf('day')}
        />

        <Button 
          type="primary" 
          onClick={handleSearch}
        >
          Search
        </Button>
      </Space>

      <div 
        ref={chartContainerRef}
        style={{ 
          width: '100%',
          height: '600px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          position: 'relative'
        }}
      />
    </div>
  );
};

export default StockChart;
