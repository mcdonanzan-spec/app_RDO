
export const parseMoney = (value: any): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    let str = String(value).trim();

    // Remove Currency Symbols if present
    str = str.replace(/^R\$\s?/, '').replace(/^\$\s?/, '');

    // Heuristic for format detection
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');

    if (lastComma === -1 && lastDot === -1) {
        // Integer-like string
        return parseFloat(str) || 0;
    }

    // Special handling for BR Integer format (e.g. 43.000.000)
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1 && lastComma === -1) {
        // Assume BR Thousands separators
        str = str.replace(/\./g, '');
        return parseFloat(str) || 0;
    }

    if (lastComma > lastDot) {
        // BR Format assumed (decimal is comma): 1.000,00 or 1000,00
        // Remove dots (thousands), replace comma with dot
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
        // US Format assumed (decimal is dot): 1,000.00 or 1000.00
        // BUT if we are in a BR context and it looks like 43.000 (and 43000 makes more sense than 43)...
        // Ideally we stick to standard. Standard is: Single dot = decimal.
        str = str.replace(/,/g, '');
    }
    // If equal (both -1), handled above.

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

export const formatMoney = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Conversão robusta de largura Excel para Pixels
export const getColumnWidth = (w: number | undefined) => {
    if (!w) return 100; // Default
    // Aproximação: (width * 7) pixels (ajuste fino empírico)
    return Math.min(Math.max(w * 7, 50), 400);
};
