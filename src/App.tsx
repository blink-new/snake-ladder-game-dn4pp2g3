import React, { useState, useEffect } from 'react';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Trophy, RotateCcw } from 'lucide-react';

interface Player {
  id: number;
  name: string;
  position: number;
  color: string;
}

interface SnakeOrLadder {
  start: number;
  end: number;
  type: 'snake' | 'ladder';
}

const BOARD_SIZE = 100;
const ROWS = 10;
const COLS = 10;

// Predefined snakes and ladders
const snakesAndLadders: SnakeOrLadder[] = [
  // Ladders
  { start: 4, end: 14, type: 'ladder' },
  { start: 9, end: 31, type: 'ladder' },
  { start: 20, end: 38, type: 'ladder' },
  { start: 28, end: 84, type: 'ladder' },
  { start: 40, end: 59, type: 'ladder' },
  { start: 51, end: 67, type: 'ladder' },
  { start: 63, end: 81, type: 'ladder' },
  { start: 71, end: 91, type: 'ladder' },
  
  // Snakes
  { start: 17, end: 7, type: 'snake' },
  { start: 54, end: 34, type: 'snake' },
  { start: 62, end: 19, type: 'snake' },
  { start: 64, end: 60, type: 'snake' },
  { start: 87, end: 24, type: 'snake' },
  { start: 93, end: 73, type: 'snake' },
  { start: 95, end: 75, type: 'snake' },
  { start: 99, end: 78, type: 'snake' }
];

const diceIcons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

function App() {
  const [players] = useState<Player[]>([
    { id: 1, name: 'Player 1', position: 0, color: 'bg-blue-500' },
    { id: 2, name: 'Player 2', position: 0, color: 'bg-red-500' }
  ]);
  
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [gameState, setGameState] = useState<Player[]>(players);
  const [winner, setWinner] = useState<Player | null>(null);
  const [gameMessage, setGameMessage] = useState('');

  const nextTurn = () => {
    setCurrentPlayerIndex((prev) => (prev + 1) % players.length);
    setGameMessage('');
  };

  const movePlayer = (steps: number) => {
    const currentPlayer = gameState[currentPlayerIndex];
    let newPosition = currentPlayer.position + steps;
    
    // Check if player exceeds 100
    if (newPosition > BOARD_SIZE) {
      setGameMessage(`${currentPlayer.name} needs exactly ${BOARD_SIZE - currentPlayer.position} to win!`);
      nextTurn();
      return;
    }
    
    // Check for snakes and ladders
    const snakeOrLadder = snakesAndLadders.find(sl => sl.start === newPosition);
    if (snakeOrLadder) {
      if (snakeOrLadder.type === 'snake') {
        setGameMessage(`${currentPlayer.name} got bitten by a snake! Sliding down from ${newPosition} to ${snakeOrLadder.end}`);
      } else {
        setGameMessage(`${currentPlayer.name} climbed a ladder! Moving up from ${newPosition} to ${snakeOrLadder.end}`);
      }
      newPosition = snakeOrLadder.end;
    } else {
      setGameMessage(`${currentPlayer.name} moved ${steps} steps to position ${newPosition}`);
    }
    
    // Update player position
    const newGameState = [...gameState];
    newGameState[currentPlayerIndex] = { ...currentPlayer, position: newPosition };
    setGameState(newGameState);
    
    // Check for winner
    if (newPosition === BOARD_SIZE) {
      setWinner(currentPlayer);
      setGameMessage(`🎉 ${currentPlayer.name} wins the game!`);
      return;
    }
    
    // Next player's turn
    setTimeout(() => {
      nextTurn();
    }, 2000);
  };

  const rollDice = () => {
    if (isRolling || winner) return;
    
    setIsRolling(true);
    setGameMessage('Rolling dice...');
    
    // Animate dice roll
    let rollCount = 0;
    const rollInterval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      rollCount++;
      
      if (rollCount > 10) {
        clearInterval(rollInterval);
        const finalValue = Math.floor(Math.random() * 6) + 1;
        setDiceValue(finalValue);
        movePlayer(finalValue);
        setIsRolling(false);
      }
    }, 100);
  };

  const resetGame = () => {
    setGameState(players.map(p => ({ ...p, position: 0 })));
    setCurrentPlayerIndex(0);
    setWinner(null);
    setGameMessage('');
    setDiceValue(1);
  };

  const getSquareNumber = (row: number, col: number) => {
    // Snake and ladder board numbering (bottom-left is 1, top-right is 100)
    const isEvenRow = row % 2 === 0;
    if (isEvenRow) {
      return (ROWS - row - 1) * COLS + col + 1;
    } else {
      return (ROWS - row - 1) * COLS + (COLS - col);
    }
  };

  const getSquarePosition = (position: number) => {
    if (position === 0) return { row: -1, col: -1 }; // Starting position
    
    const adjustedPos = position - 1;
    const row = Math.floor(adjustedPos / COLS);
    const isEvenRow = (ROWS - row - 1) % 2 === 0;
    
    if (isEvenRow) {
      return { row: ROWS - row - 1, col: adjustedPos % COLS };
    } else {
      return { row: ROWS - row - 1, col: COLS - 1 - (adjustedPos % COLS) };
    }
  };

  const getSnakeOrLadderForSquare = (squareNum: number) => {
    return snakesAndLadders.find(sl => sl.start === squareNum);
  };

  const DiceIcon = diceIcons[diceValue - 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🐍 Snake & Ladder Game 🪜</h1>
          <p className="text-gray-600">Roll the dice and race to square 100!</p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Game Board */}
          <div className="lg:col-span-3">
            <Card className="p-6">
              <div className="grid grid-cols-10 gap-1 aspect-square max-w-2xl mx-auto">
                {Array.from({ length: ROWS }, (_, row) =>
                  Array.from({ length: COLS }, (_, col) => {
                    const squareNum = getSquareNumber(row, col);
                    const snakeOrLadder = getSnakeOrLadderForSquare(squareNum);
                    const playersOnSquare = gameState.filter(p => p.position === squareNum);
                    
                    return (
                      <div
                        key={`${row}-${col}`}
                        className={`
                          aspect-square border border-gray-300 flex flex-col items-center justify-center text-xs font-semibold relative
                          ${snakeOrLadder?.type === 'snake' ? 'bg-red-100 border-red-300' : ''}
                          ${snakeOrLadder?.type === 'ladder' ? 'bg-green-100 border-green-300' : ''}
                          ${!snakeOrLadder ? 'bg-white hover:bg-gray-50' : ''}
                        `}
                      >
                        <span className="text-gray-700 mb-1">{squareNum}</span>
                        
                        {/* Snake or Ladder indicator */}
                        {snakeOrLadder && (
                          <div className="text-xs">
                            {snakeOrLadder.type === 'snake' ? '🐍' : '🪜'}
                          </div>
                        )}
                        
                        {/* Players on this square */}
                        <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                          {playersOnSquare.map((player, index) => (
                            <div
                              key={player.id}
                              className={`w-3 h-3 rounded-full ${player.color} border-2 border-white -mb-1`}
                              style={{ marginLeft: index > 0 ? '-4px' : '0' }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* Game Controls */}
          <div className="space-y-6">
            {/* Current Player */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Current Turn</h3>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full ${gameState[currentPlayerIndex]?.color}`} />
                <span className="font-medium">{gameState[currentPlayerIndex]?.name}</span>
              </div>
            </Card>

            {/* Dice */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Dice</h3>
              <div className="text-center">
                <div className="mb-4">
                  <DiceIcon 
                    className={`w-16 h-16 mx-auto text-blue-600 ${isRolling ? 'animate-spin' : ''}`} 
                  />
                </div>
                <Button 
                  onClick={rollDice} 
                  disabled={isRolling || !!winner}
                  className="w-full"
                >
                  {isRolling ? 'Rolling...' : 'Roll Dice'}
                </Button>
              </div>
            </Card>

            {/* Players Status */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Players</h3>
              <div className="space-y-2">
                {gameState.map((player) => (
                  <div key={player.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${player.color}`} />
                      <span className="text-sm">{player.name}</span>
                    </div>
                    <Badge variant="outline">
                      {player.position}/100
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Game Message */}
            {gameMessage && (
              <Card className="p-4">
                <p className="text-sm text-center text-gray-700">{gameMessage}</p>
              </Card>
            )}

            {/* Reset Button */}
            <Button 
              onClick={resetGame} 
              variant="outline" 
              className="w-full"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              New Game
            </Button>
          </div>
        </div>

        {/* Winner Dialog */}
        <Dialog open={!!winner} onOpenChange={() => setWinner(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-center">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                🎉 Congratulations! 🎉
              </DialogTitle>
            </DialogHeader>
            <div className="text-center py-4">
              <div className={`w-16 h-16 rounded-full ${winner?.color} mx-auto mb-4`} />
              <h3 className="text-xl font-bold mb-2">{winner?.name} Wins!</h3>
              <p className="text-gray-600 mb-4">You've reached square 100!</p>
              <Button onClick={resetGame} className="w-full">
                Play Again
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default App;