import { describe, it, expect } from "vitest";
import { hello } from "./examples/hello.js";
import { createGame, startGame } from "./examples/game.js";

describe("lab harness", () => {
  it("should be ready", () => {
    expect(true).toBe(true);
  });

  it("hello example works", () => {
    expect(hello()).toBe("Hello, Spark!");
    expect(hello("World")).toBe("Hello, World!");
  });

  it("game example works", () => {
    const game = createGame();
    expect(game.running).toBe(false);
    const started = startGame(game);
    expect(started.running).toBe(true);
    expect(started.score).toBe(0);
  });
});
