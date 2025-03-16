// global constants
const MIL = 0.0254; // 1 mil = 0.0254 mm
const SHOW_QUOTE_CHANGES = true;

// global functions
function downloadFile(json, filename) {
	const modifiedData = JSON.stringify(data, null, 2);
	const blob = new Blob([modifiedData], { type: 'application/json' });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function compareObjects(oldObj, newObj, path = '') {
	// Compare new against old
	for (let key in newObj) {
		const currentPath = path ? `${path}.${key}` : key;

		if (!(key in oldObj)) {
			console.log(`+ Added ${currentPath}: ${JSON.stringify(newObj[key])}`);
		} else if (typeof newObj[key] === 'object' && newObj[key] !== null &&
			typeof oldObj[key] === 'object' && oldObj[key] !== null) {
			compareObjects(oldObj[key], newObj[key], currentPath);
		} else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
			console.log(`~ Changed ${currentPath}: ${JSON.stringify(oldObj[key])} → ${JSON.stringify(newObj[key])}`);
		}
	}

	// Check for removed keys
	for (let key in oldObj) {
		const currentPath = path ? `${path}.${key}` : key;
		if (!(key in newObj)) {
			console.log(`- Removed ${currentPath}: ${JSON.stringify(oldObj[key])}`);
		}
	}
}

let services = {};

/**
 * Registers a new service for handling requests
 * @function registerService
 * @param {string} name - The name of the service
 * @param {string} url - The URL to monitor
 * @param {Function} handler - The function to handle the request
 * @param {Function} decoder - The decoder function for the service
 */
function registerService(name, url, handler, handler_status, delete_cache, decoder) {
	services[name] = {
		"url": url,
		"handler": handler,
		"handler_status": handler_status,
		"delete_cache": delete_cache,
		"decoder": decoder
	};
	console.log(`Service registered: ${name}`);
}

let edas = {};
function registerEda(name, encoder) {
	edas[name] = { "name": name, "encoder": encoder };
}

//browser.runtime.onInstalled.addListener(() => {
//    console.log('Extension installed');
//});

//browser.runtime.onStartup.addListener(() => {
//    console.log('Extension loaded');
//});

browser.webRequest.onBeforeRequest.addListener(
	(details) => {
		for (let service in services) {
			if (details.url === services[service].url) {
				services[service].handler(details);
			}
		}
	},
	{
		urls: ["<all_urls>"],
		types: ["xmlhttprequest"] // Filters specific request types
	},
	["blocking", "requestBody"]  // Ensure requestBody is enabled to capture POST data
);

// template format
const json = {
	"log": {
		"raw": null, // raw data that is used to generate rules
		"warnings": [],
		"errors": []
	},
	"pro": {
		"board": {
			"design_settings": {
				"defaults": {},
				"rules": {}
			}
		}
	},
	"dru": "",
	"pcb": {
		"layers": {},
		"setup": {
			"stackup": {
				"copper_finish": "\"HASL SnPb\"",
				"edge_plating": "\"no\"",
				"edge_connector": "\"no\"",
				"layer": [
					{ "\"F.SilkS\"": { "type": "\"silk screen\"" } },
					{ "\"F.Paste\"": { "type": "\"solder paste\"" } },
					{ "\"F.Mask\"": { "type": "\"solder mask\"", "thickness": 0.03048, "color": "\"green\"" } },
					{ "\"B.Mask\"": { "type": "\"solder mask\"", "thickness": 0.03048, "color": "\"green\"" } },
					{ "\"B.Paste\"": { "type": "\"solder paste\"" } },
					{ "\"B.SilkS\"": { "type": "\"silk screen\"" } }
				]
			},
			"solder_mask_min_width": "0"
		}
	}
}

browser.action.onClicked.addListener((tab) => {
	browser.windows.create({
		url: "popup.html",
		type: "popup",
		width: 700,
		height: 900
	});
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action == "status") {
		data = {
			"services": {},
			"edas": {}
		};

		const statusPromises = Object.keys(services).map(service =>
			services[service].handler_status().then(status => {
				data.services[service] = status;
			}).catch(err => {
				console.error(`Failed to get status for ${service}:`, err);
			})
		);

		for (let eda in edas) {
			data.edas[eda] = {};
		}

		Promise.all(statusPromises).then(() => {
			sendResponse({ status: 'success', data: data });
		});

		return true; // Required to indicate async response
	}
	if (message.action == "generate") {
		const selectedServices = message.services;
		const selectedEdas = message.edas;

		services[selectedServices[0]].decoder(JSON.parse(JSON.stringify(json))).then((decodedData) => {
			if (decodedData.log.errors.length > 0) {
				sendResponse({
					status: 'error',
					data: {
						"service": decodedData.log
					}
				});
			} else {
				edas[selectedEdas[0]].encoder(decodedData).then((encodedData) => {
					if (false /*encodedData.log.errors.length > 0*/) {
						sendResponse({
							status: 'error',
							data: {
								"service": encodedData.log,
								"eda": decodedData.log
							}
						});
					} else {
						sendResponse({
							status: 'success',
							data: {
								"service": decodedData.log
								//"eda": encodedData.log
							}
						});
					}
				});
			}
		});

		return true; // Required to indicate async response
	}
	if (message.action == "delete") {
		console.log('Deleting cache for', message.service);

		services[message.service].delete_cache().then(() => {
			sendResponse({
				status: 'success'
			});
		});

		return true; // Required to indicate async response
	}
});