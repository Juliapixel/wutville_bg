export class RingBuffer<T> {
    private buffer: Array<T | undefined>
    private capacity: number;
    private size: number;
    private start: number;

    constructor(capacity: number) {
        this.capacity = capacity
        this.buffer = new Array<T | undefined>(capacity)
        this.size = 0;
        this.start = 0;
    }

    enqueue(item: T): T | undefined {
        if (this.size == this.capacity) {
            const prevStart = this.start
            this.start = (this.start + 1) % this.capacity;
            return this.buffer[prevStart];
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
        const popIdx = (this.start + this.size - 1) % this.capacity;
        const out = this.buffer[popIdx];
        this.buffer[popIdx] = undefined;
        this.size -= 1;
        return out
    }
}
