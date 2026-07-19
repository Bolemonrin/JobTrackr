/** @format */

const SHARED_TOKEN =
  PropertiesService.getScriptProperties().getProperty("SHARED_TOKEN"); // shared token for authentication

function doPost(event) {
  // Lock the script to prevent race conditions (optional but good for safety)
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for other requests to finish
  } catch (e) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: "Server busy" }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    // event will have all our data
    // so event.postData.content will look like this:
    // {"action":"CREATE", "payload":{}}
    // for that reason we parse to get each instruction in the object
    const json = JSON.parse(event.postData.contents);
    if (json.token != SHARED_TOKEN) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: "error", message: "Unauthorized" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }
    Logger.log("FROM EXT: " + event.postData.contents);

    // instructions for create, update, read, delete
    // in our case create, update, delete, edit application
    const action = json.action;
    const payload = json.payload; // the application data
    const spreadsheetId = json.sheetId; // the id for the spreadSheet

    let result = null;

    switch (action) {
      case "CREATE":
        result = addToSheet(spreadsheetId, payload); // call function for create row in sheet
        break;

      case "DELETE":
        result = rowToDelete(spreadsheetId, payload.id); // call function to delete vow via id
        break;

      case "UPDATE":
        // payload is going to be {id" "...", updates: { whatweareupdating: "content"}}
        result = updateRow(spreadsheetId, payload.id, payload.updates); // function to update needs to var, id and object
        break;

      case "EDIT":
        // payload is the full app object
        result = replaceRowColumnValue(spreadsheetId, payload); // function for editing application in case of manual or scripting error
        break;

      case "READ":
        result = readSheetData(spreadsheetId); // call function to read data
        console.log("READ", result);
        break;

      default:
        throw new Error("Unknown action: " + action);
    }

    // return success
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "success",
        result: result,
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    //return error
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: e.toString(),
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
