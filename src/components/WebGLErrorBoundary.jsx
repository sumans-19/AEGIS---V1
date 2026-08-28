import { Component } from 'react'

export class WebGLErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("WebGL Error Boundary caught an error:", error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // Sleek placeholder fallback
      if (this.props.fallbackType === 'globe') {
        return (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            color: '#00e5ff',
            fontSize: '12px',
            fontFamily: 'JetBrains Mono, monospace',
            textAlign: 'center',
            padding: '20px',
            boxSizing: 'border-box'
          }}>
            <div style={{
              border: '1px solid rgba(0, 229, 255, 0.2)',
              background: 'rgba(8, 12, 26, 0.8)',
              backdropFilter: 'blur(8px)',
              padding: '16px',
              borderRadius: '8px',
              maxWidth: '300px',
              boxShadow: '0 4px 20px rgba(0, 229, 255, 0.1)'
            }}>
              <span style={{ display: 'block', fontSize: '24px', marginBottom: '8px' }}>🌐</span>
              <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Globe Engine Offline
              </span>
              <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
                WebGL context lost. Please reload the page to restart the globe animation.
              </p>
              <button
                onClick={this.handleReset}
                style={{
                  background: 'rgba(0, 229, 255, 0.1)',
                  border: '1px solid #00e5ff',
                  color: '#00e5ff',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontFamily: 'inherit',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  transition: '0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 229, 255, 0.2)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)'}
              >
                Reload Page
              </button>
            </div>
          </div>
        )
      }

      return (
        <div style={{
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle at center, #0f172a, #020617)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'JetBrains Mono, monospace',
          color: '#f43f5e',
          padding: '24px',
          textAlign: 'center',
          border: '1px dashed rgba(244, 63, 94, 0.2)',
          borderRadius: '12px',
          boxSizing: 'border-box'
        }}>
          {/* Futuristic warning icon */}
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
            filter: 'drop-shadow(0 0 10px #f43f5e)',
            animation: 'pulse 2s infinite'
          }}>
            ⚠️
          </div>
          
          <h3 style={{
            color: '#fff',
            letterSpacing: '3px',
            fontSize: '18px',
            textTransform: 'uppercase',
            margin: '0 0 12px 0',
            background: 'linear-gradient(to right, #f43f5e, #fb7185)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            AEGIS Graphics Core Failure
          </h3>
          
          <p style={{
            color: '#94a3b8',
            fontSize: '13px',
            maxWidth: '480px',
            lineHeight: '1.6',
            margin: '0 0 24px 0',
          }}>
            WebGL context could not be created or was lost. This is usually due to multiple hot-reloads in development exhausting GPU resource limits, or GPU hardware acceleration being disabled.
          </p>

          <div style={{
            background: 'rgba(244, 63, 94, 0.05)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            padding: '12px 18px',
            borderRadius: '8px',
            fontSize: '11px',
            color: '#fb7185',
            fontFamily: 'Consolas, monospace',
            marginBottom: '24px',
            maxWidth: '90%',
            overflowX: 'auto',
            textAlign: 'left',
            whiteSpace: 'pre-wrap'
          }}>
            {this.state.error?.message || "Error: Error creating WebGL context."}
          </div>

          <button
            onClick={this.handleReset}
            style={{
              background: 'linear-gradient(135deg, #f43f5e, #be123c)',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              letterSpacing: '1px',
              fontSize: '12px',
              textTransform: 'uppercase',
              boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)',
              transition: 'all 0.3s ease',
              outline: 'none',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 0 20px rgba(244, 63, 94, 0.6)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(244, 63, 94, 0.3)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Restart Graphics Engine
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
