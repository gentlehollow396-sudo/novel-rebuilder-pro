// src/utils/requestQueue.ts
// Simple in-browser promise queue with configurable concurrency and abort support.

export type QueueTask<T> = (signal: AbortSignal) => Promise<T>;

export class RequestQueue {
  private concurrency: number;
  private running = 0;
  private queue: Array<{
    task: QueueTask<any>;
    resolve: (v: any) => void;
    reject: (e: any) => void;
    controller: AbortController;
  }> = [];

  constructor(concurrency = 2) {
    this.concurrency = Math.max(1, concurrency);
  }

  enqueue<T>(task: QueueTask<T>): Promise<T> {
    const controller = new AbortController();
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject, controller });
      this.dequeueNext();
    });
  }

  private dequeueNext() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.running += 1;
      const { task, resolve, reject, controller } = item;
      task(controller.signal)
        .then((v) => resolve(v))
        .catch((e) => reject(e))
        .finally(() => {
          this.running -= 1;
          // next tick to avoid deep recursion
          setTimeout(() => this.dequeueNext(), 0);
        });
    }
  }

  clear() {
    // Abort all queued tasks
    for (const i of this.queue) {
      i.controller.abort();
      i.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }
}

export default RequestQueue;
