export class RingBuffer<T> implements Iterable<T> {
    private buffer: Array<T | undefined>
    private capacity: number;
    private start: number;

    constructor(capacity: number) {
        this.capacity = capacity
        this.buffer = new Array<T | undefined>(capacity).fill(undefined, 0, capacity - 1)
        this.length = 0;
        this.start = 0;
    }

    get length(): number {
        return this.length;
    }

    private set length(val: number) {
        this.length = val;
    }

    [Symbol.iterator](): Iterator<T, T, T> {
        let localThis = this;
        return {
            next() {
                let val = localThis.dequeue()
                if (val !== undefined) {
                    return {
                        value: val,
                        done: false
                    } as IteratorResult<T, T>
                } else {
                    return {
                        done: true
                    } as IteratorResult<T, T>
                }
            },
        }
    }

    enqueue(item: T): T | undefined {
        if (this.length == this.capacity) {
            const out = this.buffer[this.start];
            this.buffer[this.start] = item;
            this.start = (this.start + 1) % this.capacity;
            return out;
        }
        const insertIdx = (this.start + this.length) % this.capacity;
        this.buffer[insertIdx] = item;
        this.length += 1;
        return;
    }

    dequeue(): T | undefined {
        if (this.length == 0) {
            return;
        }
        const out = this.buffer[this.start];
        this.buffer[this.start] = undefined;
        this.start = (this.start + 1) % this.capacity
        this.length -= 1;
        return out
    }
}
