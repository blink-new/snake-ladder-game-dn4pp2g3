import React, { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { blink } from '../blink/client'
import { Game, GamePlayer, PLAYER_COLORS } from '../types/game'
import { Users, Play, Settings } from 'lucide-react'

interface GameLobbyProps {
  onGameStart: (gameId: string) => void
}

export function GameLobby({ onGameStart }: GameLobbyProps) {
  const [games, setGames] = useState<Game[]>([])
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [currentGame, setCurrentGame] = useState<Game | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const loadGames = useCallback(async () => {
    try {
      const gamesData = await blink.db.games.list({
        where: { status: 'waiting' },
        orderBy: { createdAt: 'desc' }
      })
      setGames(gamesData)
    } catch (error) {
      console.error('Failed to load games:', error)
    }
  }, [])

  const loadGamePlayers = useCallback(async (gameId: string) => {
    try {
      const gamePlayers = await blink.db.gamePlayer.list({
        where: { gameId: gameId },
        orderBy: { joinedAt: 'asc' }
      })
      setPlayers(gamePlayers)
    } catch (error) {
      console.error('Failed to load players:', error)
    }
  }, [])

  const setupRealtimeUpdates = useCallback(async () => {
    if (!user) return
    
    const channel = blink.realtime.channel('among-us-lobby')
    await channel.subscribe({ userId: user.id })

    channel.onMessage((message) => {
      if (message.type === 'game_created' || message.type === 'game_updated') {
        loadGames()
      }
      if (message.type === 'player_joined' && currentGame) {
        loadGamePlayers(currentGame.id)
      }
    })
  }, [user, loadGames, loadGamePlayers, currentGame])

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (user) {
      loadGames()
      setupRealtimeUpdates()
    }
  }, [user, loadGames, setupRealtimeUpdates])

  const joinGame = async (gameId: string) => {
    if (!user) return

    try {
      // Check if already in game
      const existingPlayer = await blink.db.gamePlayer.list({
        where: { 
          AND: [
            { gameId: gameId },
            { userId: user.id }
          ]
        }
      })

      if (existingPlayer.length === 0) {
        // Get current players to assign color
        const currentPlayers = await blink.db.gamePlayer.list({
          where: { gameId: gameId }
        })

        const usedColors = currentPlayers.map(p => p.color)
        const availableColors = Object.keys(PLAYER_COLORS).filter(c => !usedColors.includes(c))
        
        if (availableColors.length === 0) {
          alert('Game is full!')
          return
        }

        const playerId = `player_${Date.now()}`
        await blink.db.gamePlayer.create({
          id: playerId,
          gameId: gameId,
          userId: user.id,
          username: user.email?.split('@')[0] || 'Player',
          color: availableColors[0],
          isAlive: true,
          positionX: 400,
          positionY: 300,
          currentRoom: 'cafeteria',
          tasksCompleted: 0,
          totalTasks: 5
        })

        // Update game player count
        const playerCount = currentPlayers.length + 1
        await blink.db.games.update(gameId, {
          currentPlayers: playerCount
        })

        // Notify others
        await blink.realtime.publish('among-us-lobby', 'player_joined', { gameId })
      }

      // Load game and players
      const game = await blink.db.games.list({
        where: { id: gameId }
      })
      
      if (game.length > 0) {
        setCurrentGame(game[0])
        loadGamePlayers(gameId)
      }
    } catch (error) {
      console.error('Failed to join game:', error)
    }
  }

  const createGame = async () => {
    if (!user) return
    
    setCreating(true)
    try {
      const gameId = `game_${Date.now()}`
      const playerId = `player_${Date.now()}`
      
      // Create game
      await blink.db.games.create({
        id: gameId,
        hostUserId: user.id,
        status: 'waiting',
        maxPlayers: 6,
        currentPlayers: 1,
        impostorCount: 1
      })

      // Add host as first player
      const availableColors = Object.keys(PLAYER_COLORS)
      const playerColor = availableColors[0]
      
      await blink.db.gamePlayer.create({
        id: playerId,
        gameId: gameId,
        userId: user.id,
        username: user.email?.split('@')[0] || 'Player',
        color: playerColor,
        isAlive: true,
        positionX: 400,
        positionY: 300,
        currentRoom: 'cafeteria',
        tasksCompleted: 0,
        totalTasks: 5
      })

      // Notify others
      await blink.realtime.publish('among-us-lobby', 'game_created', { gameId })
      
      // Join the game
      joinGame(gameId)
    } catch (error) {
      console.error('Failed to create game:', error)
    } finally {
      setCreating(false)
    }
  }

  const startGame = async () => {
    if (!currentGame || !user || currentGame.hostUserId !== user.id) return

    try {
      // Assign roles
      const shuffledPlayers = [...players].sort(() => Math.random() - 0.5)
      const impostorCount = Math.min(currentGame.impostorCount, Math.floor(players.length / 3))
      
      for (let i = 0; i < shuffledPlayers.length; i++) {
        const role = i < impostorCount ? 'impostor' : 'crewmate'
        await blink.db.gamePlayer.update(shuffledPlayers[i].id, { role })
      }

      // Update game status
      await blink.db.games.update(currentGame.id, { status: 'playing' })

      // Start the game
      onGameStart(currentGame.id)
    } catch (error) {
      console.error('Failed to start game:', error)
    }
  }

  const leaveGame = () => {
    setCurrentGame(null)
    setPlayers([])
    loadGames()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="w-96 bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-center">Among Us</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-slate-300 mb-4">Please sign in to play</p>
            <Button onClick={() => blink.auth.login()}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🚀 Among Us</h1>
          <p className="text-slate-300">Social deduction in space</p>
        </div>

        {!currentGame ? (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Create Game */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Create Game
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={createGame} 
                  disabled={creating}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {creating ? 'Creating...' : 'Create New Game'}
                </Button>
              </CardContent>
            </Card>

            {/* Join Game */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Available Games
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {games.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">No games available</p>
                  ) : (
                    games.map((game) => (
                      <div key={game.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                        <div>
                          <p className="text-white font-medium">Game Room</p>
                          <p className="text-slate-400 text-sm">
                            {game.currentPlayers}/{game.maxPlayers} players
                          </p>
                        </div>
                        <Button 
                          onClick={() => joinGame(game.id)}
                          size="sm"
                          className="bg-teal-600 hover:bg-teal-700"
                        >
                          Join
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Game Lobby */
          <Card className="bg-slate-800 border-slate-700 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-white text-center">Game Lobby</CardTitle>
              <p className="text-slate-300 text-center">
                {players.length}/{currentGame.maxPlayers} players
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {players.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg">
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-white"
                      style={{ backgroundColor: PLAYER_COLORS[player.color] }}
                    />
                    <div>
                      <p className="text-white text-sm font-medium">{player.username}</p>
                      {player.userId === currentGame.hostUserId && (
                        <Badge variant="secondary" className="text-xs">Host</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 justify-center">
                {user.id === currentGame.hostUserId ? (
                  <Button 
                    onClick={startGame}
                    disabled={players.length < 4}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Game
                  </Button>
                ) : (
                  <p className="text-slate-400">Waiting for host to start...</p>
                )}
                
                <Button 
                  onClick={leaveGame}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Leave Game
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}