import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import 'antd/dist/reset.css'  // Add this line if you need global antd styles

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
