import assert from 'node:assert/strict';
import test from 'node:test';
import { filterFinanceTransactions } from './financeSearch.js';

const transactions = [
    {
        name: 'Cafe Morning',
        desc: 'Dining Out',
        bank: 'SBI',
        date: '2026-10-04',
        amount: 731.9699999999993,
        type: 'expense',
        status: 'FAILED',
    },
    {
        name: 'Monthly salary',
        desc: 'Salary',
        bank: 'Kotak',
        date: '2026-10-01',
        amount: 1200,
        type: 'income',
        status: 'SUCCESS',
    },
];

test('searches transaction names, category, bank, date, amount, type and status', () => {
    for (const query of ['cafe', 'DINING', 'sbi', '2026-10-04', '731.97', 'expense']) {
        assert.deepEqual(filterFinanceTransactions(transactions, query), [transactions[0]], query);
    }

    assert.deepEqual(filterFinanceTransactions(transactions, 'salary'), [transactions[1]]);
    assert.deepEqual(filterFinanceTransactions(transactions, 'failed'), [transactions[0]]);
    assert.deepEqual(filterFinanceTransactions(transactions, 'success'), [transactions[1]]);
});

test('returns all transactions for a blank search and none for an unmatched search', () => {
    assert.equal(filterFinanceTransactions(transactions, '  '), transactions);
    assert.deepEqual(filterFinanceTransactions(transactions, 'not found'), []);
});
