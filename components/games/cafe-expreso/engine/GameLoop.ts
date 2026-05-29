// ─── GAME LOOP — RAF con fixed timestep ───

export class GameLoop {
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private readonly TICK_MS = 1000 / 60;
  private running = false;

  constructor(
    private onTick: (dt: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private schedule(): void {
    this.rafId = requestAnimationFrame((now) => this.loop(now));
  }

  private loop = (now: number): void => {
    if (!this.running) return;

    const frameDt = Math.min(now - this.lastTime, 100); // cap a 100ms
    this.lastTime = now;
    this.accumulator += frameDt;

    // Fixed timestep
    while (this.accumulator >= this.TICK_MS) {
      this.onTick(this.TICK_MS / 1000); // delta en segundos
      this.accumulator -= this.TICK_MS;
    }

    this.schedule();
  };
}
