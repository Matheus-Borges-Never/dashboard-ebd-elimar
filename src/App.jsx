import { Routes, Route, Navigate } from 'react-router-dom'
import { Component } from 'react'
import Dashboard from './pages/Dashboard.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 p-6 max-w-lg w-full">
            <p className="text-red-600 font-semibold mb-2">Erro no Dashboard</p>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all bg-gray-50 p-3 rounded">
              {this.state.error.message}{'\n\n'}{this.state.error.stack?.slice(0, 600)}
            </pre>
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
              onClick={() => this.setState({ error: null })}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
      <Route path="/admin/*" element={<AdminLayout />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
