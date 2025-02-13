import React, { useState, useEffect } from 'react';
import { Form, Input, Button, DatePicker, Select, InputNumber, Space, Table, message, TimePicker } from 'antd';
import moment from 'moment-timezone';
import { ENDPOINTS } from '../config/api';

const { TextArea } = Input;
const { Option } = Select;

const TradeEntry = () => {
  // Initialize form with proper array destructuring
  const [form] = Form.useForm();
  
  // State declarations
  const [trades, setTrades] = useState([]);
  const [editingTrade, setEditingTrade] = useState(null);
  const [filterSymbol, setFilterSymbol] = useState("SPY");  // Default to SPY
  const [filterDate, setFilterDate] = useState(moment().subtract(1, 'days'));  // Default to yesterday
  const [symbol, setSymbol] = useState('SPY');
  const [selectedTimezone, setSelectedTimezone] = useState("America/New_York");

  // Timezone options configuration
  const timezoneOptions = [
    { value: 'America/New_York', label: 'New York' },
    { value: 'Asia/Shanghai', label: 'Beijing' },
    { value: 'Asia/Singapore', label: 'Singapore' }
  ];

  // Add timezone change handler
  const handleTimezoneChange = (newTimezone) => {
    setSelectedTimezone(newTimezone);
    
    // Get current time value
    const currentTime = form.getFieldValue('actionTime');
    if (currentTime && moment.isMoment(currentTime)) {
      // Convert time to new timezone while preserving local time
      const newTime = moment(currentTime).tz(newTimezone, true);
      form.setFieldsValue({ actionTime: newTime });
    }
  };

  // Initial data fetch on component mount
  useEffect(() => {
    fetchTrades();
  }, []);

  // Load default form values
  useEffect(() => {
    form.setFieldsValue(initialFormValues);
  }, [form]);

  // Clean up form on unmount
  useEffect(() => {
    return () => {
      form.resetFields();
    };
  }, [form]);

  // Modified fetchTrades to include filtering
  const fetchTrades = async () => {
    try {
      let url = ENDPOINTS.TRADES;
      const params = new URLSearchParams();
      if (filterSymbol) params.append("symbol", filterSymbol);
      if (filterDate) params.append("date", filterDate.format("YYYY-MM-DD"));
      if (params.toString()) url += "?" + params.toString();

      const response = await fetch(url);
      const data = await response.json();
      setTrades(data);
    } catch (error) {
      message.error('Failed to fetch trades');
    }
  };

  const onFinish = async (values) => {
    const actionDateTime = `${values.actionDate.format('YYYY-MM-DD')} ${values.actionTime.format('HH:mm:ss')}`;

    const tradeData = {
      symbol: values.symbol,
      name: values.name.replace(/\s+/g, ''),
      action: values.action,
      actionDateTime,
      actionPrice: values.actionPrice,
      stopLoss: values.stopLoss || 0,  // Ensure stop_loss is 0 if not provided
      exitTarget: values.exitTarget || 0,  // Ensure exit_target is 0 if not provided
      size: values.size,
      fee: values.fee || 0,
      reason: values.reason,
      mentalState: values.mentalState,
      description: values.description || ''
    };

    try {
      const url = editingTrade 
        ? `${ENDPOINTS.TRADES}?id=${editingTrade.id}`
        : ENDPOINTS.TRADES;
      
      const response = await fetch(url, {
        method: editingTrade ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData)
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      message.success(`Trade ${editingTrade ? 'updated' : 'saved'} successfully`);
      form.resetFields();
      setEditingTrade(null);
      fetchTrades();
    } catch (error) {
      console.error('Error saving trade:', error);
      message.error(error.message || 'Failed to save trade');
    }
  };

  // Update edit button handler to avoid circular references
  const handleEditClick = (record) => {
    const datetime = moment.tz(record.action_datetime, "YYYY-MM-DD HH:mm:ss", "America/New_York");
    
    setSelectedTimezone("America/New_York");
    setEditingTrade(record);

    // Set the time without timezone conversion
    const formValues = {
      ...record,
      actionDate: datetime,
      actionTime: moment(datetime),  // Create new moment without timezone
      actionPrice: record.action_price,
      stopLoss: record.stop_loss || 0,
      exitTarget: record.exit_target || 0,
      mentalState: record.mental_state
    };

    console.log('Setting form time:', formValues.actionTime.format('HH:mm:ss'));
    form.setFieldsValue(formValues);
  };

  // Update columns configuration with optimized widths
  const columns = [
    { 
      title: 'Symbol', 
      dataIndex: 'symbol',
      sorter: (a, b) => a.symbol.localeCompare(b.symbol),
      width: 80,  // Reduced width
    },
    { 
      title: 'Name', 
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      width: 200,  // Increased width
    },
    { 
      title: 'Action', 
      dataIndex: 'action',
      sorter: (a, b) => a.action.localeCompare(b.action),
      width: 80,  // Reduced width
    },
    { 
      title: 'Action Time', 
      dataIndex: 'action_datetime',
      sorter: (a, b) => moment(a.action_datetime).unix() - moment(b.action_datetime).unix(),
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss'),
      width: 180,  // Increased width
    },
    { 
      title: 'Price', 
      dataIndex: 'action_price',
      sorter: (a, b) => a.action_price - b.action_price,
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
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Button onClick={() => handleEditClick(record)}>
          Edit
        </Button>
      ),
    },
  ];

  // Add fee field to existing form items
  const formItems = (
    <>
      <Space size="large" style={{ display: 'flex', marginBottom: '24px' }}>
        <Form.Item
          name="symbol"
          label="Symbol"
          rules={[{ required: true, message: 'Please enter symbol' }]}
        >
          <Select style={{ width: 120 }}>
            <Option value="SPY">SPY</Option>
            <Option value="QQQ">QQQ</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="name"
          label="Name"
          rules={[{ required: true, message: 'Please enter trade name' }]}
        >
          <Input placeholder="e.g., SPY 250201 Put 600" style={{ width: 200 }} />
        </Form.Item>
      </Space>

      <Space size="large" style={{ display: 'flex', marginBottom: '24px' }}>
        <Form.Item
          name="action"
          label="Action"
          rules={[{ required: true, message: 'Please select action' }]}
        >
          <Select style={{ width: 120 }}>
            <Option value="BUY">Buy</Option>
            <Option value="SELL">Sell</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="actionDate"
          label="Action Date"
          rules={[{ required: true }]}
        >
          <DatePicker 
            format="YYYY-MM-DD"
            disabledDate={current => current && current > moment().endOf('day')}
          />
        </Form.Item>

        <Form.Item
          name="actionTime"
          label="Action Time"
          rules={[{ required: true }]}
        >
          <Space>
            <TimePicker 
              format="HH:mm:ss"
              style={{ width: 200 }}
              onChange={(time) => {
                if (time) {
                  // Keep the original time value without timezone conversion
                  console.log('Setting time:', time.format('HH:mm:ss'));
                  form.setFieldsValue({ actionTime: time });
                }
              }}
            />
            <Select
              value={selectedTimezone}
              onChange={setSelectedTimezone}
              style={{ width: 120 }}
              options={timezoneOptions}
            />
          </Space>
        </Form.Item>

        <Form.Item
          name="actionPrice"  // Updated from action_price
          label="Action Price"
          rules={[{ required: true }]}
        >
          <InputNumber
            step={0.01}
            precision={2}
            style={{ width: 120 }}
          />
        </Form.Item>

        <Form.Item
          name="stopLoss"
          label="Stop Loss"
        >
          <InputNumber step={0.01} precision={2} style={{ width: 120 }} />
        </Form.Item>

        <Form.Item
          name="exitTarget"
          label="Exit Target"
        >
          <InputNumber step={0.01} precision={2} style={{ width: 120 }} />
        </Form.Item>

        <Form.Item
          name="size"
          label="Size"
          rules={[{ required: true }]}
        >
          <InputNumber min={1} />
        </Form.Item>

        <Form.Item
          name="fee"
          label="Fee"
          rules={[{ required: false }]}
        >
          <InputNumber
            step={0.01}
            precision={2}
            style={{ width: 120 }}
          />
        </Form.Item>
      </Space>

      <Form.Item
        name="reason"
        label="Reason for Entry"
        // Removed required rule
      >
        <TextArea
          rows={3}
          placeholder="Describe your reason for entering this trade..."
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        name="mentalState"
        label="Mental State"
        // Removed required rule
      >
        <TextArea
          rows={2}
          placeholder="Describe your mental state during this trade..."
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        name="description"
        label="Trade Description"
      >
        <TextArea
          rows={4}
          placeholder="Detailed description of trade setup and execution..."
        />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" size="large">
          Save Trade
        </Button>
      </Form.Item>
    </>
  );

  const handleEdit = (record) => {
    // Set default values of 0 for stop_loss and exit_target if they're null/undefined
    const editData = {
      ...record,
      stop_loss: record.stop_loss || 0,
      exit_target: record.exit_target || 0
    };
    setEditingTrade(editData);
    form.setFieldsValue(editData);
  };

  const handleTradeSubmit = async (values) => {
    try {
      const actionDate = values.actionDate;
      const actionTime = values.actionTime;
      
      if (!actionDate || !actionTime) {
        message.error('Date and time are required');
        return;
      }

      // Create datetime in selected timezone
      const localDateTime = moment.tz(
        `${actionDate.format('YYYY-MM-DD')} ${actionTime.format('HH:mm:ss')}`,
        selectedTimezone
      );

      console.log('Local datetime:', localDateTime.format('YYYY-MM-DD HH:mm:ss'));
      
      // Convert to NY time
      const nyDateTime = localDateTime.clone().tz("America/New_York");
      console.log('NY datetime:', nyDateTime.format('YYYY-MM-DD HH:mm:ss'));

      const tradeData = {
        ...values,
        actionDateTime: nyDateTime.format('YYYY-MM-DD HH:mm:ss'),
        name: values.name.replace(/\s+/g, ''),
        stopLoss: values.stopLoss || 0,
        exitTarget: values.exitTarget || 0,
        fee: values.fee || 0,
        reason: values.reason || '',        // Added default empty string
        mentalState: values.mentalState || '', // Added default empty string
        description: values.description || ''
      };

      const url = editingTrade 
        ? `${ENDPOINTS.TRADES}?id=${editingTrade.id}`  // Changed from /${editingTrade.id} to ?id=
        : ENDPOINTS.TRADES;
      
      const response = await fetch(url, {
        method: editingTrade ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData)
      });
  
      if (!response.ok) {
        throw new Error(await response.text());
      }
  
      message.success(`Trade ${editingTrade ? 'updated' : 'saved'} successfully`);
      form.resetFields();
      setEditingTrade(null);
      await fetchTrades();  // Refresh the trade list
    } catch (error) {
      console.error('Error submitting trade:', error);
      message.error(error.message || 'Failed to submit trade');
    }
  };

  // Default form values
  const initialFormValues = {
    symbol: 'SPY',
    stopLoss: 0,
    exitTarget: 0
  };

  return (
    <div className="trade-entry">
      <h2>{editingTrade ? 'Edit Trade' : 'Enter Trade Details'}</h2>
      
      {/* Trade Entry Form */}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleTradeSubmit}
        initialValues={initialFormValues}
      >
        {formItems}
      </Form>

      {/* Filter Panel */}
      <Space style={{ marginTop: '24px', marginBottom: '16px' }}>
        <Select
          placeholder="Filter Symbol"
          value={filterSymbol}
          onChange={setFilterSymbol}
          style={{ width: 120 }}
        >
          <Option value="SPY">SPY</Option>
          <Option value="QQQ">QQQ</Option>
          <Option value="">All</Option>
        </Select>
        
        <DatePicker 
          placeholder="Filter Date"
          value={filterDate}
          onChange={setFilterDate}
          disabledDate={current => current && current > moment().endOf('day')}
        />
        
        <Button type="primary" onClick={fetchTrades}>
          Apply Filter
        </Button>
      </Space>

      {/* Trades Table */}
      <div style={{ marginTop: '40px' }}>
        <h3>Recent Trades</h3>
        <Table
          columns={columns}
          dataSource={trades}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} trades`,
            showQuickJumper: true,
            showSizeChanger: false
          }}
          scroll={{ x: 1300 }}
          size="small"
        />
      </div>
    </div>
  );
};

export default TradeEntry;
