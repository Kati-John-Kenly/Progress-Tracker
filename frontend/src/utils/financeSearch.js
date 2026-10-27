import { formatAmount } from './numberFormat.js';

export const filterFinanceTransactions = (transactions, search) => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return transactions;

    return transactions.filter(transaction => [
        transaction.name,
        transaction.desc,
        transaction.bank,
        transaction.date,
        formatAmount(transaction.amount),
        transaction.type,
        transaction.status,
    ].some(value => String(value ?? '').toLocaleLowerCase().includes(query)));
};
