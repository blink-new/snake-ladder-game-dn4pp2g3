import React, { useState } from 'react'
import { GameLobby } from './components/GameLobby'
import { GameMap } from './components/GameMap'
import './App.css'

function App() {
  const [currentGameId, setCurrentGameId] = useState<string | null>(null)

  const handleGameStart = (gameId: string) => {
    setCurrentGameId(gameId)
  }

  const handleGameEnd = () => {
    setCurrentGameId(null)
  }

  return (
    <div className="App">
      {!currentGameId ? (
        <GameLobby onGameStart={handleGameStart} />
      ) : (
        <GameMap gameId={currentGameId} onGameEnd={handleGameEnd} />
      )}
    </div>
  )
}

export default App