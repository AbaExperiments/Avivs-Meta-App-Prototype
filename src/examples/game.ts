// Placeholder example: game.ts
// TODO: Implement a tiny game prototype for Spark lab

export interface GameState {
  score: number;
  running: boolean;
}

export function createGame(): GameState {
  return { score: 0, running: false };
}

export function startGame(state: GameState): GameState {
  return { ...state, running: true };
}
