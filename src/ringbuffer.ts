export class RingBuffer<T> {
    private buffer: Array<T | undefined>
    private capacity: number;
    private size: number;
    private start: number;

    constructor(capacity: number) {
        this.capacity = capacity
        this.buffer = new Array<T | undefined>(capacity).fill(undefined, 0, capacity - 1)
        this.size = 0;
        this.start = 0;
    }

    enqueue(item: T): T | undefined {
        if (this.size == this.capacity) {
            const out = this.buffer[this.start];
            this.buffer[this.start] = item;
            this.start = (this.start + 1) % this.capacity;
            return out;
        }
        const insertIdx = (this.start + this.size) % this.capacity;
        this.buffer[insertIdx] = item;
        this.size += 1;
        return;
    }

    dequeue(): T | undefined {
        if (this.size == 0) {
            return;
        }
        const out = this.buffer[this.start];
        this.buffer[this.start] = undefined;
        this.start = (this.start + 1) % this.capacity
        this.size -= 1;
        return out
    }
}
