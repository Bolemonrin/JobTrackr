/** @format */

const SHEET_NAME = "Applications"; // default sheet name
// const SHEET_ID = "1joYJikR27f3lh5HdVgyEw9xvyvkdfqafc7lmaw0vl3Y";
// const TEST_SHEET_NAME = "TEST_1";

// Must match frontend column order (sheetsSchema.ts)
const COLS = [
	"id",
	"companyName",
	"jobTitle",
	"jobStatus",
	"dateApplied",
	"appliedFromName",
	"appliedFromUrl",
	"resumeRef",
	"location",
	"salary",
	"notes",
	"jobUrl",
	"jobId",
	"jobDescription",
];

function getSheetsTable(spreadsheetId) {
	const sheet = SpreadsheetApp.openById(spreadsheetId); // opens spreadsheet by the ID
	let table = sheet.getSheetByName(SHEET_NAME); // opens sheet in spreadsheet by name

	// checks if sheets exits
	// if not create one
	if (!table) table = sheet.insertSheet(SHEET_NAME);

	return table; // return that sheet
}

function checkHeader(spreadsheetId) {
	const sheet = getSheetsTable(spreadsheetId); // gets sheet
	const lastRow = sheet.getLastRow(); // get access to the last row

	// check if last row, is very first row
	// if yes, add COLS for header
	if (lastRow === 0) {
		sheet.appendRow(COLS);
		return;
	}

	const header = sheet.getRange(1, 1, 1, COLS.length).getValues()[0]; // get all data then limits to the first row for the headers
	const headerStr = header.map((v) => String(v || "").trim()); // maps the header, and check if extra space to avoid errors

	// another check for user change if any
	const allBlank = headerStr.every((v) => !v || v === "undefined");
	if (allBlank) {
		sheet.getRange(1, 1, 1, COLS.length).setValues([COLS]);
		return;
	}

	//strict check if header doesn't match COLS
	const matches = COLS.every((c, i) => headerStr[i] === c);
	if (!matches) {
		throw new Error(
			`Header mismatch. Expected:\n${COLS.join(", ")}\nGot:\n${headerStr.join(", ")}`,
		);
	}
}

function findRowById(spreadsheetId, id) {
	const sheet = getSheetsTable(spreadsheetId); // load data
	const lastRow = sheet.getLastRow(); // get the lastrow with data
	if (lastRow < 2) return -1; // check if has more that just header (row 1 = header, row 2+ = data)

	const dataRange = sheet.getRange(2, 1, lastRow - 1, 1); // get all data in sheet
	const idValues = dataRange.getValues().flat(); // flatten result from 2D array to 1D list

	const idx = idValues.findIndex((v) => String(v) === String(id));
	return idx === -1 ? -1 : idx + 2;
}

// create map to find headers fast,
// give each header a key
function headerIndexMap(spreadsheetId) {
	const sheet = getSheetsTable(spreadsheetId); // load data
	const header = sheet.getRange(1, 1, 1, COLS.length).getValues()[0]; // gets the header in very first row
	const map = {}; // create map

	// loop through COLS
	for (let i = 0; i < COLS.length; i++) {
		const key = String(COLS[i] || "").trim();
		if (key) map[key] = i + 1; // 1-based column index
	}
	return map;
}

// Converts an Application-like object to a row array in COLS order.
// Missing fields become "" so append/update never breaks.
function applicationToRow(app) {
	return COLS.map((k) => {
		const v = app && Object.prototype.hasOwnProperty.call(app, k) ? app[k] : "";
		return v === undefined || v === null ? "" : v;
	});
}

// ========CRUD FUNCTIONS========

function addToSheet(spreadsheetId, app) {
	checkHeader(spreadsheetId); // check if header is fine, meaning has all req. fields

	if (!app || !app.id) throw new Error("app must be an object with an id");

	try {
		const sheet = getSheetsTable(spreadsheetId); // get sheet

		const exist = findRowById(spreadsheetId, app.id); // check if id of application alr exits
		if (exist !== -1)
			throw new Error(`Duplicate id "${app.id}" already exists at row ${exist}`); // if so throw an error

		const rowArray = applicationToRow(app); // map each value in app object to COLS
		Logger.log("Writing to spreadsheet: " + sheet.getParent().getId());
		Logger.log("Writing to tab: " + sheet.getName());

		sheet.appendRow(rowArray); // add map to the sheets

		Logger.log(`Added application ID ${app.id}`);
		return true;
	} catch (e) {
		Logger.log(e);
		return false;
	}
}

function rowToDelete(spreadsheetId, id) {
	checkHeader(spreadsheetId); // check if header is fine, meaning has all req. fields

	try {
		const sheet = getSheetsTable(spreadsheetId); // load data
		const row = findRowById(spreadsheetId, id); // find row with id

		if (row === -1) {
			// check if row exists
			Logger.log("Row not found for ID: " + id);
			return false;
		}

		sheet.deleteRow(row); // delete the row at the id
		Logger.log("Row " + row + " has been deleted for ID: " + id);

		return true;
	} catch (e) {
		Logger.log(e);
		return false;
	}
}

// upddates value one at a time
// use case is mostly gonna be for status changes
function updateRow(spreadsheetId, id, updates) {
	checkHeader(spreadsheetId); // check if header is fine, meaning has all req. fields

	try {
		const sheet = getSheetsTable(spreadsheetId); // load data
		const row = findRowById(spreadsheetId, id); // find the id of the row

		if (row === -1) {
			// check if row exists
			Logger.log("Row not found for ID: " + id);
			return false;
		}

		if (!updates || typeof updates !== "object" || Array.isArray(updates))
			// check if updates is an object
			throw new Error("updates must be an object like { jobStatus: 'interview' }");

		const colMap = headerIndexMap(spreadsheetId); // create column map for faster search

		//strict validation: reject unknown keys
		const keys = Object.keys(updates);
		for (const k of keys) {
			if (!colMap[k])
				throw new Error(`Unknown column "${k}". Allowed: ${COLS.join(", ")}`);

			if (k === "id") throw new Error('Updating "id" is not allowed');
		}

		// Batch write: one getRange + setValues for only the columns being updated
		// We write cell-by-cell only for the keys provided (still small & safe).
		for (const k of keys) {
			const col = colMap[k];
			sheet.getRange(row, col).setValue(updates[k]);
		}

		Logger.log(`Updated ID ${id}: ${JSON.stringify(updates)}`);

		return true;
	} catch (e) {
		Logger.log(e);
		return false;
	}
}

// used to replace multiple entries
// use case when user wants to change because of a typo
function replaceRowColumnValue(spreadsheetId, app) {
	checkHeader(spreadsheetId); // check if header is fine, meaning has all req. fields

	if (!app || !app.id) throw new Error("app must be an object with an id");

	try {
		const sheet = getSheetsTable(spreadsheetId); // load data
		const row = findRowById(spreadsheetId, app.id); // find the id of the row

		if (row === -1) {
			// check if row exists
			Logger.log("Row not found for ID: " + app.id);
			return false;
		}

		const rowArray = applicationToRow(app); // conversion of object data to map the values to each column
		sheet.getRange(row, 1, 1, COLS.length).setValues([rowArray]);

		Logger.log(`Replaced row for ID ${app.id}`);
		return true;
	} catch (e) {
		Logger.log(e);
		return false;
	}
}

function readSheetData(spreadsheetId) {
	checkHeader(spreadsheetId); // check if header is fine, meaning has all req. fields
	try {
		const sheet = getSheetsTable(spreadsheetId); // load data
		const lastRow = sheet.getLastRow(); // get the lastrow with data

		if (lastRow < 2) return []; // check if has more that just header (row 1 = header, row 2+ = data)

		const data = sheet.getRange(2, 1, lastRow - 1, COLS.length).getValues(); // get all data in sheet

		return data.map((row) => {
			const obj = {};
			COLS.forEach((col, i) => {
				obj[col] = row[i];
			});

			// add syncStatus since its coming from the sheet
			obj.syncStatus = "synced"; // add syncStatus
			return obj;
		});
	} catch (e) {
		Logger.log(e);
		return [];
	}
}
