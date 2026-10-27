const CATEGORY_RULES = [
    { pattern: /salary|paycheck|income|client|freelance|bonus|dividend/, category: 'Salary' },
    { pattern: /grocery|groceries|supermarket|vegetable|fruit|food/, category: 'Groceries' },
    { pattern: /dining|restaurant|cafe|coffee|lunch|dinner|snack|tea/, category: 'Dining Out' },
    { pattern: /utility|utilities|bill|electricity|water|wifi|internet|gas|phone/, category: 'Utilities' },
    { pattern: /rent|emi|mortgage|housing|flat|pg|hostel|home/, category: 'EMI/Rent' },
    { pattern: /shop|shopping|cloth|dress|amazon|flipkart|gadget|shoes/, category: 'Shopping' },
    { pattern: /transport|travel|fuel|petrol|diesel|rapido|cab|uber|ola|bus|train|flight|metro/, category: 'Transportation' },
    { pattern: /invest|stocks|mutual|crypto|gold|fund|fd|savings/, category: 'Investment' },
];

const EMPTY_VALUES = new Set(['', 'null', 'undefined', 'n/a', 'na', '-']);

const normalizeHeader = (value) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const normalizeText = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    return EMPTY_VALUES.has(text.toLowerCase()) ? '' : text;
};

const getColumnIndexes = (row) => {
    const columns = {};
    row.forEach((value, index) => {
        const key = normalizeHeader(value);
        if (!key) return;

        if (
            key === 'name'
            || /^(payee|merchant|beneficiary|description|narration|particulars|transactionname)$/.test(key)
        ) {
            columns.name ??= index;
        } else if (key === 'bank' || key.includes('bank') || /^(account|accountname)$/.test(key)) {
            columns.bank ??= index;
        } else if (key.includes('amount') || /^(value)$/.test(key)) {
            columns.amount ??= index;
        } else if (key.includes('date')) {
            columns.date ??= index;
        } else if (key.startsWith('status') || key === 'state') {
            columns.status ??= index;
        } else if (/^(type|transactiontype|drcr|debitcredit)$/.test(key)) {
            columns.type ??= index;
        } else if (key.startsWith('debit') || key.startsWith('withdrawal')) {
            columns.debit ??= index;
        } else if (key.startsWith('credit') || key.startsWith('deposit')) {
            columns.credit ??= index;
        }
    });

    return columns;
};

const isHeaderRow = (columns) => (
    Number.isInteger(columns.date)
    && (Number.isInteger(columns.amount)
        || Number.isInteger(columns.debit)
        || Number.isInteger(columns.credit))
);

const parseAmount = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;

    const text = value.trim();
    if (!text) return null;
    const isNegative = /^\s*\(.*\)\s*$/.test(text);
    const numeric = text.replace(/[,\s₹$€£]/g, '').replace(/[()]/g, '').replace(/[^0-9.+-]/g, '');
    if (!numeric || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(numeric)) return null;
    const amount = Number(numeric);
    if (!Number.isFinite(amount)) return null;
    return isNegative ? -Math.abs(amount) : amount;
};

const parseDate = (value) => {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }

    if (typeof value === 'number' && value > 0 && value < 100000) {
        const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
        return date.toISOString().slice(0, 10);
    }

    const text = normalizeText(value);
    if (!text) return null;

    let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (match) {
        const [, year, month, day] = match;
        return makeDate(year, month, day);
    }

    match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (match) {
        const [, day, month, year] = match;
        return makeDate(year, month, day);
    }

    const parsed = new Date(text);
    if (!Number.isFinite(parsed.getTime())) return null;
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

const makeDate = (yearValue, monthValue, dayValue) => {
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const inferCategory = (name, customCategories = []) => {
    const description = name.toLowerCase();
    const matchedRule = CATEGORY_RULES.find(({ pattern }) => pattern.test(description));
    if (matchedRule) return matchedRule.category;

    const customCategory = customCategories.find(category => (
        category && description.includes(String(category).toLowerCase())
    ));
    return customCategory || 'Uncategorized';
};

const getCell = (row, index) => (Number.isInteger(index) ? row[index] : undefined);

export const parseStatementRows = (rows, { customCategories = [] } = {}) => {
    const transactions = [];
    const skippedReasons = {};
    const excludedReasons = {};
    let columns = null;
    let candidateRows = 0;

    for (const row of rows) {
        if (!Array.isArray(row) || row.every(value => !normalizeText(value))) continue;

        const detectedColumns = getColumnIndexes(row);
        if (isHeaderRow(detectedColumns)) {
            columns = detectedColumns;
            continue;
        }
        if (!columns) continue;

        const rawAmount = getCell(row, columns.amount);
        const debitAmount = parseAmount(getCell(row, columns.debit));
        const creditAmount = parseAmount(getCell(row, columns.credit));
        const hasTransactionData = [rawAmount, getCell(row, columns.debit), getCell(row, columns.credit)]
            .some(value => normalizeText(value) !== '');
        if (!hasTransactionData) continue;
        candidateRows++;

        let signedAmount = parseAmount(rawAmount);
        if (signedAmount === null) {
            if (creditAmount !== null && creditAmount !== 0) signedAmount = Math.abs(creditAmount);
            else if (debitAmount !== null && debitAmount !== 0) signedAmount = -Math.abs(debitAmount);
        }

        if (signedAmount === null || signedAmount === 0) {
            skippedReasons.amount = (skippedReasons.amount || 0) + 1;
            continue;
        }

        const date = parseDate(getCell(row, columns.date));
        if (!date) {
            skippedReasons.date = (skippedReasons.date || 0) + 1;
            continue;
        }

        const name = normalizeText(getCell(row, columns.name)) || null;
        const bank = normalizeText(getCell(row, columns.bank)) || null;
        const statusText = normalizeText(getCell(row, columns.status));
        const status = statusText ? statusText.toUpperCase() : 'UNKNOWN';
        const typeText = normalizeText(getCell(row, columns.type)).toLowerCase();
        const type = signedAmount > 0
            ? 'income'
            : signedAmount < 0
                ? 'expense'
                : /credit|income|deposit/.test(typeText)
                    ? 'income'
                    : 'expense';

        const exclusionReason = signedAmount < 0
            ? !name
                ? 'missing merchant'
                : /\brepayment\b/i.test(name)
                    ? 'repayment'
                    : /\bbank\s+ltd\b/i.test(name)
                        ? 'bank ltd'
                        : null
            : null;
        if (exclusionReason) {
            excludedReasons[exclusionReason] = (excludedReasons[exclusionReason] || 0) + 1;
            continue;
        }

        transactions.push({
            type,
            amount: Math.round(Math.abs(signedAmount) * 100) / 100,
            desc: inferCategory(name || '', customCategories),
            name,
            bank,
            date,
            status,
            source: 'statement',
        });
    }

    const skippedCount = Object.values(skippedReasons).reduce((sum, count) => sum + count, 0);
    const excludedCount = Object.values(excludedReasons).reduce((sum, count) => sum + count, 0);
    return {
        transactions,
        candidateRows,
        skippedCount,
        skippedReasons,
        excludedCount,
        excludedReasons,
        failedCount: transactions.filter(transaction => transaction.status === 'FAILED').length,
    };
};

export const parsePdfPageItems = (pages, options) => {
    const rows = [];

    for (const page of pages) {
        const items = (page?.items || [])
            .filter(item => typeof item?.str === 'string' && item.str.trim())
            .map(item => ({
                text: item.str.trim(),
                x: Number(item.transform?.[4]) || 0,
                y: Math.round(Number(item.transform?.[5]) || 0),
            }));
        const linesByY = new Map();
        for (const item of items) {
            if (!linesByY.has(item.y)) linesByY.set(item.y, []);
            linesByY.get(item.y).push(item);
        }

        const lines = [...linesByY.entries()].map(([y, lineItems]) => ({
            y,
            items: lineItems.sort((a, b) => a.x - b.x),
        }));
        const header = lines.find(line => isHeaderRow(getColumnIndexes(line.items.map(item => item.text))));
        if (!header) continue;

        const headers = header.items.filter(item => (
            isHeaderRow(getColumnIndexes(header.items.map(cell => cell.text)))
            && normalizeHeader(item.text)
        ));
        const columnItems = headers.filter(item => (
            ['name', 'bank', 'amount', 'date', 'status', 'debit', 'credit', 'type']
                .includes(normalizeHeader(item.text))
        ));
        const columnPositions = columnItems
            .map(item => ({ key: normalizeHeader(item.text), x: item.x }))
            .sort((a, b) => a.x - b.x);
        if (columnPositions.length < 3) continue;

        rows.push(columnPositions.map(column => column.key));
        const headerY = header.y;
        for (const line of lines) {
            if (line.y >= headerY) continue;
            const cells = Array(columnPositions.length).fill('');
            for (const item of line.items) {
                let columnIndex = 0;
                while (
                    columnIndex < columnPositions.length - 1
                    && item.x >= (columnPositions[columnIndex].x + columnPositions[columnIndex + 1].x) / 2
                ) {
                    columnIndex++;
                }
                cells[columnIndex] = [cells[columnIndex], item.text].filter(Boolean).join(' ');
            }
            rows.push(cells);
        }
    }

    return parseStatementRows(rows, options);
};

export const getStatementTotals = (transactions = []) => {
    const totalsInCents = transactions.reduce((totals, transaction) => {
        if (String(transaction?.status || '').toLowerCase() === 'failed') return totals;
        const amount = Math.round(Math.abs(Number(transaction?.amount) || 0) * 100);
        const category = transaction?.desc || 'Uncategorized';
        if (transaction?.type === 'income') {
            totals.income += amount;
            totals.incomeByCategory[category] = (totals.incomeByCategory[category] || 0) + amount;
        } else {
            totals.spending += amount;
            totals.spendingByCategory[category] = (totals.spendingByCategory[category] || 0) + amount;
        }
        return totals;
    }, { income: 0, spending: 0, incomeByCategory: {}, spendingByCategory: {} });

    const toAmount = (cents) => cents / 100;
    return {
        income: toAmount(totalsInCents.income),
        spending: toAmount(totalsInCents.spending),
        incomeByCategory: Object.fromEntries(
            Object.entries(totalsInCents.incomeByCategory).map(([category, cents]) => [category, toAmount(cents)]),
        ),
        spendingByCategory: Object.fromEntries(
            Object.entries(totalsInCents.spendingByCategory).map(([category, cents]) => [category, toAmount(cents)]),
        ),
    };
};
