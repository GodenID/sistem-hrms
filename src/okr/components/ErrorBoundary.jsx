import React from 'react'
import { TriangleAlert, RotateCw } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, info)
    }
  }

  handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
          <Card className="w-full">
            <CardContent className="flex flex-col items-center px-6 py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <TriangleAlert
                  className="h-6 w-6 text-destructive"
                  strokeWidth={1.75}
                />
              </div>
              <h2 className="text-lg font-semibold tracking-tight">
                Ups, ada yang salah
              </h2>
              <p className="mt-1.5 max-w-[320px] text-sm text-muted-foreground">
                Terjadi kesalahan tak terduga. Silakan coba muat ulang halaman.
              </p>
              {import.meta.env.DEV && this.state.error && (
                <pre className="mt-4 max-w-full overflow-auto rounded-md bg-muted px-3 py-2 text-left text-[11px] text-muted-foreground">
                  {this.state.error.message}
                </pre>
              )}
              <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                <Button onClick={this.handleRefresh} className="sm:w-auto">
                  <RotateCw className="h-4 w-4" />
                  Muat Ulang
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleReset}
                  className="sm:w-auto"
                >
                  Coba Lagi
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }
}
