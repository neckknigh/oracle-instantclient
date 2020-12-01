const fs = require("fs");
const axios = require("axios");
const extractZip = require("extract-zip");
const path = require("path")

const BASE_URL = "https://download.oracle.com/otn_software";
const CLIENT_TYPE = "instantclient-basiclite";
const ZIP = "instantclient.zip";
const EXEC_FOLDER = "bin"

const paths = {
	"win32": `${BASE_URL}/nt/instantclient/19600/${CLIENT_TYPE}-windows.x64-19.6.0.0.0dbru.zip`,
	"linux64": `${BASE_URL}/linux/instantclient/19600/${CLIENT_TYPE}-linux.x64-19.6.0.0.0dbru.zip`,
	"mac64": `${BASE_URL}/mac/instantclient/198000/${CLIENT_TYPE}-macos.x64-19.8.0.0.0dbru.zip`
}

const getBinaryFolder = () => path.resolve(process.cwd(), EXEC_FOLDER);

const validatePlatform = () => {
	let thePlatform = process.platform;
	if (thePlatform === "linux") {
		if (process.arch === "arm64" || process.arch === "x64") {
			thePlatform += "64";
		} else {
			console.log("Only Linux 64 bits supported.");
			process.exit(1);
		}
	} else if (thePlatform === "darwin" || thePlatform === "freebsd") {
		if (process.arch === "x64") {
			thePlatform = "mac64";
		} else {
			console.log("Only Mac 64 bits supported.");
			process.exit(1);
		}
	} else if (thePlatform !== "win32") {
		console.log(
			"Unexpected platform or architecture:",
			process.platform,
			process.arch
		);
		process.exit(1);
	}
	return thePlatform;
}


async function requestBinary(url, filePath) {
	const BYTE = 1024
	console.log(`Downloading the instant client from: ${url}`)
	const outFile = fs.createWriteStream(filePath);
	let response;
	try {
		response = await axios.get(url, {
			responseType: "stream"
		})
	} catch (error) {
		if (error && error.response) {
			if (error.response.status)
				console.error("Error status code:", error.response.status);
			if (error.response.data) {
				error.response.data.on("data", (data) =>
					console.error(data.toString("utf8"))
				);
				await new Promise((resolve) => {
					error.response.data.on("finish", resolve);
					error.response.data.on("error", resolve);
				});
			}
		}
		throw new Error("Error with http(s) request: " + error);
	}
	let count = 0;
	let notifiedCount = 0;
	response.data.on("data", (data) => {
		count += data.length;
		if (count - notifiedCount > BYTE * BYTE) {
			console.log("Received " + Math.floor(count / BYTE) + "K...");
			notifiedCount = count;
		}
	});
	response.data.on("end", () =>
		console.log("Received " + Math.floor(count / BYTE) + "K total.")
	);
	const pipe = response.data.pipe(outFile);
	await new Promise((resolve, reject) => {
		pipe.on("finish", resolve);
		pipe.on("error", reject);
	});
}

async function downloadFile() {
	const destination = path.resolve(EXEC_FOLDER, ZIP);
	const platform = validatePlatform();
	console.log(`Operative systems is ${platform}`)
	await requestBinary(paths[platform], destination)
}

async function extractDownload() {
	const dirToExtractTo = path.resolve(process.cwd(), EXEC_FOLDER)
	console.log(`Extracting zip contents to ${dirToExtractTo}.`);
	try {
		await extractZip(path.resolve(dirToExtractTo, ZIP), {
			dir: dirToExtractTo
		});
	} catch (error) {
		throw new Error("Error extracting archive: " + error);
	}
}

function removeZip() {
	fs.unlinkSync(path.resolve(getBinaryFolder(), ZIP))
}


const getDirectories = source =>
	fs.readdirSync(source, {
		withFileTypes: true
	})
	.filter(dirent => dirent.isDirectory())
	.map(dirent => dirent.name)

function renameFolder() {
	const folder = getDirectories(getBinaryFolder())[0]
	fs.renameSync(path.resolve(getBinaryFolder(), folder), path.resolve(getBinaryFolder(), "instantclient"))
}

function createBinFolder() {
	fs.mkdirSync(getBinaryFolder())
}


const beginInstallation = async () => {
	await createBinFolder()
	await downloadFile();
	await extractDownload()
	renameFolder()
	removeZip()
}

beginInstallation()