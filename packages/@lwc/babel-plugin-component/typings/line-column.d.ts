declare module 'line-column' {
    function lineColumn(source: string, options?: { origin?: number }): LineColumnFinder;

    interface LineColumnFinder {
        fromIndex(index: number): { line: number; col: number } | null;

        toIndex(line: number, col: number): number;
        toIndex(location: { line: number; col: number }): number;
        toIndex(location: { line: number; column: number }): number;
        toIndex(location: [number, number]): number;
    }

    export = lineColumn;
}
