import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parsePdfPageItems, parseStatementRows } from './statementImport';

const getExtension = (fileName = '') => fileName.split('.').pop()?.toLowerCase() || '';

const parsePdf = async (buffer, options) => {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber);
        pages.push(await page.getTextContent());
    }
    return parsePdfPageItems(pages, options);
};

const parseSpreadsheet = async (buffer, options) => {
    const XLSX = await import('@e965/xlsx');
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const rows = workbook.SheetNames.flatMap(sheetName => (
        XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
            header: 1,
            raw: true,
            defval: '',
            blankrows: false,
        })
    ));
    return parseStatementRows(rows, options);
};

export const parseStatementFile = async (file, options) => {
    const extension = getExtension(file?.name);
    if (!['pdf', 'xlsx', 'xls', 'csv'].includes(extension)) {
        throw new Error('Unsupported file type. Upload a PDF, Excel (.xlsx/.xls), or CSV statement.');
    }

    try {
        const buffer = await file.arrayBuffer();
        const result = extension === 'pdf'
            ? await parsePdf(buffer, options)
            : await parseSpreadsheet(buffer, options);

        if (result.candidateRows === 0) {
            throw new Error('No transaction table was found. Include columns for Amount and Date, with a header row.');
        }
        if (result.transactions.length === 0) {
            const reasons = Object.entries(result.skippedReasons)
                .map(([reason, count]) => `${count} row${count === 1 ? '' : 's'} with invalid ${reason}`)
                .join(' and ');
            const excluded = result.excludedCount
                ? `${result.excludedCount} suspicious debit transaction${result.excludedCount === 1 ? ' was' : 's were'} excluded`
                : '';
            const details = [reasons, excluded].filter(Boolean).join('; ');
            throw new Error(`No valid transactions were found${details ? ` (${details})` : ''}. Check the statement data.`);
        }
        return result;
    } catch (error) {
        if (error instanceof Error && (
            error.message.startsWith('Unsupported file type')
            || error.message.startsWith('No transaction table')
            || error.message.startsWith('No valid transactions')
        )) {
            throw error;
        }
        throw new Error(
            `Could not read this ${extension.toUpperCase()} statement. Check that the file is valid and not password-protected.`,
            { cause: error },
        );
    }
};
