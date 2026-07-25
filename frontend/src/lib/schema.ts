/** @format */
import type { Application } from "../types";

export const APPLICATION_COLUMNS = [
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

export const applicationToRow = (app: Application) => [
	app.id,
	app.companyName,
	app.jobTitle,
	app.jobStatus,
	app.dateApplied,
	app.appliedFromName,
	app.appliedFromUrl,
	app.resumeRef,
	app.location ?? "",
	app.salary ?? "",
	app.notes ?? "",
	app.jobUrl ?? "",
	app.jobId ?? "",
	app.jobDescription ?? "",
];
