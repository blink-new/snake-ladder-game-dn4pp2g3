import React, { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { blink } from '../blink/client'
import { GamePlayer, PLAYER_COLORS, ROOMS, Room } from '../types/game'
import { AlertTriangle, MessageSquare, Settings, Users, Zap } from 'lucide-react'

interface GameMapProps {
  gameId: string
  onGameEnd: () => void
}

export function GameMap({ gameId, onGameEnd }: GameMapProps) {
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<GamePlayer | null>(null)
  const [user, setUser] = useState<any>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [showTaskDialog, setShowTaskDialog] = useState(false)
  const [showMeetingDialog, setShowMeetingDialog] = useState(false)
  const [gameStatus, setGameStatus] = useState<'playing' | 'meeting' | 'finished'>('playing')
  const [meetingReason, setMeetingReason] = useState('')
  const [votes, setVotes] = useState<{[playerId: string]: string}>({})
  const [chatMessages, setChatMessages] = useState<{id: string, playerId: string, message: string, timestamp: number}[]>([])
  const [newMessage, setNewMessage] = useState('')

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
    })
    return unsubscribe
  }, [])

  const loadGameData = useCallback(async () => {
    if (!user) return

    try {
      // Load all players
      const gamePlayers = await blink.db.gamePlayer.list({
        where: { gameId: gameId },
        orderBy: { joinedAt: 'asc' }
      })
      setPlayers(gamePlayers)

      // Find current player
      const current = gamePlayers.find(p => p.userId === user.id)
      if (current) {
        setCurrentPlayer(current)
      }
    } catch (error) {
      console.error('Failed to load game data:', error)
    }
  }, [gameId, user])

  const setupRealtimeUpdates = useCallback(async () => {
    if (!user) return

    const channel = blink.realtime.channel(`game-${gameId}`)
    await channel.subscribe({ 
      userId: user.id,
      metadata: { gameId }
    })

    channel.onMessage((message) => {
      if (message.type === 'player_moved') {
        loadGameData()
      } else if (message.type === 'emergency_meeting') {
        setGameStatus('meeting')
        setMeetingReason(message.data.reason || 'Emergency Meeting Called')
        setShowMeetingDialog(true)
      } else if (message.type === 'chat_message') {
        setChatMessages(prev => [...prev, message.data])
      } else if (message.type === 'player_killed') {
        loadGameData()
      } else if (message.type === 'task_completed') {
        loadGameData()
      }
    })
  }, [gameId, user, loadGameData])

  useEffect(() => {
    if (user) {
      loadGameData()
      setupRealtimeUpdates()
    }
  }, [user, loadGameData, setupRealtimeUpdates])

  const moveToRoom = async (room: Room) => {
    if (!currentPlayer || !user) return

    try {
      // Update player position
      await blink.db.gamePlayer.update(currentPlayer.id, {
        positionX: room.x + room.width / 2,
        positionY: room.y + room.height / 2,
        currentRoom: room.id
      })

      // Notify other players
      await blink.realtime.publish(`game-${gameId}`, 'player_moved', {
        playerId: currentPlayer.id,
        room: room.id,
        x: room.x + room.width / 2,
        y: room.y + room.height / 2
      })

      setSelectedRoom(room)
      loadGameData()
    } catch (error) {
      console.error('Failed to move to room:', error)
    }
  }

  const completeTask = async () => {
    if (!currentPlayer || !selectedRoom) return

    try {
      const newTasksCompleted = currentPlayer.tasksCompleted + 1
      
      await blink.db.gamePlayer.update(currentPlayer.id, {
        tasksCompleted: newTasksCompleted
      })

      // Record task completion event
      await blink.db.gameEvents.create({
        id: `event_${Date.now()}`,
        gameId: gameId,
        eventType: 'task_complete',
        playerId: currentPlayer.id,
        room: selectedRoom.id,
        data: JSON.stringify({ taskType: 'generic', room: selectedRoom.id })
      })

      // Notify other players
      await blink.realtime.publish(`game-${gameId}`, 'task_completed', {
        playerId: currentPlayer.id,
        room: selectedRoom.id,
        tasksCompleted: newTasksCompleted
      })

      setShowTaskDialog(false)
      loadGameData()

      // Check win condition later
      setTimeout(() => {
        const alivePlayers = players.filter(p => Number(p.isAlive) > 0)
        const totalTasks = alivePlayers.reduce((sum, p) => sum + p.totalTasks, 0)
        const completedTasks = alivePlayers.reduce((sum, p) => sum + p.tasksCompleted, 0)
        if (completedTasks >= totalTasks) {
          blink.db.games.update(gameId, { status: 'finished' })
          alert('Crewmates Win! All tasks completed!')
          onGameEnd()
        }
      }, 1000)
    } catch (error) {
      console.error('Failed to complete task:', error)
    }
  }



  const killPlayer = async (targetPlayerId: string) => {
    if (!currentPlayer || currentPlayer.role !== 'impostor') return

    try {
      // Kill the target player
      await blink.db.gamePlayer.update(targetPlayerId, {
        isAlive: false
      })

      // Record kill event
      await blink.db.gameEvents.create({
        id: `event_${Date.now()}`,
        gameId: gameId,
        eventType: 'kill',
        playerId: currentPlayer.id,
        targetPlayerId: targetPlayerId,
        room: currentPlayer.currentRoom
      })

      // Notify other players
      await blink.realtime.publish(`game-${gameId}`, 'player_killed', {
        killerId: currentPlayer.id,
        victimId: targetPlayerId,
        room: currentPlayer.currentRoom
      })

      loadGameData()
      
      // Check impostor win condition
      setTimeout(() => {
        const alivePlayers = players.filter(p => Number(p.isAlive) > 0)
        const aliveCrewmates = alivePlayers.filter(p => p.role === 'crewmate')
        const aliveImpostors = alivePlayers.filter(p => p.role === 'impostor')
        if (aliveImpostors.length >= aliveCrewmates.length) {
          blink.db.games.update(gameId, { status: 'finished' })
          alert('Impostors Win! They outnumber the crewmates!')
          onGameEnd()
        }
      }, 1000)
    } catch (error) {
      console.error('Failed to kill player:', error)
    }
  }

  const callEmergencyMeeting = async () => {
    if (!currentPlayer) return

    try {
      setGameStatus('meeting')
      setMeetingReason('Emergency Meeting Called')
      setShowMeetingDialog(true)

      // Notify all players
      await blink.realtime.publish(`game-${gameId}`, 'emergency_meeting', {
        callerId: currentPlayer.id,
        reason: 'Emergency Meeting Called'
      })
    } catch (error) {
      console.error('Failed to call emergency meeting:', error)
    }
  }

  const sendChatMessage = async () => {
    if (!newMessage.trim() || !currentPlayer) return

    const message = {
      id: `msg_${Date.now()}`,
      playerId: currentPlayer.id,
      message: newMessage,
      timestamp: Date.now()
    }

    try {
      await blink.realtime.publish(`game-${gameId}`, 'chat_message', message)
      setChatMessages(prev => [...prev, message])
      setNewMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const checkCrewmateWin = async () => {
    const alivePlayers = players.filter(p => Number(p.isAlive) > 0)
    const totalTasks = alivePlayers.reduce((sum, p) => sum + p.totalTasks, 0)
    const completedTasks = alivePlayers.reduce((sum, p) => sum + p.tasksCompleted, 0)

    if (completedTasks >= totalTasks) {
      // Crewmates win
      await blink.db.games.update(gameId, { status: 'finished' })
      alert('Crewmates Win! All tasks completed!')
      onGameEnd()
    }
  }

  const checkImpostorWin = async () => {
    const alivePlayers = players.filter(p => Number(p.isAlive) > 0)
    const aliveCrewmates = alivePlayers.filter(p => p.role === 'crewmate')
    const aliveImpostors = alivePlayers.filter(p => p.role === 'impostor')

    if (aliveImpostors.length >= aliveCrewmates.length) {
      // Impostors win
      await blink.db.games.update(gameId, { status: 'finished' })
      alert('Impostors Win! They outnumber the crewmates!')
      onGameEnd()
    }
  }

  if (!user || !currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    )
  }

  const alivePlayers = players.filter(p => Number(p.isAlive) > 0)
  const playersInCurrentRoom = alivePlayers.filter(p => p.currentRoom === currentPlayer.currentRoom && p.id !== currentPlayer.id)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      {/* Game Header */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="flex items-center justify-between bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-4">
            <div 
              className="w-10 h-10 rounded-full border-2 border-white"
              style={{ backgroundColor: PLAYER_COLORS[currentPlayer.color] }}
            />
            <div>
              <p className="text-white font-medium">{currentPlayer.username}</p>
              <Badge 
                variant={currentPlayer.role === 'impostor' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {currentPlayer.role === 'impostor' ? '🔪 Impostor' : '👨‍🚀 Crewmate'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-white text-sm">
              Tasks: {currentPlayer.tasksCompleted}/{currentPlayer.totalTasks}
            </div>
            <Button
              onClick={callEmergencyMeeting}
              className="bg-red-600 hover:bg-red-700"
              size="sm"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Emergency
            </Button>
          </div>
        </div>
      </div>

      {/* Game Map */}
      <div className="max-w-7xl mx-auto">
        <div className="relative bg-slate-800 rounded-lg p-4" style={{ height: '600px' }}>
          {/* Rooms */}
          {ROOMS.map((room) => (
            <div
              key={room.id}
              className="absolute border-2 border-slate-600 rounded-lg cursor-pointer hover:border-white transition-colors flex items-center justify-center"
              style={{
                left: room.x,
                top: room.y,
                width: room.width,
                height: room.height,
                backgroundColor: room.color + '20'
              }}
              onClick={() => moveToRoom(room)}
            >
              <div className="text-center">
                <p className="text-white font-medium text-sm">{room.name}</p>
                {room.id === currentPlayer.currentRoom && (
                  <Badge className="mt-1 text-xs">You are here</Badge>
                )}
              </div>
            </div>
          ))}

          {/* Players */}
          {alivePlayers.map((player) => (
            <div
              key={player.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{
                left: player.positionX,
                top: player.positionY
              }}
              onClick={() => {
                if (currentPlayer.role === 'impostor' && player.id !== currentPlayer.id && player.currentRoom === currentPlayer.currentRoom) {
                  if (window.confirm(`Kill ${player.username}?`)) {
                    killPlayer(player.id)
                  }
                }
              }}
            >
              <div 
                className="w-8 h-8 rounded-full border-2 border-white shadow-lg"
                style={{ backgroundColor: PLAYER_COLORS[player.color] }}
              />
              <p className="text-white text-xs text-center mt-1 bg-black bg-opacity-50 rounded px-1">
                {player.username}
              </p>
            </div>
          ))}
        </div>

        {/* Room Actions */}
        {selectedRoom && (
          <Card className="mt-4 bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">{selectedRoom.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {currentPlayer.role === 'crewmate' && (
                  <Button
                    onClick={() => setShowTaskDialog(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Do Task
                  </Button>
                )}

                {playersInCurrentRoom.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-white" />
                    <span className="text-white text-sm">
                      {playersInCurrentRoom.map(p => p.username).join(', ')} in room
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Complete Task</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <p className="text-slate-300 mb-4">
              Complete the task in {selectedRoom?.name}
            </p>
            <div className="flex gap-4">
              <Button onClick={completeTask} className="bg-green-600 hover:bg-green-700">
                Complete Task
              </Button>
              <Button 
                onClick={() => setShowTaskDialog(false)}
                variant="outline"
                className="border-slate-600 text-slate-300"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Meeting Dialog */}
      <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Emergency Meeting</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <p className="text-slate-300 mb-4">{meetingReason}</p>
            
            {/* Chat */}
            <div className="bg-slate-700 rounded-lg p-4 mb-4 h-40 overflow-y-auto">
              {chatMessages.map((msg) => {
                const player = players.find(p => p.id === msg.playerId)
                return (
                  <div key={msg.id} className="mb-2">
                    <span className="text-white font-medium">{player?.username}: </span>
                    <span className="text-slate-300">{msg.message}</span>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-slate-600 text-white rounded px-3 py-2"
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
              />
              <Button onClick={sendChatMessage} size="sm">
                <MessageSquare className="w-4 h-4" />
              </Button>
            </div>

            <Button 
              onClick={() => {
                setShowMeetingDialog(false)
                setGameStatus('playing')
              }}
              className="w-full"
            >
              End Discussion
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}