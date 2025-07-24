export interface Game {
  id: string
  hostUserId: string
  status: 'waiting' | 'playing' | 'finished'
  maxPlayers: number
  currentPlayers: number
  impostorCount: number
  createdAt: string
  updatedAt: string
}

export interface GamePlayer {
  id: string
  gameId: string
  userId: string
  username: string
  color: string
  role?: 'crewmate' | 'impostor'
  isAlive: boolean
  positionX: number
  positionY: number
  currentRoom: string
  tasksCompleted: number
  totalTasks: number
  joinedAt: string
}

export interface GameTask {
  id: string
  gameId: string
  playerId: string
  taskType: string
  room: string
  isCompleted: boolean
  positionX: number
  positionY: number
}

export interface GameEvent {
  id: string
  gameId: string
  eventType: 'kill' | 'report_body' | 'emergency_meeting' | 'vote' | 'task_complete'
  playerId?: string
  targetPlayerId?: string
  room?: string
  data?: string
  timestamp: string
}

export interface Room {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  color: string
}

export interface PlayerColors {
  [key: string]: string
}

export const PLAYER_COLORS: PlayerColors = {
  red: '#FF6B6B',
  blue: '#4ECDC4',
  green: '#45B7D1',
  pink: '#FF69B4',
  orange: '#FFA500',
  yellow: '#FFD700',
  black: '#2C3E50',
  white: '#FFFFFF',
  purple: '#9B59B6',
  brown: '#8B4513',
  cyan: '#00FFFF',
  lime: '#32CD32'
}

export const ROOMS: Room[] = [
  { id: 'cafeteria', name: 'Cafeteria', x: 350, y: 250, width: 200, height: 150, color: '#3498DB' },
  { id: 'weapons', name: 'Weapons', x: 100, y: 100, width: 120, height: 100, color: '#E74C3C' },
  { id: 'o2', name: 'O2', x: 100, y: 250, width: 120, height: 100, color: '#2ECC71' },
  { id: 'navigation', name: 'Navigation', x: 100, y: 400, width: 120, height: 100, color: '#F39C12' },
  { id: 'shields', name: 'Shields', x: 250, y: 450, width: 120, height: 100, color: '#9B59B6' },
  { id: 'communications', name: 'Comms', x: 600, y: 450, width: 120, height: 100, color: '#1ABC9C' },
  { id: 'storage', name: 'Storage', x: 750, y: 350, width: 120, height: 100, color: '#E67E22' },
  { id: 'electrical', name: 'Electrical', x: 750, y: 200, width: 120, height: 100, color: '#F1C40F' },
  { id: 'upper_engine', name: 'Upper Engine', x: 600, y: 100, width: 120, height: 100, color: '#E74C3C' },
  { id: 'reactor', name: 'Reactor', x: 450, y: 50, width: 120, height: 100, color: '#C0392B' },
  { id: 'security', name: 'Security', x: 600, y: 250, width: 120, height: 100, color: '#34495E' },
  { id: 'medbay', name: 'Medbay', x: 750, y: 50, width: 120, height: 100, color: '#27AE60' },
  { id: 'lower_engine', name: 'Lower Engine', x: 600, y: 350, width: 120, height: 100, color: '#E74C3C' }
]