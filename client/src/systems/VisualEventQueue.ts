// ─────────────────────────────────────────────────────────────
//  VisualEventQueue
//
//  Guarantees that visual animations (Tweens, particles, popups)
//  play in strict FIFO order, regardless of when server messages
//  arrive. Each animation is a function that returns a Promise
//  that resolves inside the Tween's onComplete callback.
//
//  Usage:
//    const queue = new VisualEventQueue();
//    queue.enqueue(() => new Promise(resolve => scene.tweens.add({
//        targets: obj, x: 100, duration: 400, onComplete: resolve
//    })));
// ─────────────────────────────────────────────────────────────

export class VisualEventQueue {
    private queue: Array<() => Promise<void>> = [];
    private running: boolean = false;

    /**
     * Add an animation task to the back of the queue.
     * The task will be auto-started if nothing else is running.
     */
    enqueue(animFn: () => Promise<void>): void {
        this.queue.push(animFn);
        if (!this.running) {
            this.run();
        }
    }

    /**
     * Internal loop — drains the queue sequentially, awaiting
     * each animation before starting the next.
     */
    private async run(): Promise<void> {
        this.running = true;
        while (this.queue.length > 0) {
            const task = this.queue.shift()!;
            try {
                await task();
            } catch (e) {
                // Don't let a single failed animation halt the queue
                console.warn('[VisualEventQueue] Animation task threw:', e);
            }
        }
        this.running = false;
    }

    /** True if there are pending or running animations */
    get isBusy(): boolean {
        return this.running || this.queue.length > 0;
    }

    /** Immediately clear all pending tasks (does not cancel running anim) */
    clear(): void {
        this.queue = [];
    }
}
