export class Counter<T> {
    private values: Map<T, number>

    constructor() {
        this.values = new Map();
    }

    add(value: T): number {
        let got = this.values.get(value);
        if (got !== undefined) {
            this.values.set(value, got + 1);
            return got + 1;
        } else {
            this.values.set(value, 1);
            return 1;
        }
    }

    sub(value: T): number {
        let got = this.values.get(value);
        if (got === undefined) {
            return 0;
        } else if (got === 1) {
            this.values.delete(value);
            return 0;
        } else {
            this.values.set(value, got - 1);
            return got - 1;
        }
    }

    get(value: T): number {
        let got = this.values.get(value);
        return got ? got : 0;
    }
}
