import { RoundRobinCalculator } from './components/RoundRobinCalculator'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <main className="h-full w-full">
        <div className="h-full w-full">
          <RoundRobinCalculator />
        </div>
      </main>
    </div>
  )
}

export default App
