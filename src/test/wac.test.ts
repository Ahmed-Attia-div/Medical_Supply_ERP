
import { describe, it, expect } from 'vitest';

// WAC Formula: ((CurrentQty * CurrentCost) + (NewQty * NewCost)) / (CurrentQty + NewQty)

const calculateWAC = (currentQty: number, currentCost: number, newQty: number, newCost: number) => {
    if (currentQty + newQty === 0) return 0;
    return ((currentQty * currentCost) + (newQty * newCost)) / (currentQty + newQty);
};

describe('Weighted Average Cost (WAC) Calculation', () => {
    it('should calculate correct average for new items', () => {
        const currentQty = 100;
        const currentCost = 10;
        const newQty = 50;
        const newCost = 13;

        // (1000 + 650) / 150 = 1650 / 150 = 11
        const result = calculateWAC(currentQty, currentCost, newQty, newCost);
        expect(result).toBe(11);
    });

    it('should handle zero current stock', () => {
        const result = calculateWAC(0, 0, 10, 20);
        expect(result).toBe(20);
    });

    it('should handle decimal costs', () => {
        // 10 @ 10 = 100
        // 10 @ 20 = 200
        // Total = 300 / 20 = 15
        const result = calculateWAC(10, 10, 10, 20);
        expect(result).toBe(15);
    });

    it('should exclude negative stock if logic allows (though DB constraint should prevent it)', () => {
        // Theoretical checks only
        const result = calculateWAC(10, 10, -5, 10); // Selling 5 items shouldn't change cost
        // 100 + (-50) = 50 / 5 = 10. Cost remains same.
        expect(result).toBe(10);
    });
});
