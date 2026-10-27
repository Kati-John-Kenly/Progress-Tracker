import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { getStatementTotals, parsePdfPageItems, parseStatementRows } from './statementImport.js';
import { formatAmount } from './numberFormat.js';

const standardHeader = ['Name', 'Bank', 'Amount', 'Date', 'Status'];

test('classifies a positive credit as income', () => {
    const result = parseStatementRows([
        standardHeader,
        ['Salary payment', 'Example Bank', '+805.11', '27 Sep 2026', 'SUCCESS'],
    ]);

    assert.equal(result.transactions.length, 1);
    assert.equal(result.transactions[0].type, 'income');
    assert.equal(result.transactions[0].amount, 805.11);
    assert.equal(result.transactions[0].desc, 'Salary');
});

test('classifies a negative debit as spending and keeps a positive app amount', () => {
    const result = parseStatementRows([
        standardHeader,
        ['Grocery store', 'Example Bank', '-1494.00', '2026-10-02', 'SUCCESS'],
    ]);

    assert.equal(result.transactions[0].type, 'expense');
    assert.equal(result.transactions[0].amount, 1494);
    assert.equal(result.transactions[0].desc, 'Groceries');
});

test('retains failed rows while excluding them from income and spending totals', () => {
    const result = parseStatementRows([
        standardHeader,
        ['Paycheck', 'Example Bank', '+1000', '2026-10-01', 'SUCCESS'],
        ['Paycheck', 'Example Bank', '+500', '2026-10-01', 'FAILED'],
        ['Cafe', 'Example Bank', '-125', '2026-10-01', 'SUCCESS'],
        ['Cafe', 'Example Bank', '-80', '2026-10-01', 'FAILED'],
    ]);
    const totals = getStatementTotals(result.transactions);

    assert.equal(result.transactions.length, 4);
    assert.equal(result.failedCount, 2);
    assert.equal(totals.income, 1000);
    assert.equal(totals.spending, 125);
});

test('keeps aggregated amounts precise to cents and formats floating-point values', () => {
    const totals = getStatementTotals([
        { type: 'income', amount: 0.1, desc: 'Salary' },
        { type: 'income', amount: 0.2, desc: 'Salary' },
        { type: 'expense', amount: 0.1, desc: 'Dining Out' },
        { type: 'expense', amount: 0.2, desc: 'Dining Out' },
    ]);

    assert.equal(totals.income, 0.3);
    assert.equal(totals.spending, 0.3);
    assert.equal(formatAmount(731.9699999999993), '731.97');
    assert.equal(formatAmount(123.4567), '123.46');
    assert.equal(formatAmount(-0.001), '0');
});

test('handles a null name without inventing a category', () => {
    const result = parseStatementRows([
        standardHeader,
        [null, 'Masked account', '+25', '2026-10-04', 'SUCCESS'],
    ]);

    assert.equal(result.transactions.length, 1);
    assert.equal(result.transactions[0].name, null);
    assert.equal(result.transactions[0].desc, 'Uncategorized');
});

test('excludes suspicious debit rows but keeps corresponding credits', () => {
    const result = parseStatementRows([
        standardHeader,
        [null, 'SBI 7395', '-25', '2026-10-04', 'SUCCESS'],
        ['Utkarsh SuperCard Repayment', 'SBI 7395', '-50', '2026-10-04', 'SUCCESS'],
        ['Kotak Mahindra Bank Ltd', 'SBI 7395', '-75', '2026-10-04', 'SUCCESS'],
        ['Kotak Mahindra Bank Ltd', 'SBI 7395', '+100', '2026-10-04', 'SUCCESS'],
        ['Cafe', 'SBI 7395', '-20', '2026-10-04', 'SUCCESS'],
    ]);

    assert.deepEqual(result.excludedReasons, {
        'missing merchant': 1,
        repayment: 1,
        'bank ltd': 1,
    });
    assert.equal(result.excludedCount, 3);
    assert.deepEqual(result.transactions.map(({ name, type }) => ({ name, type })), [
        { name: 'Kotak Mahindra Bank Ltd', type: 'income' },
        { name: 'Cafe', type: 'expense' },
    ]);
});

test('supports separate debit and credit columns and retains same-day repeats', () => {
    const result = parseStatementRows([
        ['Narration', 'Account', 'Debit (INR)', 'Credit (INR)', 'Transaction Date', 'Status'],
        ['Cafe', 'Example Bank', 125, '', 46300, 'SUCCESS'],
        ['Cafe', 'Example Bank', 125, '', 46300, 'SUCCESS'],
        ['Refund', 'Example Bank', '', 25, 46300, 'SUCCESS'],
    ]);

    assert.equal(result.transactions.length, 3);
    assert.equal(result.transactions[0].type, 'expense');
    assert.equal(result.transactions[0].date, '2026-10-05');
    assert.equal(result.transactions[1].date, '2026-10-05');
    assert.equal(result.transactions[2].type, 'income');
});

test('reports malformed transaction rows instead of crashing on missing dates', () => {
    const result = parseStatementRows([
        standardHeader,
        ['Cafe', 'Example Bank', '-125', '', 'SUCCESS'],
    ]);

    assert.equal(result.transactions.length, 0);
    assert.equal(result.candidateRows, 1);
    assert.equal(result.skippedCount, 1);
    assert.equal(result.skippedReasons.date, 1);
});

const statementPath = globalThis.process?.env?.STATEMENT_TEST_PDF;
test('parses every row in the attached statement', { skip: !statementPath }, async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const document = await pdfjs.getDocument({
        data: new Uint8Array(fs.readFileSync(statementPath)),
        useSystemFonts: true,
    }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        pages.push(await (await document.getPage(pageNumber)).getTextContent());
    }

    const result = parsePdfPageItems(pages);
    const dates = result.transactions.map(transaction => transaction.date).sort();

    assert.equal(document.numPages, 5);
    assert.equal(result.candidateRows, 151);
    assert.equal(result.transactions.length, 107);
    assert.equal(result.excludedCount, 44);
    assert.deepEqual(result.excludedReasons, {
        'missing merchant': 24,
        'bank ltd': 12,
        repayment: 8,
    });
    assert.equal(result.failedCount, 5);
    assert.equal(result.skippedCount, 0);
    assert.equal(dates[0], '2026-09-27');
    assert.equal(dates.at(-1), '2026-10-26');
    assert.equal(
        result.transactions.filter(transaction => transaction.type === 'income').length
        + result.transactions.filter(transaction => transaction.type === 'expense').length,
        107,
    );
    assert.equal(
        result.transactions.some(transaction => (
            transaction.type === 'expense'
            && (!transaction.name || /repayment|\bbank\s+ltd\b/i.test(transaction.name))
        )),
        false,
    );
});
