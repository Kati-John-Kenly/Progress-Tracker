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

const MONTH_INDEX = new Map([
    ['jan', 1], ['feb', 2], ['mar', 3], ['apr', 4], ['may', 5], ['jun', 6],
    ['jul', 7], ['aug', 8], ['sep', 9], ['sept', 9], ['oct', 10], ['nov', 11], ['dec', 12],
]);

const getStatementPeriodYears = (text) => {
    const match = text.match(/\b\d{1,2}\s+([A-Z]{3,4})['’](\d{2})\s*-\s*\d{1,2}\s+([A-Z]{3,4})['’](\d{2})/i);
    if (!match) return null;
    return {
        startMonth: MONTH_INDEX.get(match[1].toLowerCase()),
        startYear: 2000 + Number(match[2]),
        endMonth: MONTH_INDEX.get(match[3].toLowerCase()),
        endYear: 2000 + Number(match[4]),
    };
};

const parseProviderDate = (text, period) => {
    const match = text.match(/\b([A-Z]{3,4})\.?\s+(\d{1,2}),?\s*(\d{4})?\b/i)
        || text.match(/\b(\d{1,2})\s+([A-Z]{3,4})\.?,?\s*(\d{4})?\b/i);
    if (!match) return null;

    const isMonthFirst = Number.isNaN(Number(match[1]));
    const month = MONTH_INDEX.get((isMonthFirst ? match[1] : match[2]).toLowerCase());
    const day = Number(isMonthFirst ? match[2] : match[1]);
    const explicitYear = Number(match[3]);
    if (!month || !day) return null;

    let year = Number.isInteger(explicitYear) && explicitYear > 0 ? explicitYear : null;
    if (!year && period?.startYear) {
        year = period.startMonth <= period.endMonth
            ? period.startYear
            : month >= period.startMonth ? period.startYear : period.endYear;
    }
    return year ? makeDate(year, month, day) : null;
};

const getPdfItemsByLine = (pages) => pages.map(page => {
    const linesByY = new Map();
    for (const item of page?.items || []) {
        if (typeof item?.str !== 'string' || !item.str.trim()) continue;
        const y = Math.round(Number(item.transform?.[5]) || 0);
        if (!linesByY.has(y)) linesByY.set(y, []);
        linesByY.get(y).push({
            text: item.str.trim(),
            x: Number(item.transform?.[4]) || 0,
            y,
        });
    }

    return [...linesByY.values()]
        .map(items => items.sort((a, b) => a.x - b.x))
        .sort((a, b) => b[0].y - a[0].y);
});

const getProviderAmount = (text) => {
    const match = text.match(/([+-]?)\s*(?:₹|Rs\.?\s*)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (!match) return null;
    return parseAmount(`${match[1]}${match[2]}`);
};

const getProviderResult = (transactions, options) => parseStatementRows([
    ['Name', 'Amount', 'Date', 'Type'],
    ...transactions.map(transaction => [
        transaction.name,
        transaction.amount,
        transaction.date,
        transaction.type,
    ]),
], options);

export const parseProviderPdfPages = (pages, options) => {
    const linesByPage = getPdfItemsByLine(pages);
    const allText = linesByPage.flatMap(lines => lines.flat().map(item => item.text)).join('\n');
    const provider = /transaction statement for/i.test(allText)
        && /transaction id/i.test(allText)
        ? 'phonepe'
        : /paytm statement for/i.test(allText) && /passbook payments history/i.test(allText)
            ? 'paytm'
            : /transaction statement period/i.test(allText) && /google pay app/i.test(allText)
                ? 'googlepay'
                : null;
    if (!provider) return null;

    const period = getStatementPeriodYears(allText);
    const transactions = [];

    for (const lines of linesByPage) {
        const transactionHeaderIndex = provider === 'paytm'
            ? lines.findIndex(items => items.some(item => /transaction details/i.test(item.text)))
            : -1;
        const starts = lines
            .map((items, index) => {
                const text = items.map(item => item.text).join(' ');
                if (provider === 'paytm' && (
                    index <= transactionHeaderIndex
                    || !items.some(item => item.x < 100)
                )) return null;
                const date = provider === 'paytm'
                    ? text.match(/\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/i)
                    : text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b/i)
                        || text.match(/\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?,?\s+\d{4}\b/i);
                return date ? { index, items, text, date: parseProviderDate(date[0], period) } : null;
            })
            .filter(Boolean);

        for (let startIndex = 0; startIndex < starts.length; startIndex++) {
            const start = starts[startIndex];
            const endIndex = starts[startIndex + 1]?.index ?? lines.length;
            const blockLines = lines.slice(start.index, endIndex);
            const blockItems = blockLines.flat();
            let name = null;
            let amount = null;
            let type = null;

            if (provider === 'phonepe') {
                const detail = blockItems.find(item => /^(?:payment to|paid to|received from)\b/i.test(item.text));
                if (detail) {
                    name = detail.text
                        .replace(/^(?:payment to|paid to|received from)\s+/i, '')
                        .replace(/\s*(?:DEBIT|CREDIT)\s*$/i, '')
                        .trim() || null;
                }
                const amountItem = blockItems.find(item => /₹\s*[\d,]+(?:\.\d{1,2})?/.test(item.text));
                const amountValue = amountItem ? getProviderAmount(amountItem.text) : null;
                const typeItem = blockItems.find(item => /^(?:DEBIT|CREDIT)$/i.test(item.text));
                type = typeItem?.text.toLowerCase() === 'credit' ? 'income' : 'expense';
                if (amountValue !== null) amount = type === 'income' ? Math.abs(amountValue) : -Math.abs(amountValue);
            } else if (provider === 'googlepay') {
                const detail = blockItems.find(item => /^(?:received from|paid to)\b/i.test(item.text));
                if (detail) {
                    name = detail.text.replace(/^(?:received from|paid to)\s+/i, '').trim() || null;
                    type = /^received from\b/i.test(detail.text) ? 'income' : 'expense';
                }
                const amountItem = blockItems.find(item => /₹\s*[\d,]+(?:\.\d{1,2})?/.test(item.text));
                const amountValue = amountItem ? getProviderAmount(amountItem.text) : null;
                if (amountValue !== null) amount = type === 'income' ? Math.abs(amountValue) : -Math.abs(amountValue);
            } else {
                const amountItem = blockItems.find(item => item.x > 400 && /[+-]\s*Rs\.?\s*[\d,]+(?:\.\d{1,2})?/i.test(item.text));
                amount = amountItem ? getProviderAmount(amountItem.text) : null;
                type = amount > 0 ? 'income' : 'expense';
                const nameItems = blockItems.filter(item => item.x >= 70 && item.x < 290)
                    .map(item => item.text)
                    .filter(text => !/^(?:UPI ID:|UPI Ref No:|Tag:|# Money|Canara Bank|Other UPI|App -|Pay$)/i.test(text));
                const sentTo = nameItems.findIndex(text => /^Money sent to\b/i.test(text));
                if (sentTo >= 0) {
                    const firstName = nameItems[sentTo].replace(/^Money sent to\s+/i, '').trim();
                    const continuation = nameItems[sentTo + 1] && !/^UPI ID:/i.test(nameItems[sentTo + 1])
                        ? nameItems[sentTo + 1]
                        : '';
                    name = [firstName, continuation].filter(Boolean).join(' ').trim() || null;
                } else {
                    name = nameItems.find(text => !/^(?:Money received|Received from|#)/i.test(text)) || null;
                }
            }

            if (start.date && name && amount !== null && amount !== 0 && type) {
                transactions.push({ name, amount, date: start.date, type });
            }
        }
    }

    return getProviderResult(transactions, options);
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
    const providerResult = parseProviderPdfPages(pages, options);
    if (providerResult) return providerResult;

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
